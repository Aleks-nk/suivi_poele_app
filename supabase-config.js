// Identifiants de connexion à ta base Supabase.
// La clé "anon" ci-dessous est publique par conception (protégée par les
// règles de sécurité RLS définies dans supabase_setup.sql) — c'est normal
// qu'elle apparaisse dans le code d'un site statique.

const SUPABASE_URL = "https://disvtcrtxqyrpxvlramn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpc3Z0Y3J0eHF5cnB4dmxyYW1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzODQ0MjAsImV4cCI6MjEwMTk2MDQyMH0.oFVJd3I7HkFnk3g0oB-xlmz5zb5Nv50qJGXp2FI3E3U";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
