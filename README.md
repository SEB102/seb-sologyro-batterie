# SEB-SOLOGYRO-BATTERIE

Le téléphone seul : il sert de baguette **et joue lui-même** les sons. Un coup sec **vers le sol** joue la **grosse caisse**, un coup **vers le plafond** la **cymbale**, quelle que soit la tenue du téléphone. Pas d'ordinateur, pas de réseau : aucun retard dû au Wi-Fi.

Version « solo » de [SEB-GYROBATTERIE](https://github.com/SEB102/seb-gyrobatterie) (son sur l'ordinateur) et [SEB-MULTIGYRO-BATTERIE](https://github.com/SEB102/seb-multigyro-batterie) (plusieurs téléphones).

## Utilisation

Sur le téléphone (iPhone ou Android), ouvrir **https://seb102.github.io/seb-sologyro-batterie/**.

1. **Toucher pour démarrer** : un seul toucher active le son et les mouvements (iPhone : autoriser « Mouvement »).
2. La première fois : **calibration guidée** : l'écran demande **2 coups secs vers le HAUT, puis 2 vers le BAS** (↑ ↑ ↓ ↓), après un court « Prépare-toi », en tenant le téléphone comme pour jouer. Comme l'app connaît le sens de chaque coup, elle trouve sans deviner quel axe du téléphone sert de baguette ; elle affiche ce qu'elle a compris (« baguette en travers du téléphone »…) et recommence si les 4 coups ne sont pas tous nets.
3. Jouer. Ajouter la page à l'écran d'accueil pour l'avoir en un toucher (iPhone : Partager → « Sur l'écran d'accueil » ; Android : ⋮ → « Ajouter à l'écran d'accueil »).

- **Sensibilité** (0 à 100 %, **80 % par défaut**) : 100 % = le geste le plus léger suffit.
- **Refaire la calibration** si on change franchement de prise en main (de petites variations ne gênent pas : testé jusqu'à 60° de rotation du téléphone dans la main et ±30° d'inclinaison).
- **Écran noir verrouillé** : l'écran devient entièrement noir (presque aucune consommation sur un écran OLED) et ignore les touchers ; on continue de jouer. **Appui long de 2 s** pour revenir.
- **« Voulez-vous fermer l'onglet ? » quand on agite le téléphone** : c'est la fonction « Secouer pour annuler » de l'iPhone, qu'une page web ne peut pas bloquer. La couper : **Réglages → Accessibilité → Toucher → Secouer pour annuler**.
- **Son coupé par l'iPhone** (après un rechargement, une recalibration, un dialogue système ou un appel, l'iPhone peut mettre le son en pause sans le relancer) : l'app le relance à chaque toucher, et un **bandeau rouge** « Son coupé… touche l'écran » s'affiche tant qu'il reste coupé, même sur l'écran noir.
- L'écran reste allumé pendant le jeu (et le redemande si la page revient au premier plan) : un écran éteint suspendrait les mesures.
- iPhone : le son joue même bouton latéral sur silencieux (iOS 17 et plus) ; sur les versions plus anciennes, désactiver le mode silencieux.

## Envoyer le son vers un ordinateur ou une sono

- **Câble** (le plus direct, sans retard ajouté) : sortie casque du téléphone (ou adaptateur USB-C / Lightning → jack) vers l'entrée ligne de l'ordinateur, d'une carte son ou d'une table de mixage.
- **Bluetooth vers une enceinte** : possible mais ajoute 100 à 300 ms ; à éviter pour jouer en rythme. AirPlay vers un Mac ajoute plus encore (environ 2 s).
- **Pour que l'ordinateur joue lui-même les sons**, utiliser plutôt [SEB-GYROBATTERIE](https://seb102.github.io/seb-gyrobatterie/).

## Déclenchement précoce (toujours actif)

Le coup part **dès que le geste dépasse le seuil**, sans attendre le sommet du geste : environ **78 ms de gagnés** en moyenne (de 33 à 133 ms selon la vitesse du geste ; mesuré dans le navigateur à 60 mesures/s). Ce n'est plus une option : c'est le seul mode, depuis le 21/10/2026. La force du coup est estimée d'après la vitesse et son accélération à cet instant.

## Grosse caisse en bas, cymbale en haut

Un coup **vers le bas** joue la grosse caisse, un coup **vers le haut** la cymbale. C'est le **sens de rotation du poignet** qui décide : un coup vers le bas plie toujours le poignet de la même façon, même bras levé. La calibration guidée (2 coups vers le haut, puis 2 vers le bas) apprend quel sens de rotation veut dire « bas » sur ce téléphone et avec cette tenue.

Historique : une version précédente déduisait le sens de la gravité et d'un axe « baguette » appris. Sur un iPhone tenu debout dans la main (enregistrement du 21/10/2026), cet axe était presque vertical et la décision basculait toute seule au moindre mouvement (« tout devient grosse caisse ou cymbale » au bout de 20 à 30 s). Le sens de rotation, lui, reste juste même quand la tenue varie : vérifié en simulation jusqu'à 60° de rotation du téléphone dans la main et ±45° d'inclinaison, en mode « sommet » et « précoce ».

## Prototype : 4 gestes (page à part)

**https://seb102.github.io/seb-sologyro-batterie/gestes.html** — le téléphone apprend 4 gestes et joue un son pour chacun : coup **vers le bas** → grosse caisse, **vers le haut** → cymbale, **vers la droite** → caisse claire, **vers la gauche** → « Oh ! » (la voix « Ho » de SEB-MULTIGYRO-BATTERIE). Le retour du poignet après un coup vers la droite joue donc « Oh ! » : droite-gauche enchaînés = caisse claire puis « Oh ! ». L'app principale n'est pas touchée. (Une première version à 4 gestes, avec « sur le côté » et « petit coup sec du poignet », a été abandonnée le 21/10/2026 : ces deux gestes n'étaient pas clairs à faire.)

- **Apprentissage** (~5 min) : 10 coups de chaque geste, guidés à l'écran **et au son** (1 bip : l'écoute commence · 2 bips : geste enregistré · 3 bips montants : terminé), pour jouer sans regarder l'écran. Le modèle reste dans le téléphone (bouton « Réapprendre mes gestes »).
- **Détection des coups rapides** : un coup est fini dès que la rotation retombe sous le tiers de son sommet (pause minimale 80 ms) ; le rebond du poignet, en sens inverse et plus faible (17 à 50 % du coup sur un vrai iPhone), ne compte pas. Tous les coups détectés jusqu'à 6 par seconde, environ 97 % à 8 par seconde.
- **Reconnaissance** : chaque coup est détecté sur la rotation de tous les axes, résumé (forme de la rotation et de l'accélération), puis comparé aux exemples (« plus proches voisins », `gestes.js`, sans bibliothèque).
- **Attente avant de jouer** : la page affiche la précision obtenue sur tes propres exemples pour 0, 30, 60 et 100 ms, choisit la plus courte qui atteint 95 %, et on peut changer.
- Mesuré sur des gestes simulés (50 tirages, 10 exemples par geste) : 92 % à 0 ms, 97 % à 30 ms, 99 % à 100 ms (avec 3 gestes : 97 / 99 / 99 %) ; jeu mélangé de 16 coups : au moins 15/16. Tests : `node test-gestes.js`.

## Licence

SEB-SOLOGYRO-BATTERIE · Sébastien Gay · Octobre 2026 · [CC BY-NC 4.0](LICENSE) : partage et adaptation libres en citant l'auteur, sans usage commercial.

## Fichiers

- `index.html` : la page du téléphone (capteur, calibration, détection, son, diagnostic)
- `detecteur.js` : détection des coups, calibration, sens 3D, sensibilité · `sons.js` : grosse caisse et cymbale synthétisées
- `test.js` : `node test.js` (50 tests : détection, déclenchement précoce, sens 3D et baguette, calibration guidée, sens par rotation (dont vraies mesures d'iPhone), calibration dans 5 configurations de capteur, sons)
