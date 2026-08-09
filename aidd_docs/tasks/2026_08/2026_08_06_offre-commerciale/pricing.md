---
objective: 'Fixer l’offre commerciale de ScreenForge : trois paliers, un prix, une marge démontrée sur les coûts fixes.'
status: draft
date: 2026-08-06
---

# Offre commerciale — ScreenForge

Ce document fixe les prix, prouve la marge, et nomme les deux seuils qui la
casseront si personne ne les surveille. Les chiffres de tarification
fournisseur sont datés d'août 2026 et sourcés en fin de document.

## 1. Le raisonnement, avant les chiffres

Trois faits contraignent l'offre. Ils passent avant toute comparaison de
concurrents.

**Le cœur du produit a un coût marginal nul.** Le canvas, le rendu et l'export
tournent entièrement dans le navigateur. Un utilisateur qui exporte cent
planches ne coûte pas un centime de plus qu'un utilisateur qui n'en exporte
aucune. Louer au mois un logiciel qui ne consomme rien se sent, et se paie en
churn.

**Le travail est épisodique.** Un développeur iOS indépendant refait ses
captures à chaque sortie — deux à six fois par an, pas tous les mois. Un
abonnement mensuel sur un travail épisodique produit le cycle : je m'abonne,
j'exporte, je résilie. Durée de vie médiane d'un tel abonnement : un à deux
mois. À 9,99 $/mois, cela donne un revenu par client d'environ 13 $ —
c'est-à-dire moins que l'ancien Lifetime à 39,99 $ censé être le lot de
consolation.

**Une seule chose a un coût récurrent : le stockage cloud des projets.** C'est
la seule fonction qui consomme du serveur tous les mois, et c'est donc la seule
qui justifie un paiement récurrent.

D'où la structure : **on achète le logiciel une fois, on s'abonne au service.**
La ligne locale / cloud n'est pas un artifice de packaging, c'est exactement la
ligne des coûts.

## 2. Les trois paliers

| | **Gratuit** | **Licence** | **Cloud** |
| --- | --- | --- | --- |
| Prix | 0 $ | **49 $ une fois** | **+ 39 $/an** (nécessite la Licence) |
| Éditeur complet | oui | oui | oui |
| Cadres iPhone, polices, dégradés | oui | oui | oui |
| Projets stockés en local (IndexedDB) | oui | oui | oui |
| Export | 3 par projet, filigrane | illimité, sans filigrane | illimité, sans filigrane |
| ZIP groupé App Store Connect | — | oui | oui |
| Mises à jour | oui | à vie | à vie |
| Compte | inutile | requis (porte la licence) | requis |
| Projets synchronisés, multi-appareil | — | — | oui |
| Sauvegarde hors navigateur | — | — | oui |

Trois décisions à défendre :

**Le Cloud exige la Licence.** Sans cette règle, un abonnement mensuel à 4 $
achète tout ce que la Licence à 49 $ achète : on s'abonne un mois, on exporte
tout, on résilie. La règle ferme la fuite et dit la vérité — le logiciel
s'achète, le service se loue.

**Le Cloud est annuel uniquement.** Les 0,40 $ de frais fixes du prestataire sur
un prélèvement de 4 $ représentent 10 % du montant ; sur un prélèvement annuel de
39 $, le même fixe tombe à 1 %. Un mensuel pourra s'ajouter plus tard, à 5 $/mois
et pas 4, pour absorber le fixe.

**L'ancien palier Mensuel à 9,99 $ disparaît.** Il cannibalisait la Licence
(rentable au bout de quatre mois, donc personne de rationnel ne prend le
mensuel) et il vendait de la location sur un produit à coût marginal nul.

## 3. Coûts fixes

Le SaaS porte sa propre infrastructure — l'abonnement Supabase déjà payé n'est
pas compté comme gratuit, sinon la marge affichée est fausse le jour où il faut
le renouveler pour le produit.

| Poste | Fournisseur | $/mois |
| --- | --- | --- |
| Postgres + Auth + Storage | Supabase Pro | 25,00 |
| API licences et webhooks | Railway ou Cloudflare Workers | 5,00 |
| Hébergement statique de la SPA | Cloudflare Pages | 0,00 |
| Domaine | ~15 $/an | 1,25 |
| E-mail transactionnel | Resend, palier gratuit (3 000/mois) | 0,00 |
| **Total** | | **31,25** |

**31,25 $/mois, soit 375 $/an.** C'est le seul chiffre que le prix doit couvrir.

Le palier gratuit de Supabase ne convient pas : il met le projet en pause après
sept jours sans activité. Un produit payant ne peut pas se réveiller froid le
jour où un client se connecte. 25 $ est donc un plancher, pas une option.

## 4. Coûts variables

**Stripe, compte français.** Cartes EEE 1,5 % + 0,25 € ; cartes hors EEE 3,25 %
+ 0,25 € ; conversion de devise + 2 % ; Stripe Tax + 0,5 % si activé.

**Supabase au-delà des quotas Pro.** Stockage 0,021 $/Go/mois au-delà de
100 Go ; egress 0,09 $/Go au-delà de 250 Go.

Coût marginal d'un utilisateur Cloud, hypothèse haute : un projet pèse ~30 Mo
(dix captures source plus le document JSON), lu une vingtaine de fois par mois,
soit ~600 Mo d'egress mensuel.

- Stockage : 100 Go inclus ÷ 30 Mo ≈ **3 300 utilisateurs** avant le premier
  centime de dépassement.
- Egress : 250 Go inclus ÷ 600 Mo ≈ **420 utilisateurs** avant dépassement,
  puis 0,09 $/Go × 0,6 Go = **0,054 $/utilisateur/mois**.

Soit une marge brute d'environ **98 %** sur l'add-on Cloud à 39 $/an. Le coût
variable n'est pas le sujet ; les coûts fixes le sont.

## 5. Revenu net et seuil de rentabilité

Les nets ci-dessous sont calculés au tarif du Merchant of Record recommandé au
§6.2 (Polar, 4 % + 0,40 $), et non au tarif Stripe : c'est le prestataire retenu,
donc c'est lui qui doit porter les chiffres de marge. Les comparer à Stripe est
le travail du §6.2, pas celui-ci.

| Vente | Frais | Net |
| --- | --- | --- |
| Licence, 49 $ | 2,36 $ | **46,64 $** |
| Cloud, 39 $/an | 1,96 $ | **37,04 $/an** |

**Seuil de rentabilité, deux façons de l'atteindre :**

- **9 licences par an** (375 $ ÷ 46,64 $ = 8,04, donc 9) couvrent la totalité de
  l'infrastructure. Huit laissent 1,88 $ à découvert : le seuil s'arrondit vers
  le haut, jamais vers le bas.
- ou **11 abonnés Cloud** (375 $ ÷ 37,04 $ = 10,12, donc 11).

Au-delà, chaque licence est ~46,64 $ de marge nette, chaque abonnement ~37 $.
Cinquante licences par an — un chiffre modeste pour un outil de niche — donnent
**1 957 $ de marge annuelle** après infrastructure.

Neuf ventes par an est un seuil bas au point d'être presque une non-contrainte :
c'est le résultat direct d'un produit dont le cœur ne consomme aucun serveur. La
question n'est pas de couvrir les coûts, elle est d'exister assez pour être
trouvé.

## 6. Les deux seuils qui cassent la marge

### 6.1 — Le seuil de TVA européen, et pourquoi 49 $ y survit

**Sous Merchant of Record, ce seuil n'est pas le nôtre.** Le prestataire est le
vendeur juridique : c'est lui qui franchit les seuils, s'enregistre à l'OSS et
reverse. C'est exactement ce que le §6.2 achète, et la raison de le choisir dès
la première vente plutôt qu'au moment où le seuil arrive.

**Sous Stripe direct, il l'est.** En dessous de 10 000 € de ventes B2C dans l'UE
hors France — soit ≈ 10 800 $, ≈ **220 licences** — un micro-entrepreneur en
franchise en base ne facture aucune TVA. Au-dessus, la TVA du pays de destination
s'applique et l'enregistrement OSS devient obligatoire.

**Le prix est construit pour survivre au franchissement.** 49 $ TTC amputés de
20 % de TVA font encore 40,83 $ HT ; à 19 % allemands, 41,18 $. Les deux restent
au-dessus des 39,99 $ bruts de l'ancien tarif. Aucun repricing ne sera nécessaire
le jour où le seuil tombe — c'est la raison chiffrée du 49, et elle ne dépend pas
de la monnaie choisie.

Second seuil à ne pas confondre : la franchise en base elle-même, à **37 500 €**
de chiffre d'affaires services en 2026, soit ≈ 40 500 $. Il arrive bien plus
tard.

### 6.2 — Le choix Stripe direct ou Merchant of Record

Un Merchant of Record devient le vendeur juridique : il collecte, déclare et
reverse la TVA à ta place, dans tous les pays.

Un point que le passage au dollar change, et qui n'apparaissait pas quand le prix
était en euros : **un compte Stripe français qui encaisse en dollars paie 2 % de
conversion de devise sur chaque vente**, en plus de sa commission. Ces 2 %
mangent presque tout l'écart qui rendait Stripe direct moins cher.

| Option | Frais sur 49 $ | Net | TVA |
| --- | --- | --- | --- |
| Stripe direct, carte EEE, + 2 % de conversion | 1,99 $ | 47,01 $ | à ta charge |
| Stripe + Stripe Tax (+ 0,5 %) | 2,24 $ | 46,76 $ | calculée, pas déclarée |
| Polar, 4 % + 0,40 $ | 2,36 $ | **46,64 $** | prise en charge |
| Paddle / Lemon Squeezy, 5 % + 0,50 $ | 2,95 $ | 46,05 $ | prise en charge |

**Recommandation : Merchant of Record dès le premier jour.** L'écart avec Stripe
direct est tombé à **0,37 $ par vente**, soit 37 $ pour cent ventes annuelles —
le prix d'un déjeuner, contre des déclarations OSS dans vingt-sept pays. Pour un
premier SaaS payant, ce n'est plus un arbitrage, c'est une évidence. À noter :
Lemon Squeezy appartient à Stripe depuis 2024, le choix n'est donc pas un pari
contre Stripe.

Ce choix se fait maintenant, pas au seuil : changer de prestataire de paiement
une fois les clients acquis coûte des licences à re-délivrer et des abonnements à
re-souscrire, ce qui vaut bien plus que les 37 $ économisés.

## 7. Positionnement prix

AppScreens, le concurrent direct nommé dans le brief produit, facture **99 $/an**
en formule Pro.

La Licence à 49 $ une fois, c'est **moins de six mois du concurrent, et elle ne se
renouvelle jamais**. C'est l'argument principal de la section tarifs : pas « moins
cher », mais « la dernière fois que vous payez ».

**Pourquoi le dollar et pas l'euro.** Trois raisons, dans l'ordre de poids.
L'acheteur est un développeur iOS : App Store Connect, les frais Apple et tout le
marché indépendant se comptent en dollars, y compris pour un acheteur français.
Le concurrent affiche 99 $ — dans la même monnaie, le comparatif sur trois ans se
lit sans note de conversion et sans taux qui pourrit. Enfin le Merchant of Record
recommandé au §6.2 règle en dollars ; facturer en euros ajouterait une conversion
à chaque vente, des deux côtés.

Le prix affiché est **toutes taxes comprises** : 49 $ est ce que le client paie,
où qu'il soit. C'est le prestataire qui absorbe l'écart de TVA d'un pays à
l'autre, pas l'acheteur — et le §6.1 montre que 49 $ survit au pire cas.

## 8. Ce qui n'est pas encore construit

L'offre décrite ici décrit des fonctions qui n'existent pas dans le code au
6 août 2026 : le filigrane et la limite de trois exports, les comptes, le
paiement, la synchronisation cloud. Voir
[`../2026_08_05_screenforge-saas/plan.md`](../2026_08_05_screenforge-saas/plan.md).

Conséquence directe sur la landing : **aucun bouton ne doit prétendre encaisser**
tant que le checkout n'existe pas. L'action réelle et disponible est « ouvrir
l'éditeur, gratuitement » ; les paliers payants annoncent leur ouverture et rien
d'autre. La mention doit vivre au niveau des boutons, pas en note de bas de
section, et **le citron va au bouton qui aboutit** — poser l'accent de la page
sur « être prévenu » braque trois mille pixels d'apprentissage sur une impasse.

Corollaire moins évident, découvert à l'audit : **la page ne doit pas décrire le
gratuit au futur comme s'il était le présent**. Elle annonçait « trois exports
filigranés » alors que l'éditeur livré n'a ni compteur ni filigrane — elle
décourageait la seule action qu'elle sait conclure, en énonçant une contrainte
fausse. Le comparatif décrit l'offre à l'ouverture ; une ligne sous le tableau et
la FAQ disent ce qui est vrai aujourd'hui.

Deux blocages restants avant d'encaisser, dans l'ordre :

1. **Mentions légales, CGV et politique de confidentialité.** La page collecte
   des adresses e-mail et annoncera des paiements. Aucune page légale n'existe :
   les liens morts ont été retirés plutôt que remplis d'un gabarit. Un studio ne
   peut pas ouvrir un dossier fournisseur avec un `mailto:` pour seule identité.
2. **L'interface de l'éditeur est uniquement en français.** La vitrine est
   bilingue et son unique action aboutie dépose un visiteur anglophone dans une
   UI qu'il n'a pas choisie. En attendant la traduction, la FAQ le dit dans les
   deux langues — c'est le minimum honnête, pas une solution.

## Sources

| Source | Vérifié |
| --- | --- |
| https://docs.stripe.com/payments/fees — tarifs FR : EEE 1,5 % + 0,25 €, hors EEE 3,25 % + 0,25 €, conversion + 2 % | 2026-08-06 |
| https://supabase.com/pricing — Pro 25 $/mois, 8 Go DB, 100 Go stockage, 250 Go egress, dépassements 0,021 $/Go et 0,09 $/Go | 2026-08-06 |
| https://appscreens.com/pricing — Pro 99 $/an | 2026-08-06 |
| Seuils TVA FR 2026 — franchise en base services 37 500 € ; seuil unique UE B2C 10 000 € puis OSS | 2026-08-06 |
| Frais Merchant of Record — Paddle et Lemon Squeezy 5 % + 0,50 $ ; Polar 4 % + 0,40 $ | 2026-08-06 |
