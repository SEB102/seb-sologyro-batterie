// Partie commune aux pages du téléphone (identique dans les trois apps) : exemples par défaut des gestes (gestes-defaut.js),
// apprentissage guidé de ceux qui n'en ont pas (ou réapprentissage des 4), choix de l'attente, moment du son, jeu. La page dit seulement où sonne le son :
//   sonner(geste, force) : joue le son du geste, sur le téléphone (SOLO) ou en l'envoyant à l'ordinateur
//   biper(type)          : 'debut' (1 bip) | 'coup' (petit bip aigu : coup compté) | 'gesteFini' (2 bips) | 'fin' (3 bips montants), au même endroit
// Il faut gestes.js, apprentissage.js (et gestes-defaut.js) avant ce fichier.
(function (racine) {
  const GESTES = [
    { id: 'bas', nom: 'coup vers le BAS ↓', son: 'Grosse caisse', couleur: '#e8643c' },
    { id: 'haut', nom: 'coup vers le HAUT ↑', son: 'Cymbale', couleur: '#e8c43c' },
    { id: 'droite', nom: 'coup vers la DROITE →', son: 'Caisse claire', couleur: '#4c9be8' },
    { id: 'gauche', nom: '← coup vers la GAUCHE', son: 'Wobble « Ho » (fermé)', couleur: '#b46be8' },
  ];
  const PAR_GESTE = 15, FENETRE = 200;   // ms de mesures gardées après chaque coup
  // Mêmes gestes pour les trois apps (même adresse seb102.github.io) : appris une fois, valables partout
  // gyro-gestes-5 : dernière mémoire en date (gyro-gestes-4 contient encore l'apprentissage du 22/10 16 h 44, « droite » à l'envers) ;
  // les mouvements « rien » qu'elle contient sont ignorés
  const CLE = 'gyro-gestes-5';
  const lire = () => { try { return JSON.parse(localStorage.getItem(CLE) || '{}'); } catch { return {}; } };
  const ecrire = (o) => { try { localStorage.setItem(CLE, JSON.stringify(o)); } catch {} };

  // nomDuSon(geste, i) : nom affiché (version multi : le son choisi sur l'ordinateur pour ce téléphone)
  // parDefaut : exemples fournis d'office ({ geste, t, mesures })
  function creerJeu({ $, seuil, sonner, biper, nomDuSon = (g) => g.son, parDefaut = racine.GESTES_DEFAUT || [] }) {
    const parDefautIds = new Set(parDefaut.map((e) => e.geste));
    // gestes à apprendre : ceux sans exemples par défaut ; s'ils en ont tous, le bouton réapprend les 4
    const sansDefaut = GESTES.filter((g) => !parDefautIds.has(g.id));
    const A_APPRENDRE = sansDefaut.length ? sansDefaut : GESTES;
    const aApprendre = new Set(A_APPRENDRE.map((g) => g.id));
    // exemples du jeu : ceux appris pour les gestes à apprendre remplacent les exemples par défaut de ces gestes ;
    // un ancien apprentissage des 4 gestes ne garde que ses gestes à apprendre
    const tousLesExemples = (appris) => {
      const gardes = (appris || []).filter((e) => aApprendre.has(e.geste)), remplaces = new Set(gardes.map((e) => e.geste));
      return [...parDefaut.filter((e) => !remplaces.has(e.geste)), ...gardes];
    };
    const historique = Gestes.creerHistorique(800);
    let declencheur = Gestes.creerDeclencheur({ seuil }), seuilActuel = seuil;
    let apprentissage = null, modele = null, attente = 30, timerFlash;
    const copie = (t) => historique.mesures.filter((m) => m.t >= t - Gestes.AVANT - 20 && m.t <= t + FENETRE)
      .map((m) => ({ t: Math.round(m.t), rot: m.rot.map((x) => Math.round(x * 10) / 10), acc: m.acc.map((x) => Math.round(x * 100) / 100) }));
    const flash = (html, fond = '#234') => { $('flash').style.background = fond; $('flash').style.color = ''; $('flash').innerHTML = html; };
    const texte = (titre, detail = '', bas = '') => `<div style="font-size:20px;line-height:1.5">${titre}<br><span style="font-size:15px;font-weight:400;color:#bbb">${detail}</span>${bas}</div>`;
    const consigne = (e) => flash(texte(`Geste ${e.etape + 1} sur ${A_APPRENDRE.length} : ${e.geste.nom}`,
      `${nomDuSon(e.geste, GESTES.indexOf(e.geste))} · fais ${PAR_GESTE} coups variés (forts, doux, bras haut, bras bas)`,
      `<div style="font-size:30px;margin-top:8px">${e.coups} / ${PAR_GESTE}</div>`));

    function surEvenement(e) {
      if (e.type === 'preparation') flash(texte('Prépare-toi…', 'tiens le téléphone comme pour jouer'));
      if (e.type === 'debut') { consigne(e); biper('debut'); }
      if (e.type === 'coup') { consigne(e); biper('coup'); }   // on entend chaque coup compté, sans regarder l'écran
      // le dernier coup d'un geste bipe aussi, puis les bips de fin (décalés de 0,15 s par la page)
      if (e.type === 'gesteFini') { flash(texte('C\'est noté !', `geste suivant : ${e.suivant.nom}`)); biper('coup'); biper('gesteFini'); }
      if (e.type === 'fin') {
        biper('coup'); biper('fin');
        if (journal) journal.fin = Math.round(performance.now());
        apprentissage = null;
        const { precisions, attente: choix } = Apprentissage.choisirAttente(tousLesExemples(e.exemples));   // avec haut/bas par défaut
        ecrire({ exemples: e.exemples, attente: choix });
        charger();
        flash(texte('Appris !', `${precisions[Apprentissage.ATTENTES.indexOf(choix)]} % de gestes reconnus avec ${choix} ms d'attente · à toi de jouer`), '');
      }
    }
    // Diagnostic : mesures brutes et décisions du dernier apprentissage, et de la dernière minute et demie de jeu (sons joués,
    // mouvements rendus muets), envoyées par le bouton « diagnostic » de la page
    let journal = null;
    const journalJeu = { duree: 90000, mesures: [], coups: [] };
    function noterJeu(t, mesure, coup) {
      if (mesure) journalJeu.mesures.push(mesure);
      if (coup) journalJeu.coups.push(coup);
      // les plus anciennes partent par paquets (retirer une mesure à chaque mesure coûterait trop sur un téléphone)
      if (journalJeu.mesures.length > 6000) journalJeu.mesures.splice(0, journalJeu.mesures.findIndex((m) => m[0] >= t - journalJeu.duree));
      if (journalJeu.coups.length > 400) journalJeu.coups.splice(0, journalJeu.coups.findIndex((c) => c.t >= t - journalJeu.duree));
    }
    function envoyerJournal() {
      if (!journal && !journalJeu.coups.length) return flash(texte('Rien à envoyer pour l\'instant', 'joue quelques coups, ou appuie sur « Réapprendre mes 4 gestes »'), '');
      const nom = 'gyro-diagnostic-' + new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-') + '.json';
      const contenu = { ...(journal || { appareil: typeof navigator !== 'undefined' ? navigator.userAgent : '' }), attente, seuil: seuilActuel, jeu: journalJeu };
      const fichier = new File([JSON.stringify(contenu)], nom, { type: 'application/json' });
      // iPhone : feuille de partage (AirDrop vers le Mac, Mail…) ; sinon téléchargement
      if (navigator.canShare && navigator.canShare({ files: [fichier] })) return navigator.share({ files: [fichier], title: nom }).catch(() => {});
      const a = document.createElement('a'); a.href = URL.createObjectURL(fichier); a.download = nom; a.click();
    }
    if ($('diagnostic')) $('diagnostic').onclick = envoyerJournal;

    function apprendre() {
      journal = { appareil: typeof navigator !== 'undefined' ? navigator.userAgent : '', debut: Math.round(performance.now()), seuil: seuilActuel,
        colonnes: ['t ms', 'rotation [alpha, beta, gamma] °/s', 'accélération [x, y, z] m/s²'], mesures: [], decisions: [], evenements: [] };
      if (apprentissage) apprentissage.annuler();
      $('precision').hidden = true;
      apprentissage = Apprentissage.creerApprentissage({ gestes: A_APPRENDRE, parGeste: PAR_GESTE,
        signaler: (e) => { if (journal) journal.evenements.push([Math.round(performance.now()), e.type, e.etape]); surEvenement(e); } });
    }
    function charger() {
      const m = lire(), exemples = tousLesExemples(m.exemples);
      if (!GESTES.every((g) => exemples.some((e) => e.geste === g.id))) { modele = null; return false; }   // reste à apprendre
      const { precisions, attente: choix } = Apprentissage.choisirAttente(exemples);
      attente = Apprentissage.ATTENTES.includes(m.attente) ? m.attente : choix;
      modele = Gestes.entrainer(exemples.map((e) => ({ geste: e.geste, resume: Gestes.resumer(e.mesures, e.t, attente) })));
      $('attentes').innerHTML = Apprentissage.ATTENTES.map((a, i) => `<button data-a="${a}" class="${a === attente ? 'actif' : ''}">${a} ms<br>${precisions[i]} %</button>`).join('');
      $('attentes').querySelectorAll('button').forEach((b) => (b.onclick = () => { const o = lire(); o.attente = Number(b.dataset.a); ecrire(o); charger(); }));
      $('precision').hidden = false;
      return true;
    }
    // Retour muet pour droite / gauche : le retour du poignet après un coup vers la droite est un mouvement vers la gauche,
    // presque aussi vif que le coup (iPhone, 22/10/2026 : 0,13 à 0,73 s après le coup) ; il jouerait « Oh ! ». Après un coup
    // droite ou gauche, un mouvement en sens INVERSE dans les RETOUR_MUET ms ne sonne donc pas, quel que soit le son reconnu.
    // Haut et bas ne sont pas concernés (leurs retours sont nettement plus faibles et passent bien).
    const RETOUR_MUET = 600;
    let dernierLateral = null;   // { t, sens } du dernier coup droite / gauche joué
    // delai : temps à attendre avant de reconnaître le geste (l'attente choisie ; 0 si ses mesures sont déjà là)
    function jouer(t, sens, delai = attente) {
      const muet = dernierLateral && t - dernierLateral.t < RETOUR_MUET && sens.reduce((s, x, i) => s + x * dernierLateral.sens[i], 0) < 0;
      if (muet) return noterJeu(t, null, { t: Math.round(t), rot: sens.map(Math.round), muet: 'retour latéral' });
      setTimeout(() => {
        const id = modele.classer(Gestes.resumer(historique.mesures, t, attente));
        noterJeu(t, null, { t: Math.round(t), rot: sens.map(Math.round), geste: id, attente });
        const i = GESTES.findIndex((g) => g.id === id), g = GESTES[i];
        dernierLateral = id === 'droite' || id === 'gauche' ? { t, sens } : null;
        sonner(g, Apprentissage.force(historique.mesures, t, seuilActuel));
        $('flash').textContent = nomDuSon(g, i).toUpperCase();
        $('flash').style.background = g.couleur; $('flash').style.color = '#111';
        clearTimeout(timerFlash);
        timerFlash = setTimeout(() => { $('flash').style.background = ''; $('flash').style.color = ''; }, 150);
      }, delai);
    }

    // Moment du son. « debut » : dès que le geste part (le plus rapide). « arret » : quand le geste s'arrête NET, comme une
    // baguette sur une peau ; un élan ou un retour ralentit en douceur et ne sonne pas. Sur les vrais mouvements de l'iPhone
    // (22/10/2026) : 77 % des coups retombent sous 30 % de leur sommet en moins de 0,1 s, contre 29 % des élans et 31 % des
    // retours ; un rebond en sens inverse (≥ 10 % du sommet) marque aussi l'arrêt d'un coup. Le son part environ 0,17 s
    // après le début du geste, au moment de l'« impact ».
    const ARRET = { chute: 0.3, delai: 100, rebond: 0.1, rebondDelai: 150, picMin: 250, max: 450 };
    const CLE_MOMENT = 'gyro-moment';
    let moment = (() => { try { return localStorage.getItem(CLE_MOMENT) === 'arret' ? 'arret' : 'debut'; } catch { return 'debut'; } })();
    let enCours = null;   // geste détecté dont on attend l'arrêt : { t, sens, pic, tPic, u }
    function afficherMoment() {
      if (!$('moment')) return;
      $('moment').innerHTML = [['debut', 'Au début du geste<br><small>le plus rapide</small>'], ['arret', 'À l\'arrêt du geste<br><small>élans et retours muets</small>']]
        .map(([m, nom]) => `<button data-m="${m}" class="${m === moment ? 'actif' : ''}">${nom}</button>`).join('');
      $('moment').querySelectorAll('button').forEach((b) => (b.onclick = () => changerMoment(b.dataset.m)));
    }
    function changerMoment(m) {
      moment = m === 'arret' ? 'arret' : 'debut'; enCours = null;
      try { localStorage.setItem(CLE_MOMENT, moment); } catch {}
      afficherMoment();
    }
    afficherMoment();
    function suivreArret(r, t) {
      const e = enCours, v = Math.hypot(r.alpha || 0, r.beta || 0, r.gamma || 0), rv = [r.alpha || 0, r.beta || 0, r.gamma || 0];
      if (v > e.pic) { e.pic = v; e.tPic = t; e.u = rv.map((x) => x / v); }
      const inverse = -rv.reduce((s, x, i) => s + x * e.u[i], 0);
      const net = e.pic >= ARRET.picMin && ((v < ARRET.chute * e.pic && t - e.tPic <= ARRET.delai) || (inverse >= ARRET.rebond * e.pic && t - e.tPic <= ARRET.rebondDelai));
      if (net) { enCours = null; return jouer(e.t, e.sens, 0); }
      if (t - e.tPic > ARRET.rebondDelai || t - e.t > ARRET.max) {
        enCours = null;
        noterJeu(t, null, { t: Math.round(e.t), rot: e.sens.map(Math.round), muet: 'pas d\'arrêt net', pic: Math.round(e.pic) });
      }
    }
    // e : événement devicemotion ; renvoie la vitesse de rotation totale (°/s) pour l'affichage, ou null sans gyroscope
    function surMouvement(e, t = performance.now()) {
      const r = e.rotationRate;
      if (!r || ![r.alpha, r.beta, r.gamma].some((v) => typeof v === 'number')) return null;
      historique.ajouter(t, r, e.acceleration);
      if (enCours && !apprentissage) suivreArret(r, t);
      const derniere = historique.mesures[historique.mesures.length - 1];
      const mesure = [Math.round(t), derniere.rot.map((x) => Math.round(x * 10) / 10), derniere.acc.map((x) => Math.round(x * 100) / 100)];
      if (apprentissage && journal && journal.mesures.length < 30000) journal.mesures.push(mesure);
      else if (!apprentissage && modele) noterJeu(t, mesure);
      if (declencheur.traiter(r, t)) {
        if (apprentissage) {
          if (apprentissage.ecoute(t)) {
            const a = apprentissage, etape = a.etape;
            // repos : téléphone presque immobile (< 100 °/s) entre 350 et 80 ms avant le déclenchement
            const repos = historique.mesures.filter((m) => m.t >= t - 350 && m.t <= t - 80).every((m) => Math.hypot(...m.rot) < 100);
            setTimeout(() => {   // attendre la fin de la fenêtre de mesure
              const mesures = copie(t), resultat = a.coup(t, etape, mesures, repos);
              if (journal) journal.decisions.push({ t: Math.round(t), etape, repos, resultat, sens: Apprentissage.sensDuCoup(mesures, t).map(Math.round) });
            }, FENETRE + 20);
          }
        } else if (modele) {
          const sens = [r.alpha || 0, r.beta || 0, r.gamma || 0], v = Math.hypot(...sens);
          if (moment === 'arret') enCours = { t, sens, pic: v, tPic: t, u: sens.map((x) => x / (v || 1)) };
          else jouer(t, sens);
        }
      }
      return Math.hypot(r.alpha || 0, r.beta || 0, r.gamma || 0);
    }
    function changerSeuil(s) { seuilActuel = s; declencheur = Gestes.creerDeclencheur({ seuil: s }); }
    // au démarrage : jeu si des gestes sont déjà appris, sinon apprentissage
    function commencer() { if (charger()) flash(texte('Joue !', 'les 4 gestes sont prêts'), ''); else apprendre(); }
    return { surMouvement, apprendre, charger, commencer, changerSeuil, changerMoment, get moment() { return moment; }, get enApprentissage() { return !!apprentissage; }, A_APPRENDRE,
      exemplesEnCours: () => (apprentissage ? apprentissage.exemples : []) };
  }

  racine.JeuGestes = { creerJeu, GESTES, CLE };
})(this);
