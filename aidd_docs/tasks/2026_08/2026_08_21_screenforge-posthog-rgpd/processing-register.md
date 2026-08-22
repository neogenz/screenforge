# Registre de traitement PostHog — ScreenForge

État vérifié le 22 août 2026. Ce document ne contient ni secret, ni identité de membre, ni donnée
utilisateur.

## Traitement

| Champ | Décision ou état vérifié |
| --- | --- |
| Responsable | ScreenForge, opéré par neogenz |
| Sous-traitant | PostHog Cloud EU, projet ScreenForge `254685`, données hébergées en région EU |
| Finalités | Analytics produit et diagnostic technique, facultatifs et séparément consentis |
| Données | Événements fermés, performance, profil identifié par ID Convex avec propriété email, erreurs expurgées, logs structurés, replay masqué |
| Données exclues | Noms et contenu de projet, images, canvas, champs saisis, console brute, corps et en-têtes réseau |
| Base | Consentement révocable sur l’appareil ; le service reste complet sans télémétrie |
| Destinataires | Unique owner de l’organisation au jour du contrôle ; aucune invitation en attente |
| Transferts et garanties | Projet EU ; DPA PostHog signé le 22 août 2026 |
| Sous-traitants ultérieurs | Liste maintenue dans le [PostHog Trust Center](https://trust.posthog.com/) |

## Rétention réellement appliquée

| Catégorie | État |
| --- | --- |
| Événements, personnes et erreurs | Le plan Pay-as-you-go annonce 7 ans et n’expose pas de réduction par projet. L’objectif ScreenForge de 13 mois n’est donc pas appliqué. Décider avant lancement entre une organisation dédiée à rétention plus courte ou un accord PostHog spécifique. |
| Session replay | 30 jours, échantillonnage 20 %, texte et images entièrement masqués ; canvas, console et réseau désactivés |
| Logs | 30 jours pour les nouveaux logs ; expurgation PII activée ; capture automatique de la console désactivée |
| IP | Rejet de l’adresse IP activé au niveau du projet |

La [tarification PostHog](https://posthog.com/pricing) décrit la rétention de sept ans du plan
Pay-as-you-go et les durées propres aux logs. La durée présentée à l’utilisateur doit rester alignée
sur la configuration réellement applicable, pas sur l’objectif initial.

## Droits et effacement

Trois gestes restent distincts :

1. Modifier les préférences arrête les futures captures sur cet appareil ; cela n’efface pas
   l’historique déjà transmis.
2. Supprimer le compte Cloud efface l’identité et les données Convex, puis conserve un job durable
   jusqu’à l’acceptation de la suppression du profil, des événements et des replays PostHog.
3. Une demande manuelle arrive à `bonjour@screenforge.app`. L’opérateur vérifie l’identité par une
   session ScreenForge active ou un lien envoyé à l’adresse déjà enregistrée, retrouve l’ID Convex,
   puis contrôle l’égalité exacte du distinct ID PostHog. Il peut lancer l’action interne
   `posthog:deletePerson` depuis le déploiement Convex. Seuls la date, la référence interne de la
   demande et l’issue symbolique sont consignées ; jamais l’email, la clé ou le corps fournisseur.

Pour retrouver un compte sans dupliquer les bases : chercher la propriété email dans PostHog, lire
son distinct ID Convex, utiliser ce même ID comme `externalCustomerId` Polar et utiliser l’email
normalisé pour Resend. Une correspondance approximative ne déclenche aucune suppression.

PostHog documente la suppression d’une personne et de ses données associées dans sa
[documentation People](https://posthog.com/docs/data/persons). Une acceptation API met la suppression
des événements en file ; elle n’est pas présentée comme instantanée.

## Polar

La suppression ScreenForge ne promet pas d’effacer les pièces que Polar ou le responsable doivent
conserver pour une obligation comptable ou légale. La juridiction, la base précise et la durée
statutaire doivent être validées avec l’identité légale de l’exploitant avant lancement ; tant que ce
point manque, la politique publique ne donne pas de durée chiffrée.

## Blocages avant lancement

- choisir une solution réelle pour ramener événements/personnes/erreurs à 13 mois ou moins ;
- activer la 2FA du seul owner avant toute règle d’organisation qui pourrait le verrouiller dehors ;

Les deux clés personnelles sont séparées et limitées au projet ScreenForge : source maps dans
GitHub Actions (`error_tracking:write`) et effacement dans Convex préproduction et production
(`person:write`, niveau qui couvre la lecture préalable dans le sélecteur d’accès PostHog). La clé
d’effacement a été roulée le 22 août 2026 ; seule sa nouvelle valeur est configurée dans les deux
déploiements Convex.
