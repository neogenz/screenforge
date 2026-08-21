# Review: préserver la position des textes après remesure

- **Verdict**: approve
- **Diff**: `main...codex/fix-font-reflow-position`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_21
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — La remesure conserve l’ancrage du calque

- [x] Une variation de hauteur ne change ni le `x` ni le `y` produit par `fabricObjectToLayerUpdate` — `apps/web/src/lib/canvas/canvas-utils.ts:151`, `apps/web/src/lib/canvas/__tests__/declared-width.test.ts:103`
- [x] Les textes d’écran et les instances de layout empruntent la compensation avant toute interaction — `apps/web/src/lib/canvas/install-fonts.ts:30`, `apps/web/src/lib/canvas/canvas-utils.ts:743`
- [x] Le test couvre la compensation, l’absence de variation et le chemin groupé `setXY` — `apps/web/src/lib/canvas/__tests__/declared-width.test.ts:103`
- [x] Les contrats de largeur déclarée, de chargement de police et de sélection multiple restent verts — `apps/web/src/lib/canvas/__tests__/declared-width.test.ts:76`, `apps/web/src/lib/canvas/__tests__/install-fonts.test.ts:61`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| -   | -    | -     | -        | None. | -   |

## Verification

| Metric        | Value                                                                                                                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Verified      | 100% (4/4)                                                                                                                                                                                                                                                                                                                                                           |
| Files checked | `apps/web/src/lib/canvas/canvas-utils.ts`, `apps/web/src/lib/canvas/__tests__/declared-width.test.ts`, `apps/web/src/lib/canvas/install-fonts.ts`, `apps/web/src/lib/canvas/__tests__/install-fonts.test.ts`, `aidd_docs/tasks/2026_08/2026_08_21_font-reflow-position/plan.md`, `aidd_docs/tasks/2026_08/2026_08_21_font-reflow-position/phase-1.md` |
| Unchecked     | none                                                                                                                                                                                                                                                                                                                                                               |
| Unplanned     | none                                                                                                                                                                                                                                                                                                                                                               |
