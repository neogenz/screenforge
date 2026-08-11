---
objective: "Une campagne App Store se conçoit une fois et se remaintient à chaque release : le design, les cadrages et les slots survivent au remplacement des captures, et le lot exporté devient une release vérifiable."
status: in-progress
---

# Plan: cycle de vie d'une campagne

## Overview

| Field       | Value                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------- |
| **Goal**    | Reprendre de deux concurrents ce qui renforce la maintenance d'une campagne, sans devenir l'un d'eux |
| **Source**  | Contrat utilisateur du 2026-08-10 (`screenforge-aidd-sdlc-goal.md`)                        |
| **Base**    | `feat/saas-foundations` — PR #3 ouverte vers `main`, non fusionnée                          |
| **Sources** | [`audit-sources.md`](./audit-sources.md) — SHA, licences et concepts repris                 |

## La proposition, et ce qu'elle exclut

L'éditeur sait déjà composer une planche. Ce qu'il ne sait pas, c'est la
**reprendre** : à la release suivante, dix captures changent et rien d'autre ne
devrait bouger. C'est le seul axe de ce plan. Une fonction des concurrents qui
ne sert pas cet axe reste dehors, même si elle est bonne.

Trois choses rendent aujourd'hui la reprise impossible :

1. **Le cadrage n'existe pas comme donnée.** Une capture est posée en
   `xMidYMid slice` (`assets/device-frames/index.ts:381`,
   `lib/canvas/canvas-utils.ts:307`). L'utilisateur ne peut ni le régler, ni
   donc le retrouver.
2. **Rien ne dit quel écran est lequel.** Un `device-frame` porte un asset, pas
   un rôle. Remplacer dix captures suppose de savoir laquelle va où, et cette
   information n'est nulle part.
3. **Un lot n'est pas une opération.** Dix substitutions font dix pas
   d'annulation, dix références de projet, et un échec au sixième laisse le
   projet entre deux releases.

## Phases

| #   | Phase                                            | Statut       |
| --- | ------------------------------------------------ | ------------ |
| 1   | Modèle versionné + `EditorTransaction`           | done         |
| 2   | Placement/crop persistant + slots sémantiques    | done         |
| 3   | Formes et icônes éditables + registre partagé    | done         |
| 4   | Batch refresh atomique                           | done         |
| 5   | Lot rendu, release immuable, diff structurel     | done         |
| 6   | Plan IA validé + builder déterministe + outils   | done         |
| 7   | Registre de providers + bridge Codex             | done         |
| 8   | Localisation éditable + revue des débordements   | done         |
| 9   | Arborescence d'export + preflight `asc`          | done         |
| 10  | Durcissement, licences, a11y, doc, E2E complet   | à faire      |

L'ordre est celui des dépendances, pas celui de la valeur. Les phases 2 à 5
tiennent seules : elles décrivent le cycle de vie complet d'une campagne sans
qu'aucun modèle de langage n'intervienne. Les phases 6 à 9 s'appuient toutes
sur le registre de la phase 3 et sur la transaction de la phase 1 — une IA qui
écrirait dans les stores un calque à la fois produirait exactement les dix pas
d'annulation que la phase 1 existe pour éviter.

## Invariants que ce plan ne touche pas

- Le modèle reste sérialisable et indépendant de Fabric.
- Les assets binaires restent hors du graphe projet, référencés par `assetId`.
- L'éditeur fonctionne sans compte et sans backend.
- L'export reste pixel-exact et vérifié octet à octet (`lib/export.ts`).
- Aucun nouveau mega-store, aucun composant monolithique, aucune voie de
  mutation concurrente aux stores existants.

## Deux points où le contrat et le dépôt se contredisent

**Le bridge local (phases 7 et 9) est un troisième déployable.** `CLAUDE.md`
pose « Zero backend, zero recurring cost », et le SaaS a déjà ajouté
`apps/api`. Un démon qui écoute sur `127.0.0.1`, lance `codex app-server` et
exécute `asc` n'est plus une application web : c'est un binaire à installer,
signer et mettre à jour sur le poste de l'utilisateur. Le contrat l'autorise
explicitement, donc il est planifié — mais il est planifié en dernier, et la
phase 9 livre d'abord l'arborescence, le manifeste et la commande `asc` prête
à coller. Cette moitié-là n'a besoin d'aucun démon et couvre le besoin réel.

**`replaceExisting` n'a pas d'équivalent local.** Le drapeau ne veut rien dire
tant que rien ne publie ; il naît en phase 9 avec la cible qu'il protège.

## Ce qui reste hors de la PR

Repris du contrat, vérifié contre le dépôt : remplacement de Fabric/React/
Zustand, Next.js, Tauri, Google Play, iPad/Watch/Mac, App Preview, appareils
3D, mockups photo sans droits prouvés, catalogue massif de templates, CRDT,
merge de projets utilisateurs, MCP générique, automation des interfaces web des
fournisseurs, SVG arbitraire produit par un modèle, shell générique exposé à
l'IA, image aplatie en remplacement de calques, TestFlight et App Review.
