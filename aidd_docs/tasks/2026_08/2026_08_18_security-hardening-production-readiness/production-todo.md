# TODO production ScreenForge

Cette checklist ne contient volontairement ni valeur d’environnement, ni identifiant fournisseur, ni adresse personnelle. Elle reste inactive tant que le gate indiqué n’a pas été donné explicitement.

## Avant `GO DOMAIN`

- [ ] Fusionner uniquement un candidat dont Quality, la Preview Vercel, le gate release, Gitleaks, la review AIDD et le rescan sécurité sont verts sur le même SHA.
- [ ] Créer un ruleset GitHub `v*` réservé à la Release GitHub App, interdire mise à jour et suppression manuelles des tags, puis conserver l'approbation humaine de l'Environment `production` comme second verrou.
- [ ] Fermer ou accepter explicitement chaque finding de sécurité; aucun finding critique, élevé, secret exposé ou contournement d’entitlement ne peut être accepté.
- [ ] Terminer Polar Sandbox : achat, relivraison idempotente, annulation/échéance et restauration du droit propriétaire.
- [ ] Terminer le test Resend de préproduction et la synchronisation réelle projet, image et settings entre deux profils.
- [ ] Restaurer une sauvegarde Convex incluant les fichiers dans un déploiement jetable, comparer les compteurs attendus, puis supprimer uniquement la cible jetable.
- [ ] Confirmer le prix, la devise, la raison sociale, les mentions légales, la politique de confidentialité et les conditions de vente.

## Après `GO DOMAIN`

- [ ] Acheter le domaine retenu, vérifier sa propriété et choisir une origine HTTPS canonique unique.
- [ ] Attacher le domaine au projet Vercel, configurer les redirections canoniques et vérifier les headers de sécurité sur l’origine finale.
- [ ] Vérifier le domaine Resend avec SPF et DKIM, publier DMARC, choisir l’adresse d’envoi finale et tester délivrabilité, alignement et rebonds.
- [ ] Configurer les callbacks GitHub et Google exclusivement vers le déploiement Convex production et l’origine finale.
- [ ] Configurer Convex production avec les valeurs exactes de site, CORS, checkout, Auth, Resend, Polar et anti-abus; laisser absents le mot de passe de test et la règle Preview.
- [ ] Programmer les sauvegardes Convex, poser des limites d’usage/coût et vérifier la procédure documentée de restauration et de révocation des clés.
- [ ] Terminer KYC et compte bancaire Polar, puis créer un unique produit Cloud production distinct du Sandbox avec son token et son webhook signé.
- [ ] Se connecter une fois avec le compte propriétaire sur le domaine final et accorder le droit Cloud complémentaire par la mutation interne, sans rôle administrateur.
- [ ] Vérifier par noms et comportements qu’aucun secret, produit, webhook, compte de fixture ou identifiant Sandbox n’existe en production.

## Avant `GO PRODUCTION`

- [ ] Exécuter le preflight production expurgé et vérifier qu’il est vert avant et après le déploiement Convex candidat.
- [ ] Rejouer `pnpm run test:release`, Gitleaks sur tous les refs, l’audit de publication et le scan des artifacts sur le SHA exact de `main`.
- [ ] Vérifier Local depuis un clone neuf sans Convex : création, import, sauvegarde, export PNG/ZIP illimité et sans filigrane.
- [ ] Vérifier Cloud sur le domaine final : auth, checkout, entitlement, projet, image, settings, second profil, lecture après expiration et refus de write sans droit.
- [ ] Vérifier que la PR Release Please contient le changelog attendu et qu’aucun tag SemVer n’a été créé manuellement.
- [ ] Prendre une sauvegarde de référence et relever le déploiement Vercel précédent utilisable pour le rollback.

## Après `GO PRODUCTION`

- [ ] Fusionner la PR Release Please; laisser son tag canonique déclencher l’unique workflow production.
- [ ] Vérifier que le candidat Vercel est construit sans secrets de déploiement hors des étapes autorisées, sondé, puis promu seulement après le preflight Convex.
- [ ] Exécuter un smoke Local et Cloud, puis un paiement réel contrôlé uniquement avec une autorisation explicite au moment de l’action.
- [ ] Surveiller les webhooks Polar, les erreurs Convex, les limites d’usage, la délivrabilité Resend, les headers Vercel et les échecs de synchronisation pendant la fenêtre de lancement.
- [ ] Déclencher le rollback Vercel et la procédure backend documentée au premier échec bloquant; ne jamais corriger directement les données production sans sauvegarde et preuve.
- [ ] Révoquer ou rembourser la transaction de validation selon le scénario convenu et consigner uniquement une preuve expurgée.
