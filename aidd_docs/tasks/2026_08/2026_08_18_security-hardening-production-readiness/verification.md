# Vérification du durcissement sécurité

Ce document est public. Il ne contient que des commandes, SHA, compteurs et
résultats expurgés; aucune valeur d'environnement, donnée client, URL temporaire
ou identifiant fournisseur.

## Candidat

- Branche : `codex/cloud-prelaunch-plan`.
- Base : `8c6c532`.
- Preview technique et backend préproduction : candidat issu de `71c8cca`.
- Aucun tag, domaine, paiement réel ou déploiement production exécuté.

## Assertions

- Gitleaks : 193 commits et le répertoire courant, aucun secret détecté.
- Dépendances : `pnpm audit --audit-level low`, aucune vulnérabilité connue.
- Unités : 59 Bridge, 176 backend, 36 MCP et 397 web; audits publication et
  configuration de déploiement verts.
- Gate release après itération : build, CSP, typecheck, lint, sonde MCP, 187 E2E
  passés et 1 fixture Apple externe ignorée comme prévu.
- Export critique : ZIP avec PNG opaque exact 1320×2868 validé par l'E2E.
- Interface : contraste minimal 4.78:1 sombre et 4.55:1 clair; échelles et
  landing vertes.
- Itération corrective : le parcours global des dialogues attend désormais les
  quatre étapes MCP; le ciblé repasse à 8/8 puis le gate complet est vert.

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
- Production : domaine, KYC, secrets production, tag, promotion et paiement réel
  restent derrière leurs gates explicites.
