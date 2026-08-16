---
objective: "Un agent qui pilote ScreenForge par MCP pose une accroche d'un seul calque avec son mot en exergue, et lit après rendu un constat mesuré de la planche — au lieu d'éclater le texte en morceaux repositionnés à la main et de juger le résultat à l'œil."
status: implemented
---

# Plan: MCP — la composition tient ce que l'agent croit avoir posé

## Overview

| Field      | Value                                                                                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Deux manques du contrat MCP, mesurés sur une vraie session : le style de passage n'est pas exprimable, et la miniature ne rend qu'une image. Les combler, puis aligner le skill dessus. |
| **Source** | Texte — session de test utilisateur du 2026-08-16, projet de 4 écrans composé par un agent via `apps/mcp` ; état relu dans l'onglet (`window.__sfStores`).                              |

## Phases

| #   | Phase                                                    | File                         |
| --- | -------------------------------------------------------- | ---------------------------- |
| 1   | Le passage en exergue traverse le contrat                | [`phase-1.md`](./phase-1.md) |
| 2   | La miniature rend un constat mesuré à côté de l'image    | [`phase-2.md`](./phase-2.md) |
| 3   | Le skill dit ce que le contrat sait faire                | [`phase-3.md`](./phase-3.md) |
| 4   | Un répertoire de captures se repose sans toucher au layout | [`phase-4.md`](./phase-4.md) |
| 5   | Le serveur rend ce que la spec 2026-07-28 sait lire      | [`phase-5.md`](./phase-5.md) |

## Resources

<!-- Aucune source externe : les trois défauts sont constatés dans l'onglet, et les règles réutilisées vivent déjà dans le dépôt. -->

## Decisions

| Decision                                                                                             | Why                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L'exergue se déclare par le passage littéral (`emphasis: [{ text, color }]`), jamais par des index    | Un modèle écrit le mot qu'il vise ; un couple d'index est une deuxième vérité qui périme dès que la copie bouge d'un caractère. Le dépôt convertit en points de code, seul endroit qui sait comment `setRangeFill` compte.        |
| Un passage introuvable dans le contenu refuse l'appel entier                                          | `runEditorTransaction` est tout ou rien : un exergue silencieusement ignoré rendrait « posé » un calque que l'agent croit coloré, et il ne le vérifierait jamais. Le refus nomme le passage et le contenu réel.                    |
| Le constat est calculé dans l'onglet, pas dans le démon                                               | Il faut la police chargée, le cadre d'appareil et la capture pour mesurer ; côté Node ce serait une approximation qui mentirait exactement là où l'agent a besoin de vérité. La page rend et mesure, le démon transporte.          |
| Le constat est du texte à côté de l'image, jamais une erreur                                          | Une composition qui déborde volontairement du cadre est légitime. `get_thumbnail` reste `readOnlyHint` et ne juge rien : il énonce ce qu'il a mesuré, l'agent et l'utilisateur décident.                                            |
| Le seuil d'alerte appareil est 70 %, quand le générateur local se tient à 90 %                        | 90 % est ce qu'une composition du dépôt s'impose ; 70 % est le point où un appareil est décapité pour de bon. Alerter à 90 % sur des planches composées à la main noierait le constat sous des signalements que personne ne veut. |
| Le rafraîchissement de captures apparie dans l'onglet, par `planRefresh`, jamais par une seconde règle | La règle — manifeste, rôle, préfixe de rang, ambiguïté rendue plutôt que tranchée — existe et sert déjà la boîte « Rafraîchir ». Une copie dans le démon serait d'accord avec elle jusqu'au premier correctif, puis poserait la mauvaise capture sans que rien ne le dise. |
| Le démon liste un répertoire, il n'ouvre pas le disque                                                 | `AssetVault` est la seule porte : un fichier n'existe pour la page que si un appel d'outil l'y a fait entrer. Lister sans récursion, filtrer sur `MEDIA_TYPES` et borner avant toute lecture garde cette porte de la même largeur qu'avec `add_image`. |
| `outputSchema` seulement là où la forme est déjà une interface courte du protocole                    | La spec 2026-07-28 sait lire `structuredContent`, mais décrire la vue complète du projet en JSON Schema la déclarerait deux fois — exactement la dérive que `createAiTools` empêche partout ailleurs. Le bloc texte reste dans tous les cas. |
