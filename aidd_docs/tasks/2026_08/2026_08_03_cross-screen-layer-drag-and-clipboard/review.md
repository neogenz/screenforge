# Review: Transfert de calques entre écrans et presse-papiers clavier

- **Verdict**: approve
- **Diff**: `feab596...5444d91`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_03
- **Findings**: 0 critical, 0 warning, 1 minor

## Phases

### Phase 1 — Transfert inter-écrans par glisser-déposer

- [x] Pendant le drag, le calque visible et les guides suivent la planche sous le centre de la sélection sans apparaître dans la gouttière comme contenu final. — `src/hooks/use-canvas.ts:1175`, `src/hooks/use-canvas.ts:1182`, `src/hooks/use-canvas.ts:1186`, `e2e/canvas-transforms.spec.ts:213`
- [x] Un calque partagé continue de représenter un seul calque `layout` sur toutes les planches. — `src/hooks/use-canvas.ts:932`, `src/hooks/use-canvas.ts:1168`, `e2e/shared-layers.spec.ts:18`
- [x] Après relâchement dans une autre planche, chaque calque local transféré est absent de la source, présent une seule fois dans la destination et ne saute pas après synchronisation. — `src/hooks/use-canvas.ts:985`, `src/hooks/use-canvas.ts:998`, `e2e/canvas-transforms.spec.ts:158`
- [x] La destination devient active, la sélection transférée reste sélectionnée et une seule annulation restaure l’état projet antérieur. — `src/hooks/use-canvas.ts:972`, `src/hooks/use-canvas.ts:1027`, `src/hooks/use-canvas.ts:1048`, `e2e/canvas-transforms.spec.ts:168`
- [x] Le zoom et le cadrage du stage sont inchangés après le dépôt : activer la destination ne recadre pas la vue. — `src/hooks/use-canvas.ts:1048`, `e2e/canvas-transforms.spec.ts:164`
- [x] Un relâchement dont le centre est dans une gouttière ou hors planche conserve l’écran propriétaire d’origine, et un déplacement suivant dans cet écran reste correctement écrêté. — `src/hooks/use-canvas.ts:942`, `src/hooks/use-canvas.ts:947`, `e2e/canvas-transforms.spec.ts:213`
- [x] Les scénarios E2E de transformation, de transfert et de calques partagés réussissent ensemble. — `e2e/canvas-transforms.spec.ts:98`, `e2e/canvas-transforms.spec.ts:180`, `e2e/shared-layers.spec.ts:33`

### Phase 2 — Couper, copier et coller au clavier

- [x] ⌘C/⌘V et Ctrl+C/Ctrl+V créent des copies distinctes de tous les calques sélectionnés sur l’écran actif. — `src/hooks/use-keyboard.ts:28`, `src/hooks/use-keyboard.ts:104`, `src/hooks/use-keyboard.ts:122`, `e2e/layers-panel.spec.ts:67`
- [x] ⌘X et Ctrl+X placent la sélection dans le presse-papiers puis la retirent du projet en une seule étape annulable. — `src/hooks/use-keyboard.ts:112`, `src/hooks/use-keyboard.ts:117`, `e2e/layers-panel.spec.ts:92`
- [x] Les calques collés conservent leur contenu, leurs références d’assets et leur portée, avec de nouveaux identifiants et un ordre de plan valide. — `src/hooks/use-keyboard.ts:9`, `src/hooks/use-keyboard.ts:129`, `src/hooks/use-keyboard.ts:132`, `src/hooks/use-keyboard.ts:136`
- [x] Dans un champ ou pendant l’édition de texte Fabric, C/X/V agissent sur le texte et ne modifient aucun calque. — `src/hooks/use-keyboard.ts:14`, `src/hooks/use-keyboard.ts:40`, `e2e/layers-panel.spec.ts:140`
- [x] L’aide des raccourcis présente copier, couper et coller. — `src/components/ui/shortcuts-overlay.tsx:18`, `e2e/layers-panel.spec.ts:157`
- [x] Les scénarios E2E Meta/Control, inter-écrans et d’annulation réussissent avec le typecheck et le lint. — `e2e/layers-panel.spec.ts:67`, `e2e/layers-panel.spec.ts:92`, `e2e/canvas-transforms.spec.ts:98`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 minor | code | 1 | `src/hooks/use-canvas.ts:902` | Le gestionnaire `object:modified` orchestre désormais dans un même bloc la résolution de destination, l’historique, la mutation multi-écrans et la resélection ; cet ordre subtil sera difficile à faire évoluer sans régression. | Extraire le calcul du prochain projet dans une fonction pure avec un test ciblé, et laisser au gestionnaire Fabric la seule orchestration du commit et de la sélection. |

## Verification

| Metric | Value |
| ------ | ----- |
| Verified | 100% (13/13) |
| Files checked | `src/hooks/use-canvas.ts`, `src/hooks/use-keyboard.ts`, `src/components/ui/shortcuts-overlay.tsx`, `e2e/canvas-transforms.spec.ts`, `e2e/helpers.ts`, `e2e/layers-panel.spec.ts`, `e2e/shared-layers.spec.ts`, `plan.md`, `phase-1.md`, `phase-2.md` |
| Unchecked | none |
| Unplanned | none |
