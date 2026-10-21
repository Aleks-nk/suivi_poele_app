/* Session en cours — encadré « Poêle allumé » + mini-formulaire d'arrêt.
   Partagé par index.html et ajouter.html.
   Dépend de : db (supabase-config.js), computeDuration() et fmtDate() définies dans la page.
   Une session est « en cours » quand elle a une heure d'allumage mais pas d'heure d'arrêt. */

function nowHHMM() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function isOpenSession(s) {
  return !!(s && s.allumage && !s.arret);
}

function elapsedLabel(s) {
  const start = new Date(`${s.date}T${s.allumage}:00`);
  const diff = Math.floor((Date.now() - start.getTime()) / 60000);
  if (isNaN(diff) || diff < 0) return "";
  const h = Math.floor(diff / 60), m = diff % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

async function fetchOpenSessions() {
  const { data, error } = await db.from("sessions").select("*")
    .is("arret", null).not("allumage", "is", null)
    .order("date", { ascending: false }).order("allumage", { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
}

// Boutons « Maintenant » à côté des champs heure (attribut data-now)
function initNowButtons() {
  document.querySelectorAll("button[data-now]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input");
      input.value = nowHHMM();
      input.dispatchEvent(new Event("input"));
    });
  });
}

function renderRunningBox(openSessions, hooks) {
  const box = document.getElementById("runningBox");
  if (!box) return;
  if (box.querySelector(".stop-form")) return; // arrêt en cours de saisie : on ne l'écrase pas
  box.innerHTML = "";
  openSessions.forEach((s) => box.appendChild(buildRunningCard(s, hooks)));
}

function buildRunningCard(s, hooks) {
  const card = document.createElement("div");
  card.className = "running-card";
  const since = elapsedLabel(s);
  const meta = [];
  if (s.puissance) meta.push(`Puissance ${s.puissance}`);
  if (s.temp_demandee !== null && s.temp_demandee !== undefined) meta.push(`demandée ${s.temp_demandee}°`);
  if (s.temp_ambiante_bas !== null && s.temp_ambiante_bas !== undefined) meta.push(`ambiante ${s.temp_ambiante_bas}°`);
  card.innerHTML = `
    <div class="running-head">
      <span class="running-dot"></span>
      <span>Poêle allumé depuis <b>${s.allumage}</b></span>
      <span class="running-since">${fmtDate(s.date)}${since ? " · " + since : ""}</span>
    </div>
    ${meta.length ? `<div class="running-meta">${meta.join(" · ")}</div>` : ""}
    <button type="button" class="btn btn-stop">■ Arrêter le poêle</button>
  `;
  card.querySelector(".btn-stop").addEventListener("click", () => showStopForm(card, s, hooks));
  return card;
}

function showStopForm(card, s, hooks) {
  card.innerHTML = `
    <div class="running-head">
      <span class="running-dot"></span>
      <span>Arrêt du poêle — allumé à <b>${s.allumage}</b> le ${fmtDate(s.date)}</span>
    </div>
    <form class="stop-form">
      <div class="form-grid">
        <div class="field"><label>Heure d'arrêt</label>
          <div class="time-now"><input type="time" name="arret" required><button type="button" class="btn-now">Maintenant</button></div>
        </div>
        <div class="field"><label>Durée (calculée)</label><div class="duree-display" data-role="duree"></div></div>
      </div>
      <div class="field-group-title">Températures à l'arrêt</div>
      <div class="form-grid">
        <div class="field"><label>Bas / général</label><input type="number" step="0.1" name="temp_arret_bas"></div>
        <div class="field"><label>Chambre O</label><input type="number" step="0.1" name="temp_arret_o"></div>
        <div class="field"><label>Chambre Z</label><input type="number" step="0.1" name="temp_arret_z"></div>
        <div class="field"><label>Chambre N</label><input type="number" step="0.1" name="temp_arret_n"></div>
      </div>
      <div class="field-group-title">Actions</div>
      <div class="toggle-row">
        <button type="button" class="toggle-btn" data-role="nettoyage">🧹 Nettoyage</button>
        <button type="button" class="toggle-btn" data-role="charge">🔄 Charge granulés</button>
      </div>
      <div class="field" style="margin-bottom:14px;"><label>Commentaires</label><textarea name="commentaires" placeholder="Notes libres…"></textarea></div>
      <div class="btn-row">
        <button class="btn" type="submit">Valider l'arrêt</button>
        <button class="btn ghost" type="button" data-cancel>Annuler</button>
      </div>
    </form>
  `;

  const f = card.querySelector("form");
  const tNet = card.querySelector('.toggle-btn[data-role="nettoyage"]');
  const tCharge = card.querySelector('.toggle-btn[data-role="charge"]');
  const dureeEl = card.querySelector('[data-role="duree"]');

  f.arret.value = nowHHMM();
  ["bas", "o", "z", "n"].forEach((k) => { f["temp_arret_" + k].value = s["temp_arret_" + k] ?? ""; });
  f.commentaires.value = s.commentaires || "";
  tNet.classList.toggle("active", !!s.nettoyage);
  tCharge.classList.toggle("active", !!s.charge);
  [tNet, tCharge].forEach((b) => b.addEventListener("click", () => b.classList.toggle("active")));

  const updateDuree = () => {
    const d = computeDuration(s.allumage, f.arret.value);
    dureeEl.textContent = d.label ? `${d.label} (${d.h} h)` : "—";
  };
  f.arret.addEventListener("input", updateDuree);
  card.querySelector(".btn-now").addEventListener("click", () => { f.arret.value = nowHHMM(); updateDuree(); });
  updateDuree();

  card.querySelector("[data-cancel]").addEventListener("click", () => card.replaceWith(buildRunningCard(s, hooks)));

  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button[type="submit"]');
    btn.disabled = true;
    const d = computeDuration(s.allumage, f.arret.value);
    const n = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
    const update = {
      arret: f.arret.value || null,
      duree_h: d.h,
      duree_label: d.label,
      temp_arret_bas: n(f.temp_arret_bas.value),
      temp_arret_o: n(f.temp_arret_o.value),
      temp_arret_z: n(f.temp_arret_z.value),
      temp_arret_n: n(f.temp_arret_n.value),
      nettoyage: tNet.classList.contains("active"),
      charge: tCharge.classList.contains("active"),
      commentaires: f.commentaires.value || null,
    };
    const { error } = await db.from("sessions").update(update).eq("id", s.id);
    btn.disabled = false;
    if (error) { console.error(error); hooks.notify("Erreur lors de l'arrêt de la session", true); return; }
    card.remove();
    hooks.notify("Poêle arrêté ✓");
    hooks.onChanged();
  });
}
