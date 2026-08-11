---
status: done
---

# Instruction: une langue de plus, pas un projet de plus

## Architecture projection

```txt
apps/web/src/
├── types/index.ts                              ✏️ `LocaleVariant`, `LocaleText`, `ScriptId`
├── lib/locale.ts                               ✅ polices par script, substitution, revue, écriture
├── lib/project-validation.ts                   ✏️ bornes des langues, `isLocaleVariant`
├── lib/project-file.ts                         ✏️ `PROJECT_FILE_VERSION` 3 → 4
├── lib/editor-transaction.ts                   ✏️ `coalesceKey` transmis à l'historique
├── lib/canvas/canvas-utils.ts                  ✏️ `transformText` exporté pour la mesure
├── components/locale-dialog/LocaleDialog.tsx   ✅ création, revue ligne à ligne, traduction
├── components/export-dialog/ExportDialog.tsx   ✏️ sélecteur de langue, refus d'une langue fautive
├── lib/commands.ts / stores/ui.store.ts / App.tsx / toolbar/TopBar.tsx  ✏️ un seul point d'entrée
├── lib/__tests__/locale.test.ts                ✅ 18 cas : polices, mesure, bornes, écriture
└── e2e/locale.spec.ts                          ✅ 1 cas : revue d'une locale avec overflow
apps/bridge/src/
├── protocol.ts                                 ✏️ `translateRequestSchema`, schéma de sortie
├── server.ts                                   ✏️ `POST /translate`, traduction par position
└── bridge.test.ts                              ✏️ 2 cas : comptes qui divergent, bornes
```

## Le principe, et pourquoi il tient

**Une langue ne duplique rien.** Une `LocaleVariant` ne porte que des chaînes,
indexées par identifiant de calque. Pas d'écran, pas de calque, pas de
géométrie, pas de crop, pas de slot. La substitution est une projection lue à
l'export et dans la revue — le projet n'a qu'un seul jeu d'écrans, quel que soit
le nombre de langues. Dupliquer les écrans aurait produit dix projets à
maintenir dès la première refonte de composition : déplacer un titre aurait
demandé dix gestes, et neuf auraient été oubliés.

Le corollaire tient tout seul : les identifiants, la structure et les crops de
la phase 2 survivent, et le refresh atomique de la phase 4 continue de valoir
pour toutes les langues d'un coup, parce qu'il n'y a rien à répercuter.

**Rien ne promet une bonne traduction.** Ce que le produit promet, c'est de
signaler ce qui ne tient pas et de laisser corriger. Un texte repris du pont
arrive `reviewed: false` et le reste tant qu'un humain ne l'a pas coché — y
compris s'il est parfait. Le compteur de textes à relire n'empêche pas
d'exporter ; seuls les débordements le font.

**Un débordement bloque une langue, jamais le projet.** L'export refuse la
variante fautive et laisse passer la langue d'origine et les autres. Une
traduction allemande trop longue n'a aucune raison d'empêcher de livrer le
français.

## Tasks to do

### `1)` La mesure est injectable, donc testable

`reviewLocale(project, locale, measure)` prend sa fonction de mesure en
paramètre. Le défaut navigateur utilise un contexte 2d hors écran ; les tests
passent une largeur de glyphe fixe, ce qui rend le verdict déterministe là où
`measureText` dépend des polices réellement installées sur la machine qui
exécute la suite.

Le retour à la ligne est reconstruit plutôt qu'emprunté à Fabric : mesurer un
débordement demande de savoir combien de lignes le texte occupera, et un objet
Fabric n'existe pas pour une langue qui n'est pas affichée. Les mots plus larges
que la boîte sont coupés au caractère — c'est aussi ce qui couvre les écritures
sans espaces, où un « mot » est une phrase entière.

`ponytail:` une police non chargée se mesure comme sa substitution latine, ce
qui sous-estime la hauteur d'un texte japonais. La boîte charge donc la police
de la langue avant de mesurer. L'erreur restante penche vers le silence, jamais
vers la fausse alerte.

### `2)` Trois défauts, pas un « invalide » générique

`empty`, `overflow`, `off-canvas`. Un texte vide n'est pas mesurable et n'est
pas un débordement : c'est une traduction manquante. Un bloc sorti du cadre est
un problème de composition que la traduction a révélé, pas causé. Les trois
bloquent l'export, mais chacun se lit sur sa propre ligne, à côté du calque
nommé — un compteur global aurait demandé de chercher.

### `3)` Une police par script, et le refus de la mauvaise

`SCRIPTS` associe à chaque écriture les familles qui la couvrent. Imposer
« Space Grotesk » à une langue japonaise ne produit pas une erreur : ça produit
des carrés vides à l'export, c'est-à-dire un défaut invisible en revue et
définitif dans la livraison. `setLocaleFont` refuse donc l'incompatible, et
`localeFont` ignore une police devenue incompatible plutôt que de l'appliquer —
le calque garde la sienne.

Le catalogue latin réutilise `POPULAR_FONTS` : la liste existait déjà.

### `4)` Le pont traduit par position, ou rien

`POST /translate` renvoie un tableau de la même longueur que celui reçu, ou une
erreur. La page rattache par index ; un texte de moins décalerait chaque
accroche d'un écran, et le résultat aurait l'air correct jusqu'à l'export. La
route est derrière les mêmes deux barrières que les autres — origine puis jeton
— et le jeton de session est partagé avec la boîte de campagne plutôt que
redemandé.

`applyTranslations` ignore les calques que le projet ne connaît pas et n'écrit
rien si aucun ne correspond : une transaction annulée vaut mieux qu'un projet
avancé d'un pas invisible.

### `5)` Une rafale de frappes est un seul pas d'annulation

`setLocaleText` passe `locale:{code}:{layerId}` à `runEditorTransaction`, qui
transmet enfin sa clé de coalescence à l'historique — le paramètre existait dans
le store depuis la v2 mais la transaction ne le relayait pas. Sans lui, corriger
un mot demandait autant de `⌘Z` que de caractères tapés.

### `6)` L'export nomme la langue qu'il produit

Le ZIP d'une variante s'appelle `{projet}-{code}`, et le bouton se désactive
avec la raison affichée à côté, pas dans une infobulle. Une langue exportable
mais partiellement relue s'exporte quand même, avec son compte affiché : la
revue est une aide, pas une procédure.

## Test acceptance criteria

| Task | Acceptance criteria                                                                     |
| ---- | ---------------------------------------------------------------------------------------- |
| 1    | Créer une langue n'ajoute aucun écran ni calque au projet                                 |
| 1    | La substitution conserve les identifiants, la géométrie et l'ordre des calques            |
| 1    | Un calque que la langue ne nomme pas reste identique à l'original                         |
| 1    | Le compte de lignes est correct pour un retour forcé, un mot trop long, un saut explicite |
| 1    | La mesure porte sur la casse rendue, pas sur celle saisie                                 |
| 2    | Un texte traduit qui ne tient plus est signalé, nommé, et bloque l'export de sa langue    |
| 2    | Un texte vide est signalé comme manquant, pas comme débordement                           |
| 2    | Un bloc sorti du cadre de l'écran est signalé                                             |
| 2    | Une traduction qui tient ne produit aucun signalement                                     |
| 3    | Un script ne propose que des polices qui le couvrent                                      |
| 3    | Une police hors script est refusée à l'écriture et ignorée à la lecture                   |
| 4    | Un lot dont le compte a changé est refusé en entier                                       |
| 4    | Les textes repris arrivent non relus, et les calques inconnus sont ignorés                |
| 4    | `/translate` refuse sans jeton, sur lot vide, et hors version de protocole                |
| 5    | Quatre frappes consécutives produisent un seul pas d'annulation                           |
| 6    | L'export de la langue d'origine reste possible pendant qu'une variante déborde            |
| 6    | La correction du débordement lève le refus sans rechargement                              |

## Ce qui n'est pas fait ici, et ce qui n'est pas prouvé

**Aucune traduction n'est vérifiée pour sa qualité.** Le produit ne sait pas si
« Rhythmus » traduit bien « Le rythme ». Il sait qu'il y a un texte, qu'il tient
dans sa boîte, et que personne ne l'a encore relu. Le contrat interdit
explicitement de promettre plus, et c'est aussi la limite honnête de ce qu'un
outil de composition peut affirmer.

**Le sens de lecture n'est pas inversé.** L'arabe et l'hébreu sont dans le
catalogue de scripts avec leurs polices, mais la composition reste
gauche-à-droite : Fabric rend le texte dans l'ordre logique, et un vrai support
RTL demande d'inverser aussi l'alignement, les ancrages et la composition des
écrans. Proposer un demi-RTL aurait été pire que de ne rien proposer — les
langues concernées restent utilisables pour un texte court centré, et le
signalement de débordement fonctionne pour elles comme pour les autres.

**Aucun catalogue de langues.** Le code et le nom sont saisis. Une liste
déroulante de 180 locales aurait demandé un catalogue à maintenir pour remplacer
deux champs.

**La mesure ne connaît pas les ligatures ni le crénage contextuel.**
`measureText` sur une famille chargée est une bonne approximation, pas le moteur
de rendu de Fabric. Un texte à un ou deux pixels de la limite peut passer d'un
côté ou de l'autre ; les débordements réels, eux, se comptent en dizaines de
pixels.

L'a11y clavier et la densité responsive de cette boîte rejoignent le groupe de
la phase 10, avec celles des phases 4 à 7.

## Résultats

```
vitest run src/lib/__tests__/locale.test.ts       18 passed
vitest run apps/bridge/src                        19 passed
playwright test e2e/locale.spec.ts                 1 passed
pnpm run test:unit                                290 passed (222 web + 49 api + 19 bridge)
pnpm run typecheck                                Done (web, api, bridge)
pnpm run lint                                     clean
pnpm run build                                    built in 1.22s
pnpm run test:e2e                                 108 passed, 1 skipped + 2 prelaunch
pnpm run audit:scale                              Échelles fermées
pnpm run audit:contrast                           dark 4.78:1, light 4.55:1
```
