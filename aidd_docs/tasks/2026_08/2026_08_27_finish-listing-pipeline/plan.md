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
| Unitaires + contrat + typage + lint | `pnpm test` (racine) | bridge 64, mcp 48, backend 209, web 496+ ; typecheck et lint propres |
| Pont sous `node` | `node src/main.ts` puis `GET /hello` | 200, protocole 7, `asc` 0.45.4 détecté, listes `apps/versions/localizations` lues sur le vrai compte (lecture seule, aucun envoi) |
| Boîtes et parcours | `playwright test` : `ai-campaign`, `ai-provider`, `locale`, `release`, `asc-publish` (5, dont le choix du lot), `campaign-journey` (dix étapes, pont → destination lue → preflight → essai à blanc), `dialogs-a11y` (8), `semantics`, `smoke`, `responsive-chrome`, `empty-state`, `android-project`, `mcp-templates`, `command-palette`, `export`, `project-file` | tous verts |
| Build + vitrine | `pnpm run build` puis `audit:landing` | pré-rendu en/fr, contraste et interdits OK |
| Design | `audit:contrast` / `audit:scale` / `audit:ui` | pire cas 5.02:1 ; échelles fermées ; provenance coss intacte |
| Suite e2e complète | `pnpm run test:e2e` | 217 réussis, 1 ignoré, 1 échec de charge (`mcp-live` : focus du code d'appairage), relancé seul : 10/10 |

Aucun envoi réel chez Apple n'a été fait : seules les listes (lecture) et l'essai à blanc simulé ont tourné.
