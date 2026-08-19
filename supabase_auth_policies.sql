-- Étape 2 : restreindre l'accès aux données aux personnes connectées.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- (à faire APRÈS avoir créé le compte partagé dans Authentication > Users)

drop policy if exists "allow all sessions" on sessions;
drop policy if exists "allow all achats" on achats;
drop policy if exists "allow all stock" on stock;

create policy "authenticated only sessions" on sessions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated only achats" on achats
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated only stock" on stock
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
