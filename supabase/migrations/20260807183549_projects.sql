-- Le miroir cloud d'un projet ScreenForge.
--
-- Une ligne = un document projet entier, tel que l'éditeur le manipule déjà en
-- IndexedDB. Le projet est auto-contenu et se sauvegarde d'un bloc : le
-- découper en tables (écrans, calques) ferait payer une jointure à chaque
-- lecture pour un gain nul, puisque rien ne lit jamais un calque isolément.
--
-- `data` ne contient que des `assetId` courts, jamais une data URL : les
-- binaires vivent dans Storage (phase 3). Une image de 3 Mo en base64 dans un
-- jsonb serait relue en entier à chaque sync.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  -- `on delete cascade` : supprimer un compte doit emporter ses projets, sinon
  -- la suppression de compte de la phase 5 laisserait des lignes orphelines
  -- qu'aucune policy ne rendrait plus jamais lisibles.
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- La RLS filtre chaque lecture sur `user_id` ; sans index, ce filtre est un
-- parcours séquentiel sur toute la table, pour tous les utilisateurs.
create index projects_user_id_idx on public.projects (user_id);

alter table public.projects enable row level security;

-- Une policy par opération plutôt qu'une seule `for all` : `for all` couvre
-- bien les quatre verbes, mais son `using` sert à la fois de filtre de lecture
-- et de garde d'écriture, et on ne peut plus resserrer l'un sans l'autre.
--
-- `(select auth.uid())` et non `auth.uid()` : entre parenthèses, Postgres
-- évalue l'appel une fois par requête (initPlan) au lieu d'une fois par ligne.
create policy "projects_select_own"
  on public.projects for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "projects_insert_own"
  on public.projects for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- `using` ET `with check` : sans le second, un utilisateur pourrait modifier
-- une de ses lignes en y écrivant le `user_id` de quelqu'un d'autre, et se
-- déposséder de sa propre donnée au profit d'un tiers.
create policy "projects_update_own"
  on public.projects for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "projects_delete_own"
  on public.projects for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Les droits de table sont le premier verrou, la RLS le second. Le rôle `anon`
-- n'en reçoit aucun : un visiteur sans compte n'a rien à faire ici, et le lui
-- refuser au niveau du GRANT évite de dépendre d'une policy pour le dire.
revoke all on public.projects from anon;
grant select, insert, update, delete on public.projects to authenticated;
