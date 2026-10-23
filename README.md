# SEB-SOLOGYRO-BATTERIE

Le téléphone seul : il sert de baguette **et joue lui-même** les sons. Il reconnaît 3 gestes : coup **vers le bas** → **grosse caisse**, **vers le haut** → **cymbale**, **vers la gauche** → **caisse claire** (par défaut ; le son de chaque geste se choisit sur la page). Pas d'ordinateur, pas de réseau : aucun retard dû au Wi-Fi.

Version « solo » de [SEB-GYROBATTERIE](https://github.com/SEB102/seb-gyrobatterie) (son sur l'ordinateur) et [SEB-MULTIGYRO-BATTERIE](https://github.com/SEB102/seb-multigyro-batterie) (plusieurs téléphones).

## Utilisation

Sur le téléphone (iPhone ou Android), ouvrir **https://seb102.github.io/seb-sologyro-batterie/**.

1. **Toucher pour démarrer** : un seul toucher active le son et les mouvements (iPhone : autoriser « Mouvement »).
2. **Rien à apprendre** : les 3 gestes sont fournis d'office (vrais coups enregistrés). Les boutons **Apprentissage** (10 coups de chaque geste, ajoutés aux exemples, guidés par des bips joués par le téléphone) et **Envoyer l'enregistrement** (dernière minute et demie de jeu, pour un diagnostic) sont masqués : ajouter `?reglages` à l'adresse de la page du téléphone pour les afficher. Voir « Les 3 gestes » et « Le modèle en un tableau ».
3. Jouer. Ajouter la page à l'écran d'accueil pour l'avoir en un toucher (iPhone : Partager → « Sur l'écran d'accueil » ; Android : ⋮ → « Ajouter à l'écran d'accueil »).

- **Droitière / Droitier · Gauchère / Gaucher** (bouton sur le téléphone, droitière/droitier par défaut, gardé dans le téléphone) : en gauchère/gaucher, le téléphone est dans la main gauche, tenu en miroir de la main droite (écran vers la paume, haut du téléphone du même côté ; c'est donc l'autre grand côté qui est en bas). Haut et bas ne changent pas, le coup latéral part **vers la droite**. Rien à réapprendre : les mouvements sont ramenés à ceux de la main droite (image dans un miroir), et les mêmes exemples servent. Un apprentissage fait d'une main sert aussi pour l'autre. Sans ce réglage, un téléphone tenu en miroir échangerait haut et bas.
- **Son de chaque geste** : un menu par geste, au choix parmi grosse caisse, cymbale, caisse claire et Wobble « Ho » (fermé) ; le même son peut servir à plusieurs gestes. Le choix est gardé dès qu'on le change (dans le téléphone) et on entend le son choisi.
- **Sensibilité** (0 à 100 %, **80 % par défaut**) : 100 % = le geste le plus léger suffit.
- **Apprentissage** (bouton masqué, `?reglages`) si les coups sont mal reconnus, en jouant les coups comme en jeu (y compris enchaînés) : chaque apprentissage s'ajoute aux précédents.
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

- **3 gestes par défaut** : fournis d'office (`gestes-defaut.js` : 20 vrais coups de chaque, réunis de deux apprentissages sur iPhone dans SOLO, le 22/10/2026 à 19 h 46, sensibilité 88 %, et le 23/10/2026 à 5 h 53, sensibilité 80 % ; ils se reconnaissent entre eux à 100 %). Réunis, ils reconnaissent mieux les coups joués en enchaînement que chacun séparément (jeux réels du 23/10 rejoués : 75 coups justes sur 81 et 40 sur 43, contre 70 et 38 au mieux). Réglages par défaut : attente 0 ms, sensibilité 80 %. Ils valent pour cette prise en main ; une autre personne ou un téléphone tenu autrement devra faire un apprentissage.
- **Apprentissage** (environ 1 min, bouton « Apprentissage », masqué : ajouter `?reglages` à l'adresse) : 10 coups de chaque geste, **ajoutés** aux exemples par défaut et aux apprentissages précédents (au plus 50 coups appris par geste, les plus récents ; en droitière/droitier comme en gauchère/gaucher), guidés à l'écran et **au son** joués par le téléphone : 1 bip l'écoute commence · un petit bip aigu à chaque coup compté · 2 bips geste enregistré · 3 bips montants terminé. Le premier coup de chaque geste doit partir d'une position immobile : il fixe le sens du geste, et un mouvement d'installation juste après le départ ne doit pas servir de référence. Le vrai coup est nettement plus vif que l'élan qui le précède et que le retour (3 à 5 fois sur iPhone) : si un mouvement en sens inverse beaucoup plus fort arrive en début de geste, l'app comprend qu'elle avait pris l'élan pour le coup et repart de ce coup fort ; un mouvement beaucoup plus faible que les coups comptés est ignoré. Seuls les coups dans le sens du geste comptent : le retour du poignet n'est ni compté ni appris, et un coup qui déborde sur le geste suivant est ignoré. Les gestes appris restent dans le téléphone et servent aux trois apps (SEB-GYROBATTERIE, SEB-MULTIGYRO-BATTERIE, SEB-SOLOGYRO-BATTERIE).
- **Moment du son** (réglage sur le téléphone) : **au début du geste** (le plus rapide, par défaut) ou **à l'arrêt du geste** : le son part quand le geste s'arrête net, comme une baguette sur une peau (environ 0,17 s après le début du geste) ; un élan ou un retour, qui ralentit en douceur, ne sonne pas. Sur les vrais mouvements de l'iPhone : 85 % des coups gardés, environ 3 élans sur 10 et 1 retour sur 4 sonnent encore (au lieu de 3 sur 4 au début du geste). À comparer en jouant.
- **Détection** : sur la vitesse de rotation de tous les axes ; le coup part dès que le seuil est franchi. Un coup est fini dès que la rotation retombe sous le tiers de son sommet (pause minimale 80 ms) ; le rebond du poignet, plus faible et en sens inverse, ne compte pas. Un geste qui ralentit au milieu puis repart dans le même sens (à moins de 45°) sans retour du poignet entre les deux ne compte qu'une fois. Tous les coups détectés jusqu'à 6 par seconde, environ 97 % à 8 par seconde.
- **Reconnaissance** : la forme de la rotation et de l'accélération est comparée aux exemples appris (plus proches voisins, `gestes.js`). Le retour du poignet après un coup vers la gauche est un mouvement vers la droite, presque aussi vif que le coup : **après un coup vers la gauche, un mouvement en sens inverse dans les 0,6 s ne sonne pas** (retours mesurés sur iPhone de 0,13 à 0,73 s après le coup). Haut et bas ne sont pas concernés.
- **Attente avant de jouer** : réglée d'office, plus de choix à l'écran : 0 ms par défaut ; après un réapprentissage, la plus courte qui reconnaît au moins 95 % des exemples.
- **Prise en main** : garder la même qu'à l'apprentissage ; varier les coups pendant l'apprentissage (forts, doux, bras haut, bras bas) si on les varie en jouant.
- **Gyroscope obligatoire** : un téléphone sans gyroscope (accéléromètre seul, rare) ne peut plus jouer, l'écran le signale.
- Mesuré sur des gestes simulés : apprentissage avec des retours aussi rapides que le coup, retours tous écartés ; 3 gestes joués à une seconde d'intervalle tous reconnus. Tests : `node test-gestes.js`.

## Le modèle en un tableau (pour le reproduire)

Le téléphone ne « voit » que deux choses, environ 60 fois par seconde (événement `devicemotion` du navigateur) : sa **vitesse de rotation** r = (α, β, γ) en °/s autour de ses trois axes, et son **accélération** a = (x, y, z) en m/s², pesanteur retirée. Tout le reste en découle. Les règles s'appliquent dans l'ordre du tableau, à chaque mesure. Notations : v = |r| (vitesse de rotation totale) ; t = instant où un coup part ; « sens » d'un mouvement = rotation additionnée sur ses 80 premières ms ; cos = cosinus de l'angle entre deux sens (1 : même direction, 0 : perpendiculaires, −1 : opposés).

| # | Étape | Règle | Valeurs | Pourquoi |
|---|---|---|---|---|
| 1 | Main | Gauchère/gaucher : chaque mesure est ramenée à celle d'un droitier avant tout le reste : (α, β, γ) → (α, −β, −γ) et (x, y, z) → (−x, y, z). | Téléphone tenu en miroir : écran vers la paume, haut du téléphone du même côté (donc l'autre grand côté en bas). | Les mouvements d'une main gauche sont l'image dans un miroir de ceux d'une main droite ; les mêmes exemples servent aux deux. |
| 2 | Départ d'un coup | Un coup **part** dès que v dépasse le seuil. | Seuil = 600 − 4,8 × sensibilité (%) °/s ; 80 % (défaut) → 216 °/s ; 0 % → 600, 100 % → 120. | Partir dès le seuil, sans attendre le sommet : environ 78 ms gagnées. |
| 3 | Fin d'un coup | Le coup est **fini** quand v retombe sous 1/3 de son sommet (ou sous 80 °/s), au moins 80 ms après son départ. Aucun nouveau coup ne part avant. | 1/3 · 80 °/s · 80 ms | Le poignet ne s'arrête jamais quand on joue vite ; jusqu'à 8 coups par seconde. |
| 4 | Rebond du poignet | Pour un mouvement de sens opposé au coup précédent (produit scalaire < 0), le seuil est relevé à 80 % du sommet de ce coup, puis redescend : × e^(−Δt / 200 ms) depuis la fin du coup. | 80 % · 200 ms | Le rebond fait 17 à 50 % de la vitesse du coup, 70 à 230 ms après : il ne compte pas ; un vrai coup opposé, aussi fort, passe. |
| 5 | Geste en deux élans | Un nouvel élan dans le **même** sens (composante le long du coup > 70 % de v), sans au moins 4° de rotation en sens inverse depuis le coup et moins de 500 ms après sa fin, est la **suite** du même coup, pas un nouveau coup. | 70 % · 4° · 500 ms | Pour frapper deux fois dans le même sens, il faut ramener le poignet entre les deux. |
| 6 | Résumé du coup | 6 canaux (rotation α, β, γ divisée par 100 ; accélération x, y, z divisée par 10) relevés en 6 instants régulièrement espacés de t − 80 ms à t + attente (interpolation linéaire) → 36 nombres. | Attente : 0 ms par défaut (0, 30, 60 ou 100). | Un résumé court, comparable d'un coup à l'autre ; rotations et accélérations ramenées à des ordres de grandeur voisins. |
| 7 | Reconnaissance | Plus proches voisins : chaque nombre est centré-réduit (moyenne et écart-type sur les exemples), distance euclidienne, les 3 exemples les plus proches votent (1 voix chacun, + 0,5 pour le plus proche). | k = 3 · exemples : 20 vrais coups par geste + ceux appris. | Simple, sans calcul d'entraînement, et il suffit d'ajouter des exemples pour l'améliorer. |
| 8 | Retour du coup latéral | Après un coup reconnu « gauche », pendant 600 ms, un mouvement dont le sens fait un cos < −0,6 avec la **direction apprise** du coup latéral (moyenne des sens de ses exemples) ne sonne pas. | 600 ms · cos < −0,6 | Le retour du poignet après un coup latéral est presque aussi vif que le coup. Comparer à la direction apprise et non au coup joué : joué vite, il est mêlé au mouvement précédent. Vrais retours : cos médian −0,98 ; coups bas/haut : −0,22 à +0,32. |
| 9 | Moment du son | « Au début du geste » (défaut) : son au départ du coup (+ attente). « À l'arrêt » : son quand v retombe sous 30 % du sommet moins de 100 ms après lui, ou quand un mouvement inverse atteint 10 % du sommet moins de 150 ms après lui ; sommet d'au moins 250 °/s ; sinon le mouvement reste muet (abandon 150 ms après le sommet, ou 450 ms après le départ). | 30 % · 100 ms · 10 % · 150 ms · 250 °/s · 450 ms | Une baguette s'arrête net sur la peau ; un élan ou un retour ralentit en douceur. |
| 10 | Force (volume) | Plus grande valeur de v entre t − 50 ms et t + 100 ms, ramenée entre 0 et 1 : (max − seuil) / (1200 − seuil). | 1200 °/s = force maximale | Le geste plus vif joue plus fort. |
| 11 | Son | Le téléphone joue lui-même le son choisi pour le geste reconnu (grosse caisse, cymbale, caisse claire ou Wobble « Ho »), avec la force (10). | | |
| 12 | Apprentissage : déroulé | 1,5 s de préparation, puis 10 coups de chaque geste dans l'ordre bas, haut, gauche, 1,2 s de pause entre deux gestes. Chaque coup est gardé de t − 100 ms à t + 200 ms. | 1,5 s · 10 coups · 1,2 s · −100/+200 ms | On joue sans regarder : 1 bip au début, un petit bip par coup compté, 2 bips à la fin d'un geste, 3 à la fin. |
| 13 | Apprentissage : sens du geste | Le 1er coup d'un geste fixe son sens ; il doit partir du repos (v < 100 °/s entre 350 et 80 ms avant). Les coups suivants enrichissent ce sens. | 100 °/s · 350 à 80 ms | Un mouvement d'installation ne doit pas servir de référence. |
| 14 | Apprentissage : élan pris pour le coup | Un mouvement de sens opposé plus de 1,8 fois plus fort que la moyenne des coups comptés, tant que 5 coups au plus sont comptés : le sens retenu était celui de l'élan ; on repart de ce coup. | × 1,8 · 5 coups | Le vrai coup est 3 à 5 fois plus vif que l'élan qui le précède. |
| 15 | Apprentissage : ce qui est écarté | Mouvement de sens opposé au geste : retour, écarté. Moins de 35 % de la force moyenne : réajustement, écarté. Coup détecté pendant un geste mais arrivé après sa fin : ignoré. | 35 % | Seuls les vrais coups deviennent des exemples. |
| 16 | Apprentissage : cumul | Les coups appris s'**ajoutent** aux exemples par défaut et aux apprentissages précédents ; au plus 50 coups appris par geste (les plus récents). L'attente devient la plus courte qui reconnaît au moins 95 % des exemples, chacun classé par les autres. | 50 par geste · 95 % | Chaque apprentissage améliore le modèle sans effacer le précédent (jeux réels du 23/10 : 75/81 coups justes avec les deux réunis, contre 70 au mieux). |
| 17 | Mémoire | Exemples appris et attente gardés dans le téléphone, communs aux trois apps (stockage du navigateur, clé `gyro-gestes-7`). | | Un apprentissage fait dans une app sert dans les autres. |

Historique : jusqu'au 21/10/2026, une calibration de 4 coups (2 vers le haut, 2 vers le bas) apprenait le sens de rotation du poignet, pour 2 sons seulement (grosse caisse en bas, cymbale en haut). Les 4 gestes appris ont d'abord été essayés dans un prototype de SEB-SOLOGYRO-BATTERIE. Du 21/10 au 22/10/2026 au soir, 4 gestes (la droite jouait la caisse claire, la gauche « Oh ! »), appris avec 15 puis 50 coups, et un bouton « diagnostic » qui envoyait l'enregistrement de l'apprentissage et du jeu ; tous deux retirés.

L'ancienne adresse du prototype (`gestes.html`) mène à l'app.

## Licence

SEB-SOLOGYRO-BATTERIE · Sébastien Gay · Octobre 2026 · [CC BY-NC 4.0](LICENSE) : partage et adaptation libres en citant l'auteur, sans usage commercial.

## Fichiers

- `index.html` : la page du téléphone (capteur, son, sensibilité, écran noir) · `gestes.html` : ancienne adresse du prototype, mène à l'app
- `gestes.js` : détection et reconnaissance des gestes · `apprentissage.js` : apprentissage guidé · `jeu-gestes.js` : écran du téléphone (apprentissage, attente, jeu), communs aux trois apps
- `detecteur.js` : réglage de sensibilité (et l'ancienne détection, gardée pour ses tests) · `sons.js` : sons synthétisés
- `test-gestes.js` : `node test-gestes.js` (37 tests : détection, reconnaissance, apprentissage, écran du téléphone, vrai jeu iPhone rejoué) · `test.js` : `node test.js` (51 tests, ancienne détection et sons : détection, déclenchement précoce, sens 3D et baguette, calibration guidée, sens par rotation (dont vraies mesures d'iPhone), calibration dans 5 configurations de capteur, sons)
