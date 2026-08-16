# Review: Connexion agents — parcours MCP et assistant

- **Verdict**: approve
- **Diff**: `f951682...a1b0022`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_16
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Un cycle MCP vrai jusque dans l’interface

- [x] `/pair`, SSE et le premier état poussé avancent trois jalons observables distincts — `apps/web/src/lib/mcp/client.ts:182`
- [x] Chaque couple statut/jalon produit un seul état actif ou fautif, sans pourcentage temporel — `apps/web/src/stores/mcp.store.ts:85`
- [x] Le flux prêt remplit les trois jalons et les compteurs d’activité restent indépendants — `apps/web/src/components/mcp/McpDialog.tsx:17`
- [x] Une désactivation pendant un asset retardé ne modifie ni projet ni historique — `apps/web/e2e/mcp-live.spec.ts:169`
- [x] La désactivation ferme le flux sans reprise automatique — `apps/web/e2e/mcp-live.spec.ts:141`
- [x] La probe fournit `findings` et conserve le round-trip complet — `scripts/mcp-live-probe.mjs:287`

### Phase 2 — Une grammaire d’étapes partagée avec le pont d’assistant

- [x] La primitive expose un jalon courant, un `<progress>` natif et masque les contrôles en attente — `apps/web/src/components/ui/setup-flow.tsx:41`
- [x] Le marqueur citron est réservé à l’étape active ; l’étape terminée reste neutre — `apps/web/src/components/ui/setup-flow.tsx:64`
- [x] Les parcours Claude Code, pont absent, secret refusé et confidentialité restent couverts — `apps/web/e2e/ai-provider.spec.ts:30`
- [x] Commande copiable, nouvelle détection et oubli du secret restent disponibles — `apps/web/src/components/campaign-dialog/AssistantSetup.tsx:265`
- [x] Le parcours étroit reste contenu dans sa surface — `apps/web/e2e/ai-provider.spec.ts:149`
- [x] Le mouvement réduit conserve les changements d’état sans déplacement — `apps/web/e2e/ai-provider.spec.ts:161`

### Phase 3 — La boîte MCP devient un parcours de connexion clair

- [x] Repos, connexion, état prêt et erreur rendent trois jalons et un seul état courant — `apps/web/e2e/mcp-live.spec.ts:26`
- [x] La progression dérive uniquement du statut et du jalon observés — `apps/web/src/components/mcp/McpDialog.tsx:17`
- [x] L’absence du démon expose commande, copie et relance dans la même boîte — `apps/web/src/components/mcp/McpDialog.tsx:69`
- [x] Fermer garde la connexion ; Désactiver la coupe — `apps/web/e2e/mcp-live.spec.ts:141`
- [x] Les détails nomment loopback, version, activité, miniature, mutation et confidentialité du jeton — `apps/web/src/components/mcp/McpDialog.tsx:117`
- [x] Le README décrit la même portée visuelle et éditoriale — `apps/mcp/README.md:32`
- [x] Le parcours est navigable au clavier, rend le focus et annonce erreur puis reprise — `apps/web/e2e/dialogs-a11y.spec.ts:95`
- [x] Les contrôles étroits et le mouvement réduit sont couverts par les audits et scénarios dédiés — `apps/web/e2e/mcp-live.spec.ts:263`

### Phase 4 — Templates hydratés avant usage et review refermée

- [x] Les appels concurrents à `hydrate()` partagent une seule lecture — `apps/web/src/stores/templates.store.ts:48`
- [x] Sauvegarde et suppression attendent l’hydratation avant de muter — `apps/web/src/stores/templates.store.ts:71`
- [x] `save_template` puis `list_templates` rend le nouveau template exactement une fois — `apps/web/src/stores/__tests__/templates.store.test.ts:43`
- [x] Rechargement et collision de nom sont vérifiés sur le vrai relais — `apps/web/e2e/mcp-templates.spec.ts:91`
- [x] Le plan et les deux phases fonts portent `implemented`, jamais `reviewed` — `aidd_docs/tasks/2026_08/2026_08_16_font-metrics-invalidation/plan.md:3`
- [x] Probe, arrêt tardif et portée des miniatures referment les cinq findings historiques — `aidd_docs/tasks/2026_08/2026_08_16_mcp-composition-quality/review.md:87`
- [x] La gate agrégée inclut tests, builds, E2E et audits sans skip ajouté dans ce diff — `package.json:15`
- [x] Les trois warnings et deux minors historiques sont absents des findings courants — `aidd_docs/tasks/2026_08/2026_08_16_mcp-agent-connection-ux/review.md:8`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |

None.

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (28/28) |
| Files checked | `apps/web/src/lib/mcp/client.ts`, `apps/web/src/lib/mcp/session.ts`, `apps/web/src/stores/mcp.store.ts`, `apps/web/src/stores/templates.store.ts`, `apps/web/src/components/ui/setup-flow.tsx`, `apps/web/src/components/campaign-dialog/AssistantSetup.tsx`, `apps/web/src/components/mcp/McpDialog.tsx`, `apps/mcp/README.md`, probe, tests et plans associés |
| Unchecked     | none |
| Unplanned     | none |
