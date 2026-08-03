---
objective: "ScreenForge permet d’importer localement un PNG de bezel iPhone officiel Apple, d’y composer une capture et d’exporter une planche App Store exacte, sans redistribuer l’asset Apple."
status: in-progress
---

# Plan: Bezels iPhone officiels importés localement

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Remplacer à la demande le cadre généré par un bezel Apple fourni par l’utilisateur, persisté localement et rendu jusque dans l’export |
| **Source** | Demande utilisateur du 2026-08-03, après recherche de faisabilité sur les Apple Product Bezels |

Le cadre SVG actuel reste le défaut et le repli des anciens projets. Le chemin officiel est
opt-in : l’utilisateur télécharge le DMG chez Apple, en extrait un PNG transparent puis importe
ce fichier dans le calque appareil. Aucun PNG, PSD ou DMG Apple n’entre dans le dépôt, le bundle
ou les fixtures de test.

La validation combine deux niveaux : des PNG synthétiques minuscules et déterministes pour le
CI, puis un test contractuel local utilisant un vrai PNG Apple désigné par chemin. Ce dernier
reste hors dépôt et constitue le contrôle final de compatibilité avec l’archive Apple réelle.

## Phases

| #   | Phase                                      | File                         |
| --- | ------------------------------------------ | ---------------------------- |
| 1   | Contrat local et preuve de faisabilité     | [`phase-1.md`](./phase-1.md) |
| 2   | Intégration éditeur, persistance et export | [`phase-2.md`](./phase-2.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| [Apple Design Resources — Product Bezels](https://developer.apple.com/design/resources/#product-bezels) | Apple distribue les bezels iPhone actuels en DMG contenant Photoshop et PNG, pas en SVG |
| [App Store Marketing Guidelines — Apple Product Images](https://developer.apple.com/app-store/marketing/guidelines/#apple-product-images) | Le bezel fourni doit rester tel quel ; Apple interdit notamment rotation, ombre ajoutée, découpe et modification |
| [App Store Marketing Artwork License Agreement](https://developer.apple.com/app-store/marketing/guidelines/#agreement) | La licence est limitée, non transférable et liée aux apps du membre Apple Developer ; ScreenForge ne doit donc pas redistribuer l’artwork |
| [App Store screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) | L’export final doit rester un PNG/JPEG opaque aux dimensions acceptées, dont 1320×2868 pour la cible 6,9 pouces |

## Decisions

| Decision | Why |
| -------- | --- |
| L’utilisateur fournit le PNG officiel ; aucun artwork Apple n’est livré par ScreenForge | C’est le seul modèle compatible avec la licence non transférable et avec un dépôt public/local-first |
| Le PNG et la capture réutilisent le registre d’assets et l’object store IndexedDB existants | Le stockage binaire v2 déduplique et persiste déjà les data URLs hors du graphe ; une migration ou un second catalogue n’apporterait rien au besoin actuel |
| Le calque porte uniquement l’identifiant d’asset et la petite géométrie détectée | Le rendu, l’historique et l’autosave restent compacts, tandis que duplication et partage de calque continuent de fonctionner sans nouveau resolver global |
| L’ouverture écran est détectée comme la composante transparente fermée contenant le centre du PNG | Les Product Bezels sont des overlays à ouverture transparente ; cette règle distingue l’écran du fond extérieur transparent sans dépendre d’un nom de modèle ou de dimensions codées en dur |
| Un bezel importé se rend toujours tel quel, en portrait | `orientation` n’est pas une étiquette : `orientedDeviceSvg` la traduit en une rotation de 90° du contenu, et la licence Apple interdit de faire pivoter l’artwork. Le champ reste sur le calque pour le cadre généré, mais il est forcé et masqué en mode importé |
| Aucun nouveau runner de test ni nouvelle dépendance | Playwright, les APIs Canvas et les bibliothèques déjà installées suffisent aux tests fonctionnels et au décodage des PNG exportés |
