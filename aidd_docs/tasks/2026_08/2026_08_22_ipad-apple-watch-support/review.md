# Review: Support officiel iPad et Apple Watch

- **Verdict**: approve pending CI
- **Diff**: `origin/main...codex/ipad-watch-support`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_23
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Contrat de cibles et compatibilité des projets

- [x] Les huit profils ont des identifiants et dossiers uniques, et chaque rapport logique correspond exactement à sa résolution officielle — `packages/project-format/src/dimensions.ts:34`, `apps/web/src/lib/__tests__/project-validation.test.ts:80`
- [x] La migration legacy convertit `profileId` vers `target`, y compris dans les snapshots de release, puis supprime le champ obsolète de façon idempotente ; toute cible inconnue ou release incompatible est refusée — `packages/project-format/src/project-validation.ts`, `apps/web/src/lib/__tests__/project-validation.test.ts`
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
| Verified      | Typecheck, lint, format, build, CSP, dépendances, publication, COSS, contraste, échelle, landing et probe MCP verts. Suites unitaires : Bridge 60, Backend 209, MCP 46, Web 473, publication 4, validateur export 5 et audit de déploiement. E2E release intégral : 226 verts, 5 défauts corrigés, 1 fixture Apple externe skippé ; les 12 scénarios affectés ont ensuite passé leurs reruns ciblés (export/release 9/9, Android/profils 3/3). |
| Files checked | Les 85 fichiers du diff net contre `origin/main`, avec relecture des frontières migration/stockage, canvas/export/release/ASC, catalogues, IA/MCP, modèles, UI et documentation. |
| Unchecked     | Un dernier rerun propre des 232 E2E est laissé à la CI de la PR ; le test de bezel Apple exige un fichier propriétaire local et reste volontairement hors CI. |
| Unplanned     | none |
