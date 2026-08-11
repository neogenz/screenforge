# Phase 2 — Schéma, droits, et le mur d'autorisation

**But** : poser les tables métier et l'unique endroit qui décide qui a le droit
d'écrire. C'est la phase qui rembourse la dette nommée dans
`apps/web/src/lib/entitlements.ts` : « La règle commerciale, troisième et
dernière copie. »

## Le raisonnement qu'on abandonne, et pourquoi c'est légitime

`supabase/migrations/20260808094557_cloud_gate.sql` justifie la RLS ainsi :

> Ce verrou ne peut pas vivre dans l'API : la sync va du navigateur à PostgREST
> et à Storage en direct, sans jamais traverser `apps/api`. Un middleware Hono
> garderait une porte à côté du mur. La RLS est le mur.

Le raisonnement est juste, et sa prémisse disparaît. Convex n'expose pas de
table : il n'y a ni PostgREST, ni URL de collection, ni clé anonyme qui ouvre une
lecture. Le client ne peut appeler que des fonctions écrites ici. Il n'y a donc
plus de porte à côté du mur — **la fonction est le mur**.

Conséquence directe et vérifiable : la règle « le Cloud exige la Licence, et une
résiliation court jusqu'à la fin de période » cesse d'exister en trois langages.
Elle est écrite une fois, en TypeScript, et le serveur comme l'éditeur importent
le même fichier.

## Tâches

### 2.1 Le schéma

`apps/backend/convex/schema.ts`, en plus de `authTables` :

```ts
entitlements: defineTable({
  userId: v.id('users'),
  polarCustomerId: v.string(),
  licenceGrantedAt: v.union(v.number(), v.null()),
  cloudStatus: v.union(v.string(), v.null()),
  cloudPeriodEnd: v.union(v.number(), v.null()),
  sourceUpdatedAt: v.union(v.number(), v.null()),
}).index('by_user', ['userId'])
```

Trois choix à noter :

- **Horodatages en `number`**, pas en chaîne ISO. Postgres avait `timestamptz` ;
  Convex n'a pas de type date, et une comparaison de chaînes ISO fonctionne par
  accident (préfixe lexicographique) tant que le fuseau ne change pas. Le
  millième de seconde est ce que le reste du dépôt manipule déjà (`updatedAt`
  d'un projet est un `number`), donc c'est aussi la forme la moins surprenante.
  Le contrat côté client (`Entitlements.licenceGrantedAt: string | null`) reste
  en ISO : la conversion se fait au bord, dans la query.
- **`cloudStatus` en texte libre**, comme la colonne d'origine : c'est la valeur
  d'un tiers, et un `v.union` de littéraux casserait à la première valeur que
  Polar ajoute.
- **Un index sur `userId`** et non l'`_id` du document comme clé : Convex ne
  permet pas de choisir la clé primaire. L'unicité « un compte, une ligne, pour
  toujours » n'est donc plus structurelle et doit être tenue par l'écriture —
  voir 2.3.

### 2.2 La règle, une fois

`apps/backend/convex/entitlements.ts` :

- `toEntitlements(row, userId, now): Entitlements` — la fonction de
  `apps/api/src/entitlements.ts`, déplacée telle quelle avec ses tests. Elle est
  pure : ni réseau ni base, ce qui est précisément ce qui la rend partageable.
- `hasCloud(row, now): boolean` — ce que faisait `public.has_cloud()`, dérivé de
  `toEntitlements` et non réécrit à côté.
- `rightsOf(entitlements, billingOpen): Rights` — déplacé depuis
  `apps/web/src/lib/entitlements.ts`.

`apps/web/src/lib/entitlements.ts` conserve le compteur d'exports du palier
gratuit (`localStorage`, purement client, sans intérêt serveur) et **importe** le
reste depuis `backend`. Le commentaire « troisième et dernière copie » est
supprimé parce qu'il devient faux, pas parce qu'il gêne.

### 2.3 Le mur

`apps/backend/convex/authz.ts`, trois helpers et rien d'autre :

| Helper                  | Rend                        | Lève si                                    |
| ----------------------- | --------------------------- | ------------------------------------------ |
| `requireUser(ctx)`      | `Id<'users'>`               | pas de session                             |
| `readEntitlements(ctx, userId)` | `Entitlements`      | jamais — l'absence de ligne vaut « aucun droit » |
| `requireCloud(ctx)`     | `Id<'users'>`               | pas de session, pas de droit `cloud`, ou suppression de compte en cours |

`requireCloud` porte les trois conditions que la RLS portait en trois endroits
(`has_cloud()`, `account_deletion_pending()`, et le filtre de propriété). La
troisième condition est déclarée ici dès la phase 2, même si la table de
suppression n'arrive qu'en phase 5 : la lire à travers une fonction qui rend
`false` tant que la table n'existe pas coûte une ligne, et l'ajouter après coup
signifierait relire chaque mutation écrite entre-temps.

**Ce qui reste ouvert quand le droit s'éteint** : la lecture et la suppression.
C'est la règle d'origine, mot pour mot — « un abonnement qui se termine ne doit
emporter aucune donnée ». Fermer `select` transformerait une fin de période en
perte apparente, et fermer `delete` retiendrait en otage des fichiers qu'on ne
synchronise plus.

### 2.4 Les écritures du miroir

- `internalMutation applyEntitlementsIfNewer` : la logique de
  `apply_entitlements_if_newer`, en TypeScript. Le `insert … on conflict … where
  excluded.source_updated_at > …` devient un `get` puis un `patch` **dans la même
  mutation**, donc dans la même transaction — Convex n'a pas besoin de plpgsql
  pour rendre la comparaison atomique. Elle rend le même triplet
  `'written' | 'unchanged' | 'ignored'`, parce que le webhook s'en sert pour
  décider s'il journalise.
- `internalMutation` et non `mutation` : une fonction interne n'est pas
  appelable depuis un client. C'est ce qui remplace la clé `service_role`, et ça
  la remplace mieux — il n'y a pas de secret à ne pas divulguer.
- `query myEntitlements` : lit la ligne du demandeur, rend `Entitlements` en
  ISO. C'est ce que `fetchEntitlements` appelait sur PostgREST.

### 2.5 La suite « point de vue attaquant »

Les cinq fichiers de `supabase/tests/` sont réécrits en `convex-test`. Ils
testent la même chose et ils la testent mieux : en Convex, l'autorisation **est**
le code de la fonction, donc un test qui passe prouve la règle plutôt que la
configuration d'un moteur tiers.

Chaque fichier garde sa contrainte d'origine : **il porte son contre-test**. Une
règle qui refuserait tout passerait sinon une suite entière de refus tout en
cassant la fonctionnalité.

| Fichier                 | Ce qu'il tente                                                    |
| ----------------------- | ----------------------------------------------------------------- |
| `entitlements.test.ts`  | Lire la ligne d'un autre ; s'écrire un droit ; appeler l'`internalMutation` depuis un client |
| `cloud-gate.test.ts`    | Écrire sans droit `cloud` ; lire et supprimer **avec succès** sans droit `cloud` ; écrire pendant une fin de période |
| `authz.test.ts`         | Appeler chaque mutation sans session                              |

## Critères d'acceptation

1. `grep -rn "has_cloud\|toEntitlements" apps/web apps/backend` : la règle
   n'apparaît que dans `apps/backend/convex/entitlements.ts` et à ses points
   d'import. Aucune réimplémentation.
2. Les tests de `apps/api/src/entitlements.test.ts` passent, déplacés, sans
   modification de leurs assertions.
3. Un utilisateur sans droit `cloud` : toute mutation d'écriture est refusée,
   toute lecture et toute suppression réussissent.
4. Un utilisateur dont `cloudPeriodEnd` est dans le passé est traité comme sans
   droit ; un utilisateur résilié dont la période court encore garde son droit.
5. Une `internalMutation` appelée depuis un client échoue à la compilation
   **et** à l'exécution.
6. Deux appels concurrents d'`applyEntitlementsIfNewer` avec des
   `sourceUpdatedAt` désordonnés laissent la ligne sur le plus récent.
7. Deux `applyEntitlementsIfNewer` pour un compte sans ligne préalable ne créent
   qu'une ligne (l'unicité que la clé primaire Postgres donnait gratuitement).
8. `pnpm test` vert ; `apps/api` et `supabase/` toujours intacts et fonctionnels.

## Ce qui n'est pas fait ici

Aucun projet, aucun binaire, aucun paiement. La phase 2 sait qui a le droit,
pas encore de quoi.
