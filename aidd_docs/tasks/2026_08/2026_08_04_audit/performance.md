# Codebase Audit: performance
Les chemins Fabric/export sont déjà bornés et différés avec discernement ; un calcul image synchrone et une dépendance ZIP chargée trop tôt restent évitables.

- **Date**: 2026-08-04
- **Scope**: bundle Vite, rendu Fabric, export, vignettes et analyse d’images
- **Health**: good
- **Findings**: 0 critical, 1 warning, 1 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
|---|---|---|---|---|---|
| 🟡 | performance | `src/lib/device-bezel.ts:85` | L’analyse du bezel fait un flood-fill synchrone et autorise jusqu’à 40 millions de pixels. À la limite, l’ImageData et la pile typée représentent des centaines de Mio et la boucle peut figer durablement le thread UI. | Commencer par abaisser la limite à une valeur alignée sur les bezels Apple réels. Si des fichiers réels dépassent encore ce plafond, déplacer seulement `findScreen` dans un Web Worker. | M |
| 🟢 | performance | `src/components/toolbar/TopBar.tsx:32` | Le build initial charge 580,65 kB + 382,47 kB minifiés (299,07 kB gzip). Environ 97 kB de source JSZip arrivent dans le chunk principal parce que les fonctions projet/ZIP sont importées au démarrage, alors qu’elles ne servent qu’après une action utilisateur. | Utiliser `import('jszip')` dans `createProjectFile`, `readProjectFile` et `createExportZip`. Garder Fabric dans le chemin initial : l’éditeur en a besoin immédiatement. | S |

## Top actions

1. Résoudre le finding performance #1 avec `aidd-dev:02-implement` : réduire le plafond du flood-fill bezel, puis utiliser un worker seulement si des assets réels le justifient.
2. Résoudre le finding performance #2 avec `aidd-dev:07-refactor` : charger JSZip à la demande dans les trois opérations ZIP.
3. Ne pas optimiser davantage les vignettes ou le rendu Fabric sans profil de terrain ; ils sont déjà debouncés, idle-schedulés et limités à dix écrans.

## Coverage

- **Scanned**: performance — build Vite avec sourcemaps, composition des chunks, export RGB/PNG, concurrence bornée, sync Fabric, vignettes, resize/zoom et analyse bezel.
- **Skipped**: aucun profiler de production ni télémétrie Web Vitals ; analyse bundle et heuristiques statiques uniquement pour les coûts de longue durée.
