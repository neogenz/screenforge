# Task [project-switcher-clarity]

Valider le sélecteur de projets et le consentement Cloud sans modifier les projets ni les données réelles.

## Main step 1

- [x] Le projet courant, ses actions et sa disponibilité Cloud sont séparés des autres projets.
- [x] Le filtre réduit le catalogue en lecture seule et conserve les noms, dates et disponibilités accessibles.
- [x] Échap ferme le sélecteur et rend le focus au déclencheur sans ouvrir, renommer ni supprimer de projet.

## Main step 2

- [x] Une métadonnée IndexedDB malformée est écartée du catalogue sans être supprimée ni réécrite.
- [x] Différer l'ajout au Cloud ne pousse aucun projet préexistant ; l'action explicite pousse exactement les fixtures listées.
- [x] La gate de release complète, les audits visuels et le scan de secrets sont verts.
