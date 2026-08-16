# Browser QA: offres Local et Cloud

- **Verdict**: pass
- **Source**: `aidd_docs/tasks/2026_08/2026_08_15_local-cloud-plans/plan.md`
- **Run**: 2026_08_15

## Scenarios

| Scenario | Result | Verdict | Evidence | Duration |
| -------- | ------ | ------- | -------- | -------- |
| Landing Cloud vers Offres | Cloud ouvre l’éditeur et le dialogue présente uniquement Local et Cloud | pass | `qa/happy-path.webm` | 6.250 s |
| Landing française | La langue, les deux offres, 49 $ une fois, 39 $/an et l’autonomie Cloud sont visibles | pass | `qa/edge-case-fr.webm` | 5.666 s |
| Dialogue Offres au clavier | Le focus reste dans le dialogue et Échap le referme sans perdre l’éditeur | pass | `qa/edge-case-keyboard.webm` | 5.500 s |
| Thème clair et fontes | Le thème clair est appliqué et persisté, les fontes sont actives et la console reste sans erreur | pass | `qa/edge-case-theme.webm` | 4.916 s |
