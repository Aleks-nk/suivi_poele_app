-- Carnet de bord du poêle — création des tables Supabase
-- À exécuter une seule fois dans : SQL Editor > New query > Run

create extension if not exists "pgcrypto";

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  allumage text,
  arret text,
  duree_h numeric,
  duree_label text,
  puissance numeric,
  temp_demandee numeric,
  temp_ambiante_bas numeric,
  temp_ambiante_o numeric,
  temp_ambiante_z numeric,
  temp_ambiante_n numeric,
  temp_arret_bas numeric,
  temp_arret_o numeric,
  temp_arret_z numeric,
  temp_arret_n numeric,
  nettoyage boolean default false,
  charge boolean default false,
  commentaires text,
  created_at timestamptz not null default now()
);

create table if not exists achats (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  magasin text,
  marque text,
  nb_sacs numeric,
  prix_sac numeric,
  prix_total numeric,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists stock (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  stock_sacs numeric not null,
  created_at timestamptz not null default now()
);

-- Sécurité : RLS activée. Comme le site n'a pas de compte utilisateur (usage perso),
-- on autorise l'accès complet via la clé "anon". Cette clé est publique par design,
-- mais garde en tête que quiconque connaît l'URL de ton site pourrait lire/modifier
-- ces données (pas de souci pour un carnet perso, à éviter pour des données sensibles).

alter table sessions enable row level security;
alter table achats enable row level security;
alter table stock enable row level security;

create policy "allow all sessions" on sessions for all using (true) with check (true);
create policy "allow all achats" on achats for all using (true) with check (true);
create policy "allow all stock" on stock for all using (true) with check (true);

-- Import de ton historique d'achats existant
insert into achats (date, magasin, marque, nb_sacs, prix_sac, prix_total, note) values
  ('2025-08-23', 'Leroy Merlin', 'Woodstock', 6, 5.49, 32.94, null),
  ('2025-11-22', 'Leroy Merlin', 'Woodstock', 12, 5.49, 65.88, null),
  ('2026-01-10', 'Leroy Merlin', 'Woodstock', 10, 5.49, 54.90, null),
  ('2026-04-18', 'Leroy Merlin', 'Woodstock', 10, 5.99, 49.90, '-10€ remise fidélité');
