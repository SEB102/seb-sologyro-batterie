// Détection d'un coup de baguette à partir de la vitesse de rotation du gyroscope.
// Entrée : vitesse de rotation autour de l'axe choisi, en degrés/seconde, et l'heure en ms.
// Convention : vitesse négative = coup vers le bas (grosse caisse), positive = vers le haut (cymbale).
// Par défaut le coup part au sommet du geste (dès que la vitesse redescend), la force dépend de ce sommet.
// Option « précoce » : le coup part dès que le geste dépasse le seuil ; la force est alors estimée
// d'après la vitesse et son accélération à cet instant, et le sommet est quand même suivi pour
// mesurer le temps gagné (surGain, en ms).
(function (racine) {
  const REGLAGES_DEFAUT = {
    seuil: 250,          // °/s pour qu'un geste compte comme un coup
    rearmement: 80,      // °/s : il faut redescendre sous cette vitesse avant un nouveau coup
    blocageInverse: 180, // ms pendant lesquelles le sens opposé est ignoré (rebond du poignet)
    forceMax: 1200,      // °/s correspondant à la force maximale
    chute: 0.85,         // le sommet est atteint quand la vitesse retombe sous 85 % du pic
    precoce: false,      // true : déclencher dès le franchissement du seuil
    surGain: null,       // (ms) => …  appelé en mode précoce quand le sommet est atteint
  };

  function creerDetecteur(reglages) {
    const r = Object.assign({}, REGLAGES_DEFAUT, reglages);
    let etat = 'repos';   // repos | montee | attente
    let sens = 0, pic = 0;
    let dernierSens = 0, dernierT = -Infinity;
    let precedente = 0;   // vitesse (signée) de la mesure précédente
    let suivi = null;     // mode précoce : { t0, sens, pic } jusqu'au sommet du geste

    function declencher(t) {
      dernierSens = sens; dernierT = t;
      etat = 'attente';
      const force = Math.min(1, Math.max(0, (pic - r.seuil) / (r.forceMax - r.seuil)));
      return { type: sens < 0 ? 'grosse-caisse' : 'cymbale', force, pic, t };
    }

    function traiter(vitesse, t) {
      if (!Number.isFinite(vitesse)) return null;
      const v = Math.abs(vitesse), s = Math.sign(vitesse);
      const avant = precedente; precedente = vitesse;

      if (suivi) {   // mode précoce : où aurait été le coup « au sommet » ?
        if (s === suivi.sens && v >= suivi.pic) suivi.pic = v;
        else if (s !== suivi.sens || v < suivi.pic * r.chute) { if (r.surGain) r.surGain(t - suivi.t0); suivi = null; }
      }
      if (etat === 'attente') {
        if (v < r.rearmement) etat = 'repos';
        return null;
      }
      if (etat === 'repos') {
        if (v <= r.seuil) return null;
        if (s === -dernierSens && t - dernierT < r.blocageInverse) { etat = 'attente'; return null; }
        sens = s; pic = v;
        if (r.precoce) {
          // sommet estimé : vitesse actuelle + ce qu'elle vient de gagner en une mesure
          const montee = Math.sign(avant) === s ? v - Math.abs(avant) : v;
          pic = v + Math.max(0, montee);
          suivi = { t0: t, sens: s, pic: v };
          return declencher(t);
        }
        etat = 'montee';
        return null;
      }
      // montee
      if (s === sens && v >= pic) { pic = v; return null; }
      if (s !== sens || v < pic * r.chute) return declencher(t);
      return null;
    }

    return { traiter, reglages: r };
  }

  // Calibration : l'utilisateur frappe quelques coups VERS LE BAS.
  // Les navigateurs ne s'accordent ni sur le nom des axes, ni toujours sur l'unité (°/s ou rad/s),
  // et certains téléphones n'ont pas de gyroscope (accéléromètre seul) : on déduit tout du geste.
  // echantillons : [{ t, axes: [x, y, z] }]  →  { axe, signe, facteur, coups } ou null
  // Une fois calibré : vitesse = axes[axe] * signe * facteur, négative vers le bas, ~CIBLE pour un coup normal.
  const CIBLE = 700;
  const mediane = (l) => { const s = [...l].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

  // Gestes francs repérés dans les échantillons : { axe, vrais: [{ pic, premierSigne }] } ou null
  function gestesForts(echantillons) {
    if (echantillons.length < 10) return null;
    let meilleur = null;
    for (let axe = 0; axe < 3; axe++) {
      const v = echantillons.map((e) => e.axes[axe] || 0);
      const max = Math.max(...v.map(Math.abs));
      const bruit = mediane(v.map(Math.abs));
      if (max > 0 && max > 8 * bruit && (!meilleur || max > meilleur.max)) meilleur = { axe, max, v };
    }
    if (!meilleur) return null;

    // Gestes = groupes d'échantillons forts séparés d'au moins 150 ms de calme
    const { v, max } = meilleur;
    const gestes = []; let g = null, dernierFort = -Infinity;
    echantillons.forEach((e, i) => {
      if (Math.abs(v[i]) < 0.2 * max) return;
      if (!g || e.t - dernierFort > 150) { g = []; gestes.push(g); }
      dernierFort = e.t;
      g.push(v[i]);
    });
    // Seuil relatif à chaque geste : avec l'accéléromètre, l'arrêt brusque peut dépasser l'élan
    const vrais = gestes.map((valeurs) => {
      const pic = Math.max(...valeurs.map(Math.abs));
      return { pic, premierSigne: Math.sign(valeurs.find((x) => Math.abs(x) >= 0.25 * pic)) };
    }).filter((x) => x.pic >= 0.4 * max);
    return { axe: meilleur.axe, vrais };
  }

  // Nombre de coups reconnus jusqu'ici (affiché pendant la calibration)
  function compterCoups(echantillons) {
    const g = gestesForts(echantillons);
    return g ? g.vrais.length : 0;
  }

  function calibrer(echantillons) {
    const g = gestesForts(echantillons);
    if (!g || g.vrais.length < 2) return null;
    const { vrais } = g;
    // Le sens du coup = sens du premier mouvement fort de chaque geste (le rebond vient après)
    const somme = vrais.reduce((s, x) => s + x.premierSigne, 0);
    if (somme === 0) return null;
    return { axe: g.axe, signe: somme > 0 ? -1 : 1, facteur: CIBLE / mediane(vrais.map((x) => x.pic)), coups: vrais.length };
  }

  // Sens du coup DANS LA PIÈCE (vers le sol ou vers le plafond), quelle que soit la tenue du téléphone.
  // On projette l'accélération du téléphone sur la direction de la gravité, puis on l'intègre (avec une fuite,
  // pour ne pas dériver) : on obtient la vitesse verticale du geste. Le produit scalaire ne change pas si un
  // navigateur inverse le signe des deux mesures. Sans « acceleration », la gravité est estimée par filtrage.
  // ajouter(t ms, acceleration, accelerationIncludingGravity) ; sens() : -1 vers le bas, +1 vers le haut, 0 inconnu
  function creerVerticale({ fuite = 250 } = {}) {
    const vecteur = (o) => {
      if (!o) return null;
      const v = Array.isArray(o) ? o : [o.x, o.y, o.z];
      if (!Number.isFinite(v[0])) return null;
      return v.map((x) => (Number.isFinite(x) ? x : 0));
    };
    let g = null, vitesse = 0, tPrec = null, mesures = 0;
    function ajouter(t, acc, accG) {
      const ag = vecteur(accG); if (!ag) return;
      const a0 = vecteur(acc);
      let a;
      if (a0) {
        const gi = ag.map((x, i) => x - a0[i]);
        g = g ? g.map((x, i) => 0.7 * x + 0.3 * gi[i]) : gi;
        a = a0;
      } else {
        g = g ? g.map((x, i) => 0.95 * x + 0.05 * ag[i]) : ag.slice();
        a = ag.map((x, i) => x - g[i]);
      }
      const norme = Math.hypot(g[0], g[1], g[2]); if (!norme) return;
      const aVerticale = (a[0] * g[0] + a[1] * g[1] + a[2] * g[2]) / norme;   // > 0 : accélère vers le haut
      const dt = tPrec === null ? 0 : Math.min(100, t - tPrec); tPrec = t;
      vitesse = vitesse * Math.exp(-dt / fuite) + aVerticale * dt / 1000;
      mesures++;
    }
    const sens = () => (mesures < 2 ? 0 : vitesse > 0 ? 1 : vitesse < 0 ? -1 : 0);
    return { ajouter, sens };
  }

  // Sensibilité affichée en % (100 % = le geste le plus léger suffit) ↔ seuil de déclenchement
  const SEUIL_MIN = 120, SEUIL_MAX = 600;
  const seuilVersSensibilite = (s) => Math.round((SEUIL_MAX - s) / (SEUIL_MAX - SEUIL_MIN) * 100);
  const sensibiliteVersSeuil = (p) => Math.round(SEUIL_MAX - Math.min(100, Math.max(0, p)) / 100 * (SEUIL_MAX - SEUIL_MIN));

  const api = { creerDetecteur, calibrer, compterCoups, creerVerticale, seuilVersSensibilite, sensibiliteVersSeuil, REGLAGES_DEFAUT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Detecteur = api;
})(this);
