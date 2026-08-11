---
status: done
---

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

## Écarts constatés à l'implémentation (2026-08-11)

**1. Un refus qui a déjà supprimé un fichier ne peut pas lever.** Une mutation
Convex est une transaction, et c'est écrit en 3.2 pour justifier l'atomicité du
LWW — mais la conséquence n'avait pas été tirée jusqu'au bout : `throw` après
`ctx.storage.delete()` annule la suppression avec le reste. Deux tests l'ont
montré, fichier encore là après le refus. Les deux refus sont donc devenus des
**valeurs de retour** : `confirmAssetUpload` rend un booléen,
`pushProject` rend `'accepted' | 'stale' | 'too-large'`, et c'est `lib/cloud.ts`
qui lève côté client. `stale` était déjà un `false` dans le plan ; `too-large`
s'y ajoute pour le blob de projet, que 3.2 ne plafonnait pas.

**2. `confirmAssetUpload` reçoit ce qui avait été annoncé.** Sa signature au plan
est `{ assetId, storageId }`, et son travail est de comparer le fichier réel « à
ce qui avait été annoncé » — or `requestAssetUpload` ne persiste rien, il rend
une URL. Le couple annoncé repasse donc en argument. Le tenir en base entre les
deux appels aurait créé une ligne à nettoyer pour chaque téléversement
abandonné.

**3. La règle d'honnêteté est extraite, parce que le simulateur ne peut pas la
mesurer.** `convex-test` n'enregistre que `{ size, sha256 }` dans `_storage` :
sans `contentType`, la branche *acceptante* de `confirmAssetUpload` est
inatteignable en test unitaire. Plutôt que de la déclarer couverte, la
comparaison vit dans une fonction pure exportée, `honest(stored, announced)`,
éprouvée des deux côtés ; le chemin complet — URL d'upload réelle, POST, relecture
authentifiée — a été passé contre un déploiement local, et `e2e/sync.spec.ts` le
retraverse à chaque exécution.

**4. Les deux routes de lecture portent des en-têtes CORS.** Rien ne le disait en
3.4, et le navigateur ne lisait rien : l'application est servie par un hôte, le
déploiement par un autre, et `Authorization` fait précéder chaque lecture d'un
préflight sans réponse — un `TypeError: Failed to fetch` là où le client attendait
un statut. Le 404 les porte aussi, sans quoi « ce n'est pas à vous » devient
indistinguable d'une panne réseau. L'origine reste `*` : ces routes n'ont aucune
autorité ambiante, la seule clé est un jeton qu'une page tierce ne peut pas lire.

**5. La session mémorisée est relue au démarrage.** Convex Auth ne dit
« connecté » qu'une fois sa WebSocket authentifiée ; sans réseau, cet état
n'arrive jamais, et une Licence achetée disparaissait hors ligne — filigrane
compris — alors que rien de ce qu'elle ouvre n'a besoin du réseau. Le client
Supabase relisait sa session dans `localStorage` sans rien demander. `initAuth`
rétablit ce comportement : identité lue dans le jeton stocké, droits relus dans
leur cache, et la réponse du déploiement écrase les deux dès qu'elle arrive. Le
serveur ne croit toujours rien de tout cela.

**6. Deux serveurs de développement pour la suite e2e.** `boot-shell.spec.ts`
promet que sans `VITE_CONVEX_URL` le SDK n'est pas téléchargé ;
`e2e/sync.spec.ts` promet qu'avec, tout fonctionne. Un seul serveur ne peut pas
porter les deux : celui qui satisfait l'un fait échouer l'autre, ou le fait
sauter en silence. `playwright.config.ts` déclare donc deux serveurs et deux
projets, et le second ne démarre que si le déploiement local tourne.

**7. Les clés de session ont leur propre module.** `lib/convex.ts` lit
`import.meta.env` dès son évaluation : hors de Vite, l'importer lève, et une spec
Playwright s'exécute dans Node. `lib/session-keys.ts` porte l'espace de nommage
et les deux clés, lisibles des deux côtés — l'ancienne suite recopiait la clé
dans le test, où elle pouvait dériver sans bruit.

**8. Les droits sont lus sur Convex dès cette phase.** La note ci-dessus n'est
plus vraie qu'à moitié : le *webhook* qui écrit le miroir reste en phase 4, mais
la *lecture* ne pouvait pas attendre — elle passait par une session Supabase qui
n'existe plus depuis la phase 1, donc `syncAllowed()` était fermé pour tout le
monde et les critères 7, 9 et 10 étaient intenables. `fetchEntitlements` appelle
`mirror.myEntitlements` ; le traducteur `projectEntitlements` côté navigateur a
été supprimé avec ses cinq tests, la même règle étant déjà éprouvée dans
`apps/backend/convex/entitlements.test.ts`.
