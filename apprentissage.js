// Apprentissage guidé des gestes, commun aux trois apps : « parGeste » coups de chaque geste, dans l'ordre.
// Ni affichage ni son ici : la page reçoit des événements (signaler) et affiche, bipe, ou fait biper l'ordinateur.
// Seuls les coups dans le sens du geste comptent : le retour du poignet (sens inverse des coups déjà comptés) n'est ni
// compté ni appris, et un coup détecté juste avant la fin d'un geste ne compte pas pour le suivant.
(function (racine) {
  const Gestes = typeof module !== 'undefined' && module.exports ? require('./gestes.js') : racine.Gestes;
  const ATTENTES = [0, 30, 60, 100];   // ms d'attente possibles avant de jouer

  // Sens d'un coup : rotation cumulée pendant ses 80 premières ms
  const sensDuCoup = (mesures, t) => mesures.filter((m) => m.t >= t && m.t <= t + 80).reduce((s, m) => s.map((x, i) => x + m.rot[i]), [0, 0, 0]);

  // gestes = [{ id, ... }] ; signaler({ type: 'preparation' | 'debut' | 'coup' | 'gesteFini' | 'fin', ... })
  function creerApprentissage({ gestes, parGeste = 10, preparation = 1500, entreGestes = 1200, signaler,
    minuterie = (f, ms) => setTimeout(f, ms), maintenant = () => performance.now() }) {
    // rien : mouvements écartés (retours, élans, réajustements, trop faibles) ; ils apprennent au jeu ce qu'il ne faut PAS jouer
    const a = { etape: 0, coups: 0, exemples: [], rien: [], debut: maintenant() + preparation, sens: null, forces: [], fini: false };
    const debut = (e) => () => { if (!a.fini && a.etape === e) signaler({ type: 'debut', etape: e, geste: gestes[e], coups: a.coups }); };
    signaler({ type: 'preparation' });
    minuterie(debut(0), preparation);
    return {
      get etape() { return a.etape; },
      get fini() { return a.fini; },
      get exemples() { return a.exemples; },
      get rien() { return a.rien; },
      // un coup détecté à l'instant t est-il à prendre ? (pas pendant la préparation ni la pause entre deux gestes)
      ecoute: (t) => !a.fini && t >= a.debut,
      // coup détecté à t pendant l'étape « etape », avec les mesures de toute sa fenêtre
      // → 'compte' | 'recommence' (le sens retenu était celui de l'élan) | 'retour' | 'faible' | 'deborde' | 'pasDeRepos'
      // repos : le téléphone était immobile juste avant. Le 1er coup d'un geste fixe son sens : il doit partir du repos, sinon un
      // mouvement d'installation (remettre le téléphone en main juste après le départ) servirait de référence et tout s'inverserait.
      coup(t, etape, mesures, repos = true) {
        if (a.fini || etape !== a.etape) return 'deborde';
        if (!a.sens && !repos) return 'pasDeRepos';
        const sens = sensDuCoup(mesures, t), force = Math.hypot(...sens), moyenne = a.forces.reduce((s, x) => s + x, 0) / (a.forces.length || 1);
        // Force : le vrai coup est nettement plus vif que l'élan qui le précède et que le retour (iPhone, 22/10/2026 : environ
        // 3 à 5 fois). Un mouvement en sens inverse BEAUCOUP plus fort que les coups comptés, en début de geste, montre que le
        // sens retenu était celui de l'élan : on repart de ce coup. Un mouvement beaucoup plus faible est un simple réajustement.
        let resultat = 'compte';
        if (a.sens) {
          const memeSens = sens.reduce((s, x, i) => s + x * a.sens[i], 0) >= 0;
          if (!memeSens && force > 1.8 * moyenne && a.coups <= 5) {
            a.exemples.splice(a.exemples.length - a.coups, a.coups); a.coups = 0; a.sens = null; a.forces = []; resultat = 'recommence';
          } else if (!memeSens) { a.rien.push({ geste: 'rien', t: Math.round(t), mesures }); return 'retour'; }
          else if (force < 0.35 * moyenne) { a.rien.push({ geste: 'rien', t: Math.round(t), mesures }); return 'faible'; }
        }
        a.forces.push(force);
        const n = force || 1;
        a.sens = (a.sens || [0, 0, 0]).map((x, i) => x + sens[i] / n);
        a.exemples.push({ geste: gestes[etape].id, t: Math.round(t), mesures });
        a.coups++;
        if (a.coups < parGeste) { signaler({ type: 'coup', etape, geste: gestes[etape], coups: a.coups }); return resultat; }
        a.etape++; a.coups = 0; a.sens = null; a.forces = [];
        if (a.etape < gestes.length) {
          a.debut = maintenant() + entreGestes;
          signaler({ type: 'gesteFini', etape: etape, suivant: gestes[a.etape] });
          minuterie(debut(a.etape), entreGestes);
          return 'compte';
        }
        a.fini = true;
        signaler({ type: 'fin', ...choisirAttente(a.exemples), exemples: a.exemples, rien: a.rien });
        return 'compte';
      },
      annuler() { a.fini = true; },
    };
  }

  // Précision « en laissant un exemple de côté », en une seule passe : mise à l'échelle commune, puis chaque exemple classé
  // par ses 3 plus proches voisins parmi les autres (même vote que Gestes.entrainer). Gestes.evaluer réapprend tout pour
  // chaque exemple : 0,75 s pour 500 exemples sur un Mac, plusieurs secondes sur un téléphone.
  function precisionRapide(exemples, attente, k = 3) {
    const r = exemples.map((e) => Gestes.resumer(e.mesures, e.t, attente)), n = r.length;
    if (n < 2) return 0;
    const dim = r[0].length, moy = new Array(dim).fill(0), ecart = new Array(dim).fill(0);
    for (const v of r) v.forEach((x, i) => { moy[i] += x / n; });
    for (const v of r) v.forEach((x, i) => { ecart[i] += (x - moy[i]) ** 2 / n; });
    const s = ecart.map((v) => Math.sqrt(v) || 1), x = r.map((v) => v.map((y, i) => (y - moy[i]) / s[i]));
    let justes = 0;
    for (let i = 0; i < n; i++) {
      const voisins = [];   // les k plus proches, triés (pas de tri complet : 500 exemples → 500 × 500 distances)
      for (let j = 0; j < n; j++) if (j !== i) {
        let d = 0; for (let c = 0; c < dim; c++) { const e = x[j][c] - x[i][c]; d += e * e; }
        if (voisins.length < k || d < voisins[voisins.length - 1][0]) { voisins.push([d, exemples[j].geste]); voisins.sort((p, q) => p[0] - q[0]); if (voisins.length > k) voisins.pop(); }
      }
      const votes = {}; voisins.forEach(([, g], rang) => { votes[g] = (votes[g] || 0) + 1 + (rang === 0 ? 0.5 : 0); });
      if (Object.entries(votes).sort((p, q) => q[1] - p[1])[0][0] === exemples[i].geste) justes++;
    }
    return justes / n;
  }

  // Précision obtenue sur ses propres exemples pour chaque attente, et la plus courte qui atteint 95 % (sinon la meilleure)
  function choisirAttente(exemples) {
    const precisions = ATTENTES.map((a) => Math.round(precisionRapide(exemples, a) * 100));
    let choix = ATTENTES.findIndex((_, i) => precisions[i] >= 95);
    if (choix < 0) choix = precisions.indexOf(Math.max(...precisions));
    return { precisions, attente: ATTENTES[choix] };
  }

  // Force d'un coup : vitesse de rotation maximale autour du coup → 0 à 1
  function force(mesures, t, seuil) {
    let max = 0; for (const m of mesures) if (m.t >= t - 50 && m.t <= t + 100) max = Math.max(max, Math.hypot(...m.rot));
    return Math.min(1, Math.max(0, (max - seuil) / (1200 - seuil)));
  }

  const api = { creerApprentissage, choisirAttente, precisionRapide, sensDuCoup, force, ATTENTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Apprentissage = api;
})(this);
