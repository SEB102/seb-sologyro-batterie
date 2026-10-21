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
  // Avec une « baguette » (apprise à la calibration, voir calibrerBaguette), le sens vient plutôt de la vitesse
  // du bout de la baguette : rotation × axe de la baguette, projetée sur la verticale. Instantané, sans dérive,
  // et insensible à l'effet « manège » (accélération vers le coude) qui trompait la vitesse verticale.
  function creerVerticale({ fuite = 250, baguette = null } = {}) {
    let g = null, vitesse = 0, tPrec = null, mesures = 0, bout = [];
    function ajouter(t, acc, accG, rot) {
      ajouterLineaire(t, acc, accG);
      const w = baguette && g && rotationEnRad(rot, baguette.convention);
      if (!w) return;
      const n = Math.hypot(g[0], g[1], g[2]);
      bout.push(produitMixte(w, baguette.axe, g) / n);
      if (bout.length > 3) bout.shift();
    }
    function ajouterLineaire(t, acc, accG) {
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
    function sens() {
      const b = bout.reduce((a, x) => a + x, 0);
      if (bout.length && Math.abs(b) > 0.05) return b > 0 ? 1 : -1;   // bout de baguette (rad/s, nettement non nul)
      return mesures < 2 ? 0 : vitesse > 0 ? 1 : vitesse < 0 ? -1 : 0;
    }
    const regler = (b) => { baguette = b; bout = []; };
    return { ajouter, sens, regler, vitesse: () => vitesse, gravite: () => g };   // vitesse, gravite : diagnostic
  }

  const vecteur = (o) => {
    if (!o) return null;
    const v = Array.isArray(o) ? o : [o.x, o.y, o.z];
    if (!Number.isFinite(v[0])) return null;
    return v.map((x) => (Number.isFinite(x) ? x : 0));
  };
  // rotationRate → vecteur rotation (rad/s) dans le repère du téléphone, selon la convention d'axes du navigateur :
  // « navigateurs » : alpha, beta, gamma autour de x, y, z ; « norme » : autour de z, x, y
  function rotationEnRad(rot, convention) {
    const r = rot && (Array.isArray(rot) ? rot : [rot.alpha, rot.beta, rot.gamma]);
    if (!r || ![r[0], r[1], r[2]].some(Number.isFinite)) return null;
    const v = r.map((x) => (Number.isFinite(x) ? x * Math.PI / 180 : 0));
    return convention === 'norme' ? [v[1], v[2], v[0]] : v;
  }
  // (w × L) · g : vitesse verticale (au signe près) du bout d'une baguette d'axe L qui tourne à w
  const produitMixte = (w, L, g) => (w[1] * L[2] - w[2] * L[1]) * g[0] + (w[2] * L[0] - w[0] * L[2]) * g[1] + (w[0] * L[1] - w[1] * L[0]) * g[2];

  // Calibration de la baguette. Un coup de batterie déplace le téléphone verticalement : la « baguette » est l'axe
  // du téléphone (x, y ou z, selon la façon de le tenir) dont la rotation produit le mouvement le plus vertical.
  // Le sens (+/-) vient ensuite de la comparaison avec la vitesse verticale mesurée, ce qui absorbe aussi le signe
  // de la gravité propre à chaque navigateur. Vérifié sur de vraies mesures d'iPhone tenu debout dans la main
  // (la baguette est alors l'avant-bras, en travers du téléphone). echantillons : [{ t, rot, acc, accG }]
  function calibrerBaguette(echantillons) {
    if (echantillons.length < 20) return null;
    const v = creerVerticale(), serie = [];
    for (const e of echantillons) {
      v.ajouter(e.t, e.acc, e.accG);
      const g = v.gravite(), w0 = rotationEnRad(e.rot, 'navigateurs');
      if (g && w0) serie.push({ g: g.map((x) => x / Math.hypot(g[0], g[1], g[2])), rot: e.rot, w: Math.hypot(w0[0], w0[1], w0[2]), vit: v.vitesse() });
    }
    const wMax = Math.max(0, ...serie.map((s) => s.w));
    if (wMax < 2) return null;   // moins de ~115 °/s : pas de vrai geste
    const gestes = serie.filter((s) => s.w > 0.3 * wMax);
    const moyenne = (l) => l.reduce((a, b) => a + b, 0) / l.length;
    let meilleur = null;
    for (const convention of ['navigateurs', 'norme']) for (let i = 0; i < 3; i++) {
      const axe = [0, 0, 0]; axe[i] = 1;
      const p = gestes.map((s) => produitMixte(rotationEnRad(s.rot, convention), axe, s.g));
      const verticalite = moyenne(p.map(Math.abs)) / moyenne(gestes.map((s) => s.w));   // 1 = bout parfaitement vertical
      if (!meilleur || verticalite > meilleur.verticalite) meilleur = { convention, axe, verticalite, p };
    }
    const c = correlation(meilleur.p, gestes.map((s) => s.vit));
    if (Math.abs(c) < 0.2) return null;
    return { convention: meilleur.convention, axe: meilleur.axe.map((x) => (c > 0 ? x : -x)),
      verticalite: Math.round(meilleur.verticalite * 100) / 100, correlation: Math.round(Math.abs(c) * 100) / 100 };
  }
  function correlation(x, y) {
    const mx = x.reduce((a, b) => a + b, 0) / x.length, my = y.reduce((a, b) => a + b, 0) / y.length;
    let sxy = 0, sxx = 0, syy = 0;
    x.forEach((xi, i) => { sxy += (xi - mx) * (y[i] - my); sxx += (xi - mx) ** 2; syy += (y[i] - my) ** 2; });
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
  }

  // Sensibilité affichée en % (100 % = le geste le plus léger suffit) ↔ seuil de déclenchement
  const SEUIL_MIN = 120, SEUIL_MAX = 600;
  const seuilVersSensibilite = (s) => Math.round((SEUIL_MAX - s) / (SEUIL_MAX - SEUIL_MIN) * 100);
  const sensibiliteVersSeuil = (p) => Math.round(SEUIL_MAX - Math.min(100, Math.max(0, p)) / 100 * (SEUIL_MAX - SEUIL_MIN));

  const api = { creerDetecteur, calibrer, compterCoups, creerVerticale, calibrerBaguette, seuilVersSensibilite, sensibiliteVersSeuil, REGLAGES_DEFAUT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Detecteur = api;
})(this);
