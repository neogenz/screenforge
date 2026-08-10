---
status: done
---

# Instruction: formes et icônes éditables, un seul registre

## Architecture projection

```txt
apps/web/src/
├── lib/
│   ├── vector-catalog.ts                  ✅ 14 formes, 36 icônes, une seule table
│   ├── layer-factories.ts                 ✏️ `createIconLayer`, forme paramétrable
│   ├── project-validation.ts              ✏️ identifiants validés par le catalogue
│   ├── project-file.ts                    ✏️ version 2 (plancher 1 inchangé)
│   ├── asset-refs.ts                      ✏️ le calque `icon` ne porte aucun asset
│   ├── commands.ts                        ✏️ « Ajouter une icône » dans ⌘K
│   └── canvas/canvas-utils.ts             ✏️ `Path` pour les tracés, trait pour les icônes
├── components/
│   ├── vector-picker/VectorPicker.tsx     ✅ grille groupée et filtrable, deux usages
│   ├── properties-panel/IconSection.tsx   ✅ icône, couleur, trait, ombre
│   ├── properties-panel/ShapeSection.tsx  ✏️ le sélecteur remplace le `Segmented`
│   ├── properties-panel/PropertiesPanel.tsx ✏️ section Icône
│   ├── template-picker/TemplatePreview.tsx  ✏️ aperçu SVG des tracés et des icônes
│   ├── canvas/SelectionToolbar.tsx        ✏️ couleur d'icône dans la barre flottante
│   ├── layers-panel/LayerItem.tsx         ✏️ glyphe de type
│   └── toolbar/TopBar.tsx                 ✏️ cinquième outil de création
└── types/index.ts                         ✏️ `IconLayer`, `ShapeId`
apps/web/
├── src/lib/__tests__/vector-catalog.test.ts  ✅ 6 cas de forme du catalogue
├── e2e/vector-catalog.spec.ts                ✅ 4 cas, dont `getBBox` et le PNG exporté
└── e2e/project-file.spec.ts                  ✏️ une archive v1 s'ouvre encore
THIRD-PARTY-NOTICES.md                        ✅ ISC Lucide + MIT Feather
```

## Ce que le dépôt savait déjà faire

`lucide-react` était déjà installé pour l'interface : aucune dépendance ajoutée.
`getResourceKey` savait déjà quand reconstruire un objet Fabric — `shape:{id}`
couvrait le nouveau cas sans être touché, et `icon:{id}` s'y ajoute d'une ligne.
Le `ShadowEditor`, le `ColorPicker` et le `Slider` sont réutilisés tels quels
par la section Icône.

## Tasks to do

### `1)` Un registre, pas deux tables

1. `vector-catalog.ts` porte les 14 formes et les 36 icônes, chacune avec son
   identifiant stable, son libellé, son groupe et son tracé
2. Le même module alimente le sélecteur, les propriétés, la barre flottante,
   les aperçus de modèles, la validation et le rendu Fabric. La vignette du
   sélecteur **est** le tracé rendu sur la planche : aucune image d'aperçu ne
   peut se désynchroniser
3. `isShapeId` / `isIconId` ferment la liste. Un projet ne persiste jamais de
   SVG : c'est ce qui rend sûr le jour où un modèle de langage pose des calques
   (phase 6), puisqu'il choisit dans une liste close au lieu d'écrire du
   balisage que personne n'a relu

### `2)` Le tracé est figé, l'objet est mis à l'échelle

1. Les formes sont tracées dans une boîte de 100 qu'elles remplissent, les
   icônes gardent la boîte de 24 de leur source
2. Redimensionner met à l'échelle et ne retrace rien — sans quoi chaque pixel
   de poignée changerait la clé de ressource et reconstruirait l'objet
3. Une forme garde `strokeUniform` (l'épaisseur est en pixels, comme pour le
   rectangle), une icône ne l'a pas : son trait grandit avec elle, comme le
   ferait le SVG dont il sort. Figé, une icône de 200 px se rendrait au fil de
   fer

### `3)` Les icônes viennent de Lucide, recopiées et attribuées

1. Sous-ensemble de 36 icônes, sous-tracés concaténés en un `d` unique, un
   `M0 0` rétabli devant chaque sous-tracé relatif
2. Recopiées plutôt qu'importées : le modèle sérialisé ne doit dépendre d'aucun
   composant React, et Fabric a besoin du tracé
3. `THIRD-PARTY-NOTICES.md` porte la notice ISC de Lucide et la notice MIT de
   Feather, en nommant les huit icônes du sous-ensemble qui en dérivent

### `4)` La boîte d'une icône suit son tracé

`createIconLayer` mesure le rapport avec le moteur qui rendra l'icône — un
`Path` Fabric construit puis jeté — au lieu de recopier une dimension dans le
catalogue. Une coche est deux fois plus large que haute : insérée dans un carré
elle serait déformée avant même le premier geste.

### `5)` Le format de projet monte à 2

`PROJECT_FILE_VERSION` passe à 2 dans le commit qui ajoute le discriminant
`icon`, comme la phase 1 l'avait annoncé. Le plancher reste 1 : une archive
écrite avant ce commit s'ouvre toujours, `migrateProject` n'ayant rien à y
reprendre.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------ |
| 1    | Aucun identifiant en double ; un identifiant inconnu (`hexagone`, `__proto__`) est refusé               |
| 1    | Les groupes sortent dans l'ordre du catalogue, les primitives Fabric restent sans tracé                 |
| 2    | Mesuré par `getBBox` : chaque tracé tient dans sa boîte et l'occupe — un sous-tracé disloqué se voit    |
| 2    | Changer de forme rend un `path` dont la clé de ressource est `shape:star`                               |
| 2    | Dans le PNG exporté : le centre du losange est encré, son coin est le fond, l'icône porte du trait      |
| 3    | Le sélecteur filtre sur un mot et ne rend qu'une entrée                                                 |
| 4    | Une icône s'ajoute, se change (le nom suit), s'annule et survit au rechargement                         |
| 5    | Une archive déclarée en version 1 s'ouvre ; 3, 0 et 1.5 sont refusées                                   |

## Résultats

```
vitest run src/lib/__tests__/vector-catalog.test.ts   6 passed
pnpm run test:unit                                    194 passed (27 + 4 fichiers)
pnpm run typecheck                                    Done
pnpm run lint                                         clean
playwright test vector-catalog                        4 passed
playwright test (suite complète)                      98 passed, 1 skipped
```
