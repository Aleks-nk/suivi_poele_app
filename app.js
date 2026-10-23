/* Carnet de bord — Poêle à granulés
   Les données vivent dans Supabase (voir supabase-config.js).
   Réglages d'affichage (capacité de la jauge) restent en local. */

const SETTINGS_KEY = "poele_settings_v1";

let DATA = { sessions: [], achats: [], stock: [] };
let SETTINGS = null;
let charts = {};

/* ---------------- Settings (local, juste l'affichage) ---------------- */

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  return { capacite: 20 };
}
function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

/* ---------------- Helpers ---------------- */

function uid() { return Math.random().toString(36).slice(2, 10); }
function fmtDate(iso) { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function num(v, digits = 1) { if (v === null || v === undefined || v === "" || isNaN(v)) return null; return Number(Number(v).toFixed(digits)); }
function sortByDateAsc(arr) { return [...arr].sort((a, b) => (a.date || "").localeCompare(b.date || "")); }
function sortByDateDesc(arr) { return [...arr].sort((a, b) => (b.date || "").localeCompare(a.date || "")); }
function sortChrono(arr) {
  return [...arr].sort((a, b) => {
    const d = (a.date || "").localeCompare(b.date || "");
    if (d !== 0) return d;
    return (a.seq || 0) - (b.seq || 0);
  });
}
function sortSessionsDesc(arr) {
  // du plus récent au plus ancien : date, puis heure d'allumage, puis ordre d'ajout
  return [...arr].sort((a, b) => {
    const d = (b.date || "").localeCompare(a.date || "");
    if (d !== 0) return d;
    const t = (b.allumage || "").localeCompare(a.allumage || "");
    if (t !== 0) return t;
    return (b.seq || 0) - (a.seq || 0);
  });
}
function monthKey(iso) { return iso ? iso.slice(0, 7) : null; }

function computeDuration(allumage, arret) {
  if (!allumage || !arret) return { h: null, label: null };
  const [ah, am] = allumage.split(":").map(Number);
  const [rh, rm] = arret.split(":").map(Number);
  if ([ah, am, rh, rm].some((n) => isNaN(n))) return { h: null, label: null };
  let diff = (rh * 60 + rm) - (ah * 60 + am);
  if (diff <= 0) diff += 24 * 60;
  const hh = Math.floor(diff / 60), mm = diff % 60;
  return { h: num(diff / 60, 2), label: `${hh}h${mm.toString().padStart(2, "0")}` };
}

function showSyncStatus(msg, isError = false) {
  const el = document.getElementById("syncStatus");
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? "var(--bad)" : "var(--text-muted)";
  if (!isError) setTimeout(() => { if (el.textContent === msg) el.textContent = ""; }, 2500);
}

/* ---------------- Supabase : chargement ---------------- */

function mapRow(row) {
  return Object.assign({}, row, { _id: row.id, seq: new Date(row.created_at).getTime() });
}

async function reloadAll(isRetry = false) {
  showSyncStatus("Synchronisation…");
  try {
    const [s, a, st] = await Promise.all([
      db.from("sessions").select("*"),
      db.from("achats").select("*"),
      db.from("stock").select("*"),
    ]);
    if (s.error) throw s.error;
    if (a.error) throw a.error;
    if (st.error) throw st.error;
    DATA = {
      sessions: s.data.map(mapRow),
      achats: a.data.map(mapRow),
      stock: st.data.map(mapRow),
    };
    showSyncStatus("À jour");
    renderAll();
  } catch (err) {
    console.error(err);

    const isAuthError = err && (err.status === 401 || err.code === "PGRST301" || /jwt|token/i.test(err.message || ""));
    if (isAuthError) {
      showSyncStatus("Session expirée — reconnexion nécessaire.", true);
      await db.auth.signOut();
      await requireAuth(); // ré-affiche l'écran de connexion
      return;
    }

    if (!isRetry) {
      // premier échec probable = petit souci réseau au tout premier chargement : on retente une fois
      showSyncStatus("Nouvelle tentative de connexion…");
      setTimeout(() => reloadAll(true), 1500);
      return;
    }
    showSyncStatus("Erreur de connexion à Supabase — vérifie supabase-config.js et le script SQL (voir console F12).", true);
  }
}

/* ---------------- Tabs ---------------- */

function activateTab(targetId) {
  document.querySelectorAll("nav.tabs button").forEach((b) => b.classList.toggle("active", b.dataset.target === targetId));
  document.querySelectorAll("section.panel").forEach((p) => p.classList.toggle("active", p.id === targetId));
  if (targetId === "panel-dashboard") renderCharts();
}

function initTabs() {
  document.querySelectorAll("nav.tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      // quitter l'onglet Sessions en plein milieu d'une modification = on annule la modification
      if (editingId && btn.dataset.target !== "panel-sessions") cancelEditSession(false);
      activateTab(btn.dataset.target);
    });
  });
}

/* ---------------- Modification d'une session ---------------- */

let editingId = null;

function setToggle(id, on) { document.getElementById(id).classList.toggle("active", !!on); }

function startEditSession(id) {
  const s = DATA.sessions.find((x) => x._id === id);
  if (!s) return;
  editingId = id;
  const f = document.getElementById("formSession");
  f.date.value = s.date || todayISO();
  f.allumage.value = s.allumage || "";
  f.arret.value = s.arret || "";
  f.puissance.value = s.puissance ?? "";
  f.temp_demandee.value = s.temp_demandee ?? "";
  ["bas", "o", "z", "n"].forEach((k) => {
    f["temp_ambiante_" + k].value = s["temp_ambiante_" + k] ?? "";
    f["temp_arret_" + k].value = s["temp_arret_" + k] ?? "";
  });
  f.commentaires.value = s.commentaires || "";
  setToggle("btnNettoyage", s.nettoyage);
  setToggle("btnCharge", s.charge);
  f.allumage.dispatchEvent(new Event("input")); // recalcule l'affichage de la durée

  document.getElementById("formSessionTitle").textContent = "Modifier la session";
  const banner = document.getElementById("editBanner");
  banner.style.display = "block";
  banner.textContent = `Modification de la session du ${fmtDate(s.date)}${s.allumage ? " (" + s.allumage + ")" : ""}.`;
  document.getElementById("btnSubmitSession").textContent = "Enregistrer les modifications";
  document.getElementById("btnCancelEdit").style.display = "";
  activateTab("panel-sessions");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelEditSession(goBackToHistory = true) {
  editingId = null;
  const f = document.getElementById("formSession");
  f.reset();
  setDefaultDate(f);
  setToggle("btnNettoyage", false);
  setToggle("btnCharge", false);
  document.getElementById("dureeDisplay").textContent = "renseigne l'allumage et l'arrêt";
  document.getElementById("formSessionTitle").textContent = "Ajouter une session";
  document.getElementById("editBanner").style.display = "none";
  document.getElementById("btnSubmitSession").textContent = "+ Ajouter la session";
  document.getElementById("btnCancelEdit").style.display = "none";
  if (goBackToHistory) activateTab("panel-historique");
}

/* ---------------- Stock helpers ---------------- */

function currentStock() {
  const s = sortChrono(DATA.stock);
  return s.length ? Number(s[s.length - 1].stock_sacs) : 0;
}

async function pushStockEntry(date, value) {
  const { error } = await db.from("stock").insert({ date, stock_sacs: num(value, 2) });
  if (error) { console.error(error); showSyncStatus("Erreur d'écriture stock", true); }
}

function estimateAutonomy() {
  const s = sortChrono(DATA.stock);
  if (s.length < 2) return null;
  let totalConso = 0, totalJours = 0;
  for (let i = 1; i < s.length; i++) {
    const prev = s[i - 1], cur = s[i];
    const delta = Number(cur.stock_sacs) - Number(prev.stock_sacs);
    if (delta < 0) {
      const days = (new Date(cur.date) - new Date(prev.date)) / 86400000;
      if (days > 0) { totalConso += -delta; totalJours += days; }
    }
  }
  if (totalJours === 0 || totalConso === 0) return null;
  const rate = totalConso / totalJours;
  const stock = currentStock();
  return { rate, joursRestants: rate > 0 ? Math.round(stock / rate) : null };
}

/* ---------------- Gauge & header stats ---------------- */

function renderGauge() {
  const stock = currentStock();
  const capacite = SETTINGS.capacite || 20;
  const pct = Math.max(0, Math.min(1, stock / capacite));
  const r = 40, c = 2 * Math.PI * r;
  const fill = document.getElementById("gaugeFill");
  fill.setAttribute("stroke-dasharray", `${c}`);
  fill.setAttribute("stroke-dashoffset", `${c * (1 - pct)}`);
  document.getElementById("gaugeNum").textContent = num(stock, 1);

  const auto = estimateAutonomy();
  const el = document.getElementById("autonomyValue");
  if (!auto || auto.joursRestants === null) {
    el.textContent = "pas assez de données";
    el.className = "value";
  } else {
    el.textContent = `≈ ${auto.joursRestants} j (${num(auto.rate, 2)} sac/j)`;
    el.className = "value " + (auto.joursRestants > 30 ? "autonomy-ok" : auto.joursRestants > 10 ? "autonomy-warn" : "autonomy-bad");
  }

  const chrono = sortChrono(DATA.stock);
  const lastStockEntry = chrono.length ? chrono[chrono.length - 1] : null;
  document.getElementById("stockDate").textContent = lastStockEntry ? fmtDate(lastStockEntry.date) : "—";

  const bigStock = document.getElementById("stockCurrentBig");
  if (bigStock) bigStock.textContent = num(stock, 1);
}

/* ---------------- Dashboard stats + charts ---------------- */

function renderStatCards() {
  const sessions = DATA.sessions;
  const nbSessions = sessions.length;
  const totalHeures = sessions.reduce((sum, s) => sum + (Number(s.duree_h) || 0), 0);
  const totalAchats = DATA.achats.reduce((sum, a) => sum + (Number(a.prix_total) || 0), 0);
  const totalSacsAchetes = DATA.achats.reduce((sum, a) => sum + (Number(a.nb_sacs) || 0), 0);
  const prixMoyenSac = totalSacsAchetes ? totalAchats / totalSacsAchetes : null;
  const temps = sessions.map((s) => s.temp_ambiante_bas).filter((t) => t !== null && t !== undefined && !isNaN(t));
  const tempMoy = temps.length ? temps.reduce((a, b) => a + Number(b), 0) / temps.length : null;

  const grid = document.getElementById("statGrid");
  grid.innerHTML = "";
  const cards = [
    { label: "Sessions enregistrées", value: nbSessions, sub: "depuis le début du suivi" },
    { label: "Heures de chauffe", value: num(totalHeures, 0) + " h", sub: "cumul de toutes les sessions" },
    { label: "Dépensé en granulés", value: num(totalAchats, 2) + " €", sub: `${num(totalSacsAchetes, 0)} sacs achetés` },
    { label: "Prix moyen du sac", value: prixMoyenSac ? num(prixMoyenSac, 2) + " €" : "—", sub: "toutes enseignes confondues" },
    { label: "Temp. ambiante moy.", value: tempMoy ? num(tempMoy, 1) + " °C" : "—", sub: "mesurée en fin de session" },
  ];
  cards.forEach((c) => {
    const div = document.createElement("div");
    div.className = "stat-card";
    div.innerHTML = `<div class="label">${c.label}</div><div class="value">${c.value}</div><div class="sub">${c.sub}</div>`;
    grid.appendChild(div);
  });
}

function chartColors() {
  return {
    ember: "#ff6a33", emberFill: "rgba(255,106,51,0.15)",
    gold: "#d99a4e", goldFill: "rgba(217,154,78,0.15)",
    smoke: "#6f8a94", smokeFill: "rgba(111,138,148,0.15)",
    grid: "rgba(255,255,255,0.06)", text: "#a89684",
  };
}

function baseChartOptions(extra = {}) {
  const c = chartColors();
  return Object.assign({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: c.text, font: { family: "Inter", size: 11 } } } },
    scales: {
      x: { ticks: { color: c.text, font: { size: 10.5 } }, grid: { color: c.grid } },
      y: { ticks: { color: c.text, font: { size: 10.5 } }, grid: { color: c.grid } },
    },
  }, extra);
}

function destroyChart(key) { if (charts[key]) { charts[key].destroy(); delete charts[key]; } }

function renderCharts() {
  const c = chartColors();

  destroyChart("stock");
  const stockSorted = sortChrono(DATA.stock);
  charts.stock = new Chart(document.getElementById("chartStock"), {
    type: "line",
    data: { labels: stockSorted.map((s) => fmtDate(s.date)), datasets: [{ label: "Stock (sacs)", data: stockSorted.map((s) => s.stock_sacs), borderColor: c.ember, backgroundColor: c.emberFill, fill: true, tension: 0.25, pointRadius: 2 }] },
    options: baseChartOptions(),
  });

  destroyChart("sessions");
  const byMonth = {};
  DATA.sessions.forEach((s) => { const mk = monthKey(s.date); if (mk) byMonth[mk] = (byMonth[mk] || 0) + 1; });
  const months = Object.keys(byMonth).sort();
  charts.sessions = new Chart(document.getElementById("chartSessions"), {
    type: "bar",
    data: { labels: months, datasets: [{ label: "Sessions", data: months.map((m) => byMonth[m]), backgroundColor: c.gold }] },
    options: baseChartOptions(),
  });

  destroyChart("temp");
  const tempByMonth = {};
  DATA.sessions.forEach((s) => {
    const mk = monthKey(s.date);
    if (!mk || s.temp_ambiante_bas === null || s.temp_ambiante_bas === undefined || isNaN(s.temp_ambiante_bas)) return;
    (tempByMonth[mk] = tempByMonth[mk] || []).push(Number(s.temp_ambiante_bas));
  });
  const tempMonths = Object.keys(tempByMonth).sort();
  charts.temp = new Chart(document.getElementById("chartTemp"), {
    type: "line",
    data: { labels: tempMonths, datasets: [{ label: "Temp. ambiante moyenne (°C)", data: tempMonths.map((m) => num(tempByMonth[m].reduce((a, b) => a + b, 0) / tempByMonth[m].length, 1)), borderColor: c.smoke, backgroundColor: c.smokeFill, fill: true, tension: 0.25, pointRadius: 2 }] },
    options: baseChartOptions(),
  });

  destroyChart("cout");
  const coutByMonth = {};
  DATA.achats.forEach((a) => { const mk = monthKey(a.date); if (mk) coutByMonth[mk] = (coutByMonth[mk] || 0) + (Number(a.prix_total) || 0); });
  const coutMonths = Object.keys(coutByMonth).sort();
  charts.cout = new Chart(document.getElementById("chartCout"), {
    type: "bar",
    data: { labels: coutMonths, datasets: [{ label: "Coût (€)", data: coutMonths.map((m) => num(coutByMonth[m], 2)), backgroundColor: c.gold }] },
    options: baseChartOptions(),
  });

  destroyChart("sacsConso");
  const stockChrono = sortChrono(DATA.stock);
  const sacsByMonth = {};
  for (let i = 1; i < stockChrono.length; i++) {
    const delta = Number(stockChrono[i].stock_sacs) - Number(stockChrono[i - 1].stock_sacs);
    if (delta < 0) { const mk = monthKey(stockChrono[i].date); if (mk) sacsByMonth[mk] = (sacsByMonth[mk] || 0) + (-delta); }
  }
  const sacsMonths = Object.keys(sacsByMonth).sort();
  charts.sacsConso = new Chart(document.getElementById("chartSacsConso"), {
    type: "bar",
    data: { labels: sacsMonths, datasets: [{ label: "Sacs consommés", data: sacsMonths.map((m) => num(sacsByMonth[m], 1)), backgroundColor: c.ember }] },
    options: baseChartOptions(),
  });
}

/* ---------------- Sessions (cartes) ---------------- */

function tempVal(v) {
  return (v === null || v === undefined || v === "" || isNaN(v)) ? null : Number(v);
}

// Grille par pièce : température au début, à l'arrêt, et écart (Δ)
function tempGridHtml(s) {
  const rooms = [["bas", "Bas"], ["o", "Ch. O"], ["z", "Ch. Z"], ["n", "Ch. N"]];
  const cols = rooms
    .map(([k, label]) => ({ label, start: tempVal(s["temp_ambiante_" + k]), stop: tempVal(s["temp_arret_" + k]) }))
    .filter((c) => c.start !== null || c.stop !== null);
  if (!cols.length) return "";
  const hasStop = cols.some((c) => c.stop !== null);
  const cell = (v) => (v === null ? '<div class="cell empty">—</div>' : `<div class="cell">${v}°</div>`);

  let html = `<div class="temp-grid" style="grid-template-columns: 54px repeat(${cols.length}, minmax(0, 1fr));">`;
  html += "<div></div>" + cols.map((c) => `<div class="th">${c.label}</div>`).join("");
  html += '<div class="rl">Début</div>' + cols.map((c) => cell(c.start)).join("");
  if (hasStop) {
    html += '<div class="rl">Arrêt</div>' + cols.map((c) => cell(c.stop)).join("");
    html += '<div class="rl">Δ</div>' + cols.map((c) => {
      if (c.start === null || c.stop === null) return '<div class="cell delta zero">—</div>';
      const d = Number((c.stop - c.start).toFixed(1));
      const cls = d > 0 ? "pos" : d < 0 ? "neg" : "zero";
      const txt = d > 0 ? `+${d}°` : d < 0 ? `−${Math.abs(d)}°` : "0°";
      return `<div class="cell delta ${cls}">${txt}</div>`;
    }).join("");
  }
  return html + "</div>";
}

function renderSessionsList(filter = "") {
  const list = document.getElementById("sessionList");
  list.innerHTML = "";
  const rows = sortSessionsDesc(DATA.sessions).filter((s) => !filter || JSON.stringify(s).toLowerCase().includes(filter.toLowerCase()));
  document.getElementById("sessionsEmpty").style.display = rows.length ? "none" : "block";

  rows.forEach((s) => {
    const div = document.createElement("div");
    div.className = "session-card";
    const open = isOpenSession(s);
    const dur = open ? "en cours" : (s.duree_label || (s.duree_h ? `${s.duree_h} h` : "—"));
    const pills = [
      open ? '<span class="pill" style="background:var(--ember); color:#1a0f08;">🔥 En cours</span>' : "",
      s.nettoyage ? '<span class="pill" style="background:var(--smoke); color:#0d1416;">🧹 Nettoyage</span>' : "",
      s.charge ? '<span class="pill" style="background:var(--gold); color:#1a0f08;">🔄 Charge</span>' : "",
    ].join(" ");
    const reglages = [];
    if (s.puissance) reglages.push(`Puissance ${s.puissance}`);
    if (tempVal(s.temp_demandee) !== null) reglages.push(`${tempVal(s.temp_demandee)}°`);

    div.innerHTML = `
      <div class="session-card-head">
        <span class="sdate">${fmtDate(s.date)}</span>
        <span class="stimes">${s.allumage || "?"} → ${s.arret || (open ? "en cours" : "?")}</span>
        <span class="sduree">${dur}</span>
        ${reglages.length ? `<span class="spuiss">${reglages.join(" · ")}</span>` : ""}
        ${pills}
        <span class="spacer"></span>
        <span class="row-actions"><button class="edit" title="Modifier" data-edit="${s._id}">✎</button><button title="Supprimer" data-id="${s._id}">✕</button></span>
      </div>
      ${tempGridHtml(s)}
      ${s.commentaires ? `<div class="session-comment">${s.commentaires}</div>` : ""}
    `;
    list.appendChild(div);
  });

  list.querySelectorAll("button[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => startEditSession(btn.dataset.edit));
  });

  list.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Supprimer cette session ?")) return;
      const { error } = await db.from("sessions").delete().eq("id", btn.dataset.id);
      if (error) { console.error(error); showSyncStatus("Erreur de suppression", true); return; }
      reloadAll();
    });
  });
}

/* ---------------- Achats & stock tables ---------------- */

function renderAchatsTable() {
  const tbody = document.querySelector("#achatsTable tbody");
  tbody.innerHTML = "";
  const rows = sortByDateDesc(DATA.achats);
  document.getElementById("achatsEmpty").style.display = rows.length ? "none" : "block";
  rows.forEach((a) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(a.date)}</td><td>${a.magasin || "—"}</td><td>${a.marque || "—"}</td>
      <td>${a.nb_sacs ?? "—"}</td><td>${a.prix_sac ?? "—"} €</td>
      <td><span class="pill">${num(a.prix_total, 2) ?? "—"} €</span></td>
      <td class="wrap-cell">${a.note || ""}</td>
      <td class="row-actions"><button title="Supprimer" data-id="${a._id}">✕</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Supprimer cet achat ? (le stock ajouté par cet achat ne sera pas retiré automatiquement)")) return;
      const { error } = await db.from("achats").delete().eq("id", btn.dataset.id);
      if (error) { console.error(error); showSyncStatus("Erreur de suppression", true); return; }
      reloadAll();
    });
  });
}

function renderStockTable() {
  const tbody = document.querySelector("#stockTable tbody");
  tbody.innerHTML = "";
  const rows = sortChrono(DATA.stock).reverse();
  document.getElementById("stockEmpty").style.display = rows.length ? "none" : "block";
  rows.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${fmtDate(s.date)}</td><td><span class="pill">${s.stock_sacs} sacs</span></td><td class="row-actions"><button title="Supprimer" data-id="${s._id}">✕</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Supprimer ce relevé de stock ?")) return;
      const { error } = await db.from("stock").delete().eq("id", btn.dataset.id);
      if (error) { console.error(error); showSyncStatus("Erreur de suppression", true); return; }
      reloadAll();
    });
  });
}

/* ---------------- Forms ---------------- */

function initForms() {
  const form = document.getElementById("formSession");
  const allumageInput = form.allumage, arretInput = form.arret;
  const dureeDisplay = document.getElementById("dureeDisplay");
  let currentDuree = { h: null, label: null };

  function updateDuree() {
    currentDuree = computeDuration(allumageInput.value, arretInput.value);
    dureeDisplay.textContent = currentDuree.label ? `${currentDuree.label} (${currentDuree.h} h)` : "renseigne l'allumage et l'arrêt";
  }
  allumageInput.addEventListener("input", updateDuree);
  arretInput.addEventListener("input", updateDuree);

  document.querySelectorAll(".toggle-btn[data-role]").forEach((btn) => {
    btn.addEventListener("click", () => btn.classList.toggle("active"));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    updateDuree();
    const entry = {
      date: f.date.value || todayISO(),
      allumage: f.allumage.value || null,
      arret: f.arret.value || null,
      duree_h: currentDuree.h,
      duree_label: currentDuree.label,
      puissance: f.puissance.value ? Number(f.puissance.value) : null,
      temp_demandee: f.temp_demandee.value ? Number(f.temp_demandee.value) : null,
      temp_ambiante_bas: f.temp_ambiante_bas.value ? Number(f.temp_ambiante_bas.value) : null,
      temp_ambiante_o: f.temp_ambiante_o.value ? Number(f.temp_ambiante_o.value) : null,
      temp_ambiante_z: f.temp_ambiante_z.value ? Number(f.temp_ambiante_z.value) : null,
      temp_ambiante_n: f.temp_ambiante_n.value ? Number(f.temp_ambiante_n.value) : null,
      temp_arret_bas: f.temp_arret_bas.value ? Number(f.temp_arret_bas.value) : null,
      temp_arret_o: f.temp_arret_o.value ? Number(f.temp_arret_o.value) : null,
      temp_arret_z: f.temp_arret_z.value ? Number(f.temp_arret_z.value) : null,
      temp_arret_n: f.temp_arret_n.value ? Number(f.temp_arret_n.value) : null,
      nettoyage: document.getElementById("btnNettoyage").classList.contains("active"),
      charge: document.getElementById("btnCharge").classList.contains("active"),
      commentaires: f.commentaires.value || null,
    };
    if (editingId) {
      const { error } = await db.from("sessions").update(entry).eq("id", editingId);
      if (error) { console.error(error); showSyncStatus("Erreur de modification de la session", true); return; }
      cancelEditSession(true);
      reloadAll();
      return;
    }
    const { error } = await db.from("sessions").insert(entry);
    if (error) { console.error(error); showSyncStatus("Erreur d'ajout de la session", true); return; }
    f.reset();
    setDefaultDate(f);
    dureeDisplay.textContent = "renseigne l'allumage et l'arrêt";
    document.getElementById("btnNettoyage").classList.remove("active");
    document.getElementById("btnCharge").classList.remove("active");
    reloadAll();
  });

  document.getElementById("btnCancelEdit").addEventListener("click", () => cancelEditSession(true));

  document.getElementById("formAchat").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const nb = Number(f.nb_sacs.value) || 0;
    const prixSac = Number(f.prix_sac.value) || 0;
    const date = f.date.value || todayISO();
    const entry = {
      date, magasin: f.magasin.value || null, marque: f.marque.value || null,
      nb_sacs: nb, prix_sac: prixSac, prix_total: num(nb * prixSac, 2), note: f.note.value || null,
    };
    const { error } = await db.from("achats").insert(entry);
    if (error) { console.error(error); showSyncStatus("Erreur d'ajout de l'achat", true); return; }
    if (nb > 0) await pushStockEntry(date, currentStock() + nb);
    f.reset();
    setDefaultDate(f);
    reloadAll();
  });

  document.getElementById("formStock").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    await pushStockEntry(f.date.value || todayISO(), Number(f.stock_sacs.value));
    f.reset();
    setDefaultDate(f);
    reloadAll();
  });

  document.getElementById("btnMoinsUnSac").addEventListener("click", async () => {
    await pushStockEntry(todayISO(), Math.max(0, currentStock() - 1));
    reloadAll();
  });

  document.getElementById("searchSessions").addEventListener("input", (e) => renderSessionsList(e.target.value));
}

function setDefaultDate(form) { if (form.date) form.date.value = todayISO(); }

/* ---------------- Settings / export ---------------- */

function initSettings() {
  const capInput = document.getElementById("capaciteInput");
  capInput.value = SETTINGS.capacite;
  capInput.addEventListener("change", () => {
    SETTINGS.capacite = Number(capInput.value) || 20;
    saveSettings(SETTINGS);
    renderGauge();
  });

  document.getElementById("btnExportJson").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(DATA, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `poele-carnet-${todayISO()}.json`;
    a.click();
  });

  document.getElementById("btnExportExcel").addEventListener("click", exportExcel);

  document.getElementById("btnResetAll").addEventListener("click", async () => {
    if (!confirm("Supprimer DÉFINITIVEMENT toutes les sessions, achats et relevés de stock dans Supabase ? Cette action est irréversible.")) return;
    if (!confirm("Confirme une deuxième fois : tout supprimer ?")) return;
    await Promise.all([
      db.from("sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      db.from("achats").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      db.from("stock").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
    ]);
    reloadAll();
  });
}

function exportExcel() {
  const sessionsRows = DATA.sessions.map((s) => ({
    "Date": fmtDate(s.date), "Allumage": s.allumage, "Arrêt": s.arret,
    "Durée": s.duree_label || s.duree_h, "Puissance": s.puissance, "Temp. demandée": s.temp_demandee,
    "Temp. ambiante bas": s.temp_ambiante_bas, "Temp. ambiante O": s.temp_ambiante_o,
    "Temp. ambiante Z": s.temp_ambiante_z, "Temp. ambiante N": s.temp_ambiante_n,
    "Temp. arrêt bas": s.temp_arret_bas, "Temp. arrêt O": s.temp_arret_o,
    "Temp. arrêt Z": s.temp_arret_z, "Temp. arrêt N": s.temp_arret_n,
    "Nettoyage": s.nettoyage ? "Oui" : "", "Charge": s.charge ? "Oui" : "", "Commentaires": s.commentaires || "",
  }));
  const achatsRows = DATA.achats.map((a) => ({ "Date": fmtDate(a.date), "Magasin": a.magasin, "Marque": a.marque, "Nombre de sacs": a.nb_sacs, "Prix/sac": a.prix_sac, "Prix total": a.prix_total, "Note": a.note || "" }));
  const stockRows = DATA.stock.map((s) => ({ "Date": fmtDate(s.date), "Stock (sacs)": s.stock_sacs }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sessionsRows), "Sessions");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(achatsRows), "Achats");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockRows), "Stock");
  XLSX.writeFile(wb, `poele-carnet-${todayISO()}.xlsx`);
}

/* ---------------- Init ---------------- */

function renderAll() {
  renderRunningBox(DATA.sessions.filter(isOpenSession), { onChanged: reloadAll, notify: showSyncStatus });
  renderGauge();
  renderStatCards();
  renderSessionsList(document.getElementById("searchSessions").value);
  renderAchatsTable();
  renderStockTable();
  if (document.getElementById("panel-dashboard").classList.contains("active")) renderCharts();
}

async function startApp() {
  SETTINGS = loadSettings();
  document.querySelectorAll('input[name="date"]').forEach((el) => { el.value = todayISO(); });
  initTabs();
  initNowButtons();
  initForms();
  initSettings();
  await reloadAll();
}

document.addEventListener("DOMContentLoaded", () => {
  initAuthGate(startApp);
});
