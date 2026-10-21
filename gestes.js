// Reconnaissance de plusieurs gestes (prototype) : chaque coup détecté est résumé par la forme de sa rotation
// et de son accélération sur une courte fenêtre, puis comparé aux exemples enregistrés par l'utilisateur
// (méthode des plus proches voisins : le geste le plus ressemblant parmi les exemples l'emporte).
(function (racine) {
  const AVANT = 80;          // ms gardées avant le déclenchement (début du geste)
  const POINTS = 6;          // valeurs relevées par canal dans la fenêtre
  const CANAUX = 6;          // rotation x, y, z + accélération x, y, z

  const vecteur = (o, cles) => {
    if (!o) return [0, 0, 0];
    const v = Array.isArray(o) ? o : cles.map((k) => o[k]);
    return v.map((x) => (Number.isFinite(x) ? x : 0));
  };

  // Mémoire des dernières mesures : { t, rot: [α, β, γ] °/s, acc: [x, y, z] m/s² }
  function creerHistorique(dureeMs = 600) {
    const mesures = [];
    return {
      ajouter(t, rot, acc) {
        mesures.push({ t, rot: vecteur(rot, ['alpha', 'beta', 'gamma']), acc: vecteur(acc, ['x', 'y', 'z']) });
        while (mesures.length && t - mesures[0].t > dureeMs) mesures.shift();
      },
      mesures,
    };
  }

  // Résumé d'un geste : valeurs interpolées à POINTS instants entre (déclenchement - AVANT) et (déclenchement + attente).
  // Les rotations sont en centaines de °/s et les accélérations en dizaines de m/s², pour des ordres de grandeur voisins.
  function resumer(mesures, tDeclenchement, attente) {
    const debut = tDeclenchement - AVANT, fin = tDeclenchement + Math.max(attente, 1);
    const valeur = (t, c) => {
      let i = 0; while (i < mesures.length - 1 && mesures[i + 1].t < t) i++;
      const a = mesures[i], b = mesures[Math.min(i + 1, mesures.length - 1)];
      const va = c < 3 ? a.rot[c] / 100 : a.acc[c - 3] / 10, vb = c < 3 ? b.rot[c] / 100 : b.acc[c - 3] / 10;
      const u = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
      return va + (vb - va) * u;
    };
    const r = [];
    for (let c = 0; c < CANAUX; c++) for (let k = 0; k < POINTS; k++) r.push(valeur(debut + (fin - debut) * k / (POINTS - 1), c));
    return r;
  }

  // Classifieur : exemples = [{ geste, resume }] ; distance normalisée dimension par dimension
  function entrainer(exemples, k = 3) {
    if (!exemples.length) return null;
    const dim = exemples[0].resume.length, moy = new Array(dim).fill(0), ecart = new Array(dim).fill(0);
    for (const e of exemples) e.resume.forEach((v, i) => { moy[i] += v / exemples.length; });
    for (const e of exemples) e.resume.forEach((v, i) => { ecart[i] += (v - moy[i]) ** 2 / exemples.length; });
    const s = ecart.map((v) => Math.sqrt(v) || 1);
    const norme = (r) => r.map((v, i) => (v - moy[i]) / s[i]);
    const base = exemples.map((e) => ({ geste: e.geste, x: norme(e.resume) }));
    return {
      classer(resume) {
        const x = norme(resume);
        const voisins = base.map((b) => ({ geste: b.geste, d: b.x.reduce((a, v, i) => a + (v - x[i]) ** 2, 0) }))
          .sort((a, b) => a.d - b.d).slice(0, Math.min(k, base.length));
        const votes = {};
        voisins.forEach((v, rang) => { votes[v.geste] = (votes[v.geste] || 0) + 1 + (rang === 0 ? 0.5 : 0); });   // le plus proche départage
        return Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
      },
    };
  }

  // Précision estimée « en laissant un exemple de côté » : chaque exemple est classé par les autres.
  // exemplesBruts = [{ geste, mesures, t }] ; renvoie { precision, parGeste, confusions }
  function evaluer(exemplesBruts, attente, k = 3) {
    const ex = exemplesBruts.map((e) => ({ geste: e.geste, resume: resumer(e.mesures, e.t, attente) }));
    let justes = 0; const parGeste = {}, confusions = {};
    ex.forEach((e, i) => {
      const modele = entrainer(ex.filter((_, j) => j !== i), k);
      const trouve = modele ? modele.classer(e.resume) : null;
      parGeste[e.geste] = parGeste[e.geste] || { justes: 0, total: 0 };
      parGeste[e.geste].total++;
      if (trouve === e.geste) { justes++; parGeste[e.geste].justes++; } else { const c = e.geste + ' → ' + trouve; confusions[c] = (confusions[c] || 0) + 1; }
    });
    return { precision: ex.length ? justes / ex.length : 0, parGeste, confusions };
  }

  // Déclenchement sur la vitesse de rotation totale (tous axes) : un coup sur le côté compte autant qu'un coup
  // vers le bas. Le coup part dès que le seuil est franchi ; il faut ensuite revenir au calme, et 200 ms de pause
  // empêchent le retour du poignet de compter comme un second coup.
  function creerDeclencheur({ seuil = 216, rearmement = 80, pause = 200 } = {}) {
    let arme = true, dernier = -Infinity;
    return {
      traiter(rot, t) {
        const r = vecteur(rot, ['alpha', 'beta', 'gamma']), v = Math.hypot(r[0], r[1], r[2]);
        if (!arme) { if (v < rearmement && t - dernier >= pause) arme = true; return false; }
        if (v > seuil && t - dernier >= pause) { arme = false; dernier = t; return true; }
        return false;
      },
    };
  }

  const api = { creerHistorique, resumer, entrainer, evaluer, creerDeclencheur, AVANT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Gestes = api;
})(this);
