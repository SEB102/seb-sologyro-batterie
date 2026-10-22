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
    const a = { etape: 0, coups: 0, exemples: [], debut: maintenant() + preparation, sens: null, fini: false };
    const debut = (e) => () => { if (!a.fini && a.etape === e) signaler({ type: 'debut', etape: e, geste: gestes[e], coups: a.coups }); };
    signaler({ type: 'preparation' });
    minuterie(debut(0), preparation);
    return {
      get etape() { return a.etape; },
      get fini() { return a.fini; },
      get exemples() { return a.exemples; },
      // un coup détecté à l'instant t est-il à prendre ? (pas pendant la préparation ni la pause entre deux gestes)
      ecoute: (t) => !a.fini && t >= a.debut,
      // coup détecté à t pendant l'étape « etape », avec les mesures de toute sa fenêtre → 'compte' | 'retour' | 'deborde' | 'pasDeRepos'
      // repos : le téléphone était immobile juste avant. Le 1er coup d'un geste fixe son sens : il doit partir du repos, sinon un
      // mouvement d'installation (remettre le téléphone en main juste après le départ) servirait de référence et tout s'inverserait.
      coup(t, etape, mesures, repos = true) {
        if (a.fini || etape !== a.etape) return 'deborde';
        if (!a.sens && !repos) return 'pasDeRepos';
        const sens = sensDuCoup(mesures, t);
        if (a.sens && sens.reduce((s, x, i) => s + x * a.sens[i], 0) < 0) return 'retour';
        const n = Math.hypot(...sens) || 1;
        a.sens = (a.sens || [0, 0, 0]).map((x, i) => x + sens[i] / n);
        a.exemples.push({ geste: gestes[etape].id, t: Math.round(t), mesures });
        a.coups++;
        if (a.coups < parGeste) { signaler({ type: 'coup', etape, geste: gestes[etape], coups: a.coups }); return 'compte'; }
        a.etape++; a.coups = 0; a.sens = null;
        if (a.etape < gestes.length) {
          a.debut = maintenant() + entreGestes;
          signaler({ type: 'gesteFini', etape: etape, suivant: gestes[a.etape] });
          minuterie(debut(a.etape), entreGestes);
          return 'compte';
        }
        a.fini = true;
        signaler({ type: 'fin', ...choisirAttente(a.exemples), exemples: a.exemples });
        return 'compte';
      },
      annuler() { a.fini = true; },
    };
  }

  // Précision obtenue sur ses propres exemples pour chaque attente, et la plus courte qui atteint 95 % (sinon la meilleure)
  function choisirAttente(exemples) {
    const precisions = ATTENTES.map((a) => Math.round(Gestes.evaluer(exemples, a).precision * 100));
    let choix = ATTENTES.findIndex((_, i) => precisions[i] >= 95);
    if (choix < 0) choix = precisions.indexOf(Math.max(...precisions));
    return { precisions, attente: ATTENTES[choix] };
  }

  // Force d'un coup : vitesse de rotation maximale autour du coup → 0 à 1
  function force(mesures, t, seuil) {
    let max = 0; for (const m of mesures) if (m.t >= t - 50 && m.t <= t + 100) max = Math.max(max, Math.hypot(...m.rot));
    return Math.min(1, Math.max(0, (max - seuil) / (1200 - seuil)));
  }

  const api = { creerApprentissage, choisirAttente, sensDuCoup, force, ATTENTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Apprentissage = api;
})(this);
