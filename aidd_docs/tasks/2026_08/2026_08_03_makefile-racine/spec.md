# Point d’entrée de commandes à la racine

## Target

Permettre aux contributeurs d’exécuter depuis la racine du projet, au moyen d’une interface unique et découvrable, les principaux workflows de développement, de contrôle qualité et de validation déjà pris en charge par le projet.

## Hard constraints

- Les workflows existants restent la source de vérité et conservent leur comportement, leurs arguments et leur code de sortie.
- Une erreur d’un workflow déclenché par le point d’entrée est visible par l’appelant et fait échouer la commande correspondante.
- Le workflow de validation d’un export continue d’accepter le chemin de l’archive à contrôler.
- La solution n’ajoute aucune dépendance d’exécution ou de développement au projet.

## Non-goals

- Modifier le comportement de l’application, de sa compilation ou de ses tests.
- Remplacer les commandes existantes ou dupliquer leur logique d’orchestration.
- Reconfigurer l’intégration continue ou provisionner les outils système des contributeurs.
- Ajouter des workflows qui ne sont pas déjà pris en charge par le projet.

## Done-when

- Depuis la racine du projet, un contributeur peut découvrir les workflows disponibles et leur rôle sans consulter une autre configuration.
- Depuis ce même point d’entrée, un contributeur peut lancer le développement local, la prévisualisation, la compilation, les contrôles de types et de style, les tests unitaires, les tests de bout en bout, la validation complète de livraison et l’audit de contraste.
- Un contributeur peut lancer la validation d’une archive d’export en lui transmettant son chemin.
- Pour chaque workflow, le résultat observable et le statut de réussite ou d’échec sont identiques à ceux de la commande existante correspondante.

## Stakeholders (optional)

- Decider: Mainteneur du projet
- Owner: Mainteneurs de ScreenForge
- Consumer: Contributeurs de ScreenForge

## Context (optional)

La demande source mentionne uniquement un « Makefile racine » ; le document de brainstorm indiqué n’est pas présent. Ce contrat retient donc le périmètre minimal observable couvert par le catalogue actuel de commandes du projet, sans ajouter de nouveau workflow.
