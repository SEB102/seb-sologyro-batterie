# SEB-SOLOGYRO-BATTERIE

Le téléphone seul : il sert de baguette **et joue lui-même** les sons. Un coup sec **vers le sol** joue la **grosse caisse**, un coup **vers le plafond** la **cymbale**, quelle que soit la tenue du téléphone. Pas d'ordinateur, pas de réseau : aucun retard dû au Wi-Fi.

Version « solo » de [SEB-GYROBATTERIE](https://github.com/SEB102/seb-gyrobatterie) (son sur l'ordinateur) et [SEB-MULTIGYRO-BATTERIE](https://github.com/SEB102/seb-multigyro-batterie) (plusieurs téléphones).

## Utilisation

Sur le téléphone (iPhone ou Android), ouvrir **https://seb102.github.io/seb-sologyro-batterie/**.

1. **Toucher pour démarrer** : un seul toucher active le son et les mouvements (iPhone : autoriser « Mouvement »).
2. La première fois : **donner 3 coups secs**, comme avec une baguette, dans n'importe quel sens (calibration). Chaque coup reconnu s'affiche (● ○ ○), et c'est fini dès le 3e (la page apprend quel axe du capteur bouge et la force d'un coup normal).
3. Jouer. Ajouter la page à l'écran d'accueil pour l'avoir en un toucher (iPhone : Partager → « Sur l'écran d'accueil » ; Android : ⋮ → « Ajouter à l'écran d'accueil »).

- **Sensibilité** (0 à 100 %) : 100 % = le geste le plus léger suffit.
- **Refaire la calibration** si on change de prise en main.
- iPhone : le son joue même bouton latéral sur silencieux (iOS 17 et plus) ; sur les versions plus anciennes, désactiver le mode silencieux.

## Diagnostic de latence

Sous les réglages, la page affiche :
- **Capteur** : nombre de mesures par seconde que le navigateur fournit (souvent 60 ; moins sur certains téléphones ou en mode économie d'énergie).
- **Détection** : retard dû à l'attente du sommet du geste (environ 1,5 mesure).
- **Sortie son** : retard annoncé par le téléphone entre le déclenchement et le haut-parleur.

## Envoyer le son vers un ordinateur ou une sono

- **Câble** (le plus direct, sans retard ajouté) : sortie casque du téléphone (ou adaptateur USB-C / Lightning → jack) vers l'entrée ligne de l'ordinateur, d'une carte son ou d'une table de mixage.
- **Bluetooth vers une enceinte** : possible mais ajoute 100 à 300 ms ; à éviter pour jouer en rythme. AirPlay vers un Mac ajoute plus encore (environ 2 s).
- **Pour que l'ordinateur joue lui-même les sons**, utiliser plutôt [SEB-GYROBATTERIE](https://seb102.github.io/seb-gyrobatterie/).

## Déclenchement précoce

Case à cocher sur le téléphone : le coup part **dès que le geste dépasse le seuil**, au lieu d'attendre le sommet du geste. La force du coup est alors estimée d'après la vitesse et son accélération à cet instant (un peu moins fidèle). Le téléphone mesure à chaque coup le temps gagné et affiche la moyenne.

Mesures (navigateur, gestes simulés à 60 mesures/s) : environ **78 ms de gagnés** en moyenne (de 33 à 133 ms selon la vitesse du geste ; plus le geste est lent, plus le gain est grand). Désactivée par défaut : le mode « sommet » reste inchangé.

## Grosse caisse en bas, cymbale en haut (3D)

C'est le **sens du coup dans la pièce** qui décide : un coup qui part **vers le sol** joue la grosse caisse, un coup **vers le plafond** la cymbale, quelle que soit la façon de tenir le téléphone (bras levé et téléphone pointé vers le haut, un coup vers le bas reste une grosse caisse). Le téléphone projette sa propre accélération sur la direction de la gravité et en déduit la vitesse verticale du geste (`creerVerticale` dans `detecteur.js`) ; le moment du coup reste donné par le gyroscope. Testé dans 7 inclinaisons du téléphone, avec les deux conventions de signe des navigateurs, et sur les téléphones sans mesure d'accélération « sans gravité ».

**Le bout de la « baguette ».** Mesurer seulement le mouvement du téléphone ne suffit pas : quand le bras tourne vite, le téléphone est tiré vers le coude (effet « manège »), ce qui faisait lire « vers le bas » un coup vers le haut donné bras levé (constaté sur iPhone le 21/10/2026). La calibration apprend donc aussi **quel axe du téléphone sert de baguette** (celui dont la rotation produit le mouvement le plus vertical : le long du téléphone s'il est tenu comme une baguette, en travers s'il est tenu debout dans le poing). À chaque coup, le sens vient de la vitesse du bout de cette baguette : instantané, sans dérive. Une calibration faite avant cette correction est refaite automatiquement une fois. Vérifié sur de vraies mesures d'iPhone (`mesures-iphone.json`) : 24 coups sur 25 dans le sens du geste, contre presque tous en grosse caisse avant.

## Licence

SEB-SOLOGYRO-BATTERIE · Sébastien Gay · Octobre 2026 · [CC BY-NC 4.0](LICENSE) : partage et adaptation libres en citant l'auteur, sans usage commercial.

## Fichiers

- `index.html` : la page du téléphone (capteur, calibration, détection, son, diagnostic)
- `detecteur.js` : détection des coups, calibration, sens 3D, sensibilité · `sons.js` : grosse caisse et cymbale synthétisées
- `test.js` : `node test.js` (42 tests : détection, déclenchement précoce, sens 3D et baguette (dont vraies mesures d'iPhone), calibration dans 5 configurations de capteur, sons)
