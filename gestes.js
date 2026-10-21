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

  // Déclenchement sur la vitesse de rotation totale (tous axes) : un coup vers la droite compte autant qu'un coup
  // vers le bas. Le coup part dès que le seuil est franchi.
  // Coups rapides : un coup est fini dès que la rotation retombe sous le tiers de son sommet (le poignet ne s'arrête
  // jamais quand on joue vite), avec une pause minimale de 80 ms (un coup dont la vitesse fléchit au milieu ne compte pas deux fois ; laisse jusqu'à 8 coups/s).
  // Rebond : le retour du poignet tourne dans le sens INVERSE du coup, à 17-50 % de sa vitesse, 70 à 230 ms après
  // (mesuré sur iPhone). Pour un mouvement inverse, le seuil est donc relevé à 80 % de la force du coup précédent puis
  // redescend en ~200 ms à partir de la FIN du coup : le rebond ne compte pas, un vrai coup en sens inverse aussi fort passe. Deux coups rapides
  // dans le même sens ne sont pas freinés.
  // Retour : chaque coup est un aller-retour. Sur iPhone, le poignet revient de tout l'angle du coup (≈ 130°), souvent
  // aussi vite que le coup (700 à 1 150 °/s), parfois en deux temps (petit rebond puis retour 300-400 ms après).
  // Après un coup, tout mouvement en sens inverse est donc le retour et ne sonne pas, tant que le poignet n'est pas
  // revenu de « part » de l'angle du coup. Ensuite, un coup ne part que si la vitesse remonte (sinon la fin du retour
  // sonnerait). Si le poignet reste immobile « delai » ms sans revenir, un mouvement en sens inverse redevient un coup.
  // Un mouvement dans une autre direction (vers la droite après un coup vers le bas) sonne sans attendre.
  // Le retour s'arrête souvent net et le poignet rebondit dans le sens du coup (≈ 440 °/s après un retour à 1 090 °/s,
  // mesuré) : la fin du retour arme la même protection anti-rebond que la fin d'un coup.
  function creerDeclencheur({ seuil = 216, rearmement = 80, chute = 1 / 3, pause = 80, rebond = 0.8, oubli = 200, part = 0.85, delai = 600, remontee = 1.5 } = {}) {
    let arme = true, dernier = -Infinity, finCoup = -Infinity, pic = 0, picPrecedent = 0, sens = null, sensPrecedent = null;
    let tPrec = null, axe = null, angleCoup = 0, angleRetour = 0, attendRetour = false, creux = 0, picRetour = 0;
    return {
      traiter(rot, t) {
        const r = vecteur(rot, ['alpha', 'beta', 'gamma']), v = Math.hypot(r[0], r[1], r[2]);
        const dt = tPrec === null ? 0 : Math.min(0.1, Math.max(0, (t - tPrec) / 1000)); tPrec = t;
        const c = axe ? r[0] * axe[0] + r[1] * axe[1] + r[2] * axe[2] : 0;   // vitesse le long du coup (°/s, < 0 = retour)
        // angles du coup et du retour, comptés dès le déclenchement : à tempo rapide le retour commence avant la fin du coup
        if (!arme || attendRetour) {
          if (angleRetour < 2) angleCoup += Math.max(c, 0) * dt;
          angleRetour += Math.max(-c, 0) * dt;
          if (c < -0.5 * v) picRetour = Math.max(picRetour, v);
        }
        const retourFini = () => {
          attendRetour = false; creux = v;
          if (picRetour > seuil) { finCoup = t; picPrecedent = picRetour; sensPrecedent = axe.map((x) => -x); }
        };
        if (!arme) {
          if (v > pic && c > 0) { pic = v; sens = r; }
          if (t - dernier >= pause && (v < rearmement || v < pic * chute)) {
            arme = true; finCoup = t; picPrecedent = pic; sensPrecedent = sens; attendRetour = true;
            if (angleRetour >= part * angleCoup) retourFini();
          }
          return false;
        }
        if (attendRetour) {
          if (angleRetour >= part * angleCoup) retourFini();
          else if (t - finCoup >= delai && v < rearmement) { attendRetour = false; creux = 0; }
          else if (c < -0.5 * v) return false;
        }
        if (creux) creux = Math.min(creux, v);
        const inverse = sensPrecedent && r[0] * sensPrecedent[0] + r[1] * sensPrecedent[1] + r[2] * sensPrecedent[2] < 0;
        const seuilDuMoment = inverse ? Math.max(seuil, rebond * picPrecedent * Math.exp(-(t - finCoup) / oubli)) : seuil;
        if (v > seuilDuMoment && (!creux || creux < seuil || v > remontee * creux)) {
          arme = false; dernier = t; pic = v; sens = r; axe = r.map((x) => x / v); angleCoup = 0; angleRetour = 0; attendRetour = false; creux = 0; picRetour = 0;
          return true;
        }
        return false;
      },
    };
  }

  const api = { creerHistorique, resumer, entrainer, evaluer, creerDeclencheur, AVANT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Gestes = api;
})(this);
