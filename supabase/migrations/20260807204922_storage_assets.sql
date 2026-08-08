-- Les binaires d'un projet, hors de la base.
--
-- `projects.data` ne porte que des `assetId` courts ; les images vivent ici.
-- Une image de 3 Mo en base64 dans un jsonb serait relue en entier à chaque
-- sync, et un projet à dix captures ferait 40 Mo de ligne.
--
-- Le chemin d'un objet est `{user_id}/{asset_id}`. Le premier segment n'est pas
-- décoratif : c'est lui que la policy compare à `auth.uid()`, donc c'est le
-- chemin lui-même qui porte l'isolation. Pas de segment projet — un `assetId`
-- est un UUID, il ne collisionne pas, et un niveau de plus obligerait à
-- reconstruire le chemin de chaque image quand un projet est dupliqué.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assets',
  'assets',
  -- Privé : un objet ne se lit que par une requête signée par la session de son
  -- propriétaire. Un bucket public rendrait l'URL de la capture d'écran d'une
  -- app non annoncée devinable par quiconque connaît un UUID.
  false,
  -- Le même plafond que l'import local (`MAX_IMAGE_FILE_BYTES`), plus la marge
  -- que coûte l'encodage base64 en transit. Aligner les deux évite qu'une image
  -- acceptée par l'éditeur soit refusée par le cloud une fois posée.
  22 * 1024 * 1024,
  -- Les trois types que `CONTENT_IMAGE_TYPES` laisse entrer, et rien d'autre :
  -- le bucket est un espace utilisateur, pas un disque.
  array['image/png', 'image/jpeg', 'image/svg+xml']
)
on conflict (id) do nothing;

-- Les policies vivent sur `storage.objects`, qui est déjà en RLS : le rôle
-- `authenticated` n'y a par défaut aucun droit, donc tout ce qui n'est pas
-- écrit ici est refusé.
--
-- Une policy par verbe, pour la même raison que sur `public.projects` : le
-- `using` d'un `for all` sert à la fois de filtre de lecture et de garde
-- d'écriture, et on ne peut plus resserrer l'un sans l'autre.
--
-- `(storage.foldername(name))[1]` est le premier segment du chemin. Comparer le
-- chemin entier avec un `like 'uid/%'` marcherait aussi, mais laisserait passer
-- un `..` ou un préfixe qui commence pareil sans être le même dossier.

create policy "assets_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "assets_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- `using` ET `with check` : sans le second, un utilisateur pourrait renommer un
-- de ses objets vers le dossier de quelqu'un d'autre. Le premier autorise à
-- toucher l'objet, le second à le laisser où il atterrit.
create policy "assets_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "assets_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
