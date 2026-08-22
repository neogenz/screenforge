# Review: Support officiel iPad et Apple Watch

- **Verdict**: approve
- **Diff**: `origin/main...2033653`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_22
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Contrat de profils et compatibilité des projets

- [x] Les huit profils ont des identifiants et dossiers uniques, et chaque rapport logique correspond exactement à sa résolution officielle — `packages/project-format/src/dimensions.ts:34`, `apps/web/src/lib/__tests__/project-validation.test.ts:80`
- [x] Un projet, une release et un gabarit legacy sans profil migrent vers iPhone de façon idempotente ; un profil inconnu ou une release dont `snapshot.profileId` diffère de `project.profileId` est refusé — `packages/project-format/src/project-validation.ts:316`, `packages/project-format/src/project-validation.ts:387`, `apps/web/src/lib/__tests__/project-validation.test.ts:142`, `apps/web/src/lib/__tests__/project-validation.test.ts:275`
- [x] Créer un projet ciblé sauvegarde d’abord l’actuel, persiste puis active le nouveau, et vide sélection et historique avant son rechargement avec le même profil — `apps/web/src/lib/storage.ts:456`, `apps/web/src/lib/storage.ts:465`, `apps/web/src/lib/__tests__/storage.test.ts:327`

### Phase 2 — Planche dynamique et cycle d’export officiel

- [x] Fonds, clips, sélection, alignement, zoom et vignettes dérivent du rapport iPhone, iPad ou Watch sans modifier le repère iPhone historique — `apps/web/src/lib/canvas/canvas-utils.ts:48`, `apps/web/src/lib/canvas/canvas-sync.ts:446`, `apps/web/src/lib/canvas/install-viewport.ts:75`, `apps/web/src/lib/stage.ts:44`
- [x] Les exports iPhone `1320×2868`, iPad `2064×2752` et Watch sélectionné sont RGB opaques dans le dossier du profil ; les releases rendent leur snapshot et `restoreRelease` rétablit explicitement son profil — `apps/web/src/lib/export.ts:176`, `apps/web/src/hooks/use-export.ts:91`, `apps/web/src/lib/release.ts:48`, `apps/web/src/lib/release.ts:79`, `apps/web/src/lib/release.ts:199`, `apps/web/e2e/release.spec.ts:46`
- [x] Le préflight, le manifeste et la publication utilisent le type App Store Connect du profil, et le validateur refuse dimensions inversées, alpha ou dossier incompatible — `apps/web/src/lib/asc.ts:210`, `apps/web/src/lib/asc.ts:340`, `apps/web/src/components/publish-dialog/PublishDialog.tsx:196`, `scripts/validate-export.mjs:38`, `scripts/validate-export.test.mjs:50`

### Phase 3 — Création de projet, cadres et modèles par plateforme

- [x] Le dialogue accessible crée un projet du profil choisi après sauvegarde de l’actuel et conserve l’ancien projet en cas d’échec — `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:129`, `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:143`, `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:410`
- [x] Les sélecteurs ne proposent que les cadres originaux compatibles, tandis que les bezels Apple passent uniquement par un import local licencié sans téléchargement ni redistribution par ScreenForge — `apps/web/src/assets/device-frames/index.ts:177`, `apps/web/src/assets/device-frames/index.ts:203`, `apps/web/src/components/device-picker/DevicePicker.tsx:44`, `apps/web/src/components/device-picker/DevicePicker.tsx:213`
- [x] Les galeries iPad et Watch proposent chacune une composition contenue ; les gabarits d’une autre plateforme ne sont ni listés ni applicables — `apps/web/src/assets/templates/index.ts:332`, `apps/web/src/assets/templates/index.ts:369`, `apps/web/src/components/template-picker/TemplatePicker.tsx:28`, `apps/web/src/stores/canvas.store.ts:487`
- [x] Le PRD, la mémoire, la landing et la documentation MCP décrivent les huit profils, leurs dimensions, les ressources Apple officielles et la frontière de licence — `PRD.md:38`, `PRD.md:150`, `aidd_docs/memory/architecture.md:35`, `apps/web/src/landing/copy.ts:16`, `apps/mcp/skills/screenforge-mcp/SKILL.md:33`

## Findings

None.

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (10/10) ; preuves fournies : ciblés 27/27, `pnpm test` vert (Bridge 59, Backend 193, MCP 45, Web 435, publication 4, validator 2, probe, types, lint), E2E release 3/3, diff-check et gitleaks verts, commit `2033653` poussé |
| Files checked | Les 108 fichiers modifiés de `origin/main...2033653`, dont `packages/project-format/src/dimensions.ts`, `packages/project-format/src/project-validation.ts`, `packages/project-format/src/catalog-ids.ts`, `apps/web/src/lib/canvas/*`, `apps/web/src/lib/export.ts`, `apps/web/src/lib/release.ts`, `apps/web/src/lib/asc.ts`, `apps/web/src/lib/custom-templates.ts`, `apps/web/src/lib/storage.ts`, `apps/web/src/components/project-switcher/ProjectSwitcher.tsx`, `apps/web/src/components/device-picker/DevicePicker.tsx`, `apps/web/src/components/template-picker/*`, `apps/web/src/lib/ai/*`, `apps/web/src/lib/mcp/session.ts`, `apps/mcp/src/tools/*`, `apps/mcp/skills/screenforge-mcp/*`, `scripts/validate-export.mjs`, leurs tests, le PRD et la mémoire |
| Unchecked     | none |
| Unplanned     | none |
