# Phase 5 — Suppression de compte, sans cascade

**But** : rendre irréversible et complet ce que `on delete cascade` faisait en
une instruction, et remplacer le worker `setInterval` d'un process Node par un
cron du déploiement.

## Ce qu'on perd, et ce que ça coûte exactement

`apps/api/src/routes/account.ts` est explicite :

> Une seule instruction suffit : `auth.users` est référencée en
> `on delete cascade` par `projects` et `entitlements`, donc la ligne d'identité
> emporte les droits et les projets avec elle. Supprimer table par table depuis
> ici recréerait la même chaîne en TypeScript, avec le risque qu'une table
> ajoutée demain n'y soit jamais inscrite.

Convex n'a pas de cascade. Le risque nommé dans ce commentaire devient donc réel,
et il faut le tenir autrement qu'en espérant s'en souvenir. Deux mesures :

1. **Une seule fonction possède la liste** — `convex/account-deletion.ts`,
   `TABLES_OWNED_BY_USER`, et rien ailleurs.
2. **Un test énumère le schéma** et échoue si une table porte un champ `userId`
   sans figurer dans cette liste. C'est ce test qui remplace le `cascade`, et
   c'est lui qui attrapera la table ajoutée demain.

## Ce qui ne change pas

La machine à états de `account-deletion.ts` est déjà correcte pour des raisons
qui n'ont rien à voir avec Supabase : elle est idempotente, elle sérialise les
tentatives par compte, elle distingue « supprimé » de « je ne sais pas », et elle
pose une barrière durable **avant** toute opération irréversible. Elle se
transpose, elle ne se repense pas.

| Aujourd'hui                                     | Cible                                                    |
| ----------------------------------------------- | -------------------------------------------------------- |
| Table `account_deletion_jobs`, `service_role` seul | Table Convex, écrite par des `internalMutation` seules   |
| `account_deletion_pending()` en RLS             | Troisième condition de `requireCloud` (déclarée en phase 2) |
| `startAccountDeletionWorker` (`setInterval`, `unref`) | `crons.interval('account-deletion', { minutes: 1 }, …)` |
| `auth.admin.deleteUser`                         | Suppression de l'utilisateur et de ses sessions Convex Auth |
| `storage.from('assets').list/remove` paginé     | Parcours de l'index `by_user_asset` + `ctx.storage.delete` |

## Tâches

### 5.1 La file

```ts
accountDeletionJobs: defineTable({
  userId: v.string(),          // v.string() et non v.id('users') : la ligne doit
                               // survivre à l'identité qu'elle garde et nettoie
  status: v.union(v.literal('prepared'), v.literal('cleanup')),
  attempts: v.number(),
  lastError: v.union(v.string(), v.null()),
}).index('by_user', ['userId'])
```

Le commentaire d'origine reste vrai mot pour mot : « Deliberately no foreign key
to `auth.users`: the row must outlive the identity whose Storage folder it guards
and cleans. » En Convex, un `v.id('users')` pointant sur un document supprimé est
un identifiant qui ne résout plus — même conclusion, autre mécanique.

### 5.2 Le geste

`mutation requestAccountDeletion()` :

1. `requireUser(ctx)` — jamais un `userId` en argument. « Aucune route ne lit
   d'identité ailleurs que dans le jeton : c'est la seule forme qui rend
   impossible d'agir au nom d'un autre en changeant un champ. »
2. Compteur `accountDeletion` (3/heure, par utilisateur).
3. Écrire la ligne `prepared` — **la barrière avant tout le reste**. Dès qu'elle
   existe, `requireCloud` refuse toute écriture, y compris les uploads.
4. `ctx.scheduler.runAfter(0, internal.accountDeletion.run, { userId })`.
5. Rendre immédiatement. Les quatre issues du client (`deleted`,
   `cleanup-pending`, `deletion-pending`, `unknown`) sont conservées : elles
   existent parce que « la réponse peut se perdre après la suppression
   effective », et une fonction planifiée ne supprime pas cette ambiguïté, elle
   la déplace.

### 5.3 Le nettoyage

`internalMutation run({ userId })`, dans cet ordre :

1. Blobs de projets et fichiers d'assets (`ctx.storage.delete`).
2. Documents `projects`, `assets`, `entitlements`.
3. Sessions et comptes d'authentification, puis l'utilisateur.
4. La ligne de file en dernier — c'est elle qui dit que le travail reste à faire.

**Pagination obligatoire** : une mutation Convex écrit au plus 16 000 documents
et lit au plus 16 MiB. Chaque passe traite un lot borné et se replanifie tant
qu'il reste quelque chose, exactement comme la boucle Storage d'origine relistait
l'offset zéro : « Removing a page shifts the next page to offset zero, so
advancing an offset would skip objects. » Le raisonnement est identique avec un
index.

Chaque échec incrémente `attempts` et écrit `lastError`, sans jamais retirer la
ligne. Un nettoyage à moitié fait reste un nettoyage en cours.

### 5.4 La reprise

`crons.interval('account-deletion', { minutes: 1 }, internal.accountDeletion.resumeAll)`.

Convex garantit qu'« au plus une exécution de chaque cron tourne à un instant
donné », ce qui remplace le drapeau `running` du worker Node. Le verrou par
compte (`forUser`) reste néanmoins nécessaire : le cron et une demande
utilisateur peuvent viser le même compte en même temps.

## Critères d'acceptation

1. Le test qui énumère le schéma échoue quand on ajoute une table portant
   `userId` sans l'inscrire dans `TABLES_OWNED_BY_USER`.
2. Après une suppression réussie : aucun document, aucun fichier, aucune session
   ne subsiste pour ce compte. Le test compte, il ne fait pas confiance.
3. La barrière ferme immédiatement : une tentative d'upload émise après la
   création de la ligne `prepared` est refusée, même avec un jeton encore valide.
4. `run` interrompue au milieu puis relancée termine le travail sans dupliquer ni
   sauter — appelée deux fois de suite, elle donne le même état.
5. Un compte portant plus d'un lot de documents est entièrement nettoyé, ce qui
   prouve la replanification.
6. Un échec de suppression de fichier laisse la ligne en place, `attempts`
   incrémenté, et le cron reprend au tour suivant.
7. Quatrième demande de suppression dans l'heure : refusée.
8. `apps/api/src/routes/account.test.ts` (458 lignes) est porté, cas par cas, sur
   `convex-test`. C'est le fichier de test le plus long du backend ; ses cas
   couvrent les frontières ambiguës et aucun ne se supprime au motif que la
   mécanique a changé.

## Ce qui n'est pas fait ici

Le démantèlement. À la fin de cette phase, Convex sait tout faire mais
`VITE_CONVEX_URL` est toujours absente : l'application tourne encore sur
Supabase.
