---
status: done
---

# Instruction: Imports d’images bornés

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src/lib/
│   ├── image.ts                                  ✏️ lecture, décodage et limites communes
│   ├── device-bezel.ts                           ✏️ plafond ramené à 16 MP
│   ├── layer-factories.ts                        ✏️ import via le helper borné
│   └── __tests__/image.test.ts                   ✅ taille, dimensions et formats
├── src/components/
│   ├── canvas/SelectionToolbar.tsx               ✏️ capture via le helper borné
│   ├── device-picker/DevicePicker.tsx            ✏️ capture via le helper borné
│   └── properties-panel/ImageSection.tsx         ✏️ remplacement via le helper borné
├── e2e/
│   ├── device-bezel-analysis.spec.ts             ✏️ limite 16 MP
│   └── device-bezel-import.spec.ts               ✏️ feedback utilisateur des limites
└── aidd_docs/memory/forms.md                      ✏️ limites d’import documentées
```

## Tasks to do

### `1)` Centraliser l’import de contenu

> Rejeter avant allocation les fichiers disproportionnés.

1. Introduire des erreurs typées et des plafonds de 16 Mio et 16 mégapixels dans `image.ts`.
2. Valider le MIME et les octets avant `FileReader`, puis les dimensions immédiatement après décodage.
3. Garder SVG pour les images de contenu, mais limiter les captures d’appareil à PNG/JPEG.
4. Retourner data URL et dimensions depuis un seul helper afin que tous les appelants suivent le même chemin.

### `2)` Migrer les quatre chemins utilisateur

> Appliquer les mêmes garanties à l’ajout, au remplacement et aux captures.

1. Mettre à jour la fabrique de calque image.
2. Mettre à jour `ImageSection`, `DevicePicker` et `SelectionToolbar`.
3. Afficher un message distinct pour format, octets, pixels et décodage invalide.

### `3)` Réduire le plafond du bezel

> Empêcher le flood-fill synchrone de réserver des centaines de Mio.

1. Ramener `MAX_DEVICE_BEZEL_PIXELS` à 16 millions sans ajouter de Worker.
2. Garder la lecture des dimensions PNG avant décodage et le contrôle des dimensions naturelles.
3. Tester la limite et un bezel synthétique valide proche des dimensions App Store.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Un fichier de plus de 16 Mio est refusé avant lecture et une image de plus de 16 MP avant enregistrement dans le registre d’assets. |
| 2 | Les quatre points d’import affichent une erreur précise et ne modifient ni calque ni asset après un rejet. |
| 3 | Un bezel App Store valide est analysé; un PNG dépassant 16 MP est refusé sans lancer le flood-fill. |
