# Brainstorm — ScreenForge : passage SaaS (stack & architecture)

Date : 2026-08-05
Statut : consolidé, prêt pour planification / spécification

## Contexte

ScreenForge est un éditeur local-first (Vite + React 19 + Fabric.js + Zustand + IndexedDB, zéro backend) qui génère des screenshots App Store pixel-exact. Double ambition :

1. Outil personnel pour générer les screenshots App Store.
2. SaaS payant : comptes, SSO (Google/GitHub), abonnement Stripe.

Contrainte structurante : **le SaaS sera codé à 100 % par IA, sans relecture humaine du code**. La stack doit donc maximiser le corpus IA, offrir des garde-fous déclaratifs (sécurité dans la DB plutôt que dans le code), et des filets automatiques (types générés, CI bloquante).

Autre contrainte : l'utilisateur paie déjà un plan Supabase (~30 $/mois).

## Idée clarifiée

- Le **cœur produit reste 100 % client** : canvas, export pixel-exact, IndexedDB. Aucune technologie serveur ne touche ce chemin critique.
- Le passage SaaS ajoute trois besoins : **authentification (SSO), persistance cloud des projets, billing**.
- Pas de réécriture de la stack existante : le SSR (TanStack Start, Next.js) n'apporte rien à un éditeur canvas. L'app actuelle se porte telle quelle.
- La sync cloud est **coarse-grained** (sauvegarde/reprise de projets entre appareils), pas du temps réel, pas de collaboration.
- **Backend réel dès le départ** (choix assumé de l'utilisateur) : la logique métier vit dans du code versionné et testable, pas dans des triggers DB — pour la lisibilité, la portabilité et contre le lock-in.
- La DB garde **RLS (autorisation, defense-in-depth) + contraintes d'intégrité** — jamais de triggers métier.

## Architecture retenue

```
apps/web   → Vite SPA (inchangé)
           → supabase-js : Auth SSO + CRUD simple (gardé par RLS)
apps/api   → Hono — petit backend, TOUTE la logique métier :
             • webhooks Stripe + création de sessions Checkout
             • quotas / plans (vérifiés sur les opérations sensibles)
             • orchestration de la sync cloud
           → valide le JWT Supabase sur chaque requête
           → client typé end-to-end via Hono RPC (hc) + zod
DB         → Supabase Postgres : RLS partout + contraintes d'intégrité
Storage    → Supabase Storage (binaires, URLs signées) — jamais de base64 en DB
Hosting    → SPA en statique (Cloudflare Pages ou équivalent, ~0 €)
           → API Hono : Cloudflare Workers ou Railway (~5 $/mois)
```

Partage des responsabilités :

- **DB** : intégrité + autorisation (RLS) — l'incontournable, impossible à contourner
- **Backend Hono** : toute la logique métier (billing, quotas, sync)
- **Client** : cœur produit (édition, export), CRUD simple via PostgREST

## Décisions écartées (avec raisons)

| Option | Verdict | Raison |
|---|---|---|
| TanStack Start / Next.js (SSR) | Écarté | SSR inutile pour un éditeur canvas ; migration du shell sans gain |
| Server functions (TanStack/Next) | Écarté | Feature de framework, pas ajoutable seule ; Hono `hc` + zod donne le même typage avec une frontière d'API explicite (préférable sans relecture humaine) |
| Convex | Écarté | Temps réel inutilisé, double modèle de données, lock-in, auth beta |
| Neon | Écarté (pour ce cas) | Excellent et mature (Databricks, Replit, Retool), mais nouveau compte + courbe d'apprentissage vs un abonnement Supabase déjà payé |
| better-auth | Écarté | Conflit avec Supabase Auth : la RLS, le Storage et les JWT Supabase s'appuient sur `auth.uid()` natif ; un second système d'auth casserait l'intégration RLS et créerait deux sources de vérité. Stripe s'intègre directement dans Hono (pattern standard, très bien connu des IA) — le plugin Stripe de better-auth ne justifie pas la séparation |
| Triggers métier en DB | Écarté (choix utilisateur) | Logique métier dans le backend Hono uniquement ; la DB ne garde que RLS + intégrité |
| 100 % Supabase sans backend | Écarté (choix utilisateur) | Préférence pour un vrai backend dès le départ (portabilité, lisibilité, pas de lock-in par triggers) |

## Garde-fous obligatoires (contexte 100 % IA, sans relecture)

1. Jamais la clé `service_role` côté client ni dans le contexte IA — uniquement la clé `anon` + RLS.
2. `supabase gen types` en CI — le typage DB → client casse la compile si l'IA invente un champ.
3. RLS activé sur TOUTE table dès sa création + test qu'un user ne lit pas les données d'un autre.
4. CI bloquante (`pnpm run test:release`) sur chaque push — la CI est la relecture.
5. Migrations versionnées (`supabase migration`) — jamais de modif de schéma à la main.
6. AGENTS.md tenu à jour — empêche l'IA d'halluciner les conventions.
7. Frontière d'API explicite (Hono) — les checks d'auth/quotas vivent à un endroit auditable.

## Hypothèses ouvertes & risques (à trancher au design)

> Document daté du 2026-08-05, conservé tel quel — il enregistre ce qui était su
> ce jour-là. Deux points ci-dessous ont été tranchés depuis, contre ce qui était
> supposé ici : le **2** (le pricing n'est pas un abonnement mais une licence
> perpétuelle plus un add-on annuel, et la limite du gratuit porte sur l'export)
> et le **5** (Merchant of Record, donc la TVA n'est plus à notre charge —
> Stripe direct est écarté). Voir
> [`../2026_08_06_offre-commerciale/pricing.md`](../2026_08_06_offre-commerciale/pricing.md)
> et le [plan](./plan.md) réaligné le 2026-08-07.

1. **Sync IDB → cloud** : stratégie de conflit (last-write-wins ? versioning ?), déclencheur (manuel/auto), file offline — le vrai sujet de design.
2. **Modèle de pricing** : gratuit limité vs payant, limites (projets, exports) — impacte schéma DB et Stripe.
3. **Migration anonyme → compte** : rattacher un projet local à un compte après inscription (probablement oui, à spécifier).
4. **RLS** : policies à écrire ET tester — seul point où l'IA peut introduire un trou silencieux.
5. **TVA / mentions légales** : tax collection Stripe, obligations pour encaisser — hors scope technique.
6. **Landing/marketing** : hors scope (page statique séparée suffira).
7. **Périmètre du backend** : la frontière exacte entre CRUD direct PostgREST et opérations via Hono devra être définie à la spécification (règle proposée : toute écriture soumise à une règle métier passe par l'API).

## Prochaine étape

L'idée est prête pour :

- une **planification** en phases (schéma DB + RLS → auth → sync → billing), ou
- une **spécification** du contrat de sync IDB → cloud (le point le plus délicat).
