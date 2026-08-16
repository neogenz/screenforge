---
status: done
---

# Phase 4 — Vente Polar : checkout, portail, webhook

**But** : porter les trois routes de `apps/api/src/routes/billing.ts` sur Convex
sans réécrire la partie qui compte. La projection de l'état client Polar est le
code le plus subtil du backend ; elle a été écrite pure exprès, et elle migre
telle quelle.

## Ce qui est écarté d'emblée

`@convex-dev/polar` existe et ne convient pas : le composant est bâti pour les
abonnements récurrents. La Licence est un achat unique et perpétuel — c'est
précisément la distinction que le schéma d'origine défend (« Deux droits, pas un
plan »). L'adopter obligerait à représenter la Licence comme un abonnement, ce
que le dépôt a refusé une fois déjà, avec sa raison écrite.

On garde donc le webhook maison. Coût : rien de nouveau. `entitlements.ts` est
déjà déplacé par la phase 2 ; il reste à porter le transport.

## Tâches

### 4.1 Vérification de signature

Une `httpAction` ne peut pas être `"use node"`, et `validateEvent` du SDK Polar
l'exige. Deux voies, à trancher à l'écriture :

| Voie | Forme | Ce qu'elle coûte |
| ---- | ----- | ---------------- |
| **A** | `httpAction` lit `request.text()` + les trois en-têtes, puis `ctx.runAction(internal.polar.verify, …)` en `"use node"` | Un saut de plus, et une action Node qui démarre plus lentement qu'une fonction Convex |
| **B** | Vérifier Standard Webhooks directement en Web Crypto dans l'`httpAction` | ~20 lignes maison sur un chemin de sécurité, et un algorithme à tenir à jour soi-même |

**Recommandation : A.** La règle du dépôt sur les chemins sensibles est de ne pas
réimplémenter ce qu'un fournisseur expose déjà — c'est le même argument que celui
qui a fait choisir `customer.state_changed` plutôt qu'une machine à états maison.
Un saut de fonction est moins cher qu'une vérification HMAC dont personne ne
relira le code.

Dans les deux cas, le corps **brut** : « la signature porte sur les octets reçus,
et re-sérialiser un JSON ne redonne pas les mêmes ».

### 4.2 Le webhook

`httpAction POST /billing/webhook` :

1. Corps brut + `webhook-id`, `webhook-timestamp`, `webhook-signature`.
2. Vérification. Signature invalide → 403 `INVALID_SIGNATURE`.
3. Type inconnu mais signé → `{ ignored: true }` et journal. Un type inconnu ne
   deviendra jamais pertinent en le rejouant.
4. `customer.state_changed` dont le schéma dérive → **503**, pas 200. Le
   commentaire d'origine dit pourquoi et il reste vrai : un tel message porte
   potentiellement une révocation, et l'acquitter perdrait l'état payant. Le 503
   demande explicitement une nouvelle livraison.
5. `projectCustomerState` (inchangé) puis
   `internalMutation applyEntitlementsIfNewer` (phase 2), avec
   `event.timestamp` comme `sourceUpdatedAt` — « l'horodatage appartient au
   message signé par Polar », jamais à l'heure de réception.
6. `cloudRefusedWithoutLicence` → `console.warn`, et rien d'autre. Ni erreur ni
   silence : « les deux cas demandent un humain, aucun ne justifie de renvoyer
   une erreur à Polar. »

### 4.3 Checkout et portail

`action createCheckout({ product })`, `"use node"` :

1. `requireUser(ctx)`.
2. Compteur `checkout` (fenêtre fixe, 10/heure, par utilisateur). Chaque appel
   crée un objet chez un tiers ; aujourd'hui la route est authentifiée et
   illimitée.
3. Si `product === 'cloud'`, lire le miroir et refuser sans Licence. La règle est
   dite deux fois exprès — ici pour que l'utilisateur la lise **avant** de payer,
   et dans la projection parce qu'un achat créé hors de ce checkout contournerait
   celle-ci. Cette redondance-là est voulue et reste.
4. `externalCustomerId: userId` — c'est ce qui relie le client Polar au compte
   sans table de correspondance. **L'identifiant est désormais l'`Id<'users'>`
   Convex**, pas l'`uuid` Supabase ; l'instance de production étant vide, il n'y
   a aucun client existant à remapper.

`action createPortalSession()` : `requireUser`, même compteur, puis
`customerSessions.create({ externalCustomerId })`.

### 4.4 Ce qui disparaît

- **`GET /me`.** Il existait parce que `apps/api` avait « sa vue à elle, celle
  qui garde le checkout », distincte de la lecture directe du miroir par
  l'éditeur. Sous Convex, le checkout et la query de l'éditeur lisent le même
  module dans le même déploiement : la route ne garde plus rien.
- **La liste blanche CORS.** Elle protégeait un service qui recevait un jeton
  Supabase dans un en-tête. Les fonctions Convex sont authentifiées par le
  client ; seule l'`httpAction` du webhook reste exposée, et elle est gardée par
  une signature, pas par une origine.
- **`env.ts` et son schéma zod.** Les variables passent par
  `npx convex env set`, et une variable manquante fait échouer la fonction qui la
  lit. Ce qui se perd ici est réel et doit être remplacé : `env()` était appelé
  au boot « pour que le processus meure si une variable manque, plutôt que de
  répondre 200 à la sonde de santé et 500 au premier achat ». Le remplaçant est
  une `internalQuery healthcheck` qui vérifie la présence des cinq variables
  Polar, appelée par un test de déploiement et non par une sonde.

### 4.5 Côté web

`lib/api.ts` disparaît : `createCheckout` et `createPortalSession` deviennent des
appels Convex typés. `CheckoutOutcome` et ses quatre cas
(`licence-required`, `unauthenticated`, `failed`, `ok`) ne bougent pas — les
appelants les lisent.

`consumeCheckoutReturn` et son attente de dix essais restent : « Polar renvoie
l'acheteur immédiatement ; le webhook arrive par un autre chemin, quelques
secondes plus tard. » Rien dans la migration ne change ce délai.

## Critères d'acceptation

1. Les charges signées réelles conservées par `billing.webhook.test.ts` sont
   rejouées contre la nouvelle `httpAction` et produisent le même miroir.
2. Signature invalide → 403. Type inconnu signé → 200 `ignored`.
   `customer.state_changed` malformé → **503**.
3. Deux livraisons désordonnées du même client laissent la ligne sur le
   `sourceUpdatedAt` le plus récent.
4. Cloud accordé par Polar à un compte sans Licence : droit refusé, ligne écrite
   sans `cloudStatus`, avertissement journalisé, réponse 200.
5. `POST` checkout `cloud` sans Licence → refus avant tout appel à Polar.
6. Onzième checkout dans l'heure → refusé, message traduit.
7. Un achat réel en bac à sable ouvre le droit dans l'éditeur sans rechargement,
   via `consumeCheckoutReturn`.
8. `grep -rn "SUPABASE_SERVICE_ROLE_KEY" .` ne rend plus que `apps/api` et
   `.env.example`, tous deux supprimés en phase 6.

## Ce qui n'est pas fait ici

La suppression de compte, qui reste servie par `apps/api` jusqu'à la phase 5.

## Écarts constatés à l'implémentation (2026-08-11)

**1. La voie A est retenue, pour une raison plus étroite que celle écrite.**
Le tableau du §4.1 dit que `validateEvent` « exige Node ». Mesuré, c'est faux de
la vérification elle-même : `standardwebhooks` est du JavaScript pur — `TextEncoder`,
`fast-sha256`, `@stablelib/base64` — et tournerait dans le runtime Convex par
défaut. Ce qui exige Node est la première ligne de `validateEvent` :
`Buffer.from(secret, 'utf-8')`. La voie B a donc été rouverte, et refusée à
nouveau, mais sur un argument précis : appeler `standardwebhooks` directement
contourne aussi `parseEvent`, donc le `SDKValidationError` qui conserve le JSON
vérifié, donc la seule chose qui distingue « type que je ne connais pas » (200)
de « `customer.state_changed` que je n'ai pas su lire » (503). Cette distinction
est ce qui empêche d'acquitter une révocation illisible.

**2. Ce qui traverse la frontière est la décision, pas l'état.** Le §4.1
dessinait un `internal.polar.verify` qui rendrait l'événement vérifié. Il aurait
fallu déclarer `CustomerState` en validateurs Convex et convertir ses dates dans
les deux sens, pour que l'appelant refasse la projection que l'action venait de
faire. La vérification, la projection et l'écriture restent donc ensemble dans
l'action Node ; ce qui traverse est un union de six littéraux, et `billing.ts`
ne fait que le traduire en statuts.

**3. `applyEntitlementsIfNewer` prend une chaîne, pas un `Id<'users'>`.** La
phase 2 l'avait déclarée `v.id('users')`, ce qui était juste tant que l'appelant
était un test. Le webhook, lui, la nourrit avec l'`externalId` que Polar renvoie
— une chaîne venue du dehors. Un validateur d'`Id` la refuse en levant, donc en
500, donc en relivraison perpétuelle pour un client qui n'a de toute façon aucun
compte ici. Elle reconnaît l'identifiant (`normalizeId`) **puis relit le
document** : la première étape ne juge que la forme, et une ligne de droits
accrochée à un compte supprimé serait un orphelin qu'aucune lecture ne
rattraperait — c'est ce que la clé étrangère Postgres donnait gratuitement.

**4. `requireUser` accepte n'importe quel `ctx` porteur d'`auth`.** Il était
typé `QueryCtx` ; une action n'a pas de `db` à offrir. L'élargir à `{ auth }` est
ce qui permet au checkout de garder l'unique chemin d'identité au lieu d'en
écrire un second.

**5. Le refus du compteur est un cinquième cas de `CheckoutOutcome`.** Le
critère 6 demande un message traduit ; `RATE_LIMITED` replié sur `failed` aurait
affiché « réessayez » sans dire pourquoi. La lecture du code d'erreur est passée
de `lib/auth.ts` à `lib/convex.ts` du même coup, deux modules la faisant
désormais.

**6. `apps/api` perd la vente, `GET /me`, `polar.ts`, `mirror.ts` et
`entitlements.ts` — mais garde sa liste blanche CORS.** Le §4.4 la donne pour
disparue ; elle garde encore `DELETE /account`, servie là jusqu'à la phase 5. La
retirer maintenant casserait la seule route restante sans rien fermer. Les
variables Polar quittent en revanche `env.ts` et `.env.example` : elles se posent
par `convex env set`, et `billing.healthcheck` dit lesquelles manquent
(`convex run billing:healthcheck '{}'` → `[]`).

**7. Le critère 7 attend un humain.** Un achat réel en bac à sable demande un
compte Polar, ses produits et son jeton — c'est la seule chose de cette phase
qu'aucune implémentation ne peut se donner. `consumeCheckoutReturn` et son
attente sont intacts et lisent désormais Convex. Ce qui a pu être vérifié à la
place l'a été contre le **déploiement local réel**, pas seulement le simulateur :
signature fausse → 403, type inconnu → 200 `ignored`, compte inconnu → `ignored`,
octroi → `written`, rejeu → `unchanged`, livraison plus ancienne → `ignored`.
