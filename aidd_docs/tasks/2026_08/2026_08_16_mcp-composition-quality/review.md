# Review: MCP AI authoring et qualité de composition

- **Verdict**: changes-requested
- **Diff**: `e69671b...f951682`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_16
- **Findings**: 0 critical, 3 warning, 2 minor

## Phases

### Phase A1 — Package partagé `project-format`

- [x] Le package build seul et expose contrat, dimensions et schémas sans Fabric/DOM — `packages/project-format/src/index.ts:1`
- [x] Typecheck et lint passent sans import web cassé — `packages/project-format/package.json:1`
- [ ] La suite e2e complète passe à l'identique, export compris — non exécutée ; 14 scénarios MCP ciblés passent.

### Phase A2 — Démon MCP et relais HTTP/SSE

- [x] Le démon stdio répond à `tools/list` sans écrire sur stdout — `apps/mcp/src/main.ts:1`
- [x] Une nouvelle SSE évince l'ancienne, les appels pendants échouent et les Origins sont filtrées — `apps/mcp/src/relay/server.ts:1`
- [x] Les outils sont schématisés, revalidés et livrés en un lot — `apps/mcp/src/server.ts:1`
- [ ] La probe couvre le round-trip et passe en CI — `pnpm test` échoue sur la réponse de vignette factice.

### Phase A3 — Mode MCP web, pairing et application live

- [ ] Le mode est opt-in et la coupure est nette — un traitement asynchrone déjà reçu peut encore modifier le projet après `disableMcp()`.
- [x] Un batch validé produit un commit et un undo ; un batch invalide ne mute rien — `apps/web/src/lib/ai/session.ts:1`
- [x] Le dialogue suit le design system et l'audit contraste passe — `apps/web/src/components/mcp/McpDialog.tsx:1`
- [x] Les scénarios e2e ciblés couvrent round-trip, undo et déconnexion — `apps/web/e2e/mcp-live.spec.ts:1`

### Phase A4 — Miniatures et assets locaux

- [x] Une miniature MCP affichable est rendue et un écran inconnu est refusé — `apps/mcp/src/tools/get-thumbnail.ts:1`
- [x] Les images locales sont importées en cover centré avec refus explicites — `apps/web/src/lib/mcp/session.ts:1`
- [x] L'export MCP ciblé reste pixel-exact et opaque — `apps/web/e2e/mcp-assets.spec.ts:1`

### Phase A5 — Templates runtime générés par IA

- [x] Un template valide persiste et un template invalide est refusé — `apps/web/src/stores/templates.store.ts:1`
- [x] Le picker expose les templates IA et leur suppression accessible — `apps/web/src/components/template-picker/TemplatePicker.tsx:1`
- [ ] L'agent sauvegarde puis liste le template de façon fiable dans la même session — lecture/sauvegarde peuvent devancer l'hydratation IndexedDB.
- [x] Le spec e2e ciblé passe, reload compris — `apps/web/e2e/mcp-templates.spec.ts:1`

### Phase A6 — Skill agent MCP ScreenForge

- [ ] Le skill est installé dans chaque outil hôte — état du poste hôte non observable depuis le diff.
- [x] `tools.md` reflète le contrat partagé et documente sa régénération — `apps/mcp/docs/tools.md:1`
- [ ] Un agent frais produit trois écrans et itère visuellement — parcours agent hôte non exécuté.

### Phase C1 — Passage en exergue dans le contrat

- [x] Le contrat accepte quatre passages valides et refuse couleur ou cardinalité invalide — `packages/project-format/src/ai-tools.ts:1`
- [x] `add_text` produit un unique calque avec les seuls `charStyles` demandés — `apps/web/src/lib/ai/executor.ts:1`
- [x] `update_layer` sans exergue retire les anciens `charStyles` — `apps/web/src/lib/ai/executor.ts:1`
- [x] Un passage absent refuse atomiquement le lot — `apps/web/src/lib/__tests__/ai-executor.test.ts:1`

### Phase C2 — Constat mesuré avec la miniature

- [x] L'extraction conserve les tests d'archétypes — `apps/web/src/lib/ai/archetypes.test.ts:1`
- [x] Chaque défaut artificiel produit un constat chiffré et nommé — `apps/web/src/lib/ai/board-review.test.ts:1`
- [x] Une forme décorative sous l'accroche ne crée pas de faux chevauchement — `apps/web/src/lib/ai/board-review.test.ts:1`
- [x] `get_thumbnail` renvoie texte puis image sans transformer un constat en erreur — `apps/mcp/src/tools/get-thumbnail.ts:1`
- [x] Une planche sans défaut renvoie un texte explicite — `apps/mcp/src/tools/get-thumbnail.ts:1`
- [x] Une planche issue du générateur local ne produit aucun constat — `apps/web/src/lib/ai/board-review.test.ts:1`

### Phase C3 — Documentation exacte du contrat

- [x] `tools.md` place `emphasis` uniquement où le schéma l'accepte — `apps/mcp/docs/tools.md:1`
- [x] Les six mesures et seuils sont documentés avec le vocabulaire du constat — `apps/mcp/docs/tools.md:1`
- [x] Le piège du découpage d'accroche et sa correction sont documentés — `apps/mcp/docs/pitfalls.md:1`
- [x] Le test MCP verrouille `emphasis` contre le contrat partagé — `apps/mcp/src/server.test.ts:1`
- [x] Le serveur démarre et annonce son port — `apps/mcp/src/main.ts:1`

### Phase C4 — Rafraîchissement d'un répertoire de captures

- [x] Les quatre refus de chemin sont distincts — `apps/mcp/src/relay/asset-vault.test.ts:1`
- [x] Seuls les fichiers de `MEDIA_TYPES` entrent dans le coffre — `apps/mcp/src/relay/asset-vault.ts:1`
- [x] Trois captures produisent un undo sans toucher au placement — `apps/web/src/lib/__tests__/mcp-refresh.test.ts:1`
- [x] Un appareil sans rôle est signalé et reste inchangé — `apps/web/src/lib/__tests__/mcp-refresh.test.ts:1`
- [x] Un rôle ambigu ne pose aucun fichier et rend l'ambiguïté — `apps/web/src/lib/__tests__/mcp-refresh.test.ts:1`
- [x] Les suites unitaires MCP et web passent — `apps/mcp/src/relay/asset-vault.test.ts:1`

### Phase C5 — Sorties structurées MCP

- [x] Chaque outil enregistré porte un `title` verrouillé par test — `apps/mcp/src/server.test.ts:1`
- [x] Chaque outil avec `outputSchema` renvoie un `structuredContent` conforme — `apps/mcp/src/server.test.ts:1`
- [x] `get_project_state` et `get_screen` restent textuels — `apps/mcp/src/server.test.ts:1`
- [x] Un refus ne porte aucun `structuredContent` — `apps/mcp/src/server.test.ts:1`
- [x] La suite unitaire MCP passe et le serveur démarre — `apps/mcp/package.json:1`

### Phase F1 — Invalidation des métriques de police

- [x] Un chargement réel notifie une fois, un fallback ne notifie pas — `apps/web/src/hooks/use-fonts.test.ts:1`
- [x] La synchronisation ne remesure plus et un échec reste retentable — `apps/web/src/lib/canvas/install-fonts.ts:1`
- [x] Une notification remesure toutes les boîtes de la scène — `apps/web/src/lib/canvas/__tests__/install-fonts.test.ts:1`
- [x] Le démontage retire l'écouteur et interdit le rendu tardif — `apps/web/src/lib/canvas/__tests__/install-fonts.test.ts:1`
- [ ] `pnpm test` passe — les tests de police passent, mais la probe MCP fait échouer la commande agrégée.

### Phase F2 — Largeur déclarée des objets texte

- [x] Chaque objet texte garde la largeur déclarée du calque — `apps/web/src/lib/canvas/__tests__/declared-width.test.ts:1`
- [x] Un mot trop large déborde sans changer la boîte déclarée — `apps/web/src/lib/canvas/__tests__/declared-width.test.ts:1`
- [x] Déplacement et redimensionnement respectent la largeur, avec un seul appelant de `initDimensions` — `apps/web/src/lib/canvas/__tests__/declared-width.test.ts:1`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| warning | functional | A2, F1 | `scripts/mcp-live-probe.mjs:289` | La fausse app renvoie l'ancien format de miniature sans `findings`; `pnpm test` échoue systématiquement et le commit `a1a3996` le reconnaît. | Ajouter `findings: []` à la réponse factice et rejouer `pnpm test`. |
| warning | functional | A3 | `apps/web/src/lib/mcp/client.ts:249` | `teardown()` invalide le flux mais `answer()` ne vérifie jamais son cycle après un `await`; un import lent peut encore être appliqué après la désactivation. | Capturer le cycle dans `answer`, abandonner avant toute mutation si le cycle a changé et couvrir le cas par un test retardé. |
| warning | functional | A5 | `apps/web/src/lib/mcp/session.ts:218` | `listRelayTemplates()` lit immédiatement un store potentiellement non hydraté et `save()` peut être écrasé par l'hydratation lancée en parallèle. | Faire attendre l'hydratation existante aux opérations list/save, sans seconde lecture concurrente. |
| minor | rot | A4 | `apps/mcp/README.md:32` | Le README affirme que l'agent ne peut pas lire une image, puis documente `get_thumbnail` qui lui fournit le PNG rendu. | Décrire explicitement l'accès visuel au projet ouvert, y compris dans le dialogue d'activation. |
| minor | rot | F1, F2 | `aidd_docs/tasks/2026_08/2026_08_16_font-metrics-invalidation/plan.md:3` | Le plan et ses phases restent `pending` alors que les commits et tests correspondants sont présents. | Aligner les statuts sur l'état réellement livré. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 87% (48/55) |
| Files checked | `apps/mcp/src/server.ts`, `apps/mcp/src/relay/server.ts`, `apps/mcp/src/relay/asset-vault.ts`, `apps/mcp/src/tools/get-thumbnail.ts`, `apps/web/src/lib/mcp/client.ts`, `apps/web/src/lib/mcp/session.ts`, `apps/web/src/stores/templates.store.ts`, `apps/web/src/lib/ai/executor.ts`, `apps/web/src/lib/ai/board-review.ts`, `apps/web/src/lib/canvas/install-fonts.ts`, `packages/project-format/src/ai-tools.ts`, tests et documentation associées |
| Unchecked     | suite e2e complète — not-applicable ; probe agrégée — fix ; arrêt en vol — fix ; hydratation template — fix ; installation du skill hôte — not-applicable ; parcours agent frais — not-applicable ; `pnpm test` font — fix |
| Unplanned     | none |
