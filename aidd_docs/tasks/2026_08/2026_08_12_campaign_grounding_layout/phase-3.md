---
status: pending
---

# Instruction: Fermer les régressions éditeur et le parcours réel

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
apps/web/
└── e2e/
    └── ✏️ ai-campaign.spec.ts # ferme le parcours campagne complet si nécessaire
```

## User Journey

```mermaid
flowchart TD
  A[Sélectionner plusieurs textes] --> B[Changer la police une fois]
  B --> C[Voir tous les textes mis à jour]
  C --> D[Exporter dans la langue du projet]
  D --> E[Obtenir les PNG sans fausse erreur de police]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Créer deux écrans avec un texte chacun => multisélection prête: 5: browser
  section Happy path
    Choisir Poppins dans la barre => les deux calques changent et un undo les restaure: 5: browser
    Ouvrir l’export => la langue courante est visible et sélectionnable: 5: browser
  section Edge case - graisse absente
    Charger Space Grotesk avec une graisse absente => face normale chargée sans alerte d’export: 1: system
```

## Tasks to do

### `1)` Rejouer les correctifs éditeur engagés

> Conserver une mutation atomique pour la multisélection et des contrôles lisibles.

1. Rejouer la mise à jour multi-écrans et son unique pas d’annulation.
2. Rejouer la valeur vide du Select Radix utilisée par la langue du projet.
3. Rejouer le repli de graisse Google Fonts sans masquer une vraie police absente.

### `2)` Exécuter le parcours final

> Prouver les correctifs ensemble dans le navigateur réel.

1. Lancer unités, types, lint et build.
2. Lancer en dernier les parcours Playwright concernés puis la suite requise.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Une édition commune touche tous les textes sélectionnés et s’annule en un geste ; la langue courante reste visible ; Space Grotesk ne produit plus de faux blocage. |
| 2 | Le parcours campagne → revue → insertion → export passe dans Chromium sans régression d’accessibilité ni de dimensions. |
