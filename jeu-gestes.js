// Partie commune aux pages du téléphone (identique dans les trois apps) : apprentissage guidé des 4 gestes,
// choix de l'attente, puis jeu. La page dit seulement où sonne le son :
//   sonner(geste, force) : joue le son du geste, sur le téléphone (SOLO) ou en l'envoyant à l'ordinateur
//   biper(type)          : 'debut' (1 bip) | 'coup' (petit bip aigu : coup compté) | 'gesteFini' (2 bips) | 'fin' (3 bips montants), au même endroit
// Il faut gestes.js et apprentissage.js avant ce fichier.
(function (racine) {
  const GESTES = [
    { id: 'bas', nom: 'coup vers le BAS ↓', son: 'Grosse caisse', couleur: '#e8643c' },
    { id: 'haut', nom: 'coup vers le HAUT ↑', son: 'Cymbale', couleur: '#e8c43c' },
    { id: 'droite', nom: 'coup vers la DROITE →', son: 'Caisse claire', couleur: '#4c9be8' },
    { id: 'gauche', nom: '← coup vers la GAUCHE', son: 'Wobble « Ho » (fermé)', couleur: '#b46be8' },
  ];
  const PAR_GESTE = 15, FENETRE = 200;   // ms de mesures gardées après chaque coup
  // Mêmes gestes pour les trois apps (même adresse seb102.github.io) : appris une fois, valables partout
  const CLE = 'gyro-gestes-4';
  const lire = () => { try { return JSON.parse(localStorage.getItem(CLE) || '{}'); } catch { return {}; } };
  const ecrire = (o) => { try { localStorage.setItem(CLE, JSON.stringify(o)); } catch {} };

  // nomDuSon(geste, i) : nom affiché (version multi : le son choisi sur l'ordinateur pour ce téléphone)
  function creerJeu({ $, seuil, sonner, biper, nomDuSon = (g) => g.son }) {
    const historique = Gestes.creerHistorique(800);
    let declencheur = Gestes.creerDeclencheur({ seuil }), seuilActuel = seuil;
    let apprentissage = null, modele = null, attente = 30, timerFlash;
    const copie = (t) => historique.mesures.filter((m) => m.t >= t - Gestes.AVANT - 20 && m.t <= t + FENETRE)
      .map((m) => ({ t: Math.round(m.t), rot: m.rot.map((x) => Math.round(x * 10) / 10), acc: m.acc.map((x) => Math.round(x * 100) / 100) }));
    const flash = (html, fond = '#234') => { $('flash').style.background = fond; $('flash').style.color = ''; $('flash').innerHTML = html; };
    const texte = (titre, detail = '', bas = '') => `<div style="font-size:20px;line-height:1.5">${titre}<br><span style="font-size:15px;font-weight:400;color:#bbb">${detail}</span>${bas}</div>`;
    const consigne = (e) => flash(texte(`Geste ${e.etape + 1} sur ${GESTES.length} : ${e.geste.nom}`,
      `${nomDuSon(e.geste, e.etape)} · fais ${PAR_GESTE} coups variés (forts, doux, bras haut, bras bas)`,
      `<div style="font-size:30px;margin-top:8px">${e.coups} / ${PAR_GESTE}</div>`));

    function surEvenement(e) {
      if (e.type === 'preparation') flash(texte('Prépare-toi…', 'tiens le téléphone comme pour jouer'));
      if (e.type === 'debut') { consigne(e); biper('debut'); }
      if (e.type === 'coup') { consigne(e); biper('coup'); }   // on entend chaque coup compté, sans regarder l'écran
      // le dernier coup d'un geste bipe aussi, puis les bips de fin (décalés de 0,15 s par la page)
      if (e.type === 'gesteFini') { flash(texte('C\'est noté !', `geste suivant : ${e.suivant.nom}`)); biper('coup'); biper('gesteFini'); }
      if (e.type === 'fin') {
        biper('coup'); biper('fin');
        apprentissage = null;
        ecrire({ exemples: e.exemples, precisions: e.precisions, attente: e.attente });
        charger();
        flash(texte('Appris !', `${e.precisions[Apprentissage.ATTENTES.indexOf(e.attente)]} % de gestes reconnus avec ${e.attente} ms d'attente · à toi de jouer`), '');
      }
    }
    function apprendre() {
      if (apprentissage) apprentissage.annuler();
      $('precision').hidden = true;
      apprentissage = Apprentissage.creerApprentissage({ gestes: GESTES, parGeste: PAR_GESTE, signaler: surEvenement });
    }
    function charger() {
      const m = lire();
      if (!m.exemples || !m.exemples.length) { modele = null; return false; }
      attente = m.attente;
      modele = Gestes.entrainer(m.exemples.map((e) => ({ geste: e.geste, resume: Gestes.resumer(e.mesures, e.t, attente) })));
      $('attentes').innerHTML = Apprentissage.ATTENTES.map((a, i) => `<button data-a="${a}" class="${a === attente ? 'actif' : ''}">${a} ms<br>${m.precisions[i]} %</button>`).join('');
      $('attentes').querySelectorAll('button').forEach((b) => (b.onclick = () => { const o = lire(); o.attente = Number(b.dataset.a); ecrire(o); charger(); }));
      $('precision').hidden = false;
      return true;
    }
    function jouer(t) {
      setTimeout(() => {
        const id = modele.classer(Gestes.resumer(historique.mesures, t, attente));
        const i = GESTES.findIndex((g) => g.id === id), g = GESTES[i];
        sonner(g, Apprentissage.force(historique.mesures, t, seuilActuel));
        $('flash').textContent = nomDuSon(g, i).toUpperCase();
        $('flash').style.background = g.couleur; $('flash').style.color = '#111';
        clearTimeout(timerFlash);
        timerFlash = setTimeout(() => { $('flash').style.background = ''; $('flash').style.color = ''; }, 150);
      }, attente);
    }
    // e : événement devicemotion ; renvoie la vitesse de rotation totale (°/s) pour l'affichage, ou null sans gyroscope
    function surMouvement(e, t = performance.now()) {
      const r = e.rotationRate;
      if (!r || ![r.alpha, r.beta, r.gamma].some((v) => typeof v === 'number')) return null;
      historique.ajouter(t, r, e.acceleration);
      if (declencheur.traiter(r, t)) {
        if (apprentissage) {
          if (apprentissage.ecoute(t)) {
            const a = apprentissage, etape = a.etape;
            // repos : téléphone presque immobile (< 100 °/s) entre 350 et 80 ms avant le déclenchement
            const repos = historique.mesures.filter((m) => m.t >= t - 350 && m.t <= t - 80).every((m) => Math.hypot(...m.rot) < 100);
            setTimeout(() => a.coup(t, etape, copie(t), repos), FENETRE + 20);   // attendre la fin de la fenêtre de mesure
          }
        } else if (modele) jouer(t);
      }
      return Math.hypot(r.alpha || 0, r.beta || 0, r.gamma || 0);
    }
    function changerSeuil(s) { seuilActuel = s; declencheur = Gestes.creerDeclencheur({ seuil: s }); }
    // au démarrage : jeu si des gestes sont déjà appris, sinon apprentissage
    function commencer() { if (charger()) flash(texte('Joue !', 'tes gestes appris sont repris'), ''); else apprendre(); }
    return { surMouvement, apprendre, charger, commencer, changerSeuil, get enApprentissage() { return !!apprentissage; },
      exemplesEnCours: () => (apprentissage ? apprentissage.exemples : []) };
  }

  racine.JeuGestes = { creerJeu, GESTES, CLE };
})(this);
