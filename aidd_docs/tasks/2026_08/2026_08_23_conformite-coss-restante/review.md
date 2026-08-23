# Review: Fermer les écarts coss restants

- **Verdict**: changes-requested
- **Diff**: `3d54bbe...63d554b`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_23
- **Findings**: 0 critical, 3 warning, 4 minor

## Phases

### Phase 1 — La surface flottante compose `Card`

- [x] `island.tsx` importe `Card`, n'écrit plus ni `rounded-2xl` ni `border` — `apps/web/src/components/patterns/island.tsx:2,25`
- [x] Le `::before` de largeur non nulle vient de `Card` (`before:absolute before:inset-0`) — `apps/web/src/components/ui/card.tsx:15`
- [x] `audit:scale` retrouve ses îles — exécuté, « Échelles fermées »
- [x] HUD et barre de sélection sur une seule rangée — `toolbar/ZoomHud.tsx:24`, `canvas/SelectionToolbar.tsx:128`
- [x] Barre haute et tiroirs sans changement de mise en page — `TopBar.tsx:209` rend `grid` (groupe `display`, il l'emporte sur `flex`, et `flex-col` est sans effet sur une grille), `drawer-island.tsx:42` déclare déjà `flex-col`
- [x] Le liseré suit la courbe du bord — `design-system/stage.css:80` pose `corner-shape` sur `&::before`, une seule définition pour les deux boîtes
- [x] `probe:visual` n'écarte qu'au bord des îles — écart résiduel sur l'état `vide` tracé à une course de vignette dans la sonde, plancher de bruit établi en capturant deux fois le même build
- [x] `audit:scale`, `audit:contrast`, `audit:ui`, `lint`, `typecheck` passent — exécutés
- [x] L'assertion échoue si l'on retire `flex-row` du HUD — vérifié par mutation, `Expected: 36, Received: 38`
- [x] `CLAUDE.md` décrit la composition réelle et la règle `flex-row` — `CLAUDE.md:207`

### Phase 2 — `group-hover` devient `in-*`

- [x] `grep -rn "group-hover" apps/web/src/components` ne renvoie rien — vérifié, seul `group/why` subsiste sur un `<details>`
- [x] Survoler une ligne de calque révèle poignée et actions, efface les pastilles — `layers-panel/LayerItem.tsx:240,268,312`
- [x] Tuile de gabarit et vignette d'écran révèlent leur action — `template-picker/TemplatePicker.tsx:213`, `screens-bar/ScreenThumbnail.tsx:378`
- [x] Les quatre `group-open` sont intacts — `landing/AgentSection.tsx:88`, `landing/Faq.tsx:30,33`, `release-dialog/ReleaseDialog.tsx:541`
- [x] Opacité mesurée à 1 sous le pointeur et 0 hors pointeur, pour les cinq sites — mesuré au navigateur, y compris `pointer-events` none/auto sur la pellicule
- [x] La révélation au clavier est inchangée — `focus-within` mesuré à 1 sur la ligne de calque, `focus-visible` à 1 sur la tuile après tabulation
- [x] La nouvelle assertion passe et échoue sur une lettre retirée au slot — `apps/web/e2e/semantics.spec.ts:165`, mutation `layer-item` → `layer-tem` → `Received: "0"`
- [x] `CLAUDE.md` énonce la règle, son gain et son exception — `CLAUDE.md:227`

### Phase 3 — Les exemptions muettes de l'audit

- [x] `audit:ui` imprime l'exemption avec sa raison — `scripts/ui-source-audit.mjs:145,159`
- [x] L'audit échoue si le fichier exempté est renommé — vérifié par `git mv`, « exemption périmée »
- [x] Un jeton de la vitrine en commentaire ne fait plus échouer l'audit — vérifié sur `island.tsx`
- [x] Le même jeton dans une `className` échoue toujours — vérifié, `island.tsx:33 — .text-2xs`
- [x] `divide-<jeton vitrine>` échoue en nommant fichier et jeton — vérifié avec un `--color-` temporaire dans `landing.css`
- [x] L'application inchangée passe toujours — les cinq préfixes ajoutés ne produisent aucun faux positif
- [x] `phase-2.md` ne cite plus de mesure datée — `2026_08_23_coss-button-auto-height/phase-2.md:95`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | conform | - | `apps/web/src/components/mcp/McpDialog.tsx:238` | L'`AlertCircle` ajouté n'a pas de classe `size-*` et ne descend d'aucun conteneur coss : mesuré au navigateur dans l'état « démon absent », il rend **24×24** dans une ligne `text-xs`, contre 10 et 16 pour les autres icônes de la boîte. C'est la signature exacte que `expectNoRawIcon` refuse, et la garde n'ouvre jamais cet état — la règle « aucune taille d'icône brute » de `CLAUDE.md` est enfreinte sans qu'aucun audit ne le voie. | Écrire `className="mt-0.5 size-3.5 shrink-0"` (l'échelon de `CLAUDE.md` pour une icône dans du texte 12px). Quatre sites préexistants copient la même forme (`AssistantSetup.tsx:136,282,350`, `CampaignDialog.tsx:591`) et méritent la même correction, hors périmètre de ce diff. |
| 🟡 | fit | 3 | `scripts/ui-source-audit.mjs:347` | Le balayage ne lit plus que les valeurs de `className` et les appels à `cn`/`cva`/`clsx` : une chaîne de classes tenue dans une variable lui échappe entièrement. Démontré en écrivant `text-2xs` dans `processing-panel.tsx:111` (`const base = 'animate-mark …'`), forme déjà présente dans le dépôt — l'audit répond « ok, aucune des 3 classes réservées ». La version précédente l'attrapait. Le critère littéral est tenu, la garde a perdu de la couverture en silence, ce que le plan lui-même donnait comme le mauvais sens de l'erreur. | Ajouter aux segments les littéraux de chaîne affectés à un identifiant, ou balayer tous les littéraux de chaîne hors commentaires — ce qui règle la plainte d'origine (le jeton cité en prose) sans ouvrir d'angle mort. |
| 🟡 | code | - | `apps/web/src/lib/mcp/client.ts:187` | `probeMcpDaemon` appelle `fetch` sans `AbortSignal` ni délai. Une socket qui accepte la connexion sans jamais répondre laisse `probe` à `null` indéfiniment : la marche 1 reste sur « Recherche du démon… », `codeUsable` reste faux, donc le champ du code **et** « Appairer » restent désactivés. La boîte n'a alors aucune sortie, et « Vérifier » relance la même attente. | Passer `signal: AbortSignal.timeout(3000)` et traiter l'abandon comme `down` — le `catch` existant le fait déjà, il suffit de borner l'attente. |
| 🟢 | code | - | `apps/web/src/components/mcp/McpDialog.tsx:89` | `recheck()` fait `void probeMcpDaemon().then(setProbe)` sans garde d'annulation ni d'ordre, alors que l'effet de montage juste au-dessus en pose une (`cancelled`). Deux clics rapides sur « Vérifier » peuvent se résoudre à l'envers et afficher un verdict périmé. | Reprendre la même garde : un jeton de requête incrémenté, ignoré si une sonde plus récente a démarré. |
| 🟢 | rot | - | `apps/web/src/components/mcp/McpDialog.tsx:325` | « Détails de connexion » lit toujours `version` (le store, rempli à l'appairage) et affiche « Non détectée » alors que la marche 1, juste au-dessus, écrit « Démon MCP 0.1.0 joignable » depuis la sonde. Deux affirmations contradictoires sur le même écran, introduites par le fait que la page connaît désormais la version avant l'appairage. | Lire `daemonVersion` (déjà calculé l. 141) plutôt que `version`. |
| 🟢 | code | 3 | `scripts/ui-source-audit.mjs:313` | `balanced()` compte les paires sans sauter chaînes ni commentaires. Une parenthèse fermante isolée dans un commentaire à l'intérieur d'un `cn(` — forme que ce dépôt écrit couramment — clôt le segment trop tôt. Démontré : le segment `cn(` est bien tronqué, le défaut n'est aujourd'hui masqué que parce que le segment `className={…}` englobant, compté en accolades, rattrape la lecture. | Sauter les littéraux de chaîne et les commentaires pendant le comptage, ou retirer les commentaires avant de compter plutôt qu'après. |
| 🟢 | code | 1 | `apps/web/e2e/semantics.spec.ts:151` | L'assertion du HUD code en dur `+ 10` (le `p-1` de l'île plus le bord de `Card`). Si coss change l'un des deux, l'échec porte sur un nombre nu, sans dire lequel a bougé. | Dériver la valeur du `padding` et du `border-width` calculés de l'île, et garder l'assertion sur l'égalité. |

## Verification

| Metric        | Value                                                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 100% (25/25)                                                                                                                                                                  |
| Files checked | `patterns/island.tsx`, `design-system/stage.css`, `toolbar/ZoomHud.tsx`, `canvas/SelectionToolbar.tsx`, `layers-panel/LayerItem.tsx`, `screens-bar/ScreenThumbnail.tsx`, `template-picker/TemplatePicker.tsx`, `mcp/McpDialog.tsx`, `lib/mcp/client.ts`, `mcp/src/relay/protocol.ts`, `mcp/src/relay/server.ts`, `gradient-editor/GradientEditor.tsx`, `scripts/ui-source-audit.mjs`, `e2e/semantics.spec.ts`, `e2e/canvas-editing.spec.ts`, `e2e/mcp-live.spec.ts`, `e2e/mcp-relay.ts`, `mcp/src/relay.test.ts`, `CLAUDE.md` |
| Unchecked     | none                                                                                                                                                                          |
| Unplanned     | Accompagnement de l'appairage MCP (`GET /hello`, `probeMcpDaemon`, réécriture de `McpDialog`, `resumeMcp`, specs associées) — demandé en cours de plan, ne trace à aucun critère ; correctif des pastilles de dégradé (`GradientEditor.tsx`, garde dans `canvas-editing.spec.ts`) — signalé en cours de plan, ne trace à aucun critère |
