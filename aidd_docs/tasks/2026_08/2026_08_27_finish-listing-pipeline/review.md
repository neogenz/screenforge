# Review: Finir la chaîne fiche → langues → version figée → App Store Connect

- **Verdict**: changes-requested
- **Diff**: `main...claude/finish-listing-pipeline` (a67f4e7..415e8a8, 51 files, +3652/−1069)
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_28
- **Findings**: 1 critical, 15 warning, 12 minor

## Phases

### Phase 1 — Format, catalogue de langues, protocole 7 et routes `asc` du pont

- [x] `Project.listing` écrit par `updateListing` sans pas d'annulation — `apps/web/src/stores/project.store.ts:227`
- [x] `listing` validé dans `project-validation.ts`, bornes fermées, direction close, langue au format ASC — `packages/project-format/src/project-validation.ts:362`
- [x] 39 langues ASC, une seule liste, `asc.ts` en dérive `APP_STORE_LOCALES` — `apps/web/src/lib/locale-catalog.ts:19`, `apps/web/src/lib/asc.ts:65`
- [x] `PROTOCOL_VERSION = 7`, refus 409 sur les trois routes — `apps/bridge/src/protocol.ts:19`, `apps/bridge/src/server.ts:173,224,316`
- [x] `GET /asc/apps|versions|localizations` derrière le jeton `asc-publish`, sortie réduite à des ids et libellés, `redactDiagnostic` sur l'erreur — `apps/bridge/src/server.ts:262,283`, `apps/bridge/src/asc.ts:387,405,428`
- [x] Identifiant validé contre `ASC_ID` avant de devenir un argument — `apps/bridge/src/server.ts:285`, `apps/bridge/src/protocol.ts:246`
- [x] Le pont tourne sous `node` en strip-only (aucune propriété de constructeur, aucun enum, aucun namespace) — grep sur `apps/bridge/src` : vide

### Phase 2 — Traduction et relecture par le rédacteur choisi (pont, Anthropic, OpenRouter)

- [x] `runTextJob({kind})` lit la session et dispatche pont / Anthropic / OpenRouter — `apps/web/src/lib/ai/text.ts:67`
- [x] Le rédacteur local refuse avec une phrase — `apps/web/src/lib/ai/text.ts:48`
- [x] Lots de 100, ordre préservé, compte vérifié **par lot** et en agrégat — `apps/web/src/lib/ai/text.ts:100`, `apps/web/src/lib/bridge-client.ts:341`, `apps/web/src/lib/ai/direct-api.ts:487`, `apps/bridge/src/server.ts:237`
- [x] Ni identifiant de calque ni image ne quittent l'onglet — `apps/web/e2e/locale.spec.ts:266`, `apps/web/e2e/ai-provider.spec.ts:323`
- [x] `/proofread` ajouté, même contrat de comptage que `/translate` — `apps/bridge/src/server.ts:250`
- [x] `textWriterUnavailable(state?)` : une seule implémentation, deux appelants, zéro copie — `apps/web/src/lib/ai/text.ts:44`
- [ ] « rien pour toutes les langues d'un coup » nommé comme lacune mesurée, phase marquée *fait* — rien ne le livre : le seul bouton est lié à la langue sélectionnée (`apps/web/src/components/locale-dialog/LocaleDialog.tsx:183`), et l'écart n'est pas consigné
- [ ] Un calque texte créé **après** la langue reste hors traduction, hors comptage et hors revue de débordement, en silence ; seule sortie : supprimer la langue et la recréer, ce qui perd toutes ses traductions — `apps/web/src/lib/locale.ts:271,354`, `apps/web/src/components/locale-dialog/LocaleDialog.tsx:191`

### Phase 3 — Boîte de génération : brief persistant, portée par écran, correction

- [x] Titre « Composer la fiche · … », étapes nommées — `apps/web/src/components/campaign-dialog/CampaignDialog.tsx:627`
- [x] Brief relu à l'ouverture depuis `Project.listing`, réécrit à chaque proposition — `apps/web/src/components/campaign-dialog/CampaignDialog.tsx:122,248` ; asserté `apps/web/e2e/ai-campaign.spec.ts:317`
- [x] « Recomposer l'écran courant » : suppression des calques + `planScreenCalls` dans **un seul** `commitAiRun`, borné par `context.screenId`, un seul pas d'annulation — `apps/web/src/components/campaign-dialog/CampaignDialog.tsx:462`, `apps/web/src/lib/ai/run.ts:41`
- [x] La capture de l'écran est conservée (image) — `apps/web/src/components/campaign-dialog/CampaignDialog.tsx:199,474`
- [x] « Corriger l'orthographe » appelle réellement `runTextJob({kind:'proofread'})` et réécrit le plan en revue — `apps/web/src/components/campaign-dialog/CampaignDialog.tsx:500`
- [ ] « sa capture reprise » : l'image survit, son recadrage persistant est remis à zéro — `apps/web/src/lib/ai/tools.ts:263`

### Phase 4 — Catalogue de mises en page dérivé des archétypes

- [x] Dérivation réelle : `backgroundFor` + `composeArchetype`, produit croisé cibles × directions × archétypes — `apps/web/src/assets/templates/catalog.ts:64,147`
- [x] Géométrie lue dans `dimensions.ts`, pas de dimension en dur dans les nouveaux fichiers — `apps/web/src/assets/templates/catalog.ts:59`
- [ ] Le catalogue expose les 6 archétypes ; `assignArchetypes` n'en émet que 3, et les tests qualité bouclent sur ces 3 (`SAFE_ARCHETYPE_IDS`). 48 des 96 modèles sortent d'une géométrie que rien n'assertait — `apps/web/src/lib/ai/archetypes.ts:353`, `apps/web/src/lib/__tests__/archetypes.test.ts:127,160`
- [ ] Conséquence mesurée : 4 modèles `google-play-phone` × `bas-ancre` peignent 94 px d'accroche **sur l'appareil**, sans pastille de lisibilité, à ≈1.1:1 — `apps/web/src/assets/templates/catalog.ts:149`, cause `apps/web/src/lib/ai/archetypes.ts:422`
- [ ] `templates.test.ts` n'assertit ni contraste, ni bande vide, ni séparation accroche/appareil, et abaisse le seuil de contenance de 90 % à 70 % en créditant `archetypes.ts` d'un plancher qu'il n'énonce pas — `apps/web/src/assets/templates/__tests__/templates.test.ts:113`

### Phase 5 — Versions figées : vocabulaire et confirmation

- [x] « release » disparu de `ReleaseDialog`, `TopBar` et `commands.ts` — grep : plus que des identifiants et des commentaires
- [x] Suppression confirmée par `ConfirmAction` → `AlertDialog` coss — `apps/web/src/components/release-dialog/ReleaseDialog.tsx:507`
- [x] Explication (définition) toujours visible — `apps/web/src/components/release-dialog/ReleaseDialog.tsx:369`
- [ ] Le mot survit dans deux chaînes rendues hors du dialogue — `apps/web/src/lib/asc.ts:327`, `apps/web/src/lib/release.ts:241`
- [ ] Les quatre *raisons* de figer se replient encore dans `<details>` dès qu'une version existe, contre « explication toujours visible » — `apps/web/src/components/release-dialog/ReleaseDialog.tsx:403`

### Phase 6 — Publication : destination lue chez Apple, confirmation, essai à blanc réel

- [x] Trois étapes pont → destination → envoi — `apps/web/src/components/publish-dialog/PublishDialog.tsx:529`
- [x] La confirmation garde réellement l'envoi réel : hors essai à blanc, aucun chemin n'atteint `publish()` sans passer par l'`AlertDialog` — `apps/web/src/components/publish-dialog/PublishDialog.tsx:519,994`
- [x] L'essai à blanc est réel de bout en bout jusqu'à `asc --dry-run`, et refusé plutôt que dégradé si le binaire ne sait pas le faire — `apps/bridge/src/asc.ts:152,248`
- [x] Le lot préparé est nul s'il ne porte pas l'identifiant de la version choisie, et tout l'aval lit `bundle`, jamais `preparedBundle` — `apps/web/src/components/publish-dialog/PublishDialog.tsx:253` ; asserté `apps/web/e2e/asc-publish.spec.ts:267`
- [x] `SelectField` « Version figée » dès qu'il y en a plusieurs — `apps/web/src/components/publish-dialog/PublishDialog.tsx:823`
- [x] Aucun identifiant Apple demandé, stocké ni affiché ; le corps envoyé ne porte que le protocole, le lot et la cible — `apps/web/src/lib/bridge-client.ts:467`
- [x] Le chemin sans pont reste entier (quatre champs, préparation, téléchargement, commande à copier) — `apps/web/src/components/publish-dialog/PublishDialog.tsx:754,877,915`
- [ ] Un 401 à la publication renvoie vers un champ de jeton que `SetupFlow` a déjà remplacé par son résultat : la seule sortie est de fermer la boîte, ce qui jette le lot préparé — `apps/web/src/components/publish-dialog/PublishDialog.tsx:578`, `apps/web/src/components/patterns/setup-flow.tsx:86`
- [ ] `publishViaBridge` est le seul appel pont sans mappage `TypeError → UNREACHABLE` : pont arrêté = « Failed to fetch » brut — `apps/web/src/lib/bridge-client.ts:464`
- [ ] Aucun test n'ouvre la branche d'envoi réel : les deux specs restent sur `dryRun: true`, donc le contrôle le plus conséquent du diff part non couvert — `apps/web/e2e/asc-publish.spec.ts:185`

### Phase 7 — Vitrine, mémoire projet, parcours e2e

- [x] `campaign-journey.spec.ts` tient son titre : sonde du pont, destination lue et appariée, preflight, essai à blanc, et `published[0].releaseId === frozen[0].id` — `apps/web/e2e/campaign-journey.spec.ts:127,304`
- [x] `aidd_docs/memory/integration.md` décrit ce que le code fait (vérifié ligne à ligne contre `apps/bridge/src/asc.ts` et `server.ts`)
- [x] La vitrine ne survend aucune capacité absente — `apps/web/src/landing/copy.ts`
- [ ] La vitrine énonce les étapes de publication dans un ordre que le produit ne peut pas exécuter — `apps/web/src/landing/copy.ts:346,703`
- [ ] `CLAUDE.md` documente encore le titre et l'icône que ce diff remplace, contredit par une ligne que le même diff ajoute — `CLAUDE.md`, paragraphe « The default path is not an AI »

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🔴 | functional | 4 | `apps/web/src/assets/templates/catalog.ts:149` (cause `apps/web/src/lib/ai/archetypes.ts:422`) | 4 modèles `google-play-phone` × `bas-ancre` posent 94 px d'accroche sur l'appareil sans pastille, à ≈1.1:1. `const stacked = !spec.headline.overDevice && wantedY >= 0` : `bas-ancre` a `deviceY: -0.2`, donc l'appareil n'est jamais réduit pour dégager l'accroche, et l'encre est choisie contre le fond, pas contre ce qui est dessous. Invisible sur iPhone (planche 440×956), visible sur Google Play (540×960, appareil 23 % plus haut) | Borner la hauteur de l'appareil à `headline.y - device.y` dans la branche non empilée, **après** avoir élargi les deux boucles `SAFE_ARCHETYPE_IDS` de `archetypes.test.ts:127,160` à `ARCHETYPE_IDS` |
| 🟡 | functional | 4 | `apps/web/src/lib/__tests__/archetypes.test.ts:127,160` | Le catalogue est le premier et seul consommateur des 3 archétypes que `assignArchetypes` n'émet jamais — exactement les 3 que la suite qualité exclut. 48 des 96 modèles sortent d'une géométrie non assertée | Boucler sur `ARCHETYPE_IDS` (en sautant `overDevice` pour la séparation) |
| 🟡 | functional | 4 | `apps/web/src/assets/templates/__tests__/templates.test.ts:113` | Aucune assertion de contraste, de bande vide ni de séparation ; plancher de contenance abaissé à 0.7 avec un commentaire créditant `archetypes.ts`, qui dit 90 % (`:29`, `:532`) | Reprendre les assertions d'`archetypes.test.ts`, ou dire que le plancher est le choix du catalogue |
| 🟡 | functional | 2 | `apps/web/src/components/locale-dialog/LocaleDialog.tsx:191`, `apps/web/src/lib/locale.ts:271,354` | Un calque texte né après la langue est muet partout : `seedTexts` ne tourne que dans `addLocale`, `reviewLocale` fait `if (!variant) continue`, le filtre du dialogue exige `variant &&`. C'est le pipeline même de cette branche (composer un lot, puis traduire). Recouvrement uniquement destructif | Réamorcer les calques manquants à l'ouverture du dialogue, ou laisser `applyTranslations` accepter un id désignant un vrai calque texte |
| 🟡 | functional | 2 | `apps/web/src/components/locale-dialog/LocaleDialog.tsx:183` | « rien pour toutes les langues d'un coup » listé comme lacune mesurée, phase 2 marquée *fait*, rien ne le livre, rien ne le consigne dans « Écarts » | Boucler sur `locales`, ou consigner l'abandon |
| 🟡 | code | 2 | `apps/web/src/components/locale-dialog/LocaleDialog.tsx:395` | Supprimer une langue — toutes ses traductions — est un clic non confirmé, sans toast, retour ignoré, dans la release qui a justement ajouté la confirmation au geste équivalent des versions figées | Même enveloppe `ConfirmAction` que `ReleaseDialog.tsx:507` |
| 🟡 | code | 6 | `apps/web/src/components/publish-dialog/PublishDialog.tsx:578` | Un 401 à la publication demande de recoller un jeton dans un champ que `SetupFlow` a remplacé par son résultat une fois l'étape `done` ; la seule sortie jette le lot préparé | Dans le `catch` de `publish()`, `setAppsResult({ state: 'idle' })` pour rouvrir l'étape 2 |
| 🟡 | code | 6 | `apps/web/src/lib/bridge-client.ts:464` | Seul appel pont sans mappage `TypeError → UNREACHABLE` ; `PublishDialog.tsx:473` affiche donc « Failed to fetch » | `catch (cause) { throw cause instanceof TypeError ? new Error(UNREACHABLE) : cause }` |
| 🟡 | code | 6 | `apps/web/src/components/publish-dialog/PublishDialog.tsx:432` | `download()` est la seule action asynchrone sans garde d'occupation, sans état de chargement et sans `catch` : double-clic = deux ZIP, rejet = promesse non gérée, rien à l'écran | `if (!bundle || !manifest || busy) return`, drapeau replié dans `busy`, `try/catch → setError` |
| 🟡 | code | 2 | `apps/web/src/lib/ai/direct-api.ts:483` | Budget de sortie figé à 4096 jetons pour des lots annoncés à 100 × 400 caractères : troncature, puis refus du lot entier sous un message trompeur. Le pont n'a pas ce plafond | Dériver le budget du lot, ou baisser `TEXT_BATCH` sur le chemin API |
| 🟡 | rot | 4 | `apps/web/src/components/template-picker/TemplatePreview.tsx:151` | La vignette échelonne les formes tracées par `SHAPE_BOX` (100) quand le canevas utilise la bbox propre du `Path` : erreur de 8.3× sur 16 modèles. `PlanPreview` avait déjà été corrigé, pas celui-ci. Bug préexistant, exposé par le passage de 7 à 96 modèles n'utilisant que `rectangle` avant | Une ligne : `drawnBox(entry)` à la place de `SHAPE_BOX`, comme `PlanPreview.tsx:88` |
| 🟡 | conform | 5 | `apps/web/src/lib/asc.ts:327`, `apps/web/src/lib/release.ts:241` | « Régénérez une nouvelle release propre. » — le mot que le contrat de la branche fait disparaître de l'interface, dans deux chaînes rendues (l'une assertée visible par `asc-publish.spec.ts:246`) | « Figez une nouvelle version sans filigrane. » |
| 🟡 | conform | 6 | `apps/web/src/components/publish-dialog/PublishDialog.tsx:899,903` | « gel / gelée / Gelez » trois fois dans une alerte, contre « figer » partout ailleurs, y compris à `:209` du même fichier | « depuis qu'il a été figé » / « à la version figée » / « Figez un nouveau lot » |
| 🟡 | fit | 7 | `apps/web/src/landing/copy.ts:346,703` | « Freeze a version, run the preflight, pick the app, version and language… » : le preflight valide `bundleId`, `appVersion` et `locale`, que l'étape destination fournit — il ne peut donc pas la précéder | Intervertir les deux propositions, en/fr |
| 🟡 | rot | 7 | `CLAUDE.md`, § « The default path is not an AI » | Documente « Générer les visuels App Store » et le mégaphone, remplacés par « Composer la fiche » (`CampaignDialog.tsx:627`) et `GalleryHorizontal` (`TopBar.tsx:779`) — contredit par la ligne d'arborescence que le même diff ajoute | Réécrire au titre et à l'icône livrés, en consignant pourquoi |
| 🟡 | rot | 4 | `apps/web/src/assets/templates/layers.ts:71` | `shadowColor: 'rgba(0,0,0,0.22)'` contre `DEFAULT_DEVICE_SHADOW_COLOR = 'rgba(0,0,0,0.3)'` que `layer-factories.ts:169` utilise — la duplication ayant déjà dérivé, désormais sur 80 calques au lieu de 6. Le fichier importe déjà `DEFAULT_INK_COLOR` du même module | Importer la constante |
| 🟡 | code | 4 | `apps/web/src/assets/templates/catalog.ts:27` + `__tests__/templates.test.ts:12` | La couverture est une liste de 4 des 9 `STORE_TARGET_IDS`, redite mot pour mot dans le test : le test ne peut pas voir une famille ajoutée à `dimensions.ts` et absente du catalogue | La dériver en groupant `STORE_TARGET_PROFILES` par famille, comme `archetypes.test.ts:39` |
| 🟡 | conform | 6 | `apps/web/src/components/publish-dialog/PublishDialog.tsx:858,867,971,973` | Quatre icônes Lucide sans classe `size-*` hors conteneur coss : repli 24×24 à côté d'un texte de 12 px. `expectNoRawIcon` existe pour ça mais est appelé (`asc-publish.spec.ts:150`) sur une étape où aucune n'est montée | `size-3.5` sur les quatre, et déplacer l'appel après l'assertion d'essai à blanc |
| 🟢 | code | 6 | `apps/web/src/components/publish-dialog/PublishDialog.tsx:499` | `ConfirmAction` est frère de `StepDialog` dans un fragment, seul de ce genre dans le dépôt (`ReleaseDialog.tsx:507` l'imbrique). Mesuré : le compteur d'imbrication Base UI reste bien à 0, mais un Échap réel ne ferme que la confirmation (piège de focus + `stopPropagation` de `useDismiss`) ; seul un keydown émis depuis le popup parent démonte tout. Incohérence structurelle, pas un défaut atteignable | Imbriquer dans le contenu de l'étape « envoi » |
| 🟢 | code | 6 | `apps/web/src/components/publish-dialog/PublishDialog.tsx:315` | Écriture morte : `setBridgeToken('asc-publish', trimmed)` avant validation, alors que chaque appel `asc` passe le jeton explicitement et que le seul lecteur de `bridgeToken()` demande `'assistant'` | Supprimer l'appel |
| 🟢 | code | 1 | `apps/bridge/src/server.ts:229` | `prompt(parsed.data as TranslateRequest & ProofreadRequest)` : le transtypage désarme la vérification qui attraperait un appariement schéma/prompt inversé | Paramétrer `textTurn` en générique sur le schéma |
| 🟢 | code | 2 | `apps/web/src/lib/ai/text.ts:72` | `runTextJob` revérifie avec `textWriterUnavailable()` sans argument, donc la session du module, quand l'appelant a jugé sur l'état réactif — le cas même que le paramètre existe pour couvrir. Sans conséquence en pratique (l'effet a tourné avant le clic) | Accepter un état optionnel et le transmettre |
| 🟢 | code | 3 | `apps/web/src/components/campaign-dialog/CampaignDialog.tsx:1126,1274` | `onHeadline` typé à 2 arguments mais câblé sur `editScreen(index, headline, evidence?)` : la première frappe efface la « Source factuelle » | `editScreen(index, headline, evidence = plan.screens[index]?.evidence)` |
| 🟢 | code | 3 | `apps/web/src/components/campaign-dialog/CampaignDialog.tsx:1019` | « Réécrire » disparaît sans rédacteur connecté, sans raison affichée, quand « Corriger l'orthographe » juste au-dessus reste visible et dit pourquoi | Le rendre désactivé avec la même phrase |
| 🟢 | code | 5 | `apps/web/src/components/release-dialog/ReleaseDialog.tsx:219` | Suppression échouée : retour ignoré, aucun message, la version reste listée ; `resume()` deux lignes plus bas pose bien une erreur | `setError(…)` avant le `return` |
| 🟢 | code | 6 | `apps/web/src/components/publish-dialog/PublishDialog.tsx:926` | `void navigator.clipboard?.writeText(...)` suivi d'un toast de succès inconditionnel : un rejet est une promesse non gérée et le toast ment | Toaster dans le `.then` |
| 🟢 | conform | 6 | `apps/web/src/components/publish-dialog/PublishDialog.tsx:938,949` | `<label>` brut là où coss livre `Label` ; le pouce du `Switch` clé son animation sur `[data-slot=label]:active` | `<Label>` de `ui/label` |
| 🟢 | rot | 1 | `packages/project-format/src/project-validation.ts:354` vs `apps/web/src/lib/ai/plan.ts:116` | Deux listes indépendantes des mêmes quatre directions ; une cinquième dans `DIRECTIONS` ferait échouer `isProject` sur le projet entier | Une assertion liant `DIRECTIONS.map(d => d.id)` à `LISTING_DIRECTIONS` |
| 🟢 | rot | 6 | `apps/web/src/lib/asc.ts:42,398` | `ASC_ACCEPTED_SIZES` et `ASC_SIZE_LABEL` : zéro lecteur, supplantés par `profile.output.portrait` et `ascSizeLabel`. Préexistants, mais cette branche a réécrit les lecteurs du fichier | Supprimer |
| 🟢 | code | 2 | `apps/web/src/lib/ai/direct-api.ts:497` | `target: TextLanguage & { script: string }` : obligation imposée à l'appelant, jamais lue | Retirer `& { script: string }` |
| 🟢 | rot | 4 | `apps/web/src/assets/templates/catalog.ts:112,131,140` | `y` fractionnaire sur 4 modèles montre (seule géométrie du fichier non produite par `composeArchetype`, et non testée) ; `lineHeight: 1.2` redit `LINE_HEIGHT` privé ; 24 tuiles pour 6 noms-phrases tronqués dans une colonne de ~108 px | `Math.round`, exporter `LINE_HEIGHT`, ajouter un `name` court |
| 🟢 | rot | 7 | `apps/web/e2e/campaign-journey.spec.ts:210`, `apps/web/e2e/locale.spec.ts:225` | Deux étapes plus faibles que leur intitulé : « borné à l'écran courant » n'assertit qu'une non-modification (une recomposition sans effet passe) ; « traduit les textes non relus » traduit alors que tout est non relu, donc n'exerce jamais la branche intéressante du filtre | Asserter l'effet ; marquer une ligne relue avant de traduire |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 79 % (30/38)                                      |
| Files checked | `apps/web/src/lib/ai/{text,direct-api,plan,run}.ts`, `lib/{bridge-client,locale,locale-catalog,asc,release,commands}.ts`, `stores/project.store.ts`, `components/{publish-dialog,campaign-dialog,locale-dialog,release-dialog,template-picker}/*`, `assets/templates/{catalog,layers,index}.ts` + tests, `apps/bridge/src/{server,protocol,asc,main}.ts`, `packages/project-format/src/{types,project-validation}.ts`, `apps/web/e2e/*`, `apps/web/src/landing/copy.ts`, `CLAUDE.md`, `aidd_docs/memory/integration.md` |
| Unchecked     | Séparation accroche/appareil sur les archétypes non couverts — fix ; assertions qualité du catalogue — fix ; réamorçage des calques nés après une langue — fix ; « toutes les langues d'un coup » — fix ; « release » dans `asc.ts`/`release.ts` — fix ; ordre des étapes sur la vitrine — fix ; 401 sans champ de retour — fix ; branche d'envoi réel non testée — fix |
| Unplanned     | `apps/web/src/lib/asc.ts:197` — `appId`/`appName`/`versionId` désormais recopiés dans `manifest.target` alors que `uploadCommand` ne lit que `versionLocalization` : le manifeste montre des identifiants que la commande n'utilise pas (`bundleHash` inchangé, donc sans effet sur la vérification) |
