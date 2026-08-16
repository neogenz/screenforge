---
objective: "Un agent qui pilote ScreenForge par MCP pose une accroche d'un seul calque avec son mot en exergue, et lit après rendu un constat mesuré de la planche — au lieu d'éclater le texte en morceaux repositionnés à la main et de juger le résultat à l'œil."
status: in-progress
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
