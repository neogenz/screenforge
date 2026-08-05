# Review: Correction des findings des contrôles

- **Verdict**: approve
- **Diff**: `17f2d3c...b27262c74825d9ca06124cde6ba228f67f963ec3`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_04
- **Findings**: 0 critical, 0 warning, 2 minor

## Phases

### Phase 1 — Fiabiliser les contrôles et leurs régressions

- [x] Deux actions d’arrière-plan de natures différentes créent deux étapes d’annulation, tandis qu’un drag continu reste une seule étape — `src/components/gradient-editor/GradientEditor.tsx:44`, `src/components/properties-panel/BackgroundSection.tsx:15`, `e2e/smoke.spec.ts:98`
- [x] Rotation et angle de dégradé exposent des groupes de préréglages nommés distinctement lorsqu’ils coexistent — `src/components/ui/angle-control.tsx:51`, `e2e/canvas-editing.spec.ts:99`
- [x] Une requête multi-graisses partiellement chargée ne permet pas à `isFontLoaded` d’annoncer une graisse absente — `src/hooks/use-fonts.ts:124`, `e2e/canvas-editing.spec.ts:48`
- [x] Le contrat TypeScript E2E déclare les propriétés et actions utilisées par le scénario de copier-coller — `e2e/helpers.ts:58`, `e2e/helpers.ts:78`
- [x] La validation de release passe sans régression fonctionnelle, visuelle, de contraste ou d’export — `package.json:20`, preuve executor : 46 tests unitaires, typecheck, lint, build, 56 E2E avec 1 skip optionnel et audit de contraste verts

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 minor | code | 1 | `src/components/ui/angle-control.tsx:32` | L’arrondi est appliqué après la normalisation : une rotation comprise entre 359,5° et 360° produit `360`, hors de la plage `0..359` du slider et hors des valeurs du groupe segmenté. | Normaliser une seconde fois après l’arrondi, par exemple avec `Math.round(normalizedAngle) % 360`. |
| 🟢 minor | conform | 1 | `src/hooks/use-fonts.ts:72` | Le libellé `900 · Black` réintroduit un terme anglais alors que la règle déclarée impose une interface française et que les autres graisses sont traduites. | Employer `900 · Noir` et aligner l’assertion E2E. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (5/5)                                        |
| Files checked | `aidd_docs/tasks/2026_08/2026_08_04_browser-feedback-controls/phase-1.md`, `aidd_docs/tasks/2026_08/2026_08_04_browser-feedback-controls/plan.md`, `aidd_docs/tasks/2026_08/2026_08_04_browser-feedback-controls/review.md`, `e2e/canvas-editing.spec.ts`, `e2e/canvas-transforms.spec.ts`, `e2e/device-bezel-import.spec.ts`, `e2e/helpers.ts`, `e2e/smoke.spec.ts`, `src/components/background-editor/BackgroundEditor.tsx`, `src/components/canvas/canvas-sync.ts`, `src/components/globals-editor/GlobalsEditor.tsx`, `src/components/gradient-editor/GradientEditor.tsx`, `src/components/properties-panel/BackgroundSection.tsx`, `src/components/properties-panel/ShapeSection.tsx`, `src/components/properties-panel/TransformSection.tsx`, `src/components/screens-bar/ScreenThumbnail.tsx`, `src/components/screens-bar/ScreensBar.tsx`, `src/components/text-editor/TextEditor.tsx`, `src/components/ui/angle-control.tsx`, `src/components/ui/slider.tsx`, `src/hooks/use-fonts.ts`, `src/hooks/use-keyboard.ts`, `src/lib/export.ts`, `src/stores/canvas.store.ts` |
| Unchecked     | none                                              |
| Unplanned     | Implémentation de base des cinq retours navigateur incluse dans la plage (copier-coller des réglages, contrôles d’angle, largeur des onglets, slider et Poppins 900) — cohérente avec la source, aucun fix |
