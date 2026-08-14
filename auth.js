/* Écran de connexion partagé — protège l'accès aux données du foyer.
   Nécessite que supabase-config.js soit chargé avant ce fichier. */

async function requireAuth() {
  const { data: { session } } = await db.auth.getSession();
  const gate = document.getElementById("loginGate");
  const root = document.getElementById("appRoot");
  if (session) {
    gate.style.display = "none";
    root.style.display = "";
    return true;
  }
  gate.style.display = "flex";
  root.style.display = "none";
  return false;
}

function initAuthGate(onAuthenticated) {
  const form = document.getElementById("loginForm");
  const errorEl = document.getElementById("loginError");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Connexion…";
    const { error } = await db.auth.signInWithPassword({
      email: form.email.value.trim(),
      password: form.password.value,
    });
    btn.disabled = false;
    btn.textContent = "Se connecter";
    if (error) {
      errorEl.textContent = "Email ou mot de passe incorrect.";
      return;
    }
    errorEl.textContent = "";
    form.reset();
    const ok = await requireAuth();
    if (ok) onAuthenticated();
  });

  document.querySelectorAll(".btnLogout").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await db.auth.signOut();
      location.reload();
    });
  });

  requireAuth().then((ok) => { if (ok) onAuthenticated(); });
}
