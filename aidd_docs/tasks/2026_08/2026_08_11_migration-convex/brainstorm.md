# Brainstorm — remplacer Supabase + `apps/api` par Convex

Date : 2026-08-11
Statut : à arbitrer (deux décisions ouvertes, §7)

## 1. Ce qui est en place, et ce que ça coûte

Le socle SaaS livré le 2026-08-09 tient en cinq briques :

| Brique                     | Où                                             | Volume        |
| -------------------------- | ---------------------------------------------- | ------------- |
| Auth SSO + lien magique    | `lib/supabase.ts`, `lib/auth.ts`, `auth.store.ts` | ~300 lignes   |
| Sync projets + binaires    | `lib/sync.ts`, `lib/sync-queue.ts`             | ~900 lignes   |
| Schéma + RLS + 2 RPC       | `supabase/migrations/*.sql`                    | 444 lignes SQL |
| Backend de vente (Polar)   | `apps/api/src/**`                              | ~800 lignes   |
| Suite RLS « point de vue attaquant » | `supabase/tests/*.test.mjs`          | 5 fichiers    |

Ce socle marche. Ce qu'il coûte, en revanche, est documenté dans le dépôt
lui-même, et ce sont ces trois lignes qui motivent la question :

1. **La règle commerciale existe en trois exemplaires** — `public.has_cloud()`
   en SQL, `toEntitlements` dans `apps/api`, `projectEntitlements` dans
   `apps/web`. `lib/entitlements.ts` le dit noir sur blanc : « Les trois doivent
   répondre pareil, sinon l'éditeur affiche un droit que la base refuse. » Trois
   langages, trois suites de tests, une seule règle.
2. **Deux runtimes de plus à déployer et à surveiller** — un projet Supabase et
   un process Node sur Railway, dont un worker `setInterval` qui existe
   uniquement parce que la suppression de compte doit survivre à un redémarrage.
3. **La clé `service_role` circule** — elle contourne la RLS, elle ne doit jamais
   atteindre un navigateur, et le dépôt paie un grep en CI pour le vérifier.

## 2. Ce que Convex change vraiment

Convex n'a pas de RLS parce qu'il n'a pas de chemin direct vers la base. Il n'y a
pas de PostgREST, pas d'URL de table, pas de clé anonyme qui ouvre un `select`.
Le client appelle des fonctions que l'on écrit ; **la fonction est le mur**.

C'est exactement l'inverse du raisonnement de `cloud_gate.sql`, qui explique que
le verrou ne pouvait pas vivre dans l'API « puisque la sync va du navigateur à
PostgREST en direct ». Cette contrainte disparaît. Conséquence directe : la règle
commerciale passe de trois copies à **une seule** (`convex/entitlements.ts`,
importé par les mutations serveur et par l'éditeur, littéralement le même
fichier). C'est le gain principal, et il est structurel, pas cosmétique.

Le reste s'aligne :

| Aujourd'hui                                   | Convex                                                   |
| --------------------------------------------- | -------------------------------------------------------- |
| `upsert_project_lww` (plpgsql)                | une `mutation` — transactionnelle par construction        |
| `apply_entitlements_if_newer` (plpgsql)       | une `internalMutation`                                    |
| RLS × 4 verbes × 2 tables + Storage           | un helper `requireCloud(ctx)` appelé par les écritures    |
| `service_role` + grep CI                      | fonctions `internal*`, inatteignables depuis le client    |
| `on delete cascade`                           | **rien** — à écrire à la main (§4.3)                      |
| worker Node `setInterval` sur Railway         | un `cron` Convex                                          |
| `AppType` via `hono/client`                   | `api` généré, même garantie à la compilation              |
| `database.types.ts` (`supabase gen types`)    | `_generated/` automatique                                 |
| stack Docker ports 544xx                      | `convex dev --local`, dossier `.convex/`, zéro conteneur  |

Disparaissent du dépôt : `apps/api/` entier, `supabase/` entier, le déploiement
Railway, `@supabase/supabase-js`, `@hono/node-server`, `hono` côté web,
`database.types.ts`.

## 3. Le point dur : le document projet ne rentre pas

**Convex plafonne un document à 1 MiB.** `project-file.ts:40` déclare
`MAX_MANIFEST_BYTES = 4 * 1024 * 1024`. Ce n'est pas une estimation qui se
discute : ce sont deux constantes déclarées qui se contredisent d'un facteur 4.

Le chemin qui y mène est connu. `Release.snapshot` est un `ProjectSnapshot`,
c'est-à-dire `{ name, screens, layoutLayers, globals }` — le projet entier, moins
son identité. `MAX_PROJECT_RELEASES = 20`. Un projet qui a figé vingt lots porte
donc vingt-et-une copies de son graphe, plus douze variantes de langue
(`MAX_PROJECT_LOCALES = 12`). La colonne `data jsonb` d'aujourd'hui l'accepte
sans broncher ; un document Convex, non.

**Décision : le JSON du projet devient un fichier, pas un champ.** La ligne ne
garde que `{ userId, projectId, name, updatedAt, blobId }`.

Ce n'est pas un contournement, c'est une amélioration du modèle actuel. Le
serveur n'a jamais lu à l'intérieur de `data` : le LWW tranche sur `updated_at`
seul. Or `fetchRemoteProjectRows` fait aujourd'hui
`select('id, data, updated_at')` sur **toutes** les lignes, par pages de 500 —
autrement dit il télécharge l'intégralité des projets pour comparer des
horodatages. Sortir le blob de la ligne supprime ce gaspillage en même temps
qu'il supprime le plafond.

Effet de bord à traiter : un blob remplacé laisse l'ancien derrière lui. La
mutation qui écrit la nouvelle version supprime l'ancienne dans la même
transaction — c'est une ligne, et c'est le seul endroit qui écrit ce champ.

## 4. Les trois autres frictions

### 4.1 Les URL de fichiers sont des jetons porteurs

Supabase sert un bucket privé : chaque lecture est autorisée. Convex expose
`storage.getUrl()`, qui rend une URL permanente et non devinable — quiconque
l'obtient lit le fichier, et on ne révoque qu'en supprimant.

Pour les captures d'écran d'applications non annoncées, c'est un cran en dessous
de ce que `storage_assets.sql` promet aujourd'hui. Deux réponses :

- **Servir les octets par une `httpAction` authentifiée.** Parité exacte. Le
  plafond de réponse est de 20 MiB, l'import local est plafonné à 16 MiB
  (`MAX_IMAGE_FILE_BYTES`) : ça passe, sans marge confortable.
- **Accepter l'URL-capacité**, délivrée seulement après contrôle de session.

Recommandation : `httpAction`. La promesse « bucket privé » est écrite dans une
migration et dans la doc produit ; la dégrader en silence n'est pas une option,
et l'écart de code entre les deux est d'une vingtaine de lignes.

À noter aussi : le bucket applique aujourd'hui un plafond de taille et une liste
blanche MIME **côté serveur**. Convex ne filtre rien à l'upload. Le contrôle doit
être refait dans la mutation qui enregistre le fichier — et un fichier déjà
téléversé mais refusé doit être supprimé, pas oublié.

### 4.2 Polar : le composant officiel ne convient pas

`@convex-dev/polar` existe mais ne gère que les abonnements récurrents. La
Licence est un achat unique et perpétuel : le composant est hors sujet.

On garde donc le webhook maison, ce qui est une bonne nouvelle : `entitlements.ts`
(la projection de `customer.state_changed`, le code le plus subtil du backend) est
volontairement pur — ni réseau ni base. Il **migre tel quel**, avec ses tests.

Une seule contrainte technique : une `httpAction` ne peut pas être `"use node"`,
et le SDK Polar l'exige. Le webhook lit donc le corps brut, puis délègue à une
action `"use node"`. Alternative : vérifier la signature Standard Webhooks
directement en Web Crypto (HMAC-SHA256, une vingtaine de lignes) et se passer du
saut. À trancher à l'écriture, pas maintenant.

### 4.3 Il n'y a pas de cascade

`on delete cascade` porte aujourd'hui l'essentiel de la suppression de compte :
`account.ts` le dit — « Une seule instruction suffit ». Sous Convex, tout est
explicite : droits, projets, blobs de projets, fichiers d'assets, sessions
d'auth, utilisateur. Six suppressions, à rendre idempotentes et reprenables, et à
paginer (une mutation écrit au plus 16 000 documents).

La bonne nouvelle est que la file durable (`account_deletion_jobs`) et sa logique
de reprise existent déjà et se transposent : la table devient une table Convex, le
worker `setInterval` devient un `cron`, et la barrière anti-upload devient une
condition dans le helper d'autorisation au lieu d'une policy RLS.

## 5. Auth — la partie la plus incertaine

Aujourd'hui : Supabase Auth, lien magique + Google/GitHub, jeton relu à chaque
appel, session sous la clé `screenforge-auth` (que `e2e/sync.spec.ts` sème pour
ouvrir deux navigateurs sur un même compte).

Trois options, et aucune n'est gratuite.

| Option           | Statut  | Lien magique                    | Coût                        | Ce qu'on y perd / gagne |
| ---------------- | ------- | ------------------------------- | --------------------------- | ----------------------- |
| **Convex Auth**  | **bêta** | oui, via Auth.js + un expéditeur (Resend) | 0 $ + Resend | Tout dans le dépôt, table `users` locale. Mais : API susceptible de bouger, **et il faut un compte Resend + un domaine vérifié** là où Supabase envoyait les courriels |
| **WorkOS AuthKit** | GA    | oui                             | gratuit jusqu'à 1 M         | Mûr, mais UI hébergée et redirection : un écran de plus hors du produit |
| **Clerk**        | GA      | oui                             | gratuit jusqu'à ~10 k MAU   | La meilleure DX, la plus grosse dépendance, et un composant React de plus dans un bundle mesuré |

Le point qui pèse le plus lourd n'est pas dans ce tableau : **Convex Auth ne fait
ni limitation de débit, ni protection contre le bourrage, ni verrouillage de
compte** — sa page sécurité n'en parle pas, et c'est délibéré. Supabase Auth
fournit tout cela par configuration (`[auth.rate_limit]` dans `config.toml`, plus
un captcha optionnel). Voir §6 : ce n'est pas une note de bas de page, c'est un
lot de travail créé par la migration.

Sur la migration des identités elle-même : les `uuid` de `auth.users` servent
d'`externalCustomerId` chez Polar. Si des comptes existent en production, changer
de fournisseur d'auth casse ce lien et il faut réécrire les clients Polar. Si
aucun compte n'existe — ce que suggèrent `plan.md` (« trois comptes tiers restent
à créer ») et l'absence de toute référence à un projet Supabase hébergé —, il n'y
a strictement rien à migrer et une phase entière disparaît. **C'est la première
question à trancher.**

## 6. Limitation de débit — aujourd'hui absente là où elle compte

État des lieux, mesuré : `grep -i "rate.limit\|throttl"` ne trouve **rien** dans
`apps/api` ni dans `apps/web`. La seule limitation du produit est celle de
Supabase Auth, en configuration.

Autrement dit, ces routes sont aujourd'hui non bornées :
`POST /billing/checkout`, `POST /billing/portal`, `DELETE /account`, et le chemin
de sync (upserts projets + uploads Storage), tous authentifiés mais illimités.

Migrer sans rien ajouter serait donc une **régression** sur l'auth et un statu quo
sur le reste. Le composant `@convex-dev/rate-limiter` couvre le besoin, et son
intérêt propre est qu'il compte dans la même transaction que la mutation qu'il
garde : un débit consommé par une mutation qui échoue est rendu. Cinq compteurs
suffisent, tous par utilisateur ou par adresse :

| Ce qui est gardé            | Pourquoi                                             |
| --------------------------- | ---------------------------------------------------- |
| envoi de lien magique       | remplace `[auth.rate_limit] email_sent`, protège la réputation d'expédition |
| vérification de code / lien | ce que Convex Auth ne fait pas : le bourrage          |
| `billing/checkout`          | chaque appel crée un objet chez un tiers              |
| URL d'upload d'asset        | seule porte vers du stockage facturé                  |
| poussée de projet           | borne le coût récurrent du seul droit qui en a un     |

À écrire une fois, comme un helper au-dessus des mutations, pas au cas par cas.

## 7. Les deux décisions à prendre avant de planifier

1. **Y a-t-il des comptes et des données en production ?** Si non : pas de phase
   de migration de données, pas de réécriture des clients Polar, et la bascule
   est un remplacement, pas une cohabitation.
2. **Quel fournisseur d'auth ?** Convex Auth (tout dans le dépôt, bêta, sécurité
   à notre charge) contre WorkOS/Clerk (GA, gratuit à notre échelle, une
   dépendance de plus et un écran hors produit).

## 8. Ce que la migration coûte, honnêtement

- **Elle inverse une décision explicite du plan précédent.** `plan.md` retient
  Supabase pour la « sécurité déclarative RLS adaptée au dev 100 % IA » et note
  « zéro trigger métier en DB (choix utilisateur contre le lock-in) ». Convex est
  *plus* enfermant que Postgres : tout le backend devient du TypeScript Convex.
  L'atténuation est réelle (`npx convex export` rend les données, les fonctions
  sont du TS ordinaire) mais elle n'annule pas le fait.
- **Le corpus IA est plus petit** que celui de Postgres/Supabase — critère que le
  brainstorm de 2026-08-05 posait comme structurant.
- **Un plafond de 1 MiB par document** contraint le modèle pour toujours, même
  après le contournement du §3.
- **`convex-test` est un simulateur JS** : il n'applique ni les limites de taille
  ni les crons. La suite « point de vue attaquant » se réécrit et reste valable —
  en Convex l'autorisation *est* le code de la fonction — mais elle ne prouvera
  plus rien sur les limites de la plateforme.
- **Coûts** : plan gratuit Convex à 0,5 Go de base, 1 Go de fichiers, 1 M
  d'appels ; au-delà 25 $/dev/mois. Supabase (~25-30 $) et Railway (~5 $) tombent.
  À l'échelle actuelle c'est neutre à légèrement favorable ; à l'échelle de
  quelques centaines de comptes déposant des captures de 16 Mo, le poste fichiers
  décide.

## 9. Ce que ça rapporte

- Une seule copie de la règle commerciale au lieu de trois, et c'est celle qui
  fait aujourd'hui l'objet d'un avertissement écrit dans le code.
- Un déploiement au lieu de trois (Supabase + Railway + statique → Convex +
  statique).
- Pas de clé `service_role`, donc pas de grep en CI pour la garder.
- Pas de Docker en développement ni en intégration continue.
- 444 lignes de SQL et 5 fichiers de test RLS remplacés par du TypeScript testé
  par le même lanceur que le reste du dépôt.
- Une sync qui cesse de télécharger tous les projets pour comparer des dates.
- Un webhook, un cron et une API dans le même déploiement que la base, sans
  process Node à surveiller.

## Sources vérifiées le 2026-08-11

| Source | Ce qui en est retenu |
| ------ | -------------------- |
| https://docs.convex.dev/production/state/limits | Document 1 MiB, 1024 champs, profondeur 16, 8192 éléments ; arguments et retour 16 MiB ; réponse `httpAction` 20 MiB ; transaction 16 MiB lus/écrits, 16 000 documents écrits |
| https://docs.convex.dev/auth | Convex Auth en bêta ; Clerk, WorkOS, Auth0, OIDC générique |
| https://labs.convex.dev/auth/config/email | Lien magique via un fournisseur Auth.js, Resend donné en exemple ; domaine à vérifier |
| https://labs.convex.dev/auth/security | Jeton d'accès 1 h + jeton de rafraîchissement, `localStorage`, détection de réemploi ; **rien sur la limitation de débit ni le verrouillage** |
| https://docs.convex.dev/file-storage | `storage.getUrl()` = URL porteuse non révocable ; contrôle d'accès à faire avant de la donner, ou servir les octets par `httpAction` |
| https://docs.convex.dev/functions/http-actions | Corps brut accessible (`request.text()`), CORS manuel, pas d'API Node |
| https://docs.convex.dev/database/schemas | Schéma en code, validé au push contre les documents existants ; pas d'étape de migration séparée |
| https://docs.convex.dev/scheduling/cron-jobs | `crons.ts`, une exécution au plus à la fois par tâche |
| https://docs.convex.dev/testing/convex-test | Simulateur JS + vitest, `withIdentity` ; n'applique ni limites ni crons |
| https://docs.convex.dev/cli/local-deployments | `convex dev --local`, état dans `.convex/`, sans conteneur ; pas d'URL publique |
| https://www.convex.dev/components/rate-limiter | Fenêtre fixe ou seau à jetons, clés par utilisateur, compté dans la transaction de l'appelant |
| https://www.convex.dev/components/polar | Composant Polar limité aux abonnements récurrents |
| https://stack.convex.dev/migrate-data-postgres-to-convex | `\copy … row_to_json` → JSONL → `npx convex import --format jsonLines --replace --table` |
