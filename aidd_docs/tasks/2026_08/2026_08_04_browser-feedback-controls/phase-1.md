---
status: done
---

# Instruction: Fiabiliser les contrôles et leurs régressions

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── e2e
│   ├── canvas-editing.spec.ts ✏️ distinguer et vérifier les groupes d’angles accessibles
│   ├── helpers.ts ✏️ aligner le contrat TypeScript du handle debug sur le test
│   └── smoke.spec.ts ✏️ couvrir des étapes d’annulation d’arrière-plan indépendantes
└── src
    ├── components
    │   ├── background-editor/BackgroundEditor.tsx ✏️ qualifier les gestes continus et discrets
    │   ├── gradient-editor/GradientEditor.tsx ✏️ propager une clé propre à chaque propriété de dégradé
    │   ├── properties-panel
    │   │   ├── BackgroundSection.tsx ✏️ construire une clé d’historique granulaire
    │   │   └── ShapeSection.tsx ✏️ préserver la granularité pour les dégradés de forme
    │   ├── text-editor/TextEditor.tsx ✏️ préserver la granularité pour les dégradés de texte
    │   └── ui/angle-control.tsx ✏️ rendre chaque groupe de préréglages identifiable
    └── hooks/use-fonts.ts ✏️ ne mémoriser comme chargées que les graisses réellement disponibles
```

## Tasks to do

### `1)` Rendre l’historique d’arrière-plan granulaire

> Conserver une étape d’annulation par propriété ou geste continu, sans fusionner des actions distinctes.

1. Faire remonter depuis les éditeurs une clé sémantique uniquement pour les changements continus.
2. Préfixer cette clé au niveau du calque ou de l’écran concerné.
3. Laisser les changements discrets sans coalescence et couvrir la séquence par un test.

### `2)` Corriger l’accessibilité et le cache des graisses

> Éliminer les ambiguïtés de navigation et les faux positifs du cache de polices.

1. Dériver le nom accessible des quatre préréglages depuis le contrôle d’angle parent.
2. Refuser ou enregistrer séparément toute réponse multi-graisses partielle.
3. Conserver le chargement exact de Poppins 900 au canvas et à l’export.

### `3)` Réaligner les contrats de test et valider

> Garder les tests représentatifs du contrat réel et passer la validation de release.

1. Étendre le type minimal de `window.__sfStores` utilisé par Playwright.
2. Adapter les sélecteurs et assertions aux libellés accessibles distincts.
3. Exécuter les tests ciblés puis la validation de release complète.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Deux actions d’arrière-plan de natures différentes créent deux étapes d’annulation, tandis qu’un drag continu reste une seule étape. |
| 2 | Rotation et angle de dégradé exposent des groupes de préréglages nommés distinctement lorsqu’ils coexistent. |
| 2 | Une requête multi-graisses partiellement chargée ne permet pas à `isFontLoaded` d’annoncer une graisse absente. |
| 3 | Le contrat TypeScript E2E déclare les propriétés et actions utilisées par le scénario de copier-coller. |
| 3 | La validation de release passe sans régression fonctionnelle, visuelle, de contraste ou d’export. |
