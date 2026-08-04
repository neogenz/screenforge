---
objective: "ScreenForge permet de composer, sauvegarder et exporter jusqu’à dix captures iPhone conformes à App Store Connect, sans compte ni backend."
status: implemented
---

# Plan: Reprise fonctionnelle de ScreenForge

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Réparer le noyau état/rendu/export, puis fiabiliser l’éditeur local utile pour produire les captures App Store de Pulpe. |
| **Source** | Demande utilisateur du 22 juillet 2026, dépôt local, `PRD.md`, dix captures AppScreens et projet AppScreens ouvert. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1 | Contrat produit, état et persistance | [`phase-1.md`](./phase-1.md) |
| 2 | Rendu Fabric et géométrie canonique | [`phase-2.md`](./phase-2.md) |
| 3 | Outils d’édition réellement fonctionnels | [`phase-3.md`](./phase-3.md) |
| 4 | Écrans, modèles et parcours de composition | [`phase-4.md`](./phase-4.md) |
| 5 | Export App Store validé et durcissement final | [`phase-5.md`](./phase-5.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/ | App Store Connect accepte 1 à 10 captures, dont 1320×2868 pour l’iPhone 6.9 pouces, et refuse les images avec canal alpha. |
| https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/ | Le jeu de captures à la résolution la plus élevée est redimensionné automatiquement pour les appareils plus petits. |
| https://fabricjs.com/docs/upgrading/upgrading-to-fabric-70/ | Fabric 7 place désormais les objets par leur centre par défaut. |
| https://fabricjs.com/api/classes/staticcanvas/ | `StaticCanvas.toBlob()` fournit le chemin d’export direct sans conversion base64. |
| https://appscreens.com/user/project/OEu8a9bFHycubuxc1xZL | Référence du parcours panorama, inspecteur par élément, réglages de sortie et export ZIP. |

## Decisions

| Decision | Why |
| -------- | --- |
| Garder React, Zustand, Fabric et l’interface actuelle au lieu de réécrire avec une autre stack. | Le socle compile et le chrome d’éditeur existe ; les pannes viennent de flux incomplets, pas du choix de framework. |
| Le projet sérialisé reste la seule source de vérité ; Fabric n’est qu’une projection interactive. | Le même modèle peut alimenter le canvas, les miniatures et l’export sans divergence. |
| Utiliser un seul profil officiel par défaut : iPhone 6.9 pouces, portrait, 1320×2868, PNG opaque. | C’est suffisant pour App Store Connect, qui réduit automatiquement ce jeu ; la matrice commerciale multi-appareils d’AppScreens est inutile ici. |
| Écarter comptes, abonnements, cloud, collaboration, traduction automatique et upload direct vers les stores. | L’outil est personnel, local et centré sur la production des fichiers. |
| Épingler le modèle de coordonnées haut-gauche pour Fabric 7 et reporter toute migration Fabric 8. | Le domaine actuel stocke `x/y` au coin supérieur gauche ; changer les données maintenant agrandirait le diff sans bénéfice utilisateur. |
