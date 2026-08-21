---
status: in-progress
---

# Vérification du candidat préproduction

Ce document sépare les preuves reproductibles du dépôt des contrôles qui exigent
encore le déploiement ou l'autorité du propriétaire. Il ne contient ni identifiant
fournisseur, ni consommation réelle, ni secret, ni URL de contournement.

## Candidat local

- Base vérifiée : `origin/main` à `07f622212df447172fa7217b06879ed43e1860fd`.
- Branche : `codex/preprod-security-ux-plan`.
- SHA candidat : à reporter depuis le commit poussé avant tout déploiement. Aucune
  preuve hébergée n'est attribuée au worktree non commité.
- Runtime de validation : Node 24.19.0, conforme à la version majeure ciblée par
  le dépôt.

## Preuves reproductibles acquises

| Contrôle | Résultat |
| --- | --- |
| Unités workspace | Vert : Bridge 59, Backend 193, MCP 43 et Web 413 tests, soit 708 au total. |
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

## État fournisseur constaté sans mutation

- Vercel Authentication protège les previews et l'accès anonyme vérifié. Un
  bypass d'automation borné existe au niveau projet; son propriétaire et son
  consommateur doivent être confirmés avant toute révocation.
- Aucun share link exposé n'a été observé dans la configuration projet filtrée;
  la liste exhaustive des invités et exceptions reste à confirmer dans le
  tableau de bord.
- Aucun seuil Convex n'a été modifié : le worktree ne dispose ni de la clé du
  déploiement préproduction ni d'une commande CLI exposant les Usage Limits.
  Les warnings et le baseline de trois gates restent donc non prouvés; le hard
  disable demeure volontairement inactif jusqu'au choix du budget utilisateur.
- La session Polar Sandbox et Resend n'était pas disponible. Le produit annuel,
  la fiscalité visible, la description du checkout et l'envoi réel ne sont pas
  déclarés conformes sans preuve.

## Parcours hébergé restant avant GO production

1. Commiter et pousser, puis déployer exactement ce SHA par le chemin preprod.
2. Vérifier Polar Sandbox à 39 USD/an, taxes affichées et résumé des quatre
   quotas; nettoyer la fixture sans achat réel.
3. Depuis deux navigateurs, prouver inscription, entitlement, sync, usage,
   remise à zéro, conservation locale et consentement de rattachement.
4. Exécuter trois gates synthétiques, relever calls/I/O/egress dans Convex,
   activer uniquement les warnings calculés par le runbook et vérifier la
   notification; ne pas activer le disable.
5. Confirmer invités, exceptions et consommateur du bypass Vercel, puis révoquer
   seulement les accès démontrés inutiles.

Le candidat n'est « GO production » qu'après ces contrôles. Leur absence ne
doit jamais être remplacée par une preuve simulée.
