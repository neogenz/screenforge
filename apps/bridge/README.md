# Pont local ScreenForge

Un petit processus qui tourne sur votre machine, écoute sur `127.0.0.1:4590` et
lance des binaires que vous avez déjà installés : `claude` pour rédiger, `asc`
pour publier.

Il est **optionnel**, et il l'est pour ses deux capacités. Sans lui, ScreenForge
compose vos campagnes avec son générateur local, qui ne parle à personne, et
publie en vous rendant un ZIP plus la commande `asc` à coller dans un terminal.
Le pont ne fait jamais rien que vous ne puissiez faire à la main.

## Deux capacités, deux jetons

| Capacité      | Ce qu'elle lance    | Ce qui la traverse                     |
| ------------- | ------------------- | -------------------------------------- |
| `assistant`   | `claude`            | des libellés, jamais une image         |
| `asc-publish` | `asc screenshots …` | les planches d'un lot figé, vers Apple |

Une capacité est nommée d'après ce qu'elle ouvre, pas d'après le binaire. Chaque
capacité a son jeton, tiré séparément et
révocable séparément. Recopier celui de l'assistance n'autorise pas à publier :
c'est le seul mécanisme qui rende ce refus effectif, et c'est pourquoi les deux
ne sont pas un seul secret.

## Démarrer

Depuis le dossier où vous avez cloné ScreenForge — `--filter` ne résout le
paquet `bridge` que dans cet espace de travail, et lancé ailleurs il répond
`No projects matched the filters`, ce qui ressemble à un pont cassé :

```bash
pnpm --filter bridge run start
```

Le pont affiche **deux** jetons. Copiez celui dont vous avez besoin :
« assistant » dans ScreenForge, section « Qui écrit les accroches » ;
« asc-publish » dans la boîte « Publier chez Apple ». Ils sont tirés au
démarrage et meurent avec le processus : au prochain lancement, il en faudra de
nouveaux.

Il liste aussi, au démarrage, les origines qu'il admet. **Comparez-les à
l'adresse de votre onglet** : une origine absente de cette liste reçoit un 403
sans en-tête CORS, le navigateur masque la réponse, et ScreenForge ne peut alors
rien dire de plus précis que « injoignable » — indiscernable, de son côté, d'un
port fermé. Par défaut ce sont les ports `5173` (`pnpm run dev`), `4173`
(`pnpm run preview`) et `5199` (Playwright), sur `localhost` et `127.0.0.1`.

Variables reconnues :

| Variable                     | Rôle                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| `SCREENFORGE_BRIDGE_ORIGINS` | Origines admises en plus des locales. Le joker est ignoré.     |
| `SCREENFORGE_CLAUDE_BIN`     | Chemin du binaire `claude` si `claude` n'est pas dans le PATH. |
| `SCREENFORGE_ASC_BIN`        | Chemin du binaire `asc` si `asc` n'est pas dans le PATH.       |

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

## Ce qui traverse pour publier

**Vers `asc`** : les PNG d'une release **déjà figée, rendue et rehachée**, écrits
dans un dossier temporaire privé (`0700`) que le pont crée puis supprime, quoi
qu'il arrive. Plus l'identifiant de localisation de version et le type
d'appareil, tels que vous les avez saisis.

**Jamais** : une clé d'API App Store Connect, un identifiant d'émetteur, un
fichier `.p8`. Le schéma de requête n'a aucun champ pour les recevoir, et zod
retire ce qu'il ne connaît pas. `asc` résout ses identifiants dans le trousseau
du système, comme lorsque vous le lancez vous-même.

**La commande** est construite comme un tableau d'arguments passé à `execFile` :
il n'y a pas de shell, donc pas d'expansion, pas de `;`, pas de substitution. Les
noms de fichiers sont validés avant écriture et ne peuvent contenir aucun
séparateur.

**`--replace` n'est jamais ajouté par défaut.** C'est le drapeau qui supprime les
captures déjà en ligne ; il n'apparaît dans la commande que si vous avez coché la
case qui le nomme.

**Après un délai dépassé, le pont ne rejoue rien.** Un téléversement qui n'a pas
rendu la main a peut-être abouti ; refaire l'envoi doublerait les captures chez
Apple. Le pont vous dit que le sort est inconnu et s'arrête là.

**La même demande n'est pas publiée deux fois.** La clé est
`release + destination + empreinte du lot + drapeaux` : refaire la même demande
au même endroit rend le résultat déjà obtenu, sans second téléversement. Les
drapeaux en font partie, sinon cocher « remplacer » après un ajout serait avalé
par le cache et rapporté en succès sans que rien ne soit remplacé. Un essai à
blanc n'est jamais mémorisé, et ne peut pas non plus lire l'entrée d'une vraie
publication. Cette mémoire est celle du processus : un pont redémarré
recommencera.

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
par le schéma. Claude Code est lancé dans un dossier temporaire, avec zéro outil
intégré (`--tools ""`), une configuration MCP vide et stricte, les commandes,
lectures, écritures, recherches et accès web également refusés nommément, aucun
plugin ni commande personnalisée, aucune persistance de session, un délai et
une sortie bornés. Codex n'est ni annoncé ni joignable : il ne reviendra que si
son protocole fournit une barrière no-tools équivalente et testable.

**Vos identifiants Apple.** Le pont ne les lit pas, ne les reçoit pas, ne les
transporte pas. `asc` les résout dans le trousseau du système, et ScreenForge
n'a aucun champ pour en saisir. La sortie de `asc` est relue avant de vous être
rendue : blocs PEM, JWT, chemins `.p8` et paires `clé=valeur` suspectes sont
remplacés par `[REDACTED]`, et les chemins personnels par `[REDACTED_PATH]`.

**Vos identifiants Claude.** Le pont ne les lit pas, ne les copie pas,
ne les stocke pas. Il lance le binaire que vous avez installé et connecté, et
celui-ci gère son authentification comme il le fait dans votre terminal. Ni
`~/.claude` n'est pas ouvert par ce code. Aucune clé d'API n'est
demandée, ni par le pont ni par ScreenForge — c'est pourquoi il n'y a rien à
chiffrer, rien à stocker et rien à faire fuiter. Le tour Claude Code tourne dans
un dossier temporaire, pour qu'aucun `CLAUDE.md` du disque ne soit découvert, et
avec l'outillage entièrement refusé.

**Le réseau local.** L'écoute est sur `127.0.0.1`, jamais `0.0.0.0`. Un pont qui
écouterait sur toutes les interfaces serait un service exposé au réseau, jeton
ou pas.

**Les journaux.** Le pont écrit les jetons sur sa propre sortie standard au
démarrage et à chaque révocation — c'est son seul canal pour vous les donner — et
rien d'autre. Aucun brief, aucun plan, aucune erreur Claude, aucune sortie `asc`
n'est journalisée.

### Ce qui n'est pas défendu

**Un autre processus de votre session utilisateur.** Il peut lire la mémoire du
pont, sa sortie standard, ou parler directement à `claude`. La frontière de
confiance du pont est votre compte utilisateur : il n'a jamais prétendu la
franchir.

**Une page servie en HTTPS.** Le navigateur refuse une requête en clair vers
`http://127.0.0.1` depuis une page `https://` (contenu mixte). Le pont est donc
utilisable depuis un ScreenForge servi en local, pas depuis un déploiement
public. Le rendre joignable de là demanderait un certificat de confiance locale,
qui n'est pas dans ce périmètre — et c'est la raison pour laquelle le chemin
recommandé dans l'application reste le générateur local.

**Ce qu'Apple fait du lot.** Le pont sait ce que `asc` lui rapporte, et rien de
plus. Un téléversement accepté n'est pas une fiche publiée : la soumission, la
revue et la mise en ligne restent entièrement chez Apple, et ScreenForge ne
prétend pas les piloter.

**Une confusion d'origine chez un client sans navigateur.** `curl` ne pose pas
d'`Origin` et le pont l'accepte, faute de pouvoir la vérifier. Seul le jeton le
protège alors, ce qui est exactement le niveau attendu pour un outil en ligne de
commande lancé par le propriétaire de la machine.
