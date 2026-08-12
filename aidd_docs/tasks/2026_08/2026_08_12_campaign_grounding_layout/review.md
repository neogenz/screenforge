# Review: Fiabiliser la génération de campagnes

- **Verdict**: approve
- **Diff**: `6085de1...04d975e`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_13
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Ancrer et contraindre les accroches

- [x] Le corps envoyé contient les faits et descriptions bornés, mais aucun asset, logo ni data URL ; les mêmes champs traversent API directe et pont, et le pont revalide le schéma avant tout moteur — `apps/web/src/lib/ai/direct-api.ts:258`, `apps/web/src/lib/bridge-client.ts:219`, `apps/bridge/src/protocol.ts:84`, `apps/bridge/src/server.ts:172`
- [x] Un lot valide contient exactement le nombre demandé ; une hallucination ou une accroche générique ne rejoint jamais le projet — le préflight et le garde final partagent désormais l’admissibilité intrinsèque (3–7 mots, 72 caractères, non générique), la capacité et l’unicité emploient `normalizedCopy`, tandis que l’égalité fait/preuve conserve `normalizedEvidenceCopy`. Les gardes précèdent `fetch`, RPC et `runTurn`, et le miroir pont applique les mêmes invariants — `apps/web/src/lib/ai/plan.ts:288`, `apps/web/src/lib/ai/plan.ts:325`, `apps/web/src/lib/ai/plan.ts:347`, `apps/web/src/lib/ai/plan.ts:395`, `apps/web/src/lib/ai/direct-api.ts:379`, `apps/web/src/lib/bridge-client.ts:216`, `apps/bridge/src/server.ts:184`, `apps/bridge/src/server.ts:363`, `apps/bridge/src/server.ts:400`, `apps/bridge/src/server.ts:427`
- [x] La multisélection, la langue courante et Space Grotesk passent leurs régressions ciblées — `apps/web/src/stores/canvas.store.ts:287`, `apps/web/src/components/canvas/SelectionToolbar.tsx:208`, `apps/web/e2e/canvas-editing.spec.ts:133`, `apps/web/e2e/locale.spec.ts:49`, `apps/web/src/lib/fonts.ts:120`

### Phase 2 — Rendre les compositions lisibles et contrôlables

- [x] Aucun archétype automatique ne masque la capture, le titre ou le filigrane ; une capture disponible n’est jamais remplacée par un mur — layouts sûrs, limite de trois lignes, dernière capture et revalidation après édition manuelle restent couverts : `apps/web/src/lib/ai/archetypes.ts:353`, `apps/web/src/lib/ai/plan.ts:353`, `apps/web/src/components/campaign-dialog/CampaignDialog.tsx:484`, `apps/web/e2e/ai-campaign.spec.ts:208`
- [x] Changer de mise en page modifie immédiatement l’aperçu et la même géométrie est posée dans le projet — l’aperçu emploie le vrai SVG ScreenForge et partage `planScreenLayout` avec le constructeur : `apps/web/src/components/campaign-dialog/PlanPreview.tsx:122`, `apps/web/src/lib/ai/plan.ts:489`, `apps/web/src/components/campaign-dialog/CampaignDialog.tsx:1132`, `apps/web/e2e/ai-campaign.spec.ts:123`

### Phase 3 — Fermer les régressions éditeur et le parcours réel

- [x] Une édition commune touche tous les textes sélectionnés et s’annule en un geste ; la langue courante reste visible ; Space Grotesk ne produit plus de faux blocage — les actions géométriques et destructives restent masquées pour une sélection inter-écrans : `apps/web/src/stores/canvas.store.ts:287`, `apps/web/src/components/canvas/SelectionToolbar.tsx:108`, `apps/web/src/components/canvas/SelectionToolbar.tsx:208`, `apps/web/e2e/canvas-editing.spec.ts:133`, `apps/web/e2e/locale.spec.ts:83`, `apps/web/src/lib/fonts.ts:120`
- [x] Le parcours campagne → revue → insertion → export passe dans Chromium sans régression d’accessibilité ni de dimensions ; le ZIP réel reste validé en 1320×2868 et le build de production passe : `apps/web/e2e/campaign-journey.spec.ts:103`, `apps/web/e2e/campaign-journey.spec.ts:233`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| — | — | — | — | None. | — |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (7/7) |
| Files checked | `plan.md`, les trois phases, les 29 fichiers du diff complet `6085de1...04d975e`, brief/UI, prompts API/pont, préflight aux trois frontières, contrat de sortie, garde atomique, providers, archétypes, aperçu/insertion, multisélection, polices, langue et tests associés |
| Checks run    | `git diff --check 6085de1..HEAD`; 103 tests web ciblés verts; 54 tests pont ciblés verts; `pnpm test` vert (443 tests unitaires, 29 RLS, types, lint); `pnpm run build` vert; 14 parcours Chromium ciblés verts; contre-tests par catégories sur 3–7 mots, borne 72, génériques, collisions accent/casse/ponctuation, CRLF, preuve littérale et absence de `fetch`/RPC/`runTurn` |
| Unchecked     | none |
| Unplanned     | none |
