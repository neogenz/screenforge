---
objective: "ScreenForge compose, conserve, vérifie et publie des lots portrait iPhone, iPad 13 pouces et Apple Watch aux formats App Store officiels."
status: in-progress
---

# Plan: Support officiel iPad et Apple Watch

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Étendre le profil de projet, la planche, les cadres, les modèles et le cycle de livraison aux cibles iPad et Apple Watch |
| **Source** | [`spec.md`](./spec.md) |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1 | Contrat de profils et compatibilité des projets | [`phase-1.md`](./phase-1.md) |
| 2 | Planche dynamique et cycle d’export officiel | [`phase-2.md`](./phase-2.md) |
| 3 | Création de projet, cadres et modèles par plateforme | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| [Apple — Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) | Dimensions iPad et six classes Apple Watch, formats opaques et limite de dix captures |
| [Apple — Upload screenshots](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/) | La cible iPad 13 pouces permet la dérivation des classes plus petites |
| [Apple Design Resources](https://developer.apple.com/design/resources/) | Hub actuel des UI kits et Product Bezels iPad/Watch |
| [Apple Design Resources License](https://developer.apple.com/support/downloads/terms/apple-design-resources/Apple-Design-Resources-License-20230621-English.pdf) | Interdiction de redistribuer ou d’intégrer les ressources Apple |
| `asc screenshots sizes --all` | Types App Store Connect et dimensions actuellement acceptés par le client de publication local |

## Decisions

| Decision | Why |
| -------- | --- |
| Un projet porte un profil App Store immuable | Le panorama, les coordonnées et les calques partagés ont un seul repère ; mélanger les ratios dans un projet rendrait chaque opération ambiguë |
| La largeur logique reste 440 et la hauteur dérive exactement du ratio du profil | Les coordonnées iPhone existantes restent intactes et chaque nouvelle planche partage le ratio exact de son export |
| iPad exporte seulement le portrait 13 pouces `2064×2752` | Apple le requiert et dérive les classes plus petites ; ajouter les formats optionnels dupliquerait le même lot sans bénéfice |
| Watch expose les six classes acceptées | Apple ne documente pas de dérivation équivalente à iPad et chaque couple est un jeu App Store valide |
| Les cadres intégrés sont originaux et les Product Bezels restent des imports locaux | Le parcours local existe déjà et respecte la licence ; embarquer les fichiers Apple serait interdit |
