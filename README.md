# Carnet de bord — Poêle à granulés 🔥

Un site pour suivre l'utilisation de ton poêle à granulés : sessions de chauffe, achats et stock, avec graphiques et une jauge de stock.

Les données sont stockées dans **Supabase** (base de données en ligne), synchronisées entre appareils. L'accès au site est protégé par un **mot de passe partagé** — voir la section Authentification ci-dessous.

## Fichiers du projet

- `index.html` / `style.css` / `app.js` — le tableau de bord complet.
- `ajouter.html` — page allégée, pensée pour le mobile, pour ajouter une session en 2 clics.
- `auth.js` — écran de connexion partagé (utilisé par les deux pages).
- `supabase-config.js` — identifiants de connexion à ta base Supabase.
- `supabase_setup.sql` — script à exécuter une seule fois dans Supabase pour créer les tables.
- `supabase_auth_policies.sql` — script à exécuter une seule fois pour restreindre l'accès aux personnes connectées.

## Authentification

Le site est protégé par un compte partagé (un seul email/mot de passe pour tout le foyer) :

1. Dans Supabase : **Authentication → Users → Add user**, avec "Auto Confirm User" coché.
2. Exécute `supabase_auth_policies.sql` dans le SQL Editor pour verrouiller l'accès aux données à ce compte.
3. Partage l'email et le mot de passe avec les membres du foyer — chacun se connecte une fois sur chaque appareil (la session reste active ensuite).

## Mettre le site en ligne avec GitHub Pages

1. Si ce n'est pas déjà fait, exécute `supabase_setup.sql` puis `supabase_auth_policies.sql` dans **Supabase → SQL Editor**.
2. Crée un dépôt GitHub et mets-y `index.html`, `style.css`, `app.js`, `ajouter.html`, `auth.js`, `supabase-config.js`, `README.md` à la racine.
3. Dans le dépôt : **Settings → Pages → Source: Deploy from a branch**, branche `main`, dossier `/ (root)`. Sauvegarde.
4. Ton site est en ligne après 1-2 minutes, à l'adresse indiquée (ex: `https://ton-pseudo.github.io/poele-tracker/`).
5. La page d'ajout mobile est accessible via `.../ajouter.html` — ajoute-la à l'écran d'accueil de ton téléphone pour un accès en un tap.

## Fonctionnement

- **Tableau de bord** : stock actuel (jauge), autonomie estimée, statistiques clés et 5 graphiques (stock, sessions/mois, température, coût/mois, sacs consommés/mois).
- **Sessions** : formulaire avec durée calculée automatiquement, températures des 3 chambres (O, Z, N) à l'ambiante et à l'arrêt, boutons Nettoyage/Charge, historique en cartes (adapté au mobile, pas de défilement latéral).
- **Achats & stock** : bouton "− 1 sac utilisé", achat qui met à jour le stock automatiquement, correction manuelle possible pour recaler après un inventaire.
- **Réglages** : capacité de référence pour la jauge, export Excel/JSON, suppression complète des données (irréversible).
- **`ajouter.html`** : version mobile minimaliste, uniquement le formulaire de session, connectée à la même base — tout ce que tu ajoutes ici apparaît dans le tableau de bord.

## ⚠️ À savoir

- La clé `anon` dans `supabase-config.js` est publique par nature (c'est ainsi que fonctionne Supabase pour un site statique), mais elle ne suffit plus à elle seule à accéder aux données depuis que `supabase_auth_policies.sql` a été exécuté — il faut être connecté avec le compte partagé.
- Le bouton "Tout supprimer" dans Réglages efface définitivement toutes les données côté Supabase (aucune corbeille).
- Pense à exporter régulièrement un fichier Excel ou JSON comme sauvegarde.

## Faire évoluer le site

Dis-moi ce que tu veux changer (champ, graphique, calcul...), je m'occupe du code.
