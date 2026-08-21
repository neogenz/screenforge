# Review: cloud-prelaunch-merge-fixes

- **Verdict**: approve
- **Diff**: `f4fe3b938b330d71cfbc9062256e3f93a568c2f5...a339f6db4d35ffc80919c9abf81441b0c3defa2e`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_20
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Rendre le refus Cloud durable

- [x] Les projets locaux sont classés avant ouverture de la file — `apps/web/src/lib/sync.ts:463`, `apps/web/src/lib/sync.ts:679`.
- [x] Le changement d’identité invalide barrière et chargement antérieurs — `apps/web/src/lib/sync.ts:673`, `apps/web/src/lib/sync.ts:877`.
- [x] Tous les commits passent par la même décision de consentement — `apps/web/src/lib/sync.ts:770`, `apps/web/src/lib/sync.ts:850`.
- [x] Les projets créés après activation restent enrôlés automatiquement — `apps/web/e2e/sync.spec.ts:1575`.
- [x] Le scénario attend au-delà de l’autosave et prouve zéro upload après « Pas maintenant » — `apps/web/e2e/sync.spec.ts:1528`.
- [x] Le rattachement explicite pousse chaque projet puis libère sa barrière — `apps/web/src/lib/sync.ts:575`, `apps/web/e2e/sync.spec.ts:1559`.

### Phase 2 — Remplacer les suffixes Preview par des origines exactes

- [x] Auth et CORS partagent une allowlist d’origines exactes — `apps/backend/convex/origins.ts:16`, `apps/backend/convex/http.ts:50`, `apps/backend/convex/auth.ts:72`.
- [x] Le domaine collisionnel et les Previews non déclarées sont refusés — `apps/backend/convex/origins.test.ts:14`.
- [x] Les preflights refusent l’ancien suffixe et exigent une origine HTTPS stable — `apps/backend/convex/preflight.ts:91`, `apps/backend/convex/preflight.ts:95`.
- [x] Les origines loopback ne viennent que des entrées locales explicites — `apps/backend/convex/origins.ts:18`.
- [x] Les runbooks actifs réservent les Previews éphémères au mode Local — `aidd_docs/tasks/2026_08/2026_08_11_migration-convex/environnements.md:88`.

### Phase 3 — Expurger la documentation et stabiliser les gates

- [x] `script-src` conserve uniquement les scripts propres et leurs hashes exacts, sans joker ni `unsafe-inline` — `vercel.json:17`.
- [x] Le job E2E garde l’installation Playwright officielle avec 60 minutes — `.github/workflows/quality.yml:85`.
- [x] Le guide public déclare son absence d’inventaire et ne publie aucun état vivant — `CLOUD.md:1`.
- [x] Le guide conserve les responsabilités Local/Resend/Polar/Convex et les trois budgets d’envoi — `CLOUD.md:56`, `CLOUD.md:59`, `CLOUD.md:69`, `CLOUD.md:81`, `CLOUD.md:98`.

### Phase 4 — Fermer les derniers findings puis prouver un SHA unique

- [x] La rotation simultanée source + destinataire atteint le plafond global avant Resend — `apps/backend/convex/auth.ts:107`, `apps/backend/convex/auth.test.ts:327`.
- [x] Le MCP borne fichiers et répertoires aux racines canonicalisées et refuse les symlinks sortants — `apps/mcp/src/relay/assets.ts:53`, `apps/mcp/src/assets.test.ts:183`, `apps/mcp/src/refresh.test.ts:108`.
- [x] Les régressions consentement et collision d’origine restent exécutables — `apps/web/e2e/sync.spec.ts:1528`, `apps/backend/convex/origins.test.ts:14`.
- [x] Le gate release complet couvre Cloud, CSP et audits sans skip obligatoire — `aidd_docs/tasks/2026_08/2026_08_20_cloud-prelaunch-merge-fixes/verification.md:14`.
- [x] Quality et Vercel sont verts sur le candidat produit exact — `aidd_docs/tasks/2026_08/2026_08_20_cloud-prelaunch-merge-fixes/verification.md:24`.
- [x] La description de PR porte les résultats actuels et le SHA observé — `aidd_docs/tasks/2026_08/2026_08_20_cloud-prelaunch-merge-fixes/verification.md:26`.
- [x] Le rescan final couvre 71/71 fichiers sans finding reportable ni secret — `aidd_docs/tasks/2026_08/2026_08_20_cloud-prelaunch-merge-fixes/verification.md:32`.
- [x] Une édition concurrente est durable avant le changement de projet — `apps/web/src/lib/storage.ts:511`, `apps/web/src/lib/__tests__/storage.test.ts:323`.
- [x] La PR est prête mais reste ouverte et non fusionnée — `aidd_docs/tasks/2026_08/2026_08_20_cloud-prelaunch-merge-fixes/verification.md:40`.

## Findings

None.

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (24/24) |
| Files checked | 71 fichiers du diff, 4 phases, `verification.md`, règles `AGENTS.md` et `SECURITY.md` |
| Unchecked | none |
| Unplanned | none |
