-- La sync est réservée au droit `cloud`, et c'est la base qui le tient.
--
-- Le filigrane et le compteur d'exports sont peints dans le navigateur : ils se
-- contournent avec la console ouverte, et c'est assumé — l'export local sans
-- serveur est la promesse du produit. La sync, elle, consomme du stockage et de
-- la bande passante à chaque écriture : c'est le seul droit qui a un coût
-- récurrent, donc le seul qui mérite un verrou.
--
-- Ce verrou ne peut pas vivre dans l'API : la sync va du navigateur à PostgREST
-- et à Storage en direct, sans jamais traverser `apps/api`. Un middleware Hono
-- garderait une porte à côté du mur. La RLS est le mur.

-- `security invoker` et non `definer` : la fonction ne lit que la ligne du
-- demandeur, et la policy de `entitlements` le garantit déjà. En `definer` elle
-- deviendrait un moyen de lire les droits de n'importe qui, à un paramètre près.
--
-- `search_path = ''` ferme la substitution de schéma : sans lui, un rôle
-- capable de créer une table dans un schéma en tête de chemin pourrait faire
-- répondre `entitlements` par la sienne.
create function public.has_cloud() returns boolean
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  select exists (
    select 1
    from public.entitlements
    where user_id = (select auth.uid())
      -- La même règle que `toEntitlements` côté API, mot pour mot : le Cloud
      -- exige la Licence, et une résiliation laisse `cloud_status` renseigné
      -- jusqu'à la fin de la période payée. Les deux lectures doivent répondre
      -- pareil, sinon l'éditeur affiche un droit que la base refuse.
      and licence_granted_at is not null
      and cloud_status is not null
      and (cloud_period_end is null or cloud_period_end > now())
  );
$$;

revoke execute on function public.has_cloud() from public, anon;
grant execute on function public.has_cloud() to authenticated;

-- `(select public.has_cloud())` et non `public.has_cloud()` : entre parenthèses,
-- Postgres l'évalue une fois par requête (initPlan) au lieu d'une fois par
-- ligne. Même raison que `(select auth.uid())` dans les policies d'origine.
--
-- Seules les écritures sont fermées. Un abonnement qui se termine ne doit
-- emporter aucune donnée : le titulaire garde la lecture de ce qu'il a déposé
-- et le droit de l'effacer. Fermer `select` transformerait une fin de période
-- en perte apparente, et fermer `delete` retiendrait en otage des fichiers
-- qu'on ne synchronise plus.

drop policy "projects_insert_own" on public.projects;
create policy "projects_insert_own"
  on public.projects for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.has_cloud()));

drop policy "projects_update_own" on public.projects;
create policy "projects_update_own"
  on public.projects for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (select public.has_cloud()));

drop policy "assets_insert_own" on storage.objects;
create policy "assets_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.has_cloud())
  );

drop policy "assets_update_own" on storage.objects;
create policy "assets_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.has_cloud())
  );
