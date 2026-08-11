# Phase 3 — Sync des projets et des binaires

**But** : porter les 740 lignes de `lib/sync.ts` sur Convex sans changer le
modèle — document auto-contenu, dernier écrivain gagne sur `updatedAt`, jamais
bloquant — et régler au passage le seul incompatible dur de la migration.

## Le point dur, chiffré

**Convex plafonne un document à 1 MiB.** `apps/web/src/lib/project-file.ts:40`
déclare `MAX_MANIFEST_BYTES = 4 * 1024 * 1024`. Deux constantes déclarées, un
facteur 4 d'écart.

Le chemin qui y mène n'a rien d'exotique : `Release.snapshot` est un
`ProjectSnapshot`, c'est-à-dire `{ name, screens, layoutLayers, globals }` — le
projet entier moins son identité — et `MAX_PROJECT_RELEASES = 20`. Un projet qui
a figé vingt lots porte vingt-et-une copies de son graphe, plus jusqu'à douze
variantes de langue. `data jsonb` l'acceptait ; un document Convex, non.

**Le JSON du projet devient donc un fichier.** La ligne garde
`{ userId, projectId, name, updatedAt, blobId }`.

Ce n'est pas un contournement. Le serveur n'a **jamais** lu à l'intérieur de
`data` — le LWW tranche sur `updated_at` seul. Or `fetchRemoteProjectRows` fait
aujourd'hui `select('id, data, updated_at')` sur toutes les lignes, par pages de
500 : il télécharge l'intégralité des projets pour comparer des horodatages.
Sortir le blob supprime ce gaspillage en même temps que le plafond.

## Tâches

### 3.1 Schéma

```ts
projects: defineTable({
  userId: v.id('users'),
  projectId: v.string(),      // l'id du document ScreenForge, pas l'_id Convex
  name: v.string(),
  updatedAt: v.number(),
  blobId: v.id('_storage'),
}).index('by_user', ['userId'])
  .index('by_user_project', ['userId', 'projectId']),

assets: defineTable({
  userId: v.id('users'),
  assetId: v.string(),
  storageId: v.id('_storage'),
  contentType: v.string(),
  byteLength: v.number(),
}).index('by_user_asset', ['userId', 'assetId']),
```

`projectId` reste l'identifiant ScreenForge et non l'`_id` Convex : c'est lui qui
vit dans IndexedDB, dans le fichier `.screenforge` exporté et dans la file de
synchronisation. Le remplacer obligerait à tenir une table de correspondance
côté navigateur pour rien.

`assets` remplace le chemin `{user_id}/{asset_id}` du bucket, qui portait
l'isolation. Convex n'a pas de chemin : la propriété est une colonne, et l'index
`by_user_asset` est ce qui la rend interrogeable sans balayage.

### 3.2 Poussée

`mutation pushProject({ projectId, name, updatedAt, blobId })` :

1. `requireCloud(ctx)`.
2. Compteur `projectPush` (seau à jetons, 60/heure, capacité 20, par
   utilisateur).
3. Lecture par `by_user_project`. Si `existing.updatedAt >= updatedAt`, on
   supprime le blob qu'on vient de recevoir et on rend `false` — c'est le
   `where excluded.updated_at > …` de `upsert_project_lww`, et il est atomique
   parce qu'une mutation Convex est une transaction.
4. Sinon `patch` (ou `insert`), puis `ctx.storage.delete(ancien blobId)` **dans
   la même mutation**. C'est le seul endroit qui écrit ce champ, donc le seul
   qui peut laisser un orphelin.

L'ordre du client ne change pas : les binaires partent avant la ligne. « L'inverse
laisserait une fenêtre où un second navigateur tire un projet dont les binaires
ne sont pas encore là. » Le blob du projet part juste avant la mutation, pour la
même raison.

### 3.3 Binaires

- `mutation requestAssetUpload({ assetId, contentType, byteLength })` :
  `requireCloud`, compteur `assetUpload` (30/heure, capacité 10), **contrôle du
  type et de la taille ici** puis `ctx.storage.generateUploadUrl()`.
- `mutation confirmAssetUpload({ assetId, storageId })` : relit les métadonnées
  réelles depuis `_storage`, revérifie type et taille, et **supprime le fichier**
  si elles ne correspondent pas à ce qui avait été annoncé.

Ce double contrôle n'est pas de la ceinture et des bretelles : le bucket Supabase
appliquait `file_size_limit` et `allowed_mime_types` côté serveur, à l'upload.
Convex ne filtre rien — l'URL d'upload accepte n'importe quel octet. Sans la
seconde vérification, la limite annoncée serait une politesse côté client.

Les valeurs restent celles de `image.ts` : `MAX_IMAGE_FILE_BYTES` (16 MiB) et
`CONTENT_IMAGE_TYPES`. Elles sont importées, pas recopiées.

### 3.4 Lecture des binaires

`httpAction GET /asset/:assetId` :

1. Jeton dans `Authorization`, `ctx.auth.getUserIdentity()`.
2. Recherche par `by_user_asset` sur **l'utilisateur du jeton**, jamais sur un
   paramètre.
3. `ctx.storage.get(storageId)` et renvoi des octets.

`storage.getUrl()` est écarté explicitement : il rend une URL permanente et non
révocable, et `storage_assets.sql` promet l'inverse — « un bucket public rendrait
l'URL de la capture d'écran d'une app non annoncée devinable ». Une URL porteuse
qui traîne dans un historique est le même problème avec une étape de plus.

Le plafond de réponse d'une `httpAction` est de 20 MiB pour un import plafonné à
16 MiB. La marge est réelle mais mince : un test pose un asset de 16 MiB et
vérifie qu'il revient entier.

Même chemin pour le blob de projet : `GET /project-blob/:projectId`.

### 3.5 Catalogue

`query listProjects` rend `{ projectId, name, updatedAt }` pour l'utilisateur —
**sans le contenu**. C'est ce qui remplace `fetchRemoteProjectRows` et sa
pagination par 500 : la liste est petite, le tirage ne descend que les projets
dont l'horodatage est plus récent que la copie locale.

`pullTarget` ne bouge pas d'une ligne : ses deux cas (« ma ligne est plus
récente » / « je n'ai jamais rien modifié, j'adopte le plus récent ») sont du
raisonnement client, et il est déjà testé.

### 3.6 Réécriture de `lib/sync.ts`

Ce qui change : le transport. `client.rpc(...)` devient `convex.mutation(...)`,
`storage.from(BUCKET).upload/download` devient les fonctions ci-dessus.

Ce qui ne change pas, et qui doit être vérifié fichier en main :

- `mapBounded` / `mapBoundedSettled` et les quatre constantes de parallélisme ;
- `sync-queue.ts` — les accusés de réception restent en IndexedDB, base séparée,
  et pour la raison écrite dedans : « une migration ratée là-bas coûterait son
  travail » ;
- la chaîne `chain` un cycle à la fois, `ignoredAdoptionCommit`, `pulled`,
  `preserveProject`, la garde `currentUserId() !== userId` après chaque await ;
- `unattachedProjects` / `attachProjects` et le rattachement au premier login ;
- `syncAllowed()`, qui reste le point unique où la vente se branche ;
- les états `off | syncing | synced | offline | error` et les toasts.

**Ce qu'on ne fait pas maintenant** : remplacer le tirage par un abonnement
temps réel. `ConvexReactClient` le permettrait, la valeur serait réelle (un
second navigateur verrait la nouvelle version sans recharger) et le code serait
plus court. Mais ce serait changer le modèle de synchronisation dans la même
phase que le transport, et un échec ne dirait plus lequel des deux a cassé. À
poser comme une amélioration après la bascule, avec sa propre mesure.

## Critères d'acceptation

1. Un projet portant 20 releases et 12 locales se pousse et se retire intact.
   Le test le construit et vérifie que le JSON dépasse 1 MiB — sinon il ne
   prouve rien.
2. Deux poussées concurrentes du même projet laissent le serveur sur le
   `updatedAt` le plus élevé, jamais sur le plus ancien.
3. Une poussée rejetée pour cause de version plus ancienne ne laisse pas de blob
   orphelin ; une poussée acceptée supprime le blob précédent.
4. Un asset de 17 MiB est refusé ; un asset de 16 MiB fait l'aller-retour entier.
5. Un fichier téléversé dont le type réel ne correspond pas à celui annoncé est
   supprimé et non enregistré.
6. `GET /asset/:id` sur l'asset d'un autre compte rend 404, jamais 403 — un 403
   confirmerait l'existence.
7. `e2e/sync.spec.ts` passe : deux navigateurs sur le même compte convergent.
8. Réseau coupé en plein cycle : l'édition continue, l'autosave local aussi, la
   pastille passe à `offline`, et la reprise repousse ce qui manquait.
9. Sans droit `cloud` : aucune requête ne part, la pastille reste `off`.
10. Un compte qui vient d'acheter le Cloud avec cinq projets locaux se voit
    proposer le rattachement, une seule fois par session.

## Ce qui n'est pas fait ici

La vente. Les droits lus par `syncAllowed()` viennent encore du miroir Supabase
tant que la phase 4 n'a pas basculé le webhook.
