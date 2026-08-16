---
status: done
---

# Instruction: placement et recadrage persistants, rôles sémantiques

## Architecture projection

```txt
apps/web/src/
├── lib/
│   ├── screenshot-placement.ts              ✅ le cadrage : mode, point focal, zoom
│   ├── slots.ts                             ✅ le rôle d'un écran, normalisé
│   ├── project-validation.ts                ✏️ trois contrôles de plus sur `device-frame`
│   ├── canvas/canvas-utils.ts               ✏️ le bezel importé découpe et cadre comme le cadre généré
│   └── canvas/canvas-sync.ts                ✏️ le drapeau de synchronisation relit sa version dans la trame
├── assets/device-frames/index.ts            ✏️ `screenshotImage()`, un seul site de rendu de la capture
├── components/
│   ├── device-picker/ScreenshotFraming.tsx  ✅ rôle + cadrage
│   ├── device-picker/DevicePicker.tsx       ✏️ l'import mesure, il ne recadre plus
│   └── canvas/SelectionToolbar.tsx          ✏️ même mesure depuis la barre flottante
└── types/index.ts                           ✏️ `ScreenshotPlacement`, `ScreenshotSize`, `slot`
apps/web/
├── src/lib/__tests__/screenshot-placement.test.ts  ✅ 17 cas
└── e2e/screenshot-framing.spec.ts                  ✅ 4 cas
```

## Ce que le dépôt savait déjà faire

Le registre d'assets (`lib/assets.ts`) déduplique déjà par empreinte : remplacer
une capture par la même image ne crée pas de second asset, et rien n'a été
ajouté pour cela. `getResourceKey` existait pour savoir quand reconstruire
l'objet Fabric ; le cadrage s'y ajoute au lieu d'ouvrir une seconde voie
d'invalidation.

## Tasks to do

### `1)` Le cadrage est une donnée, pas un attribut SVG

> `mode` + point focal + zoom, calculés une fois, appliqués partout

1. `placeScreenshot(natural, opening, placement)` rend le rectangle exact de la
   capture dans l'ouverture de l'écran
2. Le défaut — `cover`, centre, zoom 1 — **reproduit exactement**
   `xMidYMid slice`, le rendu de toutes les versions précédentes. Un projet
   ouvert après cette phase s'affiche au pixel près comme avant
3. Tant que la capture n'est pas mesurée, `screenshotFrame` ne devine pas :
   il rend l'ouverture et laisse `preserveAspectRatio` au navigateur
4. `placementSurvivesRatioChange` dit si un rapport a changé — la phase 4 s'en
   servira pour signaler un lot dont une capture est arrivée au mauvais format

### `2)` Le remplacement mesure, il ne recadre pas

1. `DevicePicker` et `SelectionToolbar` n'écrivent plus que `screenshotAssetId`
   et `screenshotSize`. Le contre-exemple est nommé dans le test : chez OSG,
   `DeviceFrameElement.tsx:84-89` réinitialise `screenshotRect` à chaque import
2. Aucun `placement` n'est écrit à l'import : l'absence **est** le défaut, et
   écrire `cover/0.5/0.5/1` gonflerait chaque projet d'un objet qui ne dit rien

### `3)` Un seul site de rendu de la capture

1. `screenshotImage()` est exporté par `device-frames/index.ts` et appelé par
   les deux chemins : cadre généré et bezel importé
2. Le bezel importé gagne le `clipPath` qui lui manquait. Il n'en avait pas
   besoin tant que `slice` garantissait le débordement centré ; un zoom peut
   maintenant pousser la capture hors de l'ouverture
3. `placementKey(layer)` entre dans `getResourceKey` : sans lui, bouger le zoom
   ne repeignait rien, l'appareil n'étant tramé qu'une fois par clé

### `4)` Le rôle de l'écran

1. `normalizeSlot` : décomposition NFD, accents retirés, minuscules, tirets,
   48 caractères. « Réglages Généraux » et « reglages generaux » sont un seul
   rôle
2. Normalisé à la sortie du champ, pas à la frappe : couper les tirets pendant
   qu'on tape empêche d'écrire `mon-budget`
3. Un rôle vide de sens (`   ---   `) ne s'écrit pas du tout

### `5)` Le défaut trouvé en chemin

`syncCanvas` levait son drapeau `syncing` dans une `requestAnimationFrame` sans
relire sa version. Une passe suivante démarrée entre les deux voyait ses
`canvas.remove` remonter au gestionnaire de désélection : retirer l'objet actif
effaçait la sélection, le panneau des propriétés retombait sur l'arrière-plan,
et le réglage en cours disparaissait sous le curseur. Le défaut préexistait —
tout changement de `resourceKey` (couleur d'appareil, modèle, import de capture)
pouvait le déclencher — mais un curseur de zoom en reconstruit une par cran, ce
qui l'a rendu reproductible. La trame relit la version avant de lever le
drapeau.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------- |
| 1    | `cover` + centre + zoom 1 rend le même rectangle que `xMidYMid slice`, pour trois rapports d'image        |
| 1    | `contain` tient dans l'ouverture, `fill` l'épouse, le point focal colle la capture au bord visé           |
| 1    | Une capture de dimension nulle ne produit ni `NaN` ni `Infinity`                                          |
| 2    | Cadrage + rôle posés, capture remplacée par une autre de rapport différent : `placement`, `slot`, modèle et géométrie identiques |
| 3    | L'export du bezel officiel garde capture, cadre et extérieur transparent (non-régression du découpage)    |
| 3    | Le cadrage survit à un rechargement                                                                       |
| 4    | `   ---   ` n'écrit rien ; « Réglages Généraux » donne `reglages-generaux`                                |

## Résultats

```
vitest run src/lib/__tests__/screenshot-placement.test.ts   17 passed
pnpm run test:unit                                          188 passed (26 + 4 fichiers)
pnpm run typecheck                                          Done
pnpm run lint                                               clean
playwright test screenshot-framing --repeat-each=3          12 passed
playwright test (suite complète)                            voir plan.md
```
