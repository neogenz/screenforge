---
objective: Finir les cinq chantiers qui séparent l'éditeur d'un produit vendable — génération des visuels par écran ou par lot sans ressaisie, traduction automatique relue, catalogue de mises en page, versions figées compréhensibles, publication App Store Connect branchée de bout en bout
status: implemented
---

# Finir la chaîne fiche → langues → version figée → App Store Connect

| | |
| --- | --- |
| Goal | Un projet « prêt à vendre » : chaque bouton de la barre livre ce qu'il annonce, sans ressaisie ni étape morte |
| Source | Demande utilisateur du 27 août 2026 (cinq lacunes nommées, trois jugées critiques : IA écran/lot, langues, preflight & asc) |
| Base | `main` @ bc23778 |

## Ce qui manquait, mesuré

- **Générer les visuels** : le brief (nom, phrase, style, arguments) vivait dans l'état de la boîte, donc se ressaisissait à chaque ouverture ; on ne pouvait ni recomposer un seul écran, ni corriger l'orthographe d'une accroche ; le titre et le mégaphone ne disaient pas que dix écrans complets allaient être posés en calques.
- **Langues** : la boîte demandait un code et un nom à taper, et « Pré-remplir via le pont » n'existait que pour Claude Code — rien pour une clé Anthropic/OpenRouter, rien pour ne traduire que ce qui reste à relire, rien pour toutes les langues d'un coup, aucune langue d'origine déclarée.
- **Modèles** : sept gabarits pour quatre familles d'appareils, alors que `archetypes.ts` sait composer six mises en page dans quatre directions.
- **Releases** : un mot d'infrastructure, une explication repliée, « Retirer » sans confirmation, une langue affichée par son code.
- **Publication** : quatre identifiants Apple à recopier à la main depuis un terminal (`asc apps list`, `asc versions list`, `asc localizations list`), alors que le pont porte déjà le jeton `asc-publish` et le binaire.

## Contrat

- `Project.listing` (nom d'app, phrase, arguments, page produit, direction, langue d'origine) : écrit par `project.store.updateListing` sans pas d'annulation, comme le nom du projet ; validé dans `project-validation.ts`.
- `lib/locale-catalog.ts` : les 39 langues App Store Connect avec nom français et écriture ; la boîte des langues choisit dans cette liste, le code du projet est le code ASC.
- `lib/ai/text.ts` : `runTextJob({kind: 'translate' | 'proofread'}, texts)` lit la session du rédacteur (`session.ts`) et dispatche pont / Anthropic / OpenRouter ; le rédacteur local refuse avec une phrase. Lots de 100, ordre préservé, compte vérifié.
- Pont protocole 7 : `/translate` reçoit la langue source et le contexte ; `/proofread` ; `GET /asc/apps`, `/asc/versions?app=`, `/asc/localizations?version=` derrière le jeton `asc-publish`, sortie relue par `redactDiagnostic`.
- Boîte de génération : titre « Composer la fiche · … », étapes nommées, portée « N nouveaux visuels » ou « Recomposer l'écran courant » (une transaction : suppression des calques, fond, recomposition ; capture de l'écran conservée), « Corriger l'orthographe » dans la relecture.
- Versions figées : le mot « release » disparaît de l'interface ; explication toujours visible ; suppression confirmée.
- Publication : trois étapes — pont, destination choisie dans les listes du pont (localisation appariée à la langue de la version), envoi avec confirmation avant tout envoi réel. Le chemin sans pont (saisie manuelle + ZIP + commande) reste entier.

## Phases

| # | Phase | État |
| --- | --- | --- |
| 1 | Format, catalogue de langues, protocole 7 et routes `asc` du pont | fait |
| 2 | Traduction et relecture par le rédacteur choisi (pont, Anthropic, OpenRouter) | fait |
| 3 | Boîte de génération : brief persistant, portée par écran, correction | fait |
| 4 | Catalogue de mises en page dérivé des archétypes | fait |
| 5 | Versions figées : vocabulaire et confirmation | fait |
| 6 | Publication : destination lue chez Apple, confirmation, essai à blanc réel | fait |
| 7 | Vitrine, mémoire projet, parcours e2e | fait |

## Écarts décidés en cours de route

- **Un seul contrôle de disponibilité du rédacteur** : `textWriterUnavailable(state?)` prend l'état en paramètre (session du module par défaut, état réactif de `useAssistant` sinon). La boîte des langues en avait recopié le corps mot pour mot parce que le crochet ne réécrit la session qu'un rendu après la connexion ; le paramètre couvre ce cas sans copie.
- **Le choix du lot à publier est revenu** : la réécriture de la publication envoyait toujours la dernière version figée. Un `SelectField` « Version figée » apparaît dès qu'il y en a plusieurs, et le lot préparé est nul s'il ne porte pas l'identifiant de la version choisie (`bundle.releaseId`). Couvert par « quand plusieurs versions sont figées, c'est celle qu'on désigne qui part ».
- **`AscTarget` gagne `appId`, `appName`, `versionId` (optionnels)** pour porter la destination lue chez Apple à côté des identifiants saisis à la main ; le manifeste et les tests existants ne changent pas.
- **Langue d'une version figée dans la langue du projet** : `release.locale` est `undefined` dans ce cas, la publication retombe sur `project.listing.language` puis `fr-FR` — la convention du pont.
- **Le catalogue des langues remplace les champs « Code »/« Nom »** partout : la vitrine des tests (`locale`, `campaign-journey`, `dialogs-a11y`) choisit « Allemand · de-DE », et le code d'une variante est désormais le code App Store Connect complet.

## Vérification

| Porte | Commande | Résultat |
| --- | --- | --- |
| Unitaires + contrat + typage + lint | `pnpm test` (racine) | bridge 64, mcp 48, backend 209, web 503 ; typecheck et lint propres |
| Pont sous `node` | `node src/main.ts` puis `GET /hello` | 200, protocole 7, `asc` 0.45.4 détecté, listes `apps/versions/localizations` lues sur le vrai compte (lecture seule, aucun envoi) |
| Boîtes et parcours | `playwright test` : `ai-campaign`, `ai-provider`, `locale`, `release`, `asc-publish` (6, dont le choix du lot et l'envoi réel confirmé), `campaign-journey` (dix étapes, pont → destination lue → preflight → essai à blanc), `dialogs-a11y` (8), `semantics`, `smoke`, `responsive-chrome`, `empty-state`, `android-project`, `mcp-templates`, `command-palette`, `export`, `project-file` | tous verts |
| Build + vitrine | `pnpm run build` puis `audit:landing` | pré-rendu en/fr, contraste et interdits OK |
| Design | `audit:contrast` / `audit:scale` / `audit:ui` | pire cas 5.02:1 ; échelles fermées ; provenance coss intacte |
| Suite e2e complète | `pnpm run test:e2e` (deux tranches, après reprises) | 219 réussis, 1 ignoré, 0 échec — la passe d'avant reprises avait un échec de charge (`mcp-live`, 10/10 seul) |

Aucun envoi réel chez Apple n'a été fait : seules les listes (lecture) et l'essai à blanc simulé ont tourné.

## Revue indépendante et reprises

Verdict de la revue (`review.md`) : changements demandés — un bloquant, dix-sept à corriger, douze mineurs. Repris dans le même lot :

- **Bloquant** : `bas-ancre` laissait l'appareil passer sous l'accroche sur la planche Google Play (540×960) ; l'appareil est maintenant plafonné à `headline.y - 16` quand l'accroche n'est pas posée sur lui, sur toute planche. La suite `archetypes.test.ts` boucle sur les six archétypes pour la séparation (le plancher de 90 % à bord reste borné aux trois archétypes à appareil choisi automatiquement, `bas-ancre` saignant par le haut à dessein), et `templates.test.ts` tient chaque gabarit généré aux mêmes règles (contraste, bande vide, séparation) sur les calques réellement émis.
- Langues : un calque de texte né après une langue est compté « à traduire », traduit, et reçoit sa variante à l'écriture ; « Traduire toutes les langues » traduit chaque langue en parallèle puis écrit tout en une transaction ; la suppression d'une langue se confirme.
- Publication : un 401 à l'envoi rouvre l'étape du jeton sans perdre le lot préparé ; le pont arrêté en cours de route se lit « injoignable » ; le téléchargement du lot est gardé et remonte ses erreurs ; « release » et « gel » ont quitté les derniers textes rendus ; quatre icônes prennent leur taille ; la publication réelle (essai à blanc décoché → confirmation → envoi) est couverte par un test.
- Rédacteur par clé : ~6 000 caractères par appel, un lot plus gros était tronqué puis refusé entier ; vignettes des gabarits : les tracés se mettent à l'échelle sur leur propre boîte, comme sur la planche ; couverture des cibles dérivée des familles de `dimensions.ts` ; FAQ et CLAUDE.md alignés sur l'ordre réel et le nom réel de la boîte.

Laissé en l'état, en connaissance de cause : le `as TranslateRequest & ProofreadRequest` du pont, la relecture de la session du module dans `runTextJob` (c'est le rédacteur), `evidence` non renvoyé par `onHeadline`, « Réécrire » retiré sans note, l'échec silencieux d'une suppression de version, les deux listes de directions, `ConfirmAction` frère de `StepDialog` dans la publication (Échap mesuré : ne ferme que la confirmation).

### Seconde passe

Re-vérification du même relecteur : plus aucun bloquant, deux points jugés rédhibitoires — la reprise après un 401 se défaisait elle-même (« Vérifier le pont » resélectionnait la première application, donc `edit` jetait le lot préparé), et l'essai à blanc réel chez Apple n'avait jamais été lancé. Repris :

- `verifyToken` ne resélectionne une application que si la destination n'en désigne aucune dans la liste relue ; le lot préparé survit au nouveau jeton.
- « Traduire toutes les langues » est désactivé quand aucune langue n'a rien à traduire ; une suppression de langue refusée par la transaction est dite.
- Le rédacteur par clé lit `stop_reason` (Anthropic) et `finish_reason` (OpenRouter) et nomme une réponse coupée, au lieu de l'accuser d'un mauvais compte de textes (`direct-api.test.ts`).
- Tout appel au pont traduit un port fermé en « injoignable », pas seulement l'envoi ; `expectNoRawIcon` couvre aussi l'état filigrané ; CLAUDE.md nomme l'emplacement réel du pictogramme.
- **Essai à blanc réel** (spec temporaire, non commité, contre le pont sous `node src/main.ts` et `asc 0.45.4` avec l'identifiant Pulpe du trousseau) : lecture « Pulpe — app.pulpe.ios », version 1.4.2 · READY_FOR_DISTRIBUTION, localisation fr-FR `902d9331…` ; commande `asc screenshots upload --version-localization … --device-type APP_IPHONE_69 --path ./fr-FR/APP_IPHONE_69 --output json --dry-run` ; `upload · Essai à blanc terminé · 733 ms`, dossier temporaire supprimé, rien d'envoyé. Ce que l'essai a appris : toutes les versions du compte sont distribuées, la boîte en retenait une sans un mot, et Apple aurait refusé le lot à l'envoi. La boîte le dit maintenant sous la version (`asc-publish.spec.ts`, « une version déjà distribuée est nommée comme telle avant l'envoi »).

Laissé en l'état : les quatre raisons de figer restent repliées dans `<details>` de `ReleaseDialog` (la définition, elle, est toujours visible) ; les deux étapes e2e plus faibles que leur intitulé (`campaign-journey.spec.ts` « borné à l'écran courant », `locale.spec.ts` « traduit le… ») ; la relecture de la session du module dans `runTextJob` ; le plafond par script du rédacteur par clé, tant qu'aucune cible non latine n'a échoué.

Troisième passe, sur ces reprises : deux bloquants. La traduction du port fermé dans `call()` rendait morte la branche `instanceof TypeError` de `ascBridgeStatus`, donc l'étape « Pont » de la publication aurait perdu la phrase qui nomme la commande à lancer et l'origine refusée — les trois `catch` lisent maintenant le message que `call()` a déjà écrit. Et l'alerte de version verrouillée ne vivait qu'à l'étape « Destination », contredite à l'envoi par un « Preflight sans réserve » vert : `versionLock(state)` rend une phrase (distribuée : nouvelle version ; soumise : retirer de la revue ou nouvelle version) que les deux étapes lisent, la ligne verte se tait quand elle existe, et `defaultVersion` saute aussi les versions en revue. « Traduire toutes les langues » grisé dit pourquoi (« Toutes les langues sont traduites »).

Gate de cette passe : `pnpm test` racine (web 504, bridge 64, mcp 48, backend 209, typecheck et lint propres), e2e en deux tranches (119 + tranche 2 : `passed`, 1 ignoré), `asc-publish` 7, build et audits.

### Retour utilisateur sur la barre du haut

« L'iconographie du menu n'est pas claire, et confidentialité, réglages généraux… ne devraient pas être dans les premières icônes directement accessibles. » Repris : les réglages (globaux, confidentialité) quittent la rangée pour le menu « … », à toute largeur ; les six actions qui restent — Modèles, Composer la fiche, Captures, Langues, Versions figées, Publier — s'écrivent d'un mot à côté du glyphe au-dessus de `TOP_BAR_ACTION_LABELS_WIDTH` (1280 ; plancher mesuré 1216 en balayant de 4 en 4, rangée écrite 907px contre 487 en icônes), icône seule entre 1024 et 1280, repli en dessous comme avant ; les témoins d'état en toutes lettres dérivent maintenant de ce seuil (1680). La fiche prend la devanture (`Store`) à la place de la galerie « [|] », sur la barre et sur le bouton de la boîte. Mesuré en passant : `w-auto` seul laissait la boîte à 32px sous un mot de 105 (`sm:size-8` coss), et `expectNoClippedControl` ne balayait pas `data-slot="toolbar-button"` — corrigés tous les deux. `responsive-chrome.spec.ts` mesure au seuil des mots, 40px dessous, et relit l'ordre des rangs et du menu.
