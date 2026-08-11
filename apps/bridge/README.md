# Pont local ScreenForge

Un petit processus qui tourne sur votre machine, écoute sur `127.0.0.1:4590` et
sert d'intermédiaire entre ScreenForge et le Codex que vous avez déjà installé.

Il est **optionnel**. Sans lui, ScreenForge compose vos campagnes avec son
générateur local, qui ne parle à personne. Le pont ne sert qu'à une chose :
faire rédiger le plan par un modèle plutôt que par des règles.

## Démarrer

```bash
pnpm --filter bridge run start
```

Le pont affiche un jeton d'appairage. Copiez-le dans ScreenForge, section
« Assistance ». Il est tiré au démarrage et meurt avec le processus : au
prochain lancement, il en faudra un nouveau.

Variables reconnues :

| Variable                     | Rôle                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| `SCREENFORGE_BRIDGE_ORIGINS` | Origines admises en plus des locales. Le joker est ignoré.   |
| `SCREENFORGE_CODEX_BIN`      | Chemin du binaire `codex` si `codex` n'est pas dans le PATH. |

## Ce qui traverse le pont

**Vers le modèle** : le nom de l'application, sa phrase de présentation, la
direction visuelle choisie, le modèle d'appareil, et la liste des **libellés**
de vos écrans.

**Jamais** : vos captures d'écran, votre logo, aucune image, aucun fichier de
projet, aucun chemin de disque, aucun contenu de calque autre que ces libellés.
Le schéma de requête (`briefSchema`) ne comporte pas de champ pour une image, et
zod retire les champs qu'il ne connaît pas — un appelant qui joindrait une image
verrait le pont la jeter avant d'écrire quoi que ce soit sur stdin.

**Ce que le modèle rend** : un plan JSON contraint par un schéma, revalidé à
l'arrivée, puis exécuté par le constructeur déterministe de ScreenForge. Le
modèle ne pose aucun calque lui-même : il propose un plan, l'éditeur le
construit avec ses propres outils bornés.

## Modèle de menace

Ce qui est défendu, et comment.

**Une autre page ouverte dans le navigateur.** C'est la menace principale : un
service local en HTTP est joignable par n'importe quel onglet. Deux barrières,
et il faut les deux. L'`Origin` de la requête doit figurer dans une allowlist
close — le joker est explicitement retiré, même passé par l'environnement. Et
chaque route utile exige le jeton d'appairage, qu'une page tierce n'a aucun
moyen de lire : il n'est ni dans un fichier, ni dans un cookie, ni dans un
`localStorage` accessible à une autre origine.

**Un jeton qui a fuité** (capture d'écran, historique de terminal, épaule).
`POST /pair/revoke` en tire un nouveau et incrémente la version : l'ancien est
mort à l'instant, sans redémarrage. La version est annoncée par `GET /hello`,
donc une page appairée avec un jeton révoqué le voit et le dit.

**Le pont lui-même comme surface d'exécution.** Il n'expose pas de shell, pas de
proxy de requêtes arbitraires, pas de lecture de fichiers. Trois RPC typées, et
le seul texte libre qui atteint le modèle est celui du brief, borné en longueur
par le schéma. Le tour Codex tourne en `sandbox: read-only` avec
`approvalPolicy: never` : ni écriture ni commande ne sont possibles, et rien ne
peut rester suspendu à attendre une approbation que le pont ne saurait donner.

**Vos identifiants Codex.** Le pont ne les lit pas, ne les copie pas, ne les
stocke pas. Il lance le binaire `codex` que vous avez installé et connecté, et
Codex gère son authentification comme il le fait dans votre terminal. Aucun
`~/.codex` n'est ouvert par ce code. Aucune clé d'API n'est demandée, ni par le
pont ni par ScreenForge — c'est pourquoi il n'y a rien à chiffrer, rien à
stocker et rien à faire fuiter.

**Le réseau local.** L'écoute est sur `127.0.0.1`, jamais `0.0.0.0`. Un pont qui
écouterait sur toutes les interfaces serait un service exposé au réseau, jeton
ou pas.

**Les journaux.** Le pont écrit le jeton sur sa propre sortie standard au
démarrage et à chaque révocation — c'est son seul canal pour vous le donner — et
rien d'autre. Aucun brief, aucun plan, aucune erreur Codex n'est journalisée.

### Ce qui n'est pas défendu

**Un autre processus de votre session utilisateur.** Il peut lire la mémoire du
pont, sa sortie standard, ou parler directement à `codex`. La frontière de
confiance du pont est votre compte utilisateur : il n'a jamais prétendu la
franchir.

**Une page servie en HTTPS.** Le navigateur refuse une requête en clair vers
`http://127.0.0.1` depuis une page `https://` (contenu mixte). Le pont est donc
utilisable depuis un ScreenForge servi en local, pas depuis un déploiement
public. Le rendre joignable de là demanderait un certificat de confiance locale,
qui n'est pas dans ce périmètre — et c'est la raison pour laquelle le chemin
recommandé dans l'application reste le générateur local.

**Une confusion d'origine chez un client sans navigateur.** `curl` ne pose pas
d'`Origin` et le pont l'accepte, faute de pouvoir la vérifier. Seul le jeton le
protège alors, ce qui est exactement le niveau attendu pour un outil en ligne de
commande lancé par le propriétaire de la machine.
