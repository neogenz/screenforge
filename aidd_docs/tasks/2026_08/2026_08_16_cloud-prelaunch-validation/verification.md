# Preuves Cloud pré-lancement

Ce fichier est l'unique matrice publique de validation pour Convex, Resend,
Polar Sandbox et les Previews Vercel. Il ne doit contenir ni jeton, secret,
adresse personnelle, cookie, lien magique, payload fournisseur, identifiant de
compte, URL temporaire ni capture de console sensible.

## Matrice

| Surface | Preuve attendue | État | Date | Commit ou URL publique stable |
| --- | --- | --- | --- | --- |
| Preflight expurgé | Configuration complète ou noms/règles seulement | vert local | 2026-08-16 | commit de phase 1 |
| Convex préproduction | Auth, projets, images et settings sur deux sessions | à valider | — | — |
| Resend test | Lien livré uniquement au destinataire autorisé | à valider | — | — |
| Compte propriétaire | Cloud complémentaire actif, aucun rôle admin | à valider | — | — |
| Polar Sandbox | Achat, relivraison, révocation et signature | à valider | — | — |
| Preview Vercel | Local puis Cloud sur Convex préproduction uniquement | à valider | — | — |
| Sauvegarde | Restauration cohérente dans une cible jetable | à valider | — | — |
| Production | Aucun tag, domaine ou paiement réel avant les gates | protégé | 2026-08-16 | workflow tagué |

## Asserts

- Phase 1 : 4 tests preflight, 132 tests backend et 615 tests workspace passent;
  typecheck, lint, format, audit de publication et Gitleaks passent également.
- GitHub : dépôt public, secret scanning et push protection actifs, rulesets
  branche et tags actifs; aucun tag v1 créé.

## Review

À remplir avec la sévérité, le fichier et la preuve reproductible de chaque
finding, sans extrait sensible.

## Browser QA

À remplir avec les étapes, le résultat et un chemin de capture publiable; une
URL de Preview éphémère ne doit pas être consignée.
