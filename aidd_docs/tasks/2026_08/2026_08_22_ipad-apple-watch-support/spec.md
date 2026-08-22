# Support officiel iPad et Apple Watch

## Target

Permettre aux développeurs de composer et d’exporter des captures App Store iPad et Apple Watch conformes, aussi fidèlement que les captures iPhone existantes.

## Hard constraints

- La cible iPad principale produit des captures portrait 13 pouces de `2064×2752` pixels ; les tailles iPad plus anciennes restent déléguées à la mise à l’échelle d’App Store Connect.
- Apple Watch accepte les six formats portrait officiels : `422×514`, `410×502`, `416×496`, `396×484`, `368×448` et `312×390` pixels.
- Chaque projet conserve une seule cible App Store pour toutes ses planches, langues et releases, et l’aperçu de la planche porte exactement le même rapport que l’export.
- Chaque fichier livré est un PNG 8 bits RGB opaque, aux dimensions exactes de sa cible, et un projet contient de 1 à 10 captures.
- Les projets existants sans cible explicite restent des projets iPhone 6,9 pouces en `1320×2868`, sans déplacement ni redimensionnement de leurs calques.
- Les sélecteurs de cadres et les modèles prêts à modifier ne proposent que des appareils compatibles avec la plateforme du projet.
- Les ressources Apple officielles ne sont ni téléchargées automatiquement, ni intégrées, ni redistribuées : l’utilisateur les obtient auprès d’Apple puis les importe localement après avoir accepté leur licence.
- Un bezel Apple importé reste intact ; les cadres intégrés sont des créations originales sans marque ni détail matériel Apple distinctif.

## Non-goals

- Produire des exports iPad paysage dans cette livraison.
- Produire les tailles iPad optionnelles et historiques qu’App Store Connect sait dériver de la cible 13 pouces.
- Embarquer, héberger, convertir ou reconditionner les UI kits, Product Bezels, fichiers DMG, PSD ou autres ressources Apple.
- Ajouter le support Mac, Apple TV ou Vision Pro.

## Done-when

- Un utilisateur peut choisir une cible iPhone, iPad ou l’une des six classes Apple Watch et voit immédiatement des planches au bon rapport.
- Il peut ajouter un cadre iPad ou Apple Watch intégré, y insérer une capture, ou importer localement un Product Bezel officiel depuis le même parcours.
- Au moins un modèle iPad et un modèle Apple Watch prêts à modifier produisent une composition entièrement contenue dans leur planche.
- L’export ZIP de chaque cible contient uniquement des PNG opaques aux dimensions officielles sélectionnées, dans un dossier qui identifie cette cible sans ambiguïté.
- Un projet ancien s’ouvre, s’édite, se sauvegarde, se recharge et s’exporte comme avant.
- Les écrans d’aide renvoient vers les spécifications et ressources Apple officielles sans redistribuer leurs fichiers.

## Stakeholders (optional)

- Decider: propriétaire de ScreenForge
- Owner: équipe ScreenForge
- Consumer: développeurs publiant une app iPhone, iPad ou Apple Watch sur l’App Store

## Context (optional)

- [Spécifications officielles des captures App Store](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Téléversement et mise à l’échelle des captures](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/)
- [Apple Design Resources](https://developer.apple.com/design/resources/)
- [Licence Apple Design Resources](https://developer.apple.com/support/downloads/terms/apple-design-resources/Apple-Design-Resources-License-20230621-English.pdf)
- Hypothèse de cadrage : cette livraison reste portrait, comme le produit actuel ; le paysage iPad est explicitement hors périmètre.
