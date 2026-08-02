---
objective: "ScreenForge se lit ET s'utilise comme un instrument payant : mockups d'appareil crédibles, profondeur réelle entre les surfaces, une seule grammaire de champ, zéro couleur chromatique dans le chrome, et un parcours qui va d'un dossier de captures de simulateur au ZIP validé sans détour."
status: in-progress
---

# Plan: Refonte UI et UX v4 — du mockup au parcours

## Overview

| Field      | Value                                                                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Corriger ce qui fait « cheap » — rendu du contenu, profondeur, typographie, grammaire des panneaux — et ce qui fait « outil générique » : ni accroche, ni import en lot, ni entrée |
| **Source** | Demandes utilisateur du 2026-08-02 : « l'interface est hideuse, police laide, ça fait cheap, mal fini », puis « hésite pas à rework toute la UX aussi »                       |

Diagnostic mené sur captures live 1600×1000 @2x des deux thèmes, projet vide et projet peuplé.
La direction v3 (monochrome, réduction maximale, stage le plus sombre) n'est pas en cause :
elle est correcte pour un outil de jugement colorimétrique. Ce qui échoue est l'exécution, à
quatre endroits mesurables.

1. **Le contenu paraît cassé** — le mockup iPhone est une dalle plate : les boutons latéraux
   sont dessinés hors du `viewBox` donc invisibles, le bezel est coloré au lieu d'être noir,
   la tranche n'a aucun dégradé métal, l'écran n'a ni verre ni ombre interne. La couleur par
   défaut est `cosmic-orange`, premier élément de `PRO_17_COLORS`, donc tout nouveau projet
   démarre en orange rouille.
2. **L'artboard actif est cerclé de rouge pur** (`activeRing` lit `--color-export`), lu comme
   une erreur, et en contradiction avec la règle « rouge = export uniquement ». Les poignées
   de sélection Fabric sont restées aux défauts : carrés bleus `rgb(178,204,255)`, 13px.
3. **Aucune profondeur** — `panel 0.19` / `raised 0.23` / `surface 0.24` : trois paliers
   séparés de 0.04 et 0.01 de luminance, indiscernables. Tout se lit comme un seul gris plat.
4. **38 usages de `.caps-label`** sur 18 fichiers : jusqu'à douze micro-labels 10px capitales
   empilés dans un seul panneau, cohabitant avec une seconde grammaire de champ à label inline
   `X 60` / `ROT 0` / `TAILLE 48`.

Choix confirmés avec l'utilisateur avant planification : **dark-first, thème clair rebâti en
neutre vrai** ; **Inter v4 variable** en remplacement de Geist ; **monochrome intégral**, le
bouton Exporter passe en blanc plein et le rouge disparaît du chrome.

### Le second diagnostic : l'UX

Le produit se comporte comme un éditeur de canvas générique alors que son unité de travail
est **une planche de dix images cohérentes**. Trois manques structurels, tous vérifiés dans
le code, pas supposés.

1. **Aucune accroche, aucun repère, aucun outil d'alignement.** Rien dans `src/` ne contient
   `snap`, `guide` ni `align`. Tout est posé à l'œil, et c'est le PNG livré qui en porte la
   trace. C'est la cause d'un « mal fini » que la refonte visuelle seule ne corrigerait pas.
2. **Aucun import en lot.** `handleImageImport` lit `files?.[0]` et l'input ne porte pas
   `multiple` ; le glisser-déposer n'existe que pour réordonner. Le geste central du produit —
   « voici mes six captures de simulateur » — demande aujourd'hui une trentaine d'actions.
3. **Aucune entrée.** Rien ne répond à `firstRun`, `onboard` ni `welcome`. La première seconde
   du produit est un artboard blanc entre deux panneaux vides, avec une galerie de modèles
   cachée derrière une icône.

S'y ajoutent deux frictions : le déplacement de la vue est sur **Alt et glisser**, geste que
tout éditeur de maquette réserve à la duplication ; et l'édition de texte en place, qui existe
au double-clic, n'est annoncée nulle part.

## Phases

| #   | Phase                                                    | File                         |
| --- | -------------------------------------------------------- | ---------------------------- |
| 1   | Fondations — tokens, type, profondeur                    | [`phase-1.md`](./phase-1.md) |
| 2   | Primitives UI                                            | [`phase-2.md`](./phase-2.md) |
| 3   | Rendu canvas & mockups appareil                          | [`phase-3.md`](./phase-3.md) |
| 4   | Manipulation directe — repères, alignement, édition canvas | [`phase-4.md`](./phase-4.md) |
| 5   | Entrée — première minute, import en lot, le set comme unité | [`phase-5.md`](./phase-5.md) |
| 6   | Shell — barre, drawers, filmstrip, zoom                  | [`phase-6.md`](./phase-6.md) |
| 7   | Panneaux, éditeurs, dialogues, contrôle d'export         | [`phase-7.md`](./phase-7.md) |
| 8   | Vérification & garde-fous                                | [`phase-8.md`](./phase-8.md) |

L'ordre n'est pas négociable. Les phases 3 et 4 portent le plus gros de la qualité perçue mais
consomment les tokens de la phase 1. La phase 5 introduit des surfaces que la phase 6 habille,
d'où son antériorité : l'inverse ferait retoucher la barre et la filmstrip deux fois. Les
phases 4 à 7 consomment les primitives de la phase 2.

## Resources

| Source                                                                    | Verified                                                                                                                                                |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900` | Inter v20 variable servi avec l'axe `opsz` : la requête avec `opsz` renvoie un woff2 distinct de la requête `wght` seule, donc `font-optical-sizing: auto` opère |
| `https://fonts.googleapis.com/css2?family=Geist:wght@100..900`             | Geist est bien servi et se charge : la gêne typographique ne vient pas d'un échec de chargement mais de la famille et de son usage                      |
| `fabric@7.2.0` — `src/shapes/Object/defaultValues.ts`                     | Défauts de sélection actuellement subis : `cornerSize 13`, `cornerColor` et `borderColor` `rgb(178,204,255)`, `transparentCorners true`, `cornerStyle 'rect'` |

## Decisions

| Decision                                                                                | Why                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monochrome intégral : aucune couleur chromatique dans le chrome, Exporter en blanc plein  | Le rouge saturé jure avec le graphite et a fui hors de son unique usage autorisé. Le blanc est le contraste le plus fort disponible sur graphite et coûte zéro token de couleur |
| Le mockup d'appareil entre dans le périmètre de la refonte UI                             | C'est le livrable du produit : un chrome impeccable autour d'un mockup en dalle plate se lira toujours comme cheap. Plus fort levier du plan                             |
| Inter variable avec `opsz` remplace Geist ; la famille mono est supprimée                 | Inter est la grotesque UI la mieux réglée en petit corps ; ses chiffres tabulaires natifs rendent Geist Mono superflu — une famille de moins à charger et un tell « dev tool » de moins |
| Rampe de neutres à chroma 0 avec paliers ≥ 0.04 de luminance                              | Le warm 0.004/60 actuel n'est pas perceptible mais teinte le jugement colorimétrique ; les paliers actuels sont trop serrés pour produire de la hiérarchie              |
| Suppression du pattern `.caps-label` au profit d'un label en casse normale                | Douze capitales trackées empilées sont la signature d'un outil générique ; le registre produit demande une grammaire de champ unique                                    |
| Thème clair rebâti en neutre vrai, secondaire au dark                                     | Le `oklch(0.9 0.004 70)` actuel tombe dans la bande beige/greige, poussiéreuse ; le stage doit rester le plus sombre pour ne pas contaminer la lecture des artboards    |
| L'unité de travail du produit devient la planche, pas l'écran                             | Le livrable est un lot de dix images cohérentes. Import en lot, propagation à tous les écrans et contrôle avant export découlent de ce recadrage, et rien de tout cela n'existe |
| Les repères d'accroche sont dessinés sur la couche de rendu, jamais comme objets du canvas | Un repère qui serait un objet Fabric apparaîtrait dans la liste des calques, dans l'historique et dans l'export. La contrainte est structurelle, elle se décide maintenant |
| Une barre contextuelle de sélection, visible uniquement drawer fermé                       | Le stage maximal et les drawers rétractables rendent la moindre modification coûteuse. La condition « drawer fermé » est ce qui évite d'entretenir deux surfaces concurrentes |
