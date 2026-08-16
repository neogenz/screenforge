# Review: offres Local et Cloud avec compte propriétaire

> **Archive de baseline — remplacée le 2026-08-16.** Ce verdict porte sur
> l’ancien Local payant. Les findings correctifs et leurs contre-tests sont
> désormais couverts par les sept phases du [`plan.md`](./plan.md); cette review
> ne peut pas être utilisée pour clôturer le plan révisé.

- **Verdict**: blocked
- **Diff**: `2771c86...cf9d545`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_15
- **Findings**: 8 critical, 2 warning, 0 minor

## Phases

### Phase 1 — Transformer les droits et la facturation en offres Local et Cloud autonomes

- [x] `PLANS` et les unions de checkout n’exposent que `local` et `cloud` — `apps/web/src/lib/plans.ts:13`, `apps/backend/convex/polar.ts:49`
- [x] Cloud est achetable directement sans `LICENCE_REQUIRED` — `apps/backend/convex/polar.ts:64`
- [x] Cloud actif donne export propre, ZIP et sync sans achat Local séparé — `apps/backend/convex/entitlements.test.ts`
- [x] L’expiration conserve uniquement un achat Local perpétuel réellement acquis — `apps/backend/convex/entitlements.test.ts`
- [x] Le LWW ignore les anciens webhooks et applique les révocations récentes — `apps/backend/convex/mirror.test.ts`
- [x] Les lignes Convex historiques restent lisibles sans migration destructive — `apps/backend/convex/schema.ts`, `apps/backend/convex/mirror.test.ts`

### Phase 2 — Garantir la sauvegarde Cloud complète des projets, assets et préférences durables

- [x] Un projet riche et ses assets survivent au round-trip entre deux navigateurs — `apps/web/e2e/sync.spec.ts:303`
- [x] `userSettings` est borné au thème et à sa date — `apps/backend/convex/schema.ts:117`, `apps/backend/convex/settings.ts:5`
- [x] Le dernier thème gagne et reste disponible hors ligne — `apps/backend/convex/settings.ts:23`, `apps/web/src/lib/user-settings.ts`
- [x] Les projets, assets et préférences restent isolés par compte — `apps/backend/convex/settings.test.ts`, `apps/backend/convex/assets.test.ts`, `apps/backend/convex/projects.test.ts`
- [x] Après expiration, lecture et suppression restent possibles mais les écritures sont refusées — `apps/backend/convex/settings.test.ts`, `apps/backend/convex/authz.test.ts`
- [x] La suppression de compte couvre `userSettings` et les blobs Storage — `apps/backend/convex/accountDeletion.test.ts`

### Phase 3 — Aligner l’éditeur, le compte et la landing sur les deux offres

- [x] Landing, Offres et Compte n’affichent que Local et Cloud comme offres — `apps/web/e2e/commercial-launch.spec.ts:18`
- [x] Aucun texte visible, JSON-LD ou audit ne présente Cloud comme add-on — `scripts/commercial-profile-audit.mjs`, `apps/web/e2e/commercial-launch.spec.ts:22`
- [x] Local est à 49 $ une fois et Cloud à 39 $/an dans les deux langues et profils — `apps/web/src/lib/plans.ts:26`, `apps/web/src/landing/copy.ts`
- [x] Cloud seul est pleinement actif et Local historique garde son fallback — `apps/web/src/lib/plans.ts:64`, `apps/web/src/lib/__tests__/entitlements.test.ts`
- [x] Les surfaces commerciales passent clavier, mobile, clair/sombre et contraste — `apps/web/e2e/dialogs-a11y.spec.ts`, `scripts/contrast-audit.mjs`
- [x] Les builds pré-rendus contiennent exactement deux offres structurées — `scripts/commercial-profile-audit.mjs`, `scripts/prerender-landing.mjs`

### Phase 4 — Ajouter puis provisionner un accès propriétaire complet et révocable

- [x] Aucun identifiant propriétaire ni secret n’est versionné — `apps/backend/convex/mirror.ts:133`
- [x] Le grant est interne, idempotent, révocable et limité à un compte existant — `apps/backend/convex/mirror.ts:133`, `apps/backend/convex/mirror.test.ts`
- [x] Le grant complet active uniquement les droits client Local et Cloud — `apps/web/e2e/sync.spec.ts:1189`
- [x] Polar et la dérogation restent indépendants; la révocation restaure les droits Polar — `apps/backend/convex/mirror.ts:184`, `apps/backend/convex/mirror.test.ts`
- [ ] Le compte cible réel réussit projet, asset et thème en préprod puis production — aucune identité réelle ni déploiement distant n’a été disponible et vérifié (`production-security-evidence.md:35`)
- [x] La révocation est testée et documentée — `apps/web/e2e/sync.spec.ts:1224`, `aidd_docs/tasks/2026_08/2026_08_11_migration-convex/environnements.md`

### Phase 5 — Durcir le déploiement et l’exploitation avant production

- [ ] Preview protégée et production passent l’audit HTTP avec CSP bloquante et HSTS — aucun projet ScreenForge Vercel ni URL déployée (`production-security-evidence.md:21`)
- [ ] Les parcours complets sont sans violation CSP utile sur le déploiement — seuls les parcours locaux avec CSP candidate Report-Only sont prouvés (`vercel.json:11`)
- [x] CORS exact, Bearer auth et isolation cross-account sont couverts sans wildcard — `apps/backend/convex/http.ts:54`, `apps/backend/convex/http.ts:78`, `production-security-evidence.md:24`
- [ ] Bundle, sous-domaine SPF/DKIM, DMARC et clé Resend limitée sont tous prouvés — bundle propre localement, mais DNS et clé fournisseur non vérifiés (`production-security-evidence.md:27`, `production-security-evidence.md:28`)
- [ ] Preview privée, MFA/récupération et Dependabot sont tous prouvés — Dependabot seul est vérifié localement (`production-security-evidence.md:23`, `production-security-evidence.md:30`)
- [ ] Sauvegarde avec fichiers, restauration hors production, limites et logs sont prouvés ou mitigés — consoles et cible jetable indisponibles (`production-security-evidence.md:32`)
- [x] La preuve de sécurité est datée, reproductible, nettoyée et sans faux succès — `aidd_docs/tasks/2026_08/2026_08_15_local-cloud-plans/production-security-evidence.md:1`

### Phase 6 — Prouver la migration et boucler jusqu’à une review approuvée

- [x] `format:check` et `test:release` passent sans skip Cloud — `production-security-evidence.md:19`
- [x] Le ZIP de contrôle reste pixel-exact, PNG opaque en 1320×2868 — `apps/web/e2e/export.spec.ts:10`
- [x] Profils, langues, Compte et Offres partagent noms, prix et règles — `apps/web/e2e/commercial-launch.spec.ts:3`, `scripts/commercial-profile-audit.mjs`
- [ ] Preview et production passent toute la preuve de sécurité déployée — absence d’URLs, CORS distant, mail, protection et restore (`production-security-evidence.md:21`)
- [ ] L’assertion ne laisse aucun critère sans preuve — dix critères externes ou de clôture restent ouverts dans ce rapport
- [ ] La review est approuvée et la browser QA ne laisse aucun écart — browser QA `pass` (`browser-qa/qa.md:3`), mais verdict actuel toujours `blocked` par les preuves externes
- [ ] Le compte propriétaire est provisionné et les données de preuve distantes nettoyées — provisioning réel non exécuté (`production-security-evidence.md:35`)

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🔴 critical | functional | 4 | `production-security-evidence.md:35` | Le compte propriétaire n’est relié à aucune identité réelle et son round-trip n’est pas prouvé hors local. | Connecter le compte cible, résoudre son `userId`, appliquer le grant interne, vérifier projet/asset/thème en préprod puis production et tester la révocation. |
| 🔴 critical | functional | 5 | `production-security-evidence.md:21` | Aucun audit HTTP réel ne prouve Preview, production, CSP bloquante ou HSTS. | Publier une Preview explicitement autorisée, mesurer la CSP Report-Only, passer en bloquant, puis auditer Preview et production. |
| 🟡 warning | functional | 5 | `vercel.json:11` | Les parcours complets n’ont été observés qu’en local sans la CSP réellement servie par Vercel. | Rejouer landing EN/FR, thèmes, auth, fontes, sync, upload/download et export sur la Preview avec les rapports CSP. |
| 🔴 critical | functional | 5 | `production-security-evidence.md:28` | Le domaine Resend, SPF/DKIM/DMARC et la portée `sending_access` ne sont pas vérifiés. | Configurer le sous-domaine et la clé limitée dans les consoles, puis prouver un lien magique préprod et production sans exposer le secret. |
| 🔴 critical | functional | 5 | `production-security-evidence.md:23` | La Preview privée et les MFA/récupérations GitHub, Vercel et Resend ne sont pas attestées. | Activer et contrôler ces protections avec les identités administrateur, puis dater la preuve nettoyée. |
| 🔴 critical | functional | 5 | `production-security-evidence.md:32` | Limites, logs, sauvegarde File Storage et restauration hors production ne sont pas prouvés. | Configurer les contrôles disponibles, créer une sauvegarde avec fichiers et réussir un restore drill sur une cible jetable. |
| 🔴 critical | functional | 6 | `production-security-evidence.md:21` | Le gate local est vert mais le gate de sécurité déployé reste entièrement ouvert. | Fermer les contrôles de phase 5 sur Preview puis production et joindre les sorties nettoyées. |
| 🔴 critical | functional | 6 | `review.md:63` | L’assertion finale contient encore des critères sans preuve reproductible. | Rejouer `aidd-dev:03-assert` après fermeture de chaque preuve externe jusqu’à 38/38. |
| 🟡 warning | functional | 6 | `phase-6.md:122` | La browser QA locale est sans écart, mais la clôture exige aussi une review approuvée; ce rapport reste bloqué par les preuves externes. | Refaire la review et la QA sur la Preview puis la production après fermeture des preuves externes. |
| 🔴 critical | functional | 6 | `production-security-evidence.md:35` | Le provisioning propriétaire et le nettoyage des éventuelles données distantes ne sont pas réalisés. | Provisionner l’identité confirmée, valider les droits client et supprimer toutes les données jetables créées pour la preuve. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 74% (28/38) |
| Files checked | 83 fichiers du diff `2771c86...cf9d545`; plans, droits, billing, sync, UI, landing, CSP/CORS, tests, browser QA et documentation |
| Unchecked     | Phase 4 critère 5 — fix; phase 5 critères 1, 2, 4, 5, 6 — fix; phase 6 critères 4, 5, 6, 7 — fix |
| Unplanned     | none |
