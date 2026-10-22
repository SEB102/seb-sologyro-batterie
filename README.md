# SEB-SOLOGYRO-BATTERIE

Le téléphone seul : il sert de baguette **et joue lui-même** les sons. Il reconnaît 3 gestes : coup **vers le bas** → **grosse caisse**, **vers le haut** → **cymbale**, **vers la gauche** → **caisse claire**. Pas d'ordinateur, pas de réseau : aucun retard dû au Wi-Fi.

Version « solo » de [SEB-GYROBATTERIE](https://github.com/SEB102/seb-gyrobatterie) (son sur l'ordinateur) et [SEB-MULTIGYRO-BATTERIE](https://github.com/SEB102/seb-multigyro-batterie) (plusieurs téléphones).

## Utilisation

Sur le téléphone (iPhone ou Android), ouvrir **https://seb102.github.io/seb-sologyro-batterie/**.

1. **Toucher pour démarrer** : un seul toucher active le son et les mouvements (iPhone : autoriser « Mouvement »).
2. **Rien à apprendre** : les 3 gestes sont fournis d'office. Pour les adapter à sa façon de jouer : « Réapprendre mes 3 gestes » (10 coups de chacun, guidés par des bips ; voir « Les 3 gestes »).
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

## Les 3 gestes (depuis le 22/10/2026 au soir)

Le téléphone apprend **3 gestes** : coup **vers le bas**, **vers le haut**, **vers la gauche** (grosse caisse, cymbale, caisse claire). Le coup vers la droite a été retiré : un mouvement vers la droite qui n'est pas le retour d'un coup vers la gauche sonne quand même, le plus souvent comme le geste « haut ».

- **3 gestes par défaut** : fournis d'office (`gestes-defaut.js` : 10 vrais coups de chaque, appris sur iPhone dans SOLO le 22/10/2026 à 19 h 46, aucun coup écarté ; ils se reconnaissent entre eux à 100 %), avec les réglages de cette séance : **attente 0 ms**, **sensibilité 80 %**. Ils s'appliquent dès l'ouverture, sans rien apprendre : les apprentissages faits avant (à 4 gestes) sont ignorés, et la sensibilité a été remise une fois à 80 % sur chaque téléphone. Ils valent pour cette prise en main ; une autre personne ou un téléphone tenu autrement devra réapprendre.
- **Réapprentissage** (environ 1 min, bouton « Réapprendre mes 3 gestes ») : 10 coups de chaque geste ; ils remplacent les exemples par défaut, guidés à l'écran et **au son** joués par le téléphone : 1 bip l'écoute commence · un petit bip aigu à chaque coup compté · 2 bips geste enregistré · 3 bips montants terminé. Le premier coup de chaque geste doit partir d'une position immobile : il fixe le sens du geste, et un mouvement d'installation juste après le départ ne doit pas servir de référence. Le vrai coup est nettement plus vif que l'élan qui le précède et que le retour (3 à 5 fois sur iPhone) : si un mouvement en sens inverse beaucoup plus fort arrive en début de geste, l'app comprend qu'elle avait pris l'élan pour le coup et repart de ce coup fort ; un mouvement beaucoup plus faible que les coups comptés est ignoré. Seuls les coups dans le sens du geste comptent : le retour du poignet n'est ni compté ni appris, et un coup qui déborde sur le geste suivant est ignoré. Les gestes appris restent dans le téléphone et servent aux trois apps (SEB-GYROBATTERIE, SEB-MULTIGYRO-BATTERIE, SEB-SOLOGYRO-BATTERIE).
- **Moment du son** (réglage sur le téléphone) : **au début du geste** (le plus rapide, par défaut) ou **à l'arrêt du geste** : le son part quand le geste s'arrête net, comme une baguette sur une peau (environ 0,17 s après le début du geste) ; un élan ou un retour, qui ralentit en douceur, ne sonne pas. Sur les vrais mouvements de l'iPhone : 85 % des coups gardés, environ 3 élans sur 10 et 1 retour sur 4 sonnent encore (au lieu de 3 sur 4 au début du geste). À comparer en jouant.
- **Détection** : sur la vitesse de rotation de tous les axes ; le coup part dès que le seuil est franchi. Un coup est fini dès que la rotation retombe sous le tiers de son sommet (pause minimale 80 ms) ; le rebond du poignet, plus faible et en sens inverse, ne compte pas. Un geste qui ralentit au milieu puis repart dans le même sens (à moins de 45°) sans retour du poignet entre les deux ne compte qu'une fois. Tous les coups détectés jusqu'à 6 par seconde, environ 97 % à 8 par seconde.
- **Reconnaissance** : la forme de la rotation et de l'accélération est comparée aux exemples appris (plus proches voisins, `gestes.js`). Le retour du poignet après un coup vers la gauche est un mouvement vers la droite, presque aussi vif que le coup : **après un coup vers la gauche, un mouvement en sens inverse dans les 0,6 s ne sonne pas** (retours mesurés sur iPhone de 0,13 à 0,73 s après le coup). Haut et bas ne sont pas concernés.
- **Attente avant de jouer** : le téléphone affiche la précision obtenue sur les exemples pour 0, 30, 60 et 100 ms ; 0 ms par défaut ; après un réapprentissage, il choisit la plus courte qui atteint 95 %, et on peut changer (plus longue = mieux reconnu, mais le son arrive plus tard).
- **Prise en main** : garder la même qu'à l'apprentissage ; varier les coups pendant l'apprentissage (forts, doux, bras haut, bras bas) si on les varie en jouant.
- **Gyroscope obligatoire** : un téléphone sans gyroscope (accéléromètre seul, rare) ne peut plus jouer, l'écran le signale.
- Mesuré sur des gestes simulés : apprentissage avec des retours aussi rapides que le coup, retours tous écartés ; 3 gestes joués à une seconde d'intervalle tous reconnus. Tests : `node test-gestes.js`.

Historique : jusqu'au 21/10/2026, une calibration de 4 coups (2 vers le haut, 2 vers le bas) apprenait le sens de rotation du poignet, pour 2 sons seulement (grosse caisse en bas, cymbale en haut). Les 4 gestes appris ont d'abord été essayés dans un prototype de SEB-SOLOGYRO-BATTERIE. Du 21/10 au 22/10/2026 au soir, 4 gestes (la droite jouait la caisse claire, la gauche « Oh ! »), appris avec 15 puis 50 coups, et un bouton « diagnostic » qui envoyait l'enregistrement de l'apprentissage et du jeu ; tous deux retirés.

L'ancienne adresse du prototype (`gestes.html`) mène à l'app.

## Licence

SEB-SOLOGYRO-BATTERIE · Sébastien Gay · Octobre 2026 · [CC BY-NC 4.0](LICENSE) : partage et adaptation libres en citant l'auteur, sans usage commercial.

## Fichiers

- `index.html` : la page du téléphone (capteur, son, sensibilité, écran noir) · `gestes.html` : ancienne adresse du prototype, mène à l'app
- `gestes.js` : détection et reconnaissance des gestes · `apprentissage.js` : apprentissage guidé · `jeu-gestes.js` : écran du téléphone (apprentissage, attente, jeu), communs aux trois apps
- `detecteur.js` : réglage de sensibilité (et l'ancienne détection, gardée pour ses tests) · `sons.js` : sons synthétisés
- `test-gestes.js` : `node test-gestes.js` (26 tests : détection, reconnaissance, apprentissage, écran du téléphone) · `test.js` : `node test.js` (51 tests, ancienne détection et sons : détection, déclenchement précoce, sens 3D et baguette, calibration guidée, sens par rotation (dont vraies mesures d'iPhone), calibration dans 5 configurations de capteur, sons)
