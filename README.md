# Carnet de bord — Poêle à granulés 🔥

Un site pour suivre l'utilisation de ton poêle à granulés : sessions de chauffe, achats et stock, avec graphiques et une jauge de stock.

Les données sont stockées dans **Supabase** (base de données en ligne), ce qui permet de les synchroniser entre plusieurs appareils — par exemple ajouter une session depuis ton téléphone et la voir apparaître aussitôt dans le tableau de bord sur ton ordinateur.

## Fichiers du projet

- `index.html` / `style.css` / `app.js` — le tableau de bord complet.
- `ajouter.html` — page allégée, pensée pour le mobile, pour ajouter une session en 2 clics (lien en bas du tableau de bord).
- `supabase-config.js` — identifiants de connexion à ta base Supabase.
- `supabase_setup.sql` — script à exécuter une seule fois dans Supabase pour créer les tables (déjà fait si tu as suivi les étapes avec Claude).

## Mettre le site en ligne avec GitHub Pages

1. Si ce n'est pas déjà fait, exécute `supabase_setup.sql` dans **Supabase → SQL Editor** (une seule fois).
2. Crée un dépôt GitHub et mets-y tous les fichiers ci-dessus à la racine (sauf `supabase_setup.sql`, qui n'est utile qu'une fois, dans Supabase).
3. Dans le dépôt : **Settings → Pages → Source: Deploy from a branch**, branche `main`, dossier `/ (root)`. Sauvegarde.
4. Ton site est en ligne après 1-2 minutes, à l'adresse indiquée (ex: `https://ton-pseudo.github.io/poele-tracker/`).
5. La page d'ajout mobile est accessible via `.../ajouter.html` — tu peux l'ajouter à l'écran d'accueil de ton téléphone pour un accès en un tap.

## Fonctionnement

- **Tableau de bord** : stock actuel (jauge), autonomie estimée, statistiques clés et 5 graphiques (stock, sessions/mois, température, coût/mois, sacs consommés/mois).
- **Sessions** : formulaire avec durée calculée automatiquement, températures des 3 chambres (O, Z, N) à l'ambiante et à l'arrêt, boutons Nettoyage/Charge, historique en cartes (adapté au mobile, pas de défilement latéral).
- **Achats & stock** : bouton "− 1 sac utilisé", achat qui met à jour le stock automatiquement, correction manuelle possible pour recaler après un inventaire.
- **Réglages** : capacité de référence pour la jauge, export Excel/JSON, suppression complète des données (irréversible).
- **`ajouter.html`** : version mobile minimaliste, uniquement le formulaire de session, connectée à la même base — tout ce que tu ajoutes ici apparaît dans le tableau de bord.

## ⚠️ À savoir

- La clé `anon` dans `supabase-config.js` est publique par nature (c'est ainsi que fonctionne Supabase pour un site statique) et protégée par les règles de sécurité (RLS) définies dans `supabase_setup.sql`. Ces règles autorisent actuellement un accès complet sans compte utilisateur — adapté à un usage personnel, mais garde en tête que toute personne connaissant l'URL du site pourrait techniquement lire/modifier tes données.
- Le bouton "Tout supprimer" dans Réglages efface définitivement toutes les données côté Supabase (aucune corbeille).
- Pense à exporter régulièrement un fichier Excel ou JSON comme sauvegarde.

## Faire évoluer le site

Dis-moi ce que tu veux changer (champ, graphique, calcul...), je m'occupe du code.
