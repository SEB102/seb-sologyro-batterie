# SEB-SOLOGYRO-BATTERIE

Le téléphone seul : il sert de baguette **et joue lui-même** les sons. Chaque coup sec, dans n'importe quel sens, joue à tour de rôle **grosse caisse** puis **cymbale**. Pas d'ordinateur, pas de réseau : aucun retard dû au Wi-Fi.

Version « solo » de [SEB-GYROBATTERIE](https://github.com/SEB102/seb-gyrobatterie) (son sur l'ordinateur) et [SEB-MULTIGYRO-BATTERIE](https://github.com/SEB102/seb-multigyro-batterie) (plusieurs téléphones).

## Utilisation

Sur le téléphone (iPhone ou Android), ouvrir **https://seb102.github.io/seb-sologyro-batterie/**.

1. **Toucher pour démarrer** : un seul toucher active le son et les mouvements (iPhone : autoriser « Mouvement »).
2. La première fois : **frapper 3 fois** (calibration : la page apprend l'axe et l'échelle du capteur de ce téléphone).
3. Jouer. Ajouter la page à l'écran d'accueil pour l'avoir en un toucher (iPhone : Partager → « Sur l'écran d'accueil » ; Android : ⋮ → « Ajouter à l'écran d'accueil »).

- **Sensibilité** (0 à 100 %) : 100 % = le geste le plus léger suffit.
- **Recalibrer** si on change de prise en main.
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

## Licence

SEB-SOLOGYRO-BATTERIE · Sébastien Gay · Octobre 2026 · [CC BY-NC 4.0](LICENSE) : partage et adaptation libres en citant l'auteur, sans usage commercial.

## Fichiers

- `index.html` : la page du téléphone (capteur, calibration, détection, son, diagnostic)
- `detecteur.js` : détection des coups, calibration, alternance, sensibilité · `sons.js` : grosse caisse et cymbale synthétisées
- `test.js` : `node test.js` (19 tests : détection, alternance, calibration dans 5 configurations de capteur, sons)
