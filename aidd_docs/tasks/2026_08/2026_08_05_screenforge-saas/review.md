# Review: ScreenForge SaaS

- **Verdict**: approve
- **Diff**: `main...f369515b3b490e07bb9fddac857422d42c3842fe`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_09
- **Findings**: 0 critical, 0 warning, 1 minor

## Phases

### Phase 1 — Fondations monorepo + tooling Supabase

- [x] `pnpm dev` depuis la racine délègue à l'application déplacée et conserve son entrée — `package.json:8`, `apps/web/package.json:7`, `apps/web/index.html:1`.
- [x] Le contrôle de release orchestre unitaires, RLS, types, lint, deux profils de build, E2E et audits — `package.json:10-18`, `aidd_docs/tasks/2026_08/2026_08_05_screenforge-saas/phase-6.md:115-129`.
- [x] La CI sépare `web`, `e2e`, `db`, `api` et annule le run précédent de la même ref — `.github/workflows/quality.yml:10-18`, `.github/workflows/quality.yml:36-38`, `.github/workflows/quality.yml:89-91`, `.github/workflows/quality.yml:125-127`.
- [x] Le job DB démarre une base vierge, applique les migrations et exerce la RLS — `.github/workflows/quality.yml:101-114`.
- [x] Le stack local et les deux variables publiques Supabase sont présents — `supabase/config.toml:5-23`, `.env.example:10-18`.

### Phase 2 — Auth SSO + schéma DB + RLS

- [x] Le schéma `projects`, ses grants et ses policies isolent chaque ligne par `auth.uid()` — `supabase/migrations/20260807183549_projects.sql:12-60`.
- [x] Sans variables Supabase, le client et l'entrée de compte restent absents — `apps/web/src/lib/supabase.ts:26-45`, `apps/web/src/components/toolbar/TopBar.tsx:580-623`.
- [ ] Connexion Google et GitHub réelles en local — not-applicable: applications OAuth du propriétaire absentes; frontières présentes dans `apps/web/src/lib/auth.ts:31-41`.
- [x] Le magic link active la même session et la déconnexion ne touche pas l'IDB — `apps/web/src/lib/auth.ts:44-60`, `apps/web/src/stores/auth.store.ts:42-64`.
- [x] Les tests RLS opposent deux utilisateurs et un visiteur aux policies projet — `supabase/tests/rls_projects.test.mjs:1-172`.
- [x] Les types DB sont régénérés depuis la base et toute divergence fait échouer la CI — `package.json:28`, `.github/workflows/quality.yml:108-112`.

### Phase 3 — Sync cloud des projets et assets

- [x] Storage est privé et chaque verbe reste borné au préfixe du propriétaire — `supabase/migrations/20260807204922_storage_assets.sql:13-76`, `supabase/tests/rls_storage.test.mjs:1-167`.
- [x] Un commit IndexedDB crée un marqueur durable par compte/projet puis programme le push du document et de ses assets — `apps/web/src/lib/storage.ts:139-191`, `apps/web/src/lib/sync.ts:623-647`, `apps/web/src/lib/sync-queue.ts:81-95`.
- [x] Un second navigateur peut tirer le projet et ses binaires — `apps/web/src/lib/sync.ts:228-379`, `apps/web/e2e/sync.spec.ts:166-231`.
- [x] Le JSON distant retire les vignettes et ne contient que les références d'assets — `apps/web/src/lib/sync.ts:178-186`, `apps/web/src/lib/project-file.ts:113-120`, `apps/web/e2e/sync.spec.ts:193-196`.
- [x] La reprise reconstruit tous les projets non accusés depuis IndexedDB, les pousse séquentiellement avec leurs assets et restaure le registre actif — `apps/web/src/lib/sync.ts:504-539`, `apps/web/src/lib/sync.ts:562-603`, `apps/web/e2e/sync.spec.ts:840-958`.
- [x] Sans session, droit Cloud ou configuration, la sync sort sans requête et l'autosave local reste actif — `apps/web/src/lib/sync.ts:62-78`, `apps/web/src/lib/sync.ts:623-647`, `apps/web/e2e/sync.spec.ts:964-997`.

### Phase 4 — Backend Hono + vente Polar

- [x] `/me` exige le bearer token et renvoie les droits du porteur avec le contrat partagé au web — `apps/api/src/middleware/auth.ts:16-25`, `apps/api/src/routes/me.ts:1-14`, `apps/web/src/lib/api.ts:1-18`.
- [x] Un utilisateur authentifié ne peut que lire sa propre ligne de droits — `supabase/migrations/20260808063013_entitlements.sql:33-56`, `supabase/tests/rls_entitlements.test.mjs:1-120`.
- [ ] Achat réel de la Licence en sandbox Polar — not-applicable: compte, produit et secret propriétaire requis; création checkout couverte par `apps/api/src/routes/billing.ts:30-52`.
- [x] Le Cloud sans Licence est refusé avant la création d'un checkout — `apps/api/src/routes/billing.ts:36-52`, `apps/api/src/routes/billing.checkout.test.ts:99-105`.
- [ ] Achat Cloud réel et période annuelle Polar — not-applicable: compte et produit propriétaire requis; projection présente dans `apps/api/src/entitlements.ts:71-95`.
- [x] Une livraison rejouée ou plus ancienne ne produit pas une seconde transition — `apps/api/src/mirror.ts:31-68`, `supabase/migrations/20260809090000_project_lww.sql:44-102`, `apps/api/src/routes/billing.webhook.test.ts:178-223`.
- [ ] Résiliation réelle via le portail Polar — not-applicable: compte propriétaire requis; session portail et maintien jusqu'à échéance présents dans `apps/api/src/routes/billing.ts:55-67`, `apps/api/src/entitlements.ts:117-140`.
- [x] Un Cloud sans Licence est refusé par la projection et journalisé — `apps/api/src/entitlements.ts:75-95`, `apps/api/src/routes/billing.ts:120-127`, `apps/api/src/routes/billing.webhook.test.ts:225-236`.
- [x] La CI refuse toute mention de la clé privilégiée dans le paquet web — `.github/workflows/quality.yml:141-152`.

### Phase 5 — Droits produit, migration et suppression de compte

- [x] Sans compte, la lecture des droits sort avant toute requête distante — `apps/web/src/lib/entitlements.ts:66-78`, `apps/web/src/stores/auth.store.ts:74-87`.
- [x] Le quota est isolé par projet, contrôlé avant le lot et propose la Licence une fois épuisé — `apps/web/src/lib/entitlements.ts:172-203`, `apps/web/src/hooks/use-export.ts:78-93`, `apps/web/src/components/export-dialog/ExportDialog.tsx:108-130`.
- [x] Le filigrane est peint dans le canvas exact avant l'encodage PNG — `apps/web/src/lib/export.ts:109-153`, `apps/web/src/lib/export.ts:156-215`.
- [x] Le compteur n'avance qu'après la fin réussie de tout le lot — `apps/web/src/hooks/use-export.ts:147-185`.
- [x] Une Licence rend le ZIP propre et supprime la limite via la source de droits commune — `apps/web/src/lib/entitlements.ts:138-154`, `apps/web/src/hooks/use-export.ts:86-177`.
- [x] Une Licence sans Cloud n'active ni réseau de sync ni témoin d'erreur — `apps/web/src/lib/sync.ts:62-78`, `apps/web/e2e/sync.spec.ts:964-997`.
- [x] Les écritures projet et asset sont refusées sans droit Cloud au niveau RLS — `supabase/migrations/20260808094557_cloud_gate.sql:20-84`, `supabase/tests/rls_cloud_gate.test.mjs:1-165`.
- [x] Le rattachement pousse plusieurs projets locaux et restaure toujours le registre du projet actif — `apps/web/src/lib/sync.ts:462-497`, `apps/web/e2e/sync.spec.ts:1153-1241`.
- [x] Une fin de période coupe la sync sans supprimer la copie locale — `apps/web/src/lib/entitlements.ts:26-38`, `apps/web/src/lib/sync.ts:662-683`, `apps/web/e2e/sync.spec.ts:1073-1150`.
- [x] « Plus tard » ne persiste aucun refus et le prochain login réarme la proposition — `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx:98-123`, `apps/web/src/lib/sync.ts:706-739`.
- [x] La suppression pose une barrière durable, purge Storage en relisant la page zéro et rend immédiatement l'éditeur local — `apps/api/src/account-deletion.ts:35-99`, `apps/api/src/account-deletion.ts:146-225`, `apps/api/src/routes/account.test.ts:200-457`, `apps/web/src/lib/account-deletion-ui.ts:12-42`.
- [x] La déconnexion retire les droits, éteint la sync et laisse l'éditeur local — `apps/web/src/stores/auth.store.ts:42-64`, `apps/web/src/lib/sync.ts:662-683`, `apps/web/e2e/sync.spec.ts:1026-1070`.

### Phase 6 — Corrections de revue et validation finale

- [x] Les écritures projet distantes et locales sont monotones au point d'écriture, côté Postgres et dans une transaction IndexedDB conditionnelle — `supabase/migrations/20260809090000_project_lww.sql:4-36`, `apps/web/src/lib/storage.ts:314-355`, `apps/web/src/lib/__tests__/storage.test.ts:157-210`.
- [x] Un asset local absent n'est pas confirmé et fait échouer le push — `apps/web/src/lib/sync.ts:145-176`, `apps/web/e2e/sync.spec.ts:680-716`.
- [x] Le rattachement et la reprise multi-projets rechargent toujours les assets du projet actif — `apps/web/src/lib/sync.ts:486-490`, `apps/web/src/lib/sync.ts:530-537`, `apps/web/e2e/sync.spec.ts:840-958`.
- [x] Le catalogue distant est paginé dans un ordre déterministe et chaque projet installé devient ouvrable — `apps/web/src/lib/sync.ts:258-273`, `apps/web/src/lib/__tests__/sync.test.ts:75-121`, `apps/web/src/components/toolbar/TopBar.tsx:202-299`.
- [x] La dernière Licence connue est restaurée hors ligne pour le même utilisateur — `apps/web/src/lib/entitlements.ts:26-51`, `apps/web/src/stores/auth.store.ts:42-56`, `apps/web/e2e/sync.spec.ts:999-1023`.
- [x] Un changement de compte remplace immédiatement les droits et ignore une réponse tardive de l'ancienne session — `apps/web/src/stores/auth.store.ts:42-64`, `apps/web/src/stores/auth.store.ts:74-87`, `apps/web/src/lib/__tests__/entitlements.test.ts:138-161`.
- [x] Checkout, portail et suppression transforment les pannes réseau en résultats gérés — `apps/web/src/lib/api.ts:64-75`, `apps/web/src/lib/api.ts:88-118`, `apps/web/src/lib/account-deletion-ui.ts:12-42`.
- [x] Un webhook Polar ancien ne réaccorde pas un droit révoqué — `apps/api/src/mirror.ts:31-68`, `apps/api/src/routes/billing.webhook.test.ts:210-223`.
- [x] La suppression d'un compte de plus de 100 assets relit l'offset zéro jusqu'à épuisement et conserve le job au moindre échec — `apps/api/src/account-deletion.ts:69-99`, `apps/api/src/routes/account.test.ts:365-419`.
- [x] Les copies FR/EN ne promettent plus d'historique restaurable — `apps/web/src/landing/copy.ts:298-304`, `apps/web/src/landing/copy.ts:590-596`.
- [x] Le job E2E démarre Supabase, injecte ses variables publiques et exécute la suite Cloud — `.github/workflows/quality.yml:36-74`, `apps/web/playwright.config.ts:1-22`.
- [x] La preuve de release couvre les profils lancement/prélancement et documente les intégrations externes — `package.json:10-18`, `scripts/commercial-profile-audit.mjs:1-35`, `aidd_docs/tasks/2026_08/2026_08_05_screenforge-saas/phase-6.md:115-129`.

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 minor | rot | 5 | `apps/web/src/App.tsx:162-164` | Le commentaire affirme que le retour de checkout interroge `/me`, alors que `consumeCheckoutReturn` relit désormais `entitlements` directement via Supabase (`apps/web/src/stores/auth.store.ts:142-153`, `apps/web/src/lib/entitlements.ts:66-78`). Le besoin d'attendre la session reste exact, mais la frontière documentée est obsolète. | Remplacer la mention de `/me` par la lecture RLS des droits du compte courant. |

## Verification

| Metric | Value |
| ------ | ----- |
| Verified | 92% (46/50) |
| Files checked | 279 entrées du diff; flux ciblés `sync.ts`, `sync-queue.ts`, `storage.ts`, `account-deletion.ts`, `account.ts`, `api.ts`, `account-deletion-ui.ts`, `use-export.ts`, `export.ts`, `entitlements.ts`, `auth.store.ts`, `billing.ts`, `mirror.ts`, migrations, tests, CI et profils commerciaux |
| Unchecked | Phase 2 Google/GitHub réel — not-applicable; Phase 4 achat Licence réel — not-applicable; Phase 4 achat Cloud réel — not-applicable; Phase 4 résiliation Polar réelle — not-applicable |
| Unplanned | Raffinements visuels de la landing hors chemin SaaS strict (`2e9439b`, `4e6447d`, `91ee67e`, `c574012`, `165eee1`); aucun défaut retenu sans preuve concrète |
