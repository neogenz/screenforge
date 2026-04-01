# Bug: Fabric.js v7 — Screen Preview Thumbnails

## TL;DR

Feature "screen preview thumbnails" dans la screens-bar : chaque thumbnail doit être une miniature fidèle de son screen dans la zone de travail. Implémentation bloquée pendant 3 jours (13+ approches) à cause de deux problèmes combinés :

1. **Fabric.js v7 a changé `originX`/`originY` par défaut de `'left'/'top'` à `'center'/'center'`** — toutes les coordonnées étaient décalées de la moitié de la taille des objets
2. **`lowerCanvasEl` ne capture que ce qui est visible dans le viewport** — les thumbnails se coupaient quand l'utilisateur zoomait ou pannait

## Root Cause #1 : Center Origin (Fabric v7)

```js
// Fabric v6 (ancien comportement)
new Rect({ left: 480, width: 440 })
// → bord gauche à x=480, rect de x=480 à x=920

// Fabric v7 (nouveau comportement par défaut)
new Rect({ left: 480, width: 440 })
// → CENTRE à x=480, rect de x=260 à x=700
```

**Symptôme :** chaque thumbnail montrait le contenu de 2 screens au lieu d'un seul (décalage de ~220px = SCREEN_WIDTH/2).

**Fix :** utiliser `bgObj.aCoords.tl` / `bgObj.aCoords.br` (coins absolus, indépendants de l'origin) au lieu de `getScreenOffset(i)` pour les positions de crop.

```ts
// AVANT (faux)
const srcX = (getScreenOffset(i) * zoom + panX) * dpr

// APRÈS (correct)
const tl = bgObj.aCoords.tl
const srcX = (tl.x * zoom + panX) * dpr
```

## Root Cause #2 : Viewport-Dependent Capture

**Symptôme :** quand l'utilisateur zoome ou panne, les thumbnails se coupent — les parties hors viewport sont manquantes.

**Fix :** avant chaque capture, temporairement fit-all le viewport pour que TOUS les screens soient entièrement visibles, crop, puis restaurer le viewport original. Tout est synchrone → le navigateur ne repaint jamais l'état temporaire → zéro flicker.

```ts
// 1. Sauvegarder le viewport
const savedVpt = [...canvas.viewportTransform]

// 2. Calculer un viewport qui montre TOUT (via aCoords des bg rects)
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
for (const bg of bgRects) {
  const tl = bg.aCoords.tl, br = bg.aCoords.br
  minX = Math.min(minX, tl.x); minY = Math.min(minY, tl.y)
  maxX = Math.max(maxX, br.x); maxY = Math.max(maxY, br.y)
}
const fitZoom = Math.min((cw - pad*2) / contentW, (ch - pad*2) / contentH, 1)
canvas.viewportTransform = [fitZoom, 0, 0, fitZoom, fitPanX, fitPanY]

// 3. Render synchrone
canvas.calcViewportBoundaries()
canvas.renderAll()

// 4. Crop chaque screen depuis lowerCanvasEl avec aCoords
for (const screen of screens) {
  const tl = bgObj.aCoords.tl, br = bgObj.aCoords.br
  ctx.drawImage(sourceEl, srcX, srcY, srcW, srcH, 0, 0, thumbW, thumbH)
}

// 5. Restaurer immédiatement
canvas.viewportTransform = savedVpt
canvas.calcViewportBoundaries()
canvas.renderAll()
```

**Point critique :** le fitAll temporaire utilise les `aCoords` des bg rects (pas `getScreenOffset`) pour calculer le bounding box du contenu. C'est essentiel car avec center origin, les positions réelles des screens ne sont PAS à 0/480/960 mais à -220/260/740.

## Solution Finale

**Fichier :** `src/hooks/use-canvas.ts` — fonction `generateThumbnails`

**Flux :**
1. Debounce 600ms après chaque sync ou changement de viewport
2. Save viewport → fitAll temporaire (calcul via aCoords) → `renderAll()` synchrone
3. Pour chaque screen : trouver son bg rect → lire `aCoords.tl`/`br` → convertir en canvas pixels → `drawImage` crop
4. Restore viewport → `renderAll()`
5. Update le store Zustand avec les nouveaux thumbnails (immutable update)

**Triggers :** `sync()` (changement de screens), `mouse:wheel` (zoom/pan), `ResizeObserver` (resize fenêtre), UIStore zoom changes

## Les 11 Approches Testées

| # | Approche | Résultat | Cause d'échec |
|---|----------|----------|---------------|
| 1 | Viewport pan + capture | FAIL | Flickering visible |
| 2 | toDataURL + viewport wrapper | FAIL | Double manipulation viewport → état incohérent |
| 3 | toDataURL region params | FAIL | `left` param interagit mal avec le zoom viewport |
| 4 | StaticCanvas full-strip | FAIL | Over-engineered, rendu différent du Canvas interactif |
| 5 | StaticCanvas per-screen + layerToFabricObject | FAIL | center origin → positions décalées à la reconstruction |
| 6 | toDataURL + requestRenderAll | FAIL | Zoom viewport appliqué au crop → bleed entre screens |
| 7 | toDataURL + identity viewport | FAIL | `left/top` params dans toCanvasElement ne marchent pas comme attendu |
| 8 | toCanvasElement full-strip + drawImage | FAIL | toCanvasElement rend différemment (clip path cache, retina scaling) |
| 9 | lowerCanvasEl + manual math | FAIL | Math manuelle `offset * zoom * dpr` fausse à cause de center origin |
| 10 | lowerCanvasEl + aCoords | PARTIEL | Coordonnées correctes mais thumbnails coupées quand viewport ne montre pas tout |
| 11 | **lowerCanvasEl + aCoords + fitAll temporaire** | **OK** | FitAll synchrone garantit que tout est visible, aCoords donne les bonnes positions |

## Pourquoi c'était si dur à diagnostiquer

1. **La math semblait correcte** — `getScreenOffset(i) * zoom + panX` est logique, mais retourne la position du centre, pas du bord
2. **Aucune erreur TypeScript/runtime** — compile et tourne sans erreur, juste avec les mauvaises coordonnées
3. **Le symptôme ressemblait à un bug de viewport/DPR** — on cherchait dans la mauvaise direction
4. **Fabric v7 ne documente pas clairement le changement de défaut origin** — le breaking change n'est pas évident
5. **`toCanvasElement` rend DIFFÉREMMENT du Canvas interactif** — clip path caching, retina scaling, état interne différent → chaque approche secondaire (StaticCanvas, clone, toCanvasElement) produisait un rendu visuel différent
6. **Multiples problèmes combinés** — center origin ET viewport-dependent capture → fixer l'un ne suffisait pas, il fallait les deux

## Diagnostic clé (via Chrome DevTools MCP)

Le diagnostic a été débloqué en inspectant les objets Fabric directement dans le navigateur :

```js
// Révélation : TOUS les objets ont originX:'center'
bgRect.originX  // → 'center' (pas 'left' !)
bgRect.left      // → 0 (c'est le CENTRE, pas le bord gauche)
bgRect.aCoords.tl // → {x: -220, y: -478} (le VRAI coin supérieur-gauche)
```

Et en échantillonnant les pixels du canvas pour vérifier les limites réelles des screens :
```js
ctx.getImageData(x, y, 1, 1).data // → vérifie la couleur à une position précise
```

## Impact sur le reste du codebase

Le bug center origin affecte potentiellement :

- **`fabricObjectToLayerUpdate`** — sauve `obj.left` comme `layer.x`, mais c'est la position du centre
- **`sync()`** — fait `obj.set({ left: layer.x + off })` en assumant left origin
- **`makeScreensClipPath()`** — crée des Rect de clip avec `left: getScreenOffset(i)` = centre
- **`fitAll()`** — centre sur (0,0)→(tw, SCREEN_HEIGHT) au lieu du vrai bounding box
- **Tout calcul de position dans `canvas-utils.ts`**

**Recommandation :** soit auditer tout le code, soit appliquer le fix global :
```ts
fabric.FabricObject.ownDefaults.originX = 'left'
fabric.FabricObject.ownDefaults.originY = 'top'
```
