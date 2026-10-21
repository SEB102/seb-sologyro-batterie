# SEB-SOLOGYRO-BATTERIE

Le téléphone seul : il sert de baguette **et joue lui-même** les sons. Il apprend 4 gestes : coup **vers le bas** → **grosse caisse**, **vers le haut** → **cymbale**, **vers la droite** → **caisse claire**, **vers la gauche** → **« Oh ! »**. Pas d'ordinateur, pas de réseau : aucun retard dû au Wi-Fi.

Version « solo » de [SEB-GYROBATTERIE](https://github.com/SEB102/seb-gyrobatterie) (son sur l'ordinateur) et [SEB-MULTIGYRO-BATTERIE](https://github.com/SEB102/seb-multigyro-batterie) (plusieurs téléphones).

## Utilisation

Sur le téléphone (iPhone ou Android), ouvrir **https://seb102.github.io/seb-sologyro-batterie/**.

1. **Toucher pour démarrer** : un seul toucher active le son et les mouvements (iPhone : autoriser « Mouvement »).
2. La première fois : **apprentissage des 4 gestes** (10 coups de chacun, guidés par des bips ; voir « Les 4 gestes »).
3. Jouer. Ajouter la page à l'écran d'accueil pour l'avoir en un toucher (iPhone : Partager → « Sur l'écran d'accueil » ; Android : ⋮ → « Ajouter à l'écran d'accueil »).

- **Sensibilité** (0 à 100 %, **80 % par défaut**) : 100 % = le geste le plus léger suffit.
- **Réapprendre mes gestes** si on change franchement de prise en main ou de façon de jouer.
- **Écran noir verrouillé** : l'écran devient entièrement noir (presque aucune consommation sur un écran OLED) et ignore les touchers ; on continue de jouer. **Appui long de 2 s** pour revenir.
- **« Voulez-vous fermer l'onglet ? » quand on agite le téléphone** : c'est la fonction « Secouer pour annuler » de l'iPhone, qu'une page web ne peut pas bloquer. La couper : **Réglages → Accessibilité → Toucher → Secouer pour annuler**.
- **Son coupé par l'iPhone** (après un rechargement, un dialogue système ou un appel, l'iPhone peut mettre le son en pause sans le relancer) : l'app le relance à chaque toucher, et un **bandeau rouge** « Son coupé… touche l'écran » s'affiche tant qu'il reste coupé, même sur l'écran noir.
- L'écran reste allumé pendant le jeu (et le redemande si la page revient au premier plan) : un écran éteint suspendrait les mesures.
- iPhone : le son joue même bouton latéral sur silencieux (iOS 17 et plus) ; sur les versions plus anciennes, désactiver le mode silencieux.

## Envoyer le son vers un ordinateur ou une sono

- **Câble** (le plus direct, sans retard ajouté) : sortie casque du téléphone (ou adaptateur USB-C / Lightning → jack) vers l'entrée ligne de l'ordinateur, d'une carte son ou d'une table de mixage.
- **Bluetooth vers une enceinte** : possible mais ajoute 100 à 300 ms ; à éviter pour jouer en rythme. AirPlay vers un Mac ajoute plus encore (environ 2 s).
- **Pour que l'ordinateur joue lui-même les sons**, utiliser plutôt [SEB-GYROBATTERIE](https://seb102.github.io/seb-gyrobatterie/).

## Déclenchement précoce (toujours actif)

Le coup part **dès que le geste dépasse le seuil**, sans attendre le sommet du geste : environ **78 ms de gagnés** en moyenne (de 33 à 133 ms selon la vitesse du geste ; mesuré dans le navigateur à 60 mesures/s). Ce n'est plus une option : c'est le seul mode, depuis le 21/10/2026. La force du coup est estimée d'après la vitesse et son accélération à cet instant.

## Les 4 gestes (depuis le 21/10/2026)

Le téléphone apprend **4 gestes** : coup **vers le bas**, **vers le haut**, **vers la droite**, **vers la gauche** (grosse caisse, cymbale, caisse claire, « Oh ! »).

- **Apprentissage** (environ 1 min, au premier démarrage, puis bouton « Réapprendre mes gestes ») : 10 coups de chaque geste, guidés à l'écran et **au son** joués par le téléphone : 1 bip l'écoute commence · 2 bips geste enregistré · 3 bips montants terminé. Seuls les coups dans le sens du geste comptent : le retour du poignet n'est ni compté ni appris, et un coup qui déborde sur le geste suivant est ignoré. Les gestes appris restent dans le téléphone et servent aux trois apps (SEB-GYROBATTERIE, SEB-MULTIGYRO-BATTERIE, SEB-SOLOGYRO-BATTERIE).
- **Détection** : sur la vitesse de rotation de tous les axes ; le coup part dès que le seuil est franchi. Un coup est fini dès que la rotation retombe sous le tiers de son sommet (pause minimale 80 ms) ; le rebond du poignet, plus faible et en sens inverse, ne compte pas. Tous les coups détectés jusqu'à 6 par seconde, environ 97 % à 8 par seconde.
- **Reconnaissance** : la forme de la rotation et de l'accélération est comparée aux exemples appris (plus proches voisins, `gestes.js`). Le retour du poignet après un coup vers la droite est un mouvement vers la gauche : il joue le son de la gauche.
- **Attente avant de jouer** : le téléphone affiche la précision obtenue sur tes propres exemples pour 0, 30, 60 et 100 ms, choisit la plus courte qui atteint 95 %, et on peut changer (plus longue = mieux reconnu, mais le son arrive plus tard).
- **Prise en main** : garder la même qu'à l'apprentissage ; varier les coups pendant l'apprentissage (forts, doux, bras haut, bras bas) si on les varie en jouant.
- **Gyroscope obligatoire** : un téléphone sans gyroscope (accéléromètre seul, rare) ne peut plus jouer, l'écran le signale.
- Mesuré sur des gestes simulés : 97 % de gestes reconnus avec 30 ms d'attente ; apprentissage avec des retours aussi rapides que le coup : 40 exemples justes, retours tous écartés. Tests : `node test-gestes.js`.

Historique : jusqu'au 21/10/2026, une calibration de 4 coups (2 vers le haut, 2 vers le bas) apprenait le sens de rotation du poignet, pour 2 sons seulement (grosse caisse en bas, cymbale en haut). Les 4 gestes appris ont d'abord été essayés dans un prototype de SEB-SOLOGYRO-BATTERIE.

L'ancienne adresse du prototype (`gestes.html`) mène à l'app.

## Licence

SEB-SOLOGYRO-BATTERIE · Sébastien Gay · Octobre 2026 · [CC BY-NC 4.0](LICENSE) : partage et adaptation libres en citant l'auteur, sans usage commercial.

## Fichiers

- `index.html` : la page du téléphone (capteur, son, sensibilité, écran noir) · `gestes.html` : ancienne adresse du prototype, mène à l'app
- `gestes.js` : détection et reconnaissance des gestes · `apprentissage.js` : apprentissage guidé · `jeu-gestes.js` : écran du téléphone (apprentissage, attente, jeu), communs aux trois apps
- `detecteur.js` : réglage de sensibilité (et l'ancienne détection, gardée pour ses tests) · `sons.js` : sons synthétisés
- `test-gestes.js` : `node test-gestes.js` (10 tests : détection, reconnaissance, apprentissage) · `test.js` : `node test.js` (51 tests, ancienne détection et sons : détection, déclenchement précoce, sens 3D et baguette, calibration guidée, sens par rotation (dont vraies mesures d'iPhone), calibration dans 5 configurations de capteur, sons)
