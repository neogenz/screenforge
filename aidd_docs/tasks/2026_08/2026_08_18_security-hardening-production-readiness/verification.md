# Vérification du durcissement sécurité

Ce document est public. Il ne contient que des commandes, SHA, compteurs et
résultats expurgés; aucune valeur d'environnement, donnée client, URL temporaire
ou identifiant fournisseur.

## Candidat

- Branche : `codex/cloud-prelaunch-plan`.
- Base : `8c6c532`.
- Correctif sécurité local et gate release : `5689b62`.
- Preview technique et backend préproduction : candidat antérieur issu de `71c8cca`;
  une nouvelle preuve Preview reste requise sur le SHA final.
- Aucun tag, domaine, paiement réel ou déploiement production exécuté.

## Assertions

- Gitleaks : 195 commits et le répertoire courant, aucun secret détecté. Le
  fichier de configuration runtime Convex ignoré, généré par les E2E, a été
  supprimé avant la preuve finale.
- Dépendances : `pnpm audit --audit-level low`, aucune vulnérabilité connue.
- Unités : 59 Bridge, 176 backend, 38 MCP et 399 web; audits publication et
  configuration de déploiement verts.
- Gate release après itération : build, CSP, typecheck, lint, sonde MCP, 187 E2E
  passés et 1 fixture Apple externe ignorée comme prévu.
- Export critique : ZIP avec PNG opaque exact 1320×2868 validé par l'E2E.
- Interface : contraste minimal 4.78:1 sombre et 4.55:1 clair; échelles et
  landing vertes.
- Itération corrective : réponses asset authentifiées `no-store`, lease et
  sérialisation MCP, graphes/archives bornés et inspectés, sauvegarde attendue
  avant navigation et SHA de tag égal au HEAD de `main`. Les ciblés repassent
  respectivement à 13/13 backend, 38/38 MCP, 25/25 web, 8/8 archive et 1/1
  transport Cloud avant le gate complet.
- Codex Security : diff scan complet 60/60 sans finding; scan standard
  `782d47fc-ea27-4189-b2f5-6af174cd29e3` scellé sur `5689b62`, six surfaces et
  zéro finding résiduel.

## Préproduction

- Intégration Git Vercel officielle reliée au seul dépôt, protection fork et
  authentification Preview actives.
- Preview interne `Ready`; trois documents passent les smokes protégés.
- Preview ne reçoit que le nom public `VITE_CONVEX_URL`.
- Convex préproduction déployé; liste de noms conforme et preflight
  `{ ready: true, missing: [], inconsistent: [] }`.
- Les preuves antérieures restent valides pour Resend, deux sessions, sync,
  propriétaire, paiement Polar Sandbox, signature et replay.

## Gates encore ouverts

- Polar Sandbox : annulation puis état effectif à échéance non observés.
- Backup : aucun snapshot réel n'a été créé. L'export complet aurait copié des
  données utilisateur vers la machine locale et requiert une autorisation
  dédiée au payload; la cible jetable vide a été supprimée.
- Browser QA Cloud sur l'URL Preview protégée, PR de fork contrôlée et couverture
  des auteurs bot restent à exécuter.
- GitHub : le ruleset `v*` réservé à la Release GitHub App et l'approbation de
  l'Environment production restent à prouver dans la configuration externe.
- Production : domaine, KYC, secrets production, tag, promotion et paiement réel
  restent derrière leurs gates explicites.
