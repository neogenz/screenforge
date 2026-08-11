---
objective: "Remplacer Supabase (Auth, Postgres, RLS, Storage) et le service Hono de vente par un unique déploiement Convex, sans jamais rendre l'éditeur dépendant du réseau ni toucher au chemin critique d'export."
status: in-progress
---

# Plan : migration Supabase + `apps/api` → Convex

## Overview

| Champ          | Valeur                                                                              |
| -------------- | ----------------------------------------------------------------------------------- |
| **But**        | Un seul backend, une seule copie de la règle commerciale, zéro clé qui contourne l'autorisation |
| **Source**     | [`brainstorm.md`](./brainstorm.md) (2026-08-11)                                       |
| **Remplace**   | La couche serveur de [`../2026_08_05_screenforge-saas/plan.md`](../2026_08_05_screenforge-saas/plan.md) — l'offre, les prix et les règles de vente sont inchangés |
| **Autorité offre** | [`../2026_08_06_offre-commerciale/pricing.md`](../2026_08_06_offre-commerciale/pricing.md) |

## Décisions prises en amont

| Décision                              | Valeur                    | Conséquence                                                                 |
| ------------------------------------- | ------------------------- | --------------------------------------------------------------------------- |
| Données en production                 | **Projet Supabase hébergé, aucun compte** | Aucune migration de données. Le projet et ses clés sont à démanteler proprement (phase 6), pas à vider |
| Fournisseur d'authentification        | **Convex Auth** (bêta)    | Tout reste dans le dépôt. En contrepartie : un expéditeur de courriels à ajouter (Resend + domaine vérifié) et **la limitation de débit est entièrement à notre charge** |
| Emplacement du backend                | `apps/backend/`           | Paquet de l'espace de travail, comme `apps/api` aujourd'hui. La racine ne porte que de l'outillage (règle `AGENTS.md`), et `apps/web` importe les types générés via `"backend": "workspace:*"` — exactement le motif de `"api": "workspace:*"` |
| Le document projet                    | **fichier, pas champ**    | Convex plafonne un document à 1 MiB, `MAX_MANIFEST_BYTES` vaut 4 MiB. La ligne ne garde que `{ userId, projectId, name, updatedAt, blobId }` |
| Lecture des binaires                  | **`httpAction` authentifiée** | Parité avec le bucket privé. `storage.getUrl()` rend une URL porteuse non révocable, ce que `storage_assets.sql` promet explicitement de ne pas faire |
| Composant `@convex-dev/polar`         | **écarté**                | Il ne gère que les abonnements récurrents ; la Licence est un achat unique. Le webhook maison est conservé, et `entitlements.ts` migre tel quel |
| Limitation de débit                   | **`@convex-dev/rate-limiter`, lot obligatoire** | Aujourd'hui il n'y en a nulle part sauf dans la configuration Supabase Auth. Migrer sans l'ajouter serait une régression |

## L'invariant qui ne bouge pas

**L'éditeur fonctionne à 100 % sans compte, sans réseau et sans backend.** C'est
la promesse du produit, elle est mesurée (`e2e/boot-shell.spec.ts`), et aucune
phase de ce plan n'a le droit de l'entamer. En pratique : `VITE_CONVEX_URL`
absente ⇒ constante de compilation `false` ⇒ rien du client Convex n'est chargé
ni même conservé par l'élagage, exactement comme `cloudConfigured` le fait
aujourd'hui pour Supabase.

Corollaire : le client Convex se charge par `import()` dynamique. Convex Auth
impose `ConvexReactClient` (WebSocket) ; c'est acceptable parce qu'il n'est
instancié qu'après avoir constaté que l'instance est configurée.

## Phases

| #   | Phase                                                | Fichier                      | Supprime |
| --- | ---------------------------------------------------- | ---------------------------- | -------- |
| 1   | Socle `apps/backend`, authentification, débit d'auth  | [`phase-1.md`](./phase-1.md) | `lib/supabase.ts` |
| 2   | Schéma, droits, et le mur d'autorisation             | [`phase-2.md`](./phase-2.md) | `has_cloud()`, `toEntitlements` |
| 3   | Sync des projets et des binaires                     | [`phase-3.md`](./phase-3.md) | `upsert_project_lww`, la pagination `data` |
| 4   | Vente Polar : checkout, portail, webhook             | [`phase-4.md`](./phase-4.md) | `apply_entitlements_if_newer`, `GET /me` |
| 5   | Suppression de compte, sans cascade                  | [`phase-5.md`](./phase-5.md) | le worker `setInterval` |
| 6   | Démantèlement, documentation, validation de release  | [`phase-6.md`](./phase-6.md) | `apps/api/`, `supabase/` |

Chaque phase laisse le dépôt vert (`pnpm test`) et l'application utilisable.
Les phases 1 à 5 cohabitent avec le code Supabase existant : rien n'est supprimé
avant la phase 6, ce qui rend chaque étape réversible par un `git revert` seul.

### Ce qui bascule quand

La bascule utilisateur ne se fait pas phase par phase : `VITE_CONVEX_URL` reste
absente jusqu'à la fin de la phase 5. Les phases livrent donc du backend testé
mais non branché, et la phase 6 échange les deux variables d'un coup. C'est ce
qui permet de ne jamais avoir deux sources de vérité vivantes en même temps —
et, l'instance de production étant vide, il n'y a rien à réconcilier.

## Limitation de débit — vue d'ensemble

Un compteur naît avec la surface qu'il garde, jamais avant : un compteur sans sa
route est du code mort, et un compteur ajouté après coup se découvre en
production. La table ci-dessous est donc l'index des phases, pas un lot à part.

| Garde                          | Clé            | Phase | Pourquoi                                                     |
| ------------------------------ | -------------- | ----- | ------------------------------------------------------------ |
| Envoi de lien magique          | courriel + IP  | 1     | Remplace `[auth.rate_limit] email_sent`, protège la réputation d'expédition |
| Vérification de lien / code    | courriel + IP  | 1     | Le bourrage — ce que Convex Auth ne fait explicitement pas    |
| URL d'upload d'asset           | utilisateur    | 3     | Seule porte vers du stockage facturé                          |
| Poussée de projet              | utilisateur    | 3     | Borne le coût récurrent du seul droit qui en a un             |
| Ouverture de checkout / portail| utilisateur    | 4     | Chaque appel crée un objet chez un tiers                      |
| Demande de suppression         | utilisateur    | 5     | Geste irréversible, et chaque tentative relance un cycle      |

## Risques et ce qui les tient

| Risque                                                        | Tenu par                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Convex Auth est en bêta : l'API peut bouger                   | Version épinglée ; toute la surface d'auth passe par `lib/auth.ts` et `auth.store.ts`, deux fichiers |
| Convex Auth ne protège pas contre le bourrage                 | Phase 1, compteurs sur l'envoi **et** sur la vérification, avec leur test  |
| Le document projet dépasse 1 MiB                              | Phase 3, le JSON devient un fichier ; un test pose un projet à 20 releases |
| Une URL de fichier fuit et n'est pas révocable                | Phase 3, les octets passent par une `httpAction` authentifiée             |
| Convex ne filtre ni la taille ni le type à l'upload           | Phase 3, contrôle dans la mutation d'enregistrement + suppression du fichier refusé |
| Pas de cascade : une suppression de compte laisse des orphelins| Phase 5, suppression explicite paginée, idempotente, reprise par cron     |
| `convex-test` est un simulateur : ni limites ni crons         | Phase 6, un passage manuel documenté contre un déploiement réel avant bascule |
| Le lock-in augmente par rapport à Postgres                    | Assumé et écrit (`brainstorm.md` §8). `npx convex export` reste la sortie de secours |

## Ce que le dépôt perd, mesuré

- `apps/api/` : 17 fichiers, ~1 100 lignes de source hors tests.
- `supabase/` : 6 migrations (444 lignes de SQL), `config.toml` (439 lignes),
  5 fichiers de test RLS.
- `apps/web/src/types/database.types.ts` : 271 lignes générées.
- `apps/web/src/lib/supabase.ts` : 61 lignes.
- Dépendances : `@supabase/supabase-js` (racine, web, api), `hono` et
  `@hono/node-server` (api), `hono` (web), `standardwebhooks`.
- Scripts racine : `db:start`, `db:stop`, `db:migrate`, `gen:types`, `test:rls`.
- Le service Railway et le job Docker de la CI.

## Ressources vérifiées

Voir [`brainstorm.md` §Sources](./brainstorm.md#sources-vérifiées-le-2026-08-11).
Ajouts propres au plan :

| Source | Retenu |
| ------ | ------ |
| https://labs.convex.dev/auth/setup | `npm i @convex-dev/auth @auth/core@0.41.1`, puis `npx @convex-dev/auth` pour générer les clés ; `authTables` dans le schéma ; `ConvexAuthProvider` autour de `ConvexReactClient` |
| https://labs.convex.dev/auth/config/oauth | `npx convex env set AUTH_GITHUB_ID …` ; rappel sur `https://<deployment>.convex.site/api/auth/callback/<provider>` ; `signIn("github")` côté client |
