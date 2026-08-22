---
status: in-progress
---

# Vérification du candidat préproduction

Ce document sépare les preuves reproductibles du dépôt des contrôles qui exigent
encore le déploiement ou l'autorité du propriétaire. Il ne contient ni identifiant
fournisseur, ni consommation réelle, ni secret, ni URL de contournement.

## Candidat local

- Base vérifiée : `origin/main` à `1cd46bb237ce680c5a2c8428c8450db19197bc73`.
- Branche : `codex/preprod-ci-automation`.
- SHA candidat : à reporter depuis le commit poussé avant tout déploiement. Aucune
  preuve hébergée n'est attribuée au worktree non commité.
- Runtime de validation : Node 24.19.0, conforme à la version majeure ciblée par
  le dépôt.

## Preuves reproductibles acquises

| Contrôle | Résultat |
| --- | --- |
| Unités workspace | Vert : Bridge 59, Backend 197, MCP 43 et Web 413 tests, soit 712 au total. |
| Corrections sécurité ciblées | Vert : 103 tests backend sur usage, purge, uploads, auth, facturation et webhook; test déterministe de course symlink MCP vert. |
| Typage, lint et format | `pnpm test` et `pnpm run format:check` verts. |
| Build et CSP | Build Vite/prérendu vert; hashes des scripts inline recalculés et `security-headers-audit --build-only` vert. |
| Architecture | Contrat Cloud dans `@screenforge/project-format`; backend seul propriétaire des quotas/purges; UI via transport Cloud; aucun code de déploiement dans le bundle critique. |
| UI | Contraste, échelle sombre/claire et audit landing verts. |
| Dépendances | Registre npm interrogé : aucune vulnérabilité connue. |
| Secrets | Gitleaks 8.29.1 : 218 commits et environ 7,19 MB analysés, aucune fuite. |
| Déploiement production | L'audit prouve deux gates Convex stricts; `ready:false` bloque et les diagnostics sont expurgés. |
| Vercel préproduction | Appel anonyme observé : redirection SSO, `no-store`, `noindex` et refus de framing. Protection des forks active. |
| E2E release local | Vert sous Node 24 : 188 scénarios passent, dont 22 Cloud obligatoires. Un scénario local optionnel reste ignoré car il exige un vrai fichier Apple absent du dépôt. |

Le premier run E2E complet a trouvé une régression mémoire au téléversement de
16 Mio : le handler conservait plusieurs copies du fichier. La lecture bornée
utilise désormais le Blob natif et ne recrée qu'une fois le buffer inspecté. Le
test exact 16 Mio / 16 Mio + 1 octet passe isolément puis dans le gate complet.
Le second échec de ce premier run était un timeout de navigation; le scénario a
passé isolément puis dans le gate complet sans correction applicative.

## Audit sécurité approfondi

Le premier Deep Security Scan statique (`fdc7aecf-f5db-4e3f-8c7f-52a3784940df`)
a couvert 762 fichiers avec une couverture partielle et au moins 48 fichiers de
sécurité relus intégralement. Il n'a trouvé aucun niveau critique ou élevé; ses
huit findings moyens ont déclenché les corrections suivantes : lecture bornée
des uploads, barrière de génération autour de la purge, suppression protégée par
l'état Polar, limites distribuées auth/webhook, validation stricte du preflight,
et fermeture de la course symlink MCP. Les douze observations faibles restent
des pistes de durcissement proportionné, pas des blockers préproduction.

Un second scan du candidat corrigé a été scellé. Il n'a trouvé aucun niveau
critique ou élevé et ses huit observations moyennes ont été corrigées avec des
tests ciblés : admission auth avant écriture durable, nettoyage OAuth, cycle
checkout/suppression Polar, accès fichier MCP ancré sur descripteur, canary
Convex avant production, budget webhook après signature et inflation ZIP
bornée. Un troisième scan de confirmation a été annulé à la demande du
propriétaire parce que ses workers étaient disproportionnés; il ne constitue
donc aucune preuve et ne bloque pas la validation locale proportionnée restante.

## État fournisseur vérifié

- Polar Sandbox présente ScreenForge Cloud comme un abonnement annuel à
  39 USD. La description du checkout reprend les quatre quotas, précise que
  l'édition et les exports locaux restent disponibles sans abonnement, et
  annonce des taxes calculées au checkout. Une commande synthétique existante
  distingue bien sous-total, net, taxe et total. Aucun achat ni réglage n'a été
  créé ou modifié pendant cette vérification.
- Vercel Authentication protège les previews et l'accès anonyme vérifié. Un
  bypass d'automation sans consommateur dans les workflows, scripts ou sources
  versionnés a été révoqué avec l'accord du propriétaire; sa valeur n'a jamais
  été révélée.
- L'inventaire Vercel ne montre ni lien partageable, ni invité supplémentaire,
  ni exception de protection. Les requêtes `OPTIONS` ne contournent pas la
  protection. Un nouvel appel anonyme confirme la redirection d'authentification,
  `no-store`, `noindex` et le refus de framing.
- Trois exécutions du preflight de préproduction ont retourné `ready: true`, sans
  variable manquante ni incohérence. Les pics quotidiens de function calls,
  database I/O et data egress ont été relevés sans données utilisateur dans le
  document; la fenêtre de limites est désormais quotidienne.
- Convex impose un minimum fournisseur pour les limites de bande passante et le
  dashboard de ce déploiement Development désactive les contrôles de warning.
  Avec l'accord explicite du propriétaire, trois disables quotidiens calculés
  au-dessus du baseline sont actifs et bornent désormais la préproduction. Ils
  se réarment automatiquement à minuit UTC; les valeurs restent exclusivement
  dans Convex. Les warnings souples demeurent indisponibles pour ce type de
  déploiement et ne sont pas simulés dans la preuve.
- Resend présente plusieurs liens de connexion ScreenForge livrés, dont un sur
  le parcours de vérification courant. La preuve ne publie ni destinataire, ni
  identifiant de message, ni contenu du lien.
- GitHub possède une application OAuth dédiée à la préproduction, avec un seul
  callback Convex exact, sans wildcard ni device flow. Le parcours réel a
  demandé uniquement le profil et l'e-mail en lecture, puis a ouvert une session
  ScreenForge sur l'alias stable.
- Google possède un projet et un client Web dédiés à ScreenForge. L'application
  reste en mode Test avec un testeur autorisé; l'origine Vercel stable et le
  callback Convex exact sont enregistrés. Le parcours réel `openid profile
  email` a ouvert une session ScreenForge. La publication, le domaine vérifié
  et les pages légales restent volontairement un gate de production.
- Les quatre identifiants OAuth vivent uniquement dans le déploiement Convex.
  Le preflight versionné les exige désormais pour toute cible hébergée afin
  qu'aucun bouton social cassé ne puisse être déclaré prêt.

## Parcours hébergé restant avant GO production

1. Commiter et pousser, puis déployer exactement ce SHA par le chemin preprod.
2. Depuis deux navigateurs, rejouer entitlement, sync, usage, remise à zéro,
   conservation locale et consentement de rattachement. Google et GitHub sont
   déjà prouvés chacun de bout en bout sur un navigateur.
3. Vérifier History et la réactivation sans provoquer volontairement le seuil
   dur; réévaluer les warnings si le type de déploiement ou le plan change.
4. Nettoyer toutes les fixtures après le parcours hébergé final.

Le candidat n'est « GO production » qu'après ces contrôles. Leur absence ne
doit jamais être remplacée par une preuve simulée.
