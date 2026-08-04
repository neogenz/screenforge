---
status: done
---

# Instruction: Contrats Fabric, alignement et export

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── src/
    ├── components/canvas/
    │   ├── canvas-utils.ts                    ✏️ retrait du monkey-patch au chargement du module
    │   ├── controls-patch.ts                  ✅ installation idempotente et fallback
    │   └── __tests__/
    │       └── controls-patch.test.ts         ✅ présence, absence et double installation
    ├── hooks/
    │   └── use-canvas.ts                      ✏️ installation explicite du patch
    └── lib/
        └── __tests__/
            ├── align.test.ts                  ✅ géométrie pure existante
            └── export.test.ts                 ✅ inspection et validation PNG
```

## Tasks to do

### `1)` Isoler le patch privé Fabric

> Une API privée absente doit désactiver l’amélioration visuelle, jamais casser l’éditeur.

1. Déplacer le remplacement de `_renderControls` dans `controls-patch.ts`.
2. Installer le patch explicitement une seule fois et conserver la fonction Fabric originale.
3. Vérifier uniquement l’existence de la fonction privée ; si elle manque, avertir et garder le rendu Fabric par défaut.
4. Documenter la version Fabric validée ; laisser l’E2E détecter un changement de sémantique impossible à introspecter.

### `2)` Tester l’alignement existant

> Verrouiller la géométrie sans introduire une nouvelle abstraction.

1. Tester `boundsOf`, les six alignements et les deux distributions.
2. Couvrir sélection unique, sélection multiple, dimensions différentes et coordonnées du layout continu.

### `3)` Tester le contrat PNG

> Séparer clairement parsing du format et validation App Store.

1. Tester `inspectPng` avec signature ou IHDR invalides et avec un header valide minimal.
2. Tester `assertAppStorePng` sur dimensions, profondeur, type RGB opaque et limite de poids.
3. Conserver la spec E2E d’export comme preuve du PNG réel 1320×2868.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Installer deux fois ne double pas le patch ; une API privée absente produit un warning et aucun crash. |
| 2 | Les placements attendus sont exacts pour chaque alignement et distribution, y compris dans le repère layout. |
| 3 | Le parser rejette un non-PNG ; le validateur refuse dimension, alpha, profondeur ou taille invalides avec un message précis. |
| 1–3 | La spec E2E export produit toujours un PNG-24 RGB opaque de 1320×2868. |
