---
status: done
---

# Phase 1 — Socle `apps/backend`, authentification, débit d'auth

**But** : un déploiement Convex qui sait dire qui est connecté, par lien magique
et par les deux fournisseurs OAuth déjà prévus, avec les compteurs que Convex
Auth ne fournit pas. Rien n'est branché sur l'éditeur : `VITE_CONVEX_URL` reste
absente et le chemin Supabase continue de servir.

## Pourquoi la limitation de débit est dans cette phase

`labs.convex.dev/auth/security` ne mentionne ni limitation de débit, ni
protection contre le bourrage, ni verrouillage de compte : ce n'est pas un oubli
de la documentation, c'est le périmètre de la bibliothèque. Supabase Auth
fournissait cela par configuration (`[auth.rate_limit]`, `email_sent = 2` en
local). Livrer l'auth sans les compteurs, ce serait publier une régression et se
promettre d'y revenir. Ils naissent donc avec elle.

## Tâches

### 1.1 Le paquet

- `apps/backend/` : `package.json` (`name: "backend"`, `private`, `type: module`,
  `exports` pointant sur `convex/_generated/api.d.ts` et `convex/_generated/api.js`),
  `convex.json`, `tsconfig.json`.
- Scripts racine, en délégation comme les autres :
  `dev:backend` → `pnpm --filter backend run dev` (`convex dev --local`),
  `deploy:backend` → `convex deploy`.
- `.gitignore` : `apps/backend/.convex/` (état du backend local).
- `apps/web/package.json` : `"backend": "workspace:*"` en `devDependencies`,
  à côté de `"api": "workspace:*"` qui reste jusqu'à la phase 6.

### 1.2 Convex Auth

- `npm i @convex-dev/auth @auth/core@0.41.1`, puis `npx @convex-dev/auth` pour
  générer `JWT_PRIVATE_KEY` et `JWKS` dans l'environnement du déploiement.
- `convex/schema.ts` : `...authTables` seul pour l'instant. Les tables métier
  arrivent en phase 2 — un schéma vide de métier se pousse et se valide, et ça
  vérifie la chaîne avant d'y mettre quoi que ce soit.
- `convex/auth.ts` : `convexAuth({ providers: [Resend, Google, GitHub] })`.
- `convex/http.ts` : `auth.addHttpRoutes(http)`.
- Variables : `AUTH_RESEND_KEY`, `AUTH_GOOGLE_ID/SECRET`, `AUTH_GITHUB_ID/SECRET`,
  `SITE_URL`. Aucune ne porte le préfixe `VITE_` — elles vivent dans
  l'environnement Convex, jamais dans `.env` du navigateur.

### 1.3 Les compteurs

- `npm i @convex-dev/rate-limiter`, déclaré dans `convex/convex.config.ts`.
- `convex/limits.ts`, un seul fichier, un seul endroit où les valeurs sont
  écrites :

  | Nom             | Algorithme     | Valeur                          | Clé            |
  | --------------- | -------------- | ------------------------------- | -------------- |
  | `magicLinkSend` | fenêtre fixe   | 3 / heure                       | courriel       |
  | `magicLinkSendPerIp` | seau à jetons | 10 / heure, capacité 3     | IP             |
  | `signInVerify`  | seau à jetons  | 10 / heure, capacité 5          | courriel       |

  Les deux clés pour l'envoi ne font pas double emploi : la première protège le
  titulaire d'une boîte contre l'inondation, la seconde protège la réputation du
  domaine expéditeur contre quelqu'un qui balaierait des adresses.

- Branchement dans les callbacks de `convexAuth` (`createOrUpdateUser` /
  l'appel de `signIn` côté serveur), pas dans un middleware : le composant
  compte dans la transaction de l'appelant, et un envoi qui échoue doit rendre
  son jeton.
- Le refus lève un `ConvexError` typé que `lib/auth.ts` traduit en message :
  « Trop de tentatives. Réessayez dans un instant. » Jamais le message brut.

### 1.4 Côté web

- `lib/convex.ts`, copie conforme de la forme de `lib/supabase.ts` — c'est ce
  fichier qui porte l'invariant, et sa forme a été raisonnée :
  - `cloudConfigured = Boolean(import.meta.env.VITE_CONVEX_URL)` — constante de
    compilation, donc tout ce qu'elle garde disparaît à l'élagage ;
  - `getConvex(): Promise<ConvexReactClient> | null`, `import()` dynamique,
    `null` et jamais une promesse rejetée quand l'instance n'est pas configurée ;
  - clé de stockage de session explicite, pour la même raison qu'aujourd'hui :
    `e2e/sync.spec.ts` la sème pour ouvrir deux navigateurs sur un compte, faute
    de pouvoir automatiser la réception d'un lien magique.
- `lib/auth.ts` réécrit sur `useAuthActions` : `signInWithProvider`,
  `signInWithEmail`, `signOut`, `signOutAndReport`. Les signatures ne changent
  pas — elles rendent `{ error }` au lieu de lever, et acceptent d'être appelées
  sans instance configurée. Les appelants (barre du haut, palette, dialog) ne
  bougent pas.
- `auth.store.ts` : `status: 'unknown' | 'signed-out' | 'signed-in'` conservé tel
  quel. `unknown` reste un état réel, pas une valeur d'attente polie. Le store
  s'abonne à l'état de Convex Auth au lieu de `onAuthStateChange`.
- `main.tsx` : `ConvexAuthProvider` monté **seulement** si `cloudConfigured`.
  Sans instance, l'arbre React est celui d'aujourd'hui, à l'identique.

### 1.5 Développement et intégration continue

- `convex dev --local` remplace `supabase start` : état dans `apps/backend/.convex/`,
  aucun conteneur. Les deux cohabitent jusqu'à la phase 6.
- `convex-test` + `@edge-runtime/vm`, lancés par le `vitest` déjà en place :
  `pnpm --filter backend run test:unit` s'ajoute au `pnpm -r run test:unit`
  existant, sans nouveau lanceur.

## Critères d'acceptation

1. `pnpm --filter backend run dev` démarre un backend local sans Docker et sans
   compte Convex.
2. Connexion par lien magique de bout en bout sur le déploiement de
   développement ; le courriel part par Resend depuis un domaine vérifié.
3. Connexion par Google et par GitHub, retour sur l'éditeur (`/`), jamais sur la
   vitrine.
4. La session survit à un rechargement ; `signOut` la retire.
5. Sans `VITE_CONVEX_URL` : `status` tombe sur `signed-out` immédiatement, aucun
   module Convex n'est demandé au réseau, et `e2e/boot-shell.spec.ts` passe avec
   le même budget qu'avant.
6. Quatre envois de lien magique consécutifs sur la même adresse : le quatrième
   est refusé, avec le message traduit et non l'erreur brute.
7. Six vérifications de code erronées pour une adresse : la sixième est refusée.
8. Les deux tests précédents existent en `convex-test`, et chacun porte son
   contre-test — un compteur qui refuserait tout passerait sinon une suite de
   refus tout en cassant la connexion.
9. `pnpm test` et `pnpm run lint` verts ; `apps/api` et `supabase/` intacts.

## Ce qui n'est pas fait ici

Aucune table métier, aucune donnée utilisateur, aucun droit. La phase 1 ne sait
que reconnaître quelqu'un.

## Écarts constatés à l'implémentation (2026-08-11)

Ce que le terrain a démenti. Les tâches et les critères ci-dessus restent
écrits tels qu'ils ont été planifiés ; ce qui suit dit où le code s'en éloigne
et pourquoi, pour que la relecture compare à la réalité et non au projet.

**1. Une quatrième porte : le mot de passe.** Le plan prévoyait
`[Resend, Google, GitHub]`. Ni le lien magique ni un SSO ne s'ouvrent sans
intervention humaine — l'un arrive par courrier, l'autre passe par un tiers —
donc aucune suite automatisée ne pouvait ouvrir de session, et aucun compte de
test n'était reproductible d'un environnement à l'autre. `Password` est ajouté
sans vérification d'adresse : l'exiger ferait dépendre cette porte de
l'expéditeur, c'est-à-dire de ce dont elle existe pour être indépendante. La
contrepartie est explicite dans `convex/auth.ts` — une adresse non vérifiée ne
vaut pas identité.

**2. `magicLinkSendPerIp` n'existe pas ; c'est `magicLinkSendGlobal`.** Une
fonction Convex ne connaît pas l'IP de l'appelant : seule une `httpAction`
reçoit des en-têtes, et `signIn` est une action ordinaire. Le plafond global
(100/heure) défend le même bien — la réputation du domaine expéditeur contre un
balayage d'adresses — avec un prix assumé et écrit : un balayage peut fermer le
lien magique pour une heure, pendant laquelle le mot de passe et les deux SSO
restent ouverts.

**3. `signInVerify` n'est pas un compteur de `limits.ts`.** La prémisse de la
section « Pourquoi la limitation de débit est dans cette phase » est en partie
périmée : `@convex-dev/auth@0.0.94` borne bel et bien les vérifications de
secret, par `signIn.maxFailedAttempsPerHour`. Le compteur est tenu par compte,
décroît d'un par secret refusé, se recharge en continu sur l'heure et est remis
à zéro par une connexion réussie. Il est posé à `5` — la valeur qui rend le
critère 7 vrai au mot près — plutôt que redoublé par un compteur maison qui
aurait compté les mêmes échecs deux fois. C'est la seule protection du dépôt qui
ne vit pas dans `limits.ts`, et `convex/auth.ts` le dit à l'endroit où on la
cherche.

**4. Ce qui reste suspendu à un humain.** Les critères 2 et 3 (lien magique de
bout en bout depuis un domaine vérifié, retour Google et GitHub) exigent un
déploiement cloud, donc `npx convex login` par navigateur, une clé Resend, un
domaine vérifié et deux applications OAuth. Rien de tout cela n'est lisible ni
créable sans un humain. Le code est complet et poussé sur le déploiement local ;
la liste exacte des valeurs à poser, et la commande pour chacune, est dans
[`environnements.md`](./environnements.md).
