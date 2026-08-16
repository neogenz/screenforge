# Documents AIDD publics

Ce dossier est versionné dans le monorepo canonique et doit pouvoir être publié
tel quel. Il aide l’assistant à comprendre le projet sans redécouvrir chaque
décision, mais ce n’est ni un coffre-fort ni un emplacement de preuves brutes.

## What lives here

- `memory/`: the project memory bank loaded each session. See [`memory/README.md`](memory/README.md).
- `GUIDELINES.md`: how this team operates the AI on this project.
- `CONTRIBUTING.md`: how to add or change project context.
- `tasks/`: specs, plans, and run summaries, created as work happens.

Le bloc `<aidd_project_memory>` des fichiers de contexte est généré. Pour
modifier ce que l’assistant charge, ajouter ou retirer les documents sous
`memory/`.

## Contrat de publication

Sont autorisés : noms de variables, URLs publiques, SHA et tags, résultats
`pass`/`fail`, horodatages et identifiants explicitement expurgés nécessaires à
une preuve reproductible.

Sont interdits dans tout `aidd_docs/` :

- token, clé, valeur réelle d’environnement, fichier PEM/P8 ou certificat ;
- e-mail privé, identifiant client ou compte personnel ;
- export de base, corps de webhook, log ou sortie CLI brute ;
- code MFA, OTP, récupération ou capture de console ;
- chemin personnel ou URL signée.

Une preuve brute nécessaire reste dans `.private/`, ignoré par Git, ou dans le
store sécurisé du fournisseur. Le document versionné n’en conserve qu’un
résultat expurgé. Gitleaks et `pnpm audit:publication` scannent ce dossier sans
exception de chemin ou de règle.

## The framework

AIDD fournit les skills et générateurs utilisés par le projet. Le catalogue et
le workflow complet restent dans la documentation du framework :
<https://github.com/ai-driven-dev/framework>.
