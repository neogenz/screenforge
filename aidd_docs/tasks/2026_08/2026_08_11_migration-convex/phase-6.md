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
