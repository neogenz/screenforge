---
objective: 'Les sept constats de la revue sont fermés : plus aucune icône ne retombe sur les 24px de Lucide, le balayage des jetons de la vitrine ne laisse plus passer une classe tenue dans une variable, et la sonde du démon MCP a une fin.'
status: in-progress
---

# Plan: Fermer les constats de la revue coss

## Overview

| Field      | Value                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Corriger les trois avertissements et les quatre mineurs de la revue, et refermer derrière chacun la garde qui ne l'avait pas vu               |
| **Source** | `aidd_docs/tasks/2026_08/2026_08_23_conformite-coss-restante/review.md` — revue du diff `3d54bbe...63d554b`, verdict `changes-requested`     |

## Phases

| #   | Phase                                                | File                         |
| --- | ---------------------------------------------------- | ---------------------------- |
| 1   | Les icônes de repli, et les états qui les montrent   | [`phase-1.md`](./phase-1.md) |
| 2   | Le balayage lit des littéraux, pas des segments      | [`phase-2.md`](./phase-2.md) |
| 3   | La sonde a une fin, la boîte a une sortie            | [`phase-3.md`](./phase-3.md) |

## Resources

| Source                                                            | Verified                                                                                                                                                                                       |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://developer.mozilla.org/docs/Web/API/AbortSignal/timeout_static` | `AbortSignal.timeout(ms)` rejette avec un `TimeoutError` et est disponible dans tous les navigateurs visés ; c'est le `signal` que `fetch` attend, sans contrôleur à tenir soi-même.               |
| `https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API` | `ts.createSourceFile` + `ts.forEachChild` donnent l'arbre sans programme ni type-checker, donc sans `tsconfig` à résoudre. `ts.isStringLiteralLike` couvre `'…'`, `"…"` et le gabarit sans substitution. |

## Decisions

| Decision                                                                                                    | Why                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Le balayage des jetons passe par l'analyseur TypeScript plutôt que par un compteur de paires maison          | Les deux constats de l'audit ont la même racine : `balanced()` compte des parenthèses sans savoir ce qu'est une chaîne ni un commentaire. Un analyseur, lui, le sait par construction — il attrape la classe tenue dans une variable, qui échappait au balayage par segments, et ignore le jeton cité en prose, qui faisait échouer le balayage sur fichier entier. `typescript` est déjà une dépendance de la racine : il n'y a rien à installer, et rien à maintenir de la grammaire. |
| Les cinq icônes prennent une classe `size-*`, sans nouveau composant de ligne de note                       | Les cinq sites partagent une forme (`<p class="flex items-start gap-1.5 text-xs">` + icône), et cette répétition est ce qui a propagé le défaut. Mais extraire un composant change le rendu de cinq écrans pour corriger une classe : la revue demande la classe, et la récidive se tient par la garde plutôt que par l'abstraction. Le jour où un sixième site apparaît, l'arbitrage se rouvre.                                                                                          |
| La garde des icônes reste dynamique, et c'est aux specs d'ouvrir les états d'erreur                          | `expectNoRawIcon` mesure du DOM rendu : c'est ce qui la rend exacte (un conteneur coss qui dimensionne son enfant est invisible à toute lecture statique) et c'est aussi son angle mort — elle ne voit que ce qu'un scénario a ouvert. La réponse est donc d'appeler la garde là où l'état existe déjà, pas d'inventer une règle statique qui devrait deviner ce que coss dimensionne.                                                                                                     |
