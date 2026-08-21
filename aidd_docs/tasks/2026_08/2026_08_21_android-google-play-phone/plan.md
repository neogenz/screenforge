---
objective: "Un projet ScreenForge peut cibler Google Play téléphone, être composé avec des cadres et mises en page Android, puis exporter un ZIP PNG opaque 1080×1920 conforme sans régresser le flux App Store existant."
status: in-progress
---

# Plan: ajouter Android et Google Play téléphone

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Ajouter une cible Google Play téléphone de bout en bout, du setup projet au ZIP validé. |
| **Source** | Description utilisateur du 21/08/2026, dépôt ScreenForge et exigences Google Play vérifiées le 21/08/2026. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Contrat de cible et migration des projets | [`phase-1.md`](./phase-1.md) |
| 2   | Géométrie de planche pilotée par la cible | [`phase-2.md`](./phase-2.md) |
| 3   | Setup, cadres et gabarits Android | [`phase-3.md`](./phase-3.md) |
| 4   | Campagnes, localisation et MCP sensibles à la cible | [`phase-4.md`](./phase-4.md) |
| 5   | Export et releases Google Play vérifiés | [`phase-5.md`](./phase-5.md) |
| 6   | Documentation et vitrine multi-store | [`phase-6.md`](./phase-6.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://support.google.com/googleplay/android-developer/answer/9866151?hl=en | Google Play demande au moins 2 captures pour publier et en accepte jusqu’à 8 par type d’appareil, en JPEG ou PNG 24 bits sans alpha, entre 320 et 3840 px avec un rapport maximal de 2:1 ; 4 captures 9:16 d’au moins 1080×1920 sont recommandées pour la promotion des apps. |
| https://support.google.com/googleplay/android-developer/answer/13393723?hl=en | Les captures doivent montrer l’expérience réelle, limiter les accroches, garder les éléments importants centrés et être localisées par marché. |
| https://support.google.com/googleplay/android-developer/answer/9898842?hl=en | Les visuels ne doivent pas contenir de classement, prix, promotion, affiliation trompeuse ou expérience étrangère à l’app. |
| https://developer.android.com/studio/run/emulator-take-screenshots | Android Studio produit directement des captures PNG depuis l’émulateur. |
| https://developer.android.com/studio/debug/am-screenshot | Android Studio sait entourer une capture d’un appareil, mais avertit qu’un cadre ne correspondant pas à la capture étire l’image. |

## Decisions

| Decision | Why |
| -------- | --- |
| Un projet porte une cible immuable `app-store-iphone` ou `google-play-phone`. | Les calques utilisent des coordonnées absolues et les ratios 1320×2868 et 1080×1920 diffèrent ; un bouton d’export seul recadrerait ou déformerait silencieusement la composition. |
| Google Play v1 exporte uniquement le téléphone portrait en 1080×1920. | C’est le profil 9:16 recommandé par Google ; tablettes, Wear OS, XR, paysage et feature graphic demandent chacun une composition distincte et restent hors de ce lot. |
| Le calque `device-frame` existant rend aussi Android. | Le cadrage, le remplacement de capture, l’ombre, la rotation et la persistance existent déjà ; un second type de calque dupliquerait tout ce chemin. |
| Le cadre Android livré est générique et vectoriel. | Il évite un catalogue de marques, des ressources propriétaires et l’obsolescence rapide tout en laissant l’import PNG existant disponible. |
| L’export reste PNG opaque avec la cible interne de 5 MB. | Ce sous-ensemble est accepté par les deux stores et la limite existante est plus stricte que celle de Google Play. |
| La publication directe reste Apple uniquement. | La demande porte sur l’export ; intégrer l’API Google Play, ses identifiants et ses destinations serait une fonctionnalité indépendante. |
