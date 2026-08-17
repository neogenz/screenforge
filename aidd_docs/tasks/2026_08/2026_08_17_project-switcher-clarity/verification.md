# Vérification : sélecteur et consentement des projets

Toutes les preuves utilisent des fixtures synthétiques ou un parcours navigateur en lecture seule. Aucun projet ni compte réel n'a été renommé, supprimé ou exporté.

## Fonctionnel

| Vérification | Résultat |
| --- | --- |
| Catalogue et stockage, dont un record frère malformé conservé sur disque | 24/24 tests ciblés |
| Sélecteur, fichier projet et sémantique | 10/10 E2E ciblés |
| Consentement Cloud : différer, singulier/pluriel, ajout exact et échec partiel nommé | 3/3 E2E ciblés |
| Parcours navigateur en lecture seule : hiérarchie, filtre, Échap et retour du focus | conforme |

## Quality gate

| Gate | Résultat |
| --- | --- |
| `pnpm run test:release` | vert |
| Tests unitaires workspace | 619 passés |
| Audit de publication | 4 passés |
| E2E release | 185 passés, 1 fixture Apple externe volontairement absente |
| Build et CSP | verts |
| Audit des dépendances | aucune vulnérabilité connue |
| Gitleaks sur le répertoire de publication | aucune fuite |
| Contraste | dark 4.78:1 minimum, light 4.55:1 minimum |
| Échelle | fermée, aucune valeur interdite |
| Landing | contraste et interdits Impeccable verts |
| Détecteur Impeccable ciblé | aucun finding (`[]`) |

## Passes visuelles

1. Sombre/clair, desktop/compact et zoom navigateur 200 % : détection d'une compression du titre et du pied de dialogue.
2. Après correction du retour à la ligne du titre : mêmes variantes confirmées, contenu lisible et actions atteignables.

Les captures de travail n'ont pas été versionnées afin de ne publier aucune donnée utilisateur.
