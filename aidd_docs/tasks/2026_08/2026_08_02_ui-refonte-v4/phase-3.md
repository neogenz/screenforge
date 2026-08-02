---
status: pending
---

# Instruction: Rendu canvas & mockups appareil

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src/assets/device-frames/index.ts   ✏️ viewBox élargi, bezel noir, tranche métal, verre, ordre des couleurs
├── src/hooks/use-canvas.ts             ✏️ poignées de sélection, anneau d'artboard neutre, police du libellé
├── src/components/canvas/canvas-utils.ts ✏️ défauts de contrôle appliqués à tout objet rendu
├── src/lib/content-defaults.ts         ✏️ contenu de départ crédible à la place des défauts Tailwind
└── src/hooks/use-fonts.ts              ✏️ ordre du catalogue : la police par défaut d'un texte neuf
```

## Wireframe

```txt
     (1) Écran 1
   ┌─────────────────────┐
   │                     │
   │   (3) Titre         │
   │                     │
   │    ┌───────────┐    │
   │    │ (4)  ▬    │    │
   │    │           │    │
   │    │           │    │
   │    │           │    │
   │    └───────────┘    │
   │                     │
   └─────────────────────┘
    (2) ombre portée
```

1. Libellé d'écran : au-dessus de l'artboard, aligné à gauche, dans la police de l'UI.
2. Ombre portée sous l'artboard : ce qui pose l'artboard sur le stage plutôt que de le coller.
3. Contenu utilisateur : la seule source de couleur de l'écran.
4. Mockup : tranche métal, bezel noir, écran en creux, îlot dynamique avec objectif.

## User Journey

```mermaid
flowchart TD
  A[L'utilisateur ajoute un cadre iPhone] --> B[Le mockup apparaît en noir, pas en orange]
  B --> C[La tranche a un dégradé et des boutons latéraux visibles]
  C --> D[Il sélectionne un calque]
  D --> E[Les poignées reprennent la couleur de sélection du thème]
  E --> F[L'artboard actif se signale par un contraste de valeur, pas par du rouge]
```

## Tasks to do

### `1)` Réparer le mockup d'appareil

> C'est le livrable du produit. Aujourd'hui c'est une dalle plate à laquelle il manque des pièces.

1. Élargir le `viewBox` à `-3 0 ${width + 6} ${height}` : les boutons latéraux sont dessinés
   à `x = -2` et `x = width - 1`, donc actuellement rognés et invisibles. Ajuster `width` et
   `height` de la balise `<svg>` en conséquence.
2. Le bezel cesse d'être `color.bezel` et passe à un noir fixe : sur un vrai appareil la
   bordure entre la tranche et la dalle est noire, quelle que soit la couleur du châssis.
   `color.bezel` ne sert plus qu'aux boutons latéraux et au liseré extérieur.
3. Ajouter un `linearGradient` horizontal sur la tranche : `color.bezel` aux deux bords,
   `color.frame` au centre, avec deux arrêts clairs proches des bords pour la réflexion
   spéculaire du métal. C'est ce qui sépare un mockup crédible d'un rectangle coloré.
4. Ajouter un liseré interne sombre d'un pixel autour de la dalle et un très léger dégradé
   de verre en haut de l'écran, sous 6% d'opacité.
5. Ajouter l'objectif dans l'îlot dynamique : un cercle sombre décalé à droite dans la pilule.
6. Vérifier que le rendu tient à l'échelle d'export : le SVG est écrit à environ 180 unités
   de large puis mis à l'échelle par Fabric. Aucun trait ne doit disparaître ni s'épaissir.

### `2)` Corriger les couleurs par défaut de l'appareil

> Tout nouveau projet démarre aujourd'hui en orange rouille.

1. Réordonner `PRO_17_COLORS` pour placer une couleur neutre en première position.
   `colors[0]` est la couleur retenue par défaut, `cosmic-orange` l'occupe.
2. Appliquer la même règle aux autres jeux de couleurs : le neutre d'abord, les couleurs
   vives ensuite. Les projets existants stockent le nom de la couleur, pas son index :
   le réordonnancement ne les casse pas.

### `3)` Habiller la sélection Fabric

> Les poignées sont restées aux défauts de la bibliothèque : carrés bleus de 13px.

1. Dans `readChromeColors`, remplacer `activeRing` : il lit `--color-export` avec `#d71921`
   en repli. Il lit désormais `--color-artboard-ring-active`. Ajouter la lecture de
   `--color-selection`.
2. Appliquer à tout objet rendu, au moment de sa création dans `canvas-utils.ts` :
   `borderColor` et `cornerColor` à `--color-selection`, `cornerStrokeColor` à `--color-stage`,
   `cornerSize: 8`, `cornerStyle: 'circle'`, `transparentCorners: false`, `borderScaleFactor: 1.5`.
3. Régler la sélection au lasso sur la même couleur : `canvas.selectionColor` en translucide
   et `canvas.selectionBorderColor` en opaque, tous deux dérivés de `--color-selection`.
4. Ces valeurs sont relues au changement de thème, comme le sont déjà les couleurs de chrome.
5. Aucun de ces réglages ne peut atteindre l'export : `lib/export.ts` construit un
   `StaticCanvas` distinct à partir des données de calque, sans contrôles ni anneaux.

### `4)` Corriger la police du libellé d'écran

> Le libellé dessiné sur le canvas est en Archivo, une famille qui n'est plus chargée.

1. `use-canvas.ts` fixe `fontFamily: '"Archivo", system-ui, sans-serif'` sur le `Textbox` du
   libellé. Archivo a disparu de `index.html` en v3 : le libellé tombe donc sur `system-ui`
   et ne correspond à aucune autre lettre de l'écran.
2. Le remplacer par la famille UI et vérifier que la police est chargée avant le rendu du
   libellé, sinon Fabric mesure avec un repli et le libellé se décale.
3. Le libellé passe en `--color-foreground-muted` : `--color-faint` est trop faible sur le stage.

### `5)` Remplacer le contenu de départ

> Le premier écran que voit l'utilisateur est un indigo Tailwind sur une police quelconque.

1. `DEFAULT_SOLID_COLOR` et le couple de dégradé valent `#6366f1` / `#8b5cf6` : ce sont les
   valeurs par défaut de Tailwind, elles signent le gabarit. Les remplacer par un point de
   départ neutre et crédible pour une capture App Store.
2. `POPULAR_FONTS` commence par `Archivo`, qui devient donc la police de tout texte neuf.
   Placer en tête une famille au dessin plus affirmé pour un titre marketing.
3. Vérifier le contraste du texte de démonstration sur le fond de démonstration : le contenu
   par défaut doit être exportable tel quel sans retouche.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Les boutons latéraux sont visibles sur le mockup rendu ; le bezel est noir sur les huit couleurs de châssis ; la tranche montre un dégradé, pas un aplat |
| 2    | Ajouter un cadre iPhone sur un projet neuf produit un appareil neutre ; ouvrir un projet enregistré en orange le rouvre en orange                        |
| 3    | Les poignées de sélection reprennent la couleur du thème et changent avec lui ; un export lancé sur une sélection active ne contient ni poignée ni anneau |
| 4    | Le libellé d'écran est dessiné dans la même famille que l'interface, sans décalage horizontal au chargement                                              |
| 5    | Un projet neuf ne contient plus `#6366f1` ; le premier texte ajouté n'est plus en Archivo                                                                |
