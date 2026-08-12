---
status: done
---

# Phase 6 — Démantèlement, documentation, validation de release

**But** : basculer, puis retirer. Dans cet ordre, et jamais l'inverse : tant que
`apps/api` et `supabase/` sont dans l'arbre, un `git revert` suffit à revenir en
arrière.

## 6.1 La bascule

Un seul geste, parce que l'instance de production est vide et qu'il n'y a rien à
réconcilier :

1. `convex deploy` sur le déploiement de production.
2. Variables Convex posées (`AUTH_*`, `POLAR_*`, `SITE_URL`, `CHECKOUT_SUCCESS_URL`).
3. Applications OAuth Google et GitHub : ajouter l'URL de rappel
   `https://<deployment>.convex.site/api/auth/callback/{google,github}`. Les
   applications elles-mêmes ne changent pas.
4. Webhook Polar repointé de l'URL Railway vers
   `https://<deployment>.convex.site/billing/webhook`.
5. `.env` de build : `VITE_CONVEX_URL` posée, `VITE_SUPABASE_URL` et
   `VITE_SUPABASE_ANON_KEY` retirées. `VITE_API_URL` reste ce qu'elle est —
   `commercialLaunch` en dépend, et cette phase ne décide pas de l'ouverture
   commerciale. **À vérifier à l'écriture** : si `commercialLaunch` doit survivre
   à la disparition de `apps/api`, il lui faut sa propre variable
   (`VITE_COMMERCIAL_LAUNCH`) plutôt que de continuer à déduire l'ouverture de
   la présence d'une API qui n'existe plus.

### La validation que `convex-test` ne peut pas faire

`convex-test` est un simulateur JavaScript : il n'applique ni les limites de
taille, ni les crons, et ses messages d'erreur diffèrent. Trois vérifications se
font donc **à la main, contre un déploiement réel**, avant de considérer la
bascule faite. Elles sont listées ici pour être cochées, pas pour être crues :

1. Un projet à 20 releases pousse et revient — la limite de 1 MiB par document
   est bien contournée par le blob, et le blob passe.
2. Un asset de 16 MiB fait l'aller-retour par l'`httpAction` — la marge de 4 MiB
   sur le plafond de réponse tient en conditions réelles.
3. Le cron de suppression de compte s'exécute et vide une file préparée à la
   main.

## 6.2 Ce qui est supprimé

```
apps/api/                              (17 fichiers, ~1 100 lignes hors tests)
supabase/                              (6 migrations, config.toml, 5 tests RLS)
apps/web/src/lib/supabase.ts           (61 lignes)
apps/web/src/lib/api.ts                (119 lignes)
apps/web/src/types/database.types.ts   (271 lignes générées)
```

Dépendances : `@supabase/supabase-js` (racine, web, api), `hono` (web et api),
`@hono/node-server`, `@polar-sh/sdk` et `standardwebhooks` déplacés vers
`apps/backend`.

Scripts racine retirés : `db:start`, `db:stop`, `db:migrate`, `gen:types`,
`test:rls`. `test` perd son `test:rls`.

Infrastructure : le service Railway est arrêté, et **le projet Supabase hébergé
est supprimé** — pas mis en pause. Il est vide (décision du plan) ; le laisser
dormir garderait des clés vivantes pour un service que plus rien n'appelle. Les
clés sont révoquées avant la suppression, dans cet ordre, pour que la révocation
soit constatable.

CI (`.github/workflows/quality.yml`) : le job qui démarre la stack Supabase et
exporte `SUPABASE_URL` / `VITE_SUPABASE_URL` disparaît. Le grep qui vérifiait que
`SUPABASE_SERVICE_ROLE_KEY` n'atteint pas le navigateur disparaît **avec sa
raison** : il n'y a plus de clé qui contourne l'autorisation.

## 6.3 Documentation

Ce n'est pas de la cosmétique : plusieurs de ces textes justifient des décisions
qui viennent d'être inversées, et un lecteur les prendra pour argent comptant.

| Fichier | Ce qui doit changer |
| ------- | ------------------- |
| `CLAUDE.md` | Tableau de stack (Storage, ligne backend) ; arborescence `apps/web/src/lib` (`supabase.ts`, `api.ts`, `sync.ts`) ; section Commands (`db:*`, `gen:types`) |
| `AGENTS.md` | Arborescence racine : `supabase/` n'y est plus, `apps/backend/` y est |
| `aidd_docs/memory/database.md` | Toute la section « Server-side conventions » — RLS, `service_role`, policies par verbe. Le remplaçant tient en une phrase : il n'y a pas de chemin direct vers la base, l'autorisation est la fonction |
| `aidd_docs/memory/architecture.md` | Le schéma des couches |
| `aidd_docs/memory/codebase-map.md` | `apps/api` → `apps/backend` |
| `aidd_docs/memory/testing.md` | `test:rls` → la suite `convex-test`, et la note sur ce que le simulateur ne couvre pas |
| `.env.example` | Réécrit : une variable web (`VITE_CONVEX_URL`), et un renvoi vers `npx convex env set` pour le reste. Plus aucun secret dans le fichier — c'est un gain, il en portait sept |
| `../2026_08_05_screenforge-saas/plan.md` | Un encadré en tête : la couche serveur de ce plan est remplacée le 2026-08-11, l'offre et les règles de vente ne le sont pas |

### Le commentaire à ne pas perdre

`apps/web/src/lib/entitlements.ts` porte aujourd'hui :

> La règle commerciale, troisième et dernière copie. […] Les trois doivent
> répondre pareil, sinon l'éditeur affiche un droit que la base refuse.

Il devient faux et se supprime. Ce qui le remplace mérite d'être écrit, parce que
c'est le résultat de toute la migration : la règle est dans
`apps/backend/convex/entitlements.ts`, le serveur et l'éditeur importent le même
fichier, et il n'y a plus de « pareil » à tenir.

## 6.4 Validation

`pnpm run test:release` en entier : `test:unit`, `typecheck`, `lint`,
`build:profiles`, `test:e2e`, `audit:contrast`, `audit:scale`, `audit:landing`.

Plus, spécifiquement :

- `e2e/boot-shell.spec.ts` — le budget du chemin critique. Convex remplace
  Supabase dans le même schéma d'import dynamique ; si le budget bouge, c'est que
  le client a fui dans le paquet critique.
- `e2e/commercial-launch.spec.ts` et `build:profiles` — les deux profils
  (prélancement / lancement) doivent encore se distinguer.
- `e2e/sync.spec.ts` — avec la nouvelle clé de session semée.
- `e2e/export.spec.ts` et `validate:export` — l'export pixel-exact n'a jamais
  touché au backend et ne doit pas commencer.

## Critères d'acceptation

1. `grep -rni "supabase" --include="*.ts" --include="*.tsx" --include="*.json" apps/ scripts/`
   ne rend plus rien.
2. `pnpm install` ne descend plus `@supabase/supabase-js` ni `@hono/node-server`.
3. `pnpm run test:release` vert de bout en bout.
4. Un compte créé sur le déploiement de production peut se connecter, acheter en
   bac à sable, synchroniser un projet, le retrouver depuis un second navigateur,
   puis supprimer son compte — et il ne reste rien.
5. Les trois vérifications manuelles du §6.1 sont cochées.
6. Le projet Supabase est supprimé et le service Railway arrêté ; aucune clé de
   l'un ni de l'autre ne subsiste dans un secret d'hébergeur ou de CI.
7. Aucun document du dépôt ne décrit encore une RLS, une clé `service_role` ou un
   `apps/api`.

## Écarts constatés à l'implémentation (2026-08-11)

**1. Ce qui est fait, et ce qui attend un humain.** Le code est basculé et
démantelé en entier ; l'infrastructure ne l'est pas, et ne peut pas l'être
depuis cette session. `convex login` est une connexion par navigateur, la
suppression du projet Supabase hébergé et l'arrêt du service Railway demandent
les identifiants du propriétaire, et un achat en bac à sable demande un compte
Polar. Les critères 4, 5 et 6 restent donc à cocher par la personne qui a ces
accès ; `environnements.md` est la liste exacte de ce qu'elle a à poser, avec la
commande pour chaque valeur.

**2. `commercialLaunch` prend sa propre variable, comme le §6.1 l'avait prévu.**
La question posée — « si `commercialLaunch` doit survivre à la disparition de
`apps/api`, il lui faut sa propre variable » — se répond oui sans hésitation :
déduire l'ouverture commerciale de la présence de `VITE_CONVEX_URL` ouvrirait la
vente à la première synchronisation, et le même déploiement sert les comptes
gratuits. `VITE_COMMERCIAL_LAUNCH` remplace donc `VITE_API_URL` dans
`lib/commercial-launch.ts`, dans `build:profiles`, dans les deux configurations
Playwright et dans la CI.

**3. `lib/api.ts` devient `lib/account.ts` au lieu de disparaître.** Le §6.2 le
compte parmi les fichiers supprimés (119 lignes). Ses trois fonctions, elles, ne
sont pas supprimables : acheter, gérer son abonnement et supprimer son compte
restent trois gestes du produit. Ce qui disparaît est ce que le nom désignait —
le client Hono, l'en-tête `Authorization` reconstruit à chaque appel, la lecture
de statuts HTTP. Les replier dans `lib/cloud.ts` aurait mêlé le transport et le
commerce dans un seul fichier ; le nom suit donc l'intention.

**4. `deleteAccount` ne dépend plus de l'ouverture commerciale.** Elle rendait
`'failed'` sans `billingConfigured`, ce qui était juste tant que la route vivait
dans le service de vente. Un compte existe désormais dès qu'il y a un
déploiement, ouverture commerciale ou non — refuser de le supprimer dans une
build d'avant-lancement serait retenir des données de quelqu'un qui demande à
partir. Elle ne dépend plus que de `connect()`.

**5. Critère 1 : tenu, après une seconde passe.** Le premier jet laissait huit
commentaires nommant Supabase, au motif qu'ils portaient la raison mesurée
derrière une contrainte. La relecture a montré que ce n'était pas vrai de la
façon dont c'était écrit : dans chacun des huit, la raison est une phrase sur
Convex — « rien n'est filtré à la réception », « une mutation est une
transaction », « la clé du document ne se choisit pas » — et le nom du système
disparu ne servait qu'à la mettre en contraste. Un lecteur qui ne l'a pas connu
n'a rien à en tirer, et un lecteur qui voudrait vérifier le contraste ne le
peut pas : le code cité n'est plus dans le dépôt.

La passe a donc porté plus loin que les huit lignes du grep, sur ~35 sites
répartis dans vingt fichiers, parce que le même défaut se cachait derrière des
noms que `supabase` ne trouve pas : `apps/api`, `cloud_gate.sql`,
`storage_assets.sql`, `upsert_project_lww`, `public.has_cloud()`, PostgREST,
`service_role`, plpgsql, `hc<AppType>`. Chaque commentaire est réécrit au
présent, la raison intacte, le pointeur mort supprimé — le renvoi de
`accountDeletion.test.ts` vers `api.test.ts` était d'ailleurs faux depuis
l'écart 3, ce fichier s'appelant `account.test.ts`. L'histoire de la migration
reste écrite en entier, à un seul endroit et daté : ce dossier.

Le grep de contrôle est élargi en conséquence et rend zéro :

```bash
grep -rniE "supabase|apps/api|postgrest|postgres|service_role|cloud_gate|storage_assets|upsert_project_lww|apply_entitlements|has_cloud\(|account_deletion_pending|auth\.users|plpgsql|\bRLS\b|VITE_API_URL" --include="*.ts" --include="*.tsx" --include="*.yml" --include="*.json" apps/ scripts/ .github/
```

**6. Critère 2 : `@hono/node-server` reste, et c'est le critère qui se
trompait.** Il appartient à `apps/bridge`
([`package.json:20`](../../../../apps/bridge/package.json)), le pont local, qui
n'a rien à voir avec la migration et continue de servir `codex` et la
publication App Store. Le retirer supprimerait une fonctionnalité vivante ; il
n'y a donc rien à corriger dans le code, seulement ici.
`@supabase/supabase-js` a bien quitté les trois `package.json` et le fichier de
verrouillage.

**7. Le job `db` de la CI disparaît sans remplaçant, et le grep `service_role`
avec lui.** Le premier appliquait les migrations sur une base vierge et
attaquait les policies depuis un second compte ; il n'y a plus ni migration ni
policy. Le second gardait une clé qui contournait la RLS ; il n'existe plus de
clé qui contourne l'autorisation, parce qu'il n'existe plus de chemin vers la
base à côté des fonctions. Le job `api` devient `backend`. Le job `e2e` ne
démarre plus aucun service : les specs qui ont besoin d'un compte vérifient
`localConvex()` et se sautent d'elles-mêmes.

**8. `pnpm run test:release` : tout est vert sauf `ai-provider.spec.ts`, pour une
raison extérieure au dépôt.** 118 tests passent, un se saute (le bezel Apple
réel, qui attend `APPLE_BEZEL_PATH`), un échoue :
`e2e/ai-provider.spec.ts` attend « aucun pont ne répond » et reçoit « le pont
parle la version 3, cette page la 2 ». Un processus `apps/bridge` tourne depuis
l'**autre copie de travail** (`/…/screen-forge/apps/bridge`, PID en écoute sur
127.0.0.1:4590), où `PROTOCOL_VERSION` vaut 3 — une valeur montée par un commit
qui n'est pas sur cette branche. Arrêter ce processus rend le test vert ; il
n'appartient pas à cette session de le tuer.

**9. Les trois vérifications manuelles du §6.1, faites contre le déploiement
local réel.** Le projet à 20 releases (1,3 MiB) pousse et revient — c'était la
phase 3. L'asset de 16 MiB fait l'aller-retour par l'`httpAction` — phase 3
également. Le cron de suppression a vidé deux files posées à la main par
`convex import` — phase 5. Ce qu'un déploiement **local** ne peut pas prouver et
qui reste à constater en ligne : rien de fonctionnel, seulement que les valeurs
d'environnement sont bien posées, ce que `billing:healthcheck` dit en une
commande.

**10. Les règles officielles Convex, lues après coup, et ce qu'elles ont trouvé.**
`npx convex ai-files install` écrit `convex/_generated/ai/guidelines.md` — les
règles que Convex publie pour qu'un agent écrive correctement contre son API,
et que la CLI proposait depuis le début sans qu'on la lise. Le backend a été
audité contre elles, dimension par dimension, chaque écart étant ensuite soumis
à une contre-lecture chargée de le réfuter : dix signalés, cinq réfutés, cinq
tenus. Les deux qui portaient un risque réel sont corrigés, les trois autres
sont refusés ici, avec leur raison.

_Corrigé — l'horloge lue dans une query._ « Do not read the wall clock inside a
query. Queries are not rerun merely because time advances. » `myEntitlements`
appelait `readEntitlements` sans instant, donc le défaut `new Date()` de
[`authz.ts`](../../../../apps/backend/convex/authz.ts) ; or le droit `cloud`
compare `cloudPeriodEnd` à cet instant. Rien ne change dans la base au moment où
une période se termine, donc rien ne ré-exécute la query : l'éditeur continuait
de lire `cloud: true` après l'échéance, et la première écriture le détrompait par
un `CLOUD_REQUIRED` — exactement l'erreur de sync « à quelqu'un qui n'a rien fait
de mal » que `entitlements.ts` existe pour éviter. L'instant devient un argument
de la query, et `readEntitlements` perd son défaut pour que le cas se décide à la
compilation. Il vient donc du client, et cela ne relâche rien : il ne décide que
de l'affichage, le mur d'écriture restant `requireCloud`, appelé depuis des
mutations, sur l'horloge du déploiement. Un test le tient : la même ligne rend
`cloud: true` avant l'échéance et `false` après.

_Corrigé — la lecture non bornée._ `listProjects` finissait par `.collect()`,
seule lecture du backend sans borne. `.take(PROJECT_CATALOGUE_LIMIT)` la ferme.
Ce n'est pas une limite de produit — 1000 projets pour un compte n'arrivera pas —
mais une soupape : au-dessus, la liste est tronquée, rien n'est supprimé, et une
poussée passe projet par projet sans jamais traverser cette liste.

_Refusé — dériver les validateurs du schéma._ La règle demande de déclarer une
forme une fois et d'en dériver les variantes (`.pick`, `.omit`). Appliquée à
`pushProject` et `listProjects`, elle ferait suivre au contrat public la forme du
stockage : un champ ajouté demain au schéma entrerait tout seul dans les
arguments d'une mutation ouverte au client, ou sortirait tout seul dans sa
réponse. C'est l'inverse de ce qu'on veut à une frontière de confiance, où
l'énumération explicite _est_ le contrôle. Pour `applyEntitlementsIfNewer`, la
divergence est en plus délibérée et documentée sur huit lignes (`v.string()` et
non `v.id('users')`, parce que la valeur vient de Polar).

_Refusé — fusionner les deux lectures du checkout._ « Try to use as few calls
from actions to queries and mutations as possible. » `createCheckout` lit
l'adresse du compte et ses droits par deux `ctx.runQuery` parallèles, donc deux
instantanés. Les deux faits sont indépendants — le portillon ne regarde que
`licence`, l'adresse n'entre que dans le checkout — et rien de fâcheux ne peut se
glisser entre les deux. Une query interne de plus pour les réunir coûterait une
fonction et n'achèterait aucune propriété.

Les cinq écarts réfutés le sont sur pièces et ne laissent rien à faire :
`download.ts` prend bien un `userId` en argument, mais ce sont des `internalQuery`
dont l'unique appelant, `http.ts`, lit l'identité dans la session avant
d'appeler ; le `.js` de `convex.config.ts` est celui que le composant prescrit
lui-même dans son README ; brander `Entitlements.userId` en `Id<'users'>`
étamperait comme identifiant de document tout ce que le cache hors-ligne du
navigateur relit de `localStorage`.

## Après

Deux améliorations que la migration rend possibles et que ce plan a
délibérément laissées de côté, chacune à mesurer pour elle-même :

- **Remplacer le tirage par un abonnement** (`ConvexReactClient` le fournit) :
  un second navigateur verrait la nouvelle version sans recharger, et le cycle de
  `sync.ts` perdrait sa moitié « pull ». Écarté de la phase 3 pour ne pas changer
  le modèle et le transport dans le même mouvement.
- **Servir les binaires par URL plutôt que par `httpAction`** si le poste egress
  devient significatif. C'est un arbitrage sécurité/coût, et il se prend avec des
  chiffres, pas avant.
