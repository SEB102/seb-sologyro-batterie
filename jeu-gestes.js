// Partie commune aux pages du téléphone (SOLO a en plus, depuis le 23/10, le retour latéral comparé à la direction apprise) : exemples par défaut des gestes (gestes-defaut.js),
// apprentissage guidé de ceux qui n'en ont pas (ou réapprentissage des 3), choix de l'attente, moment du son, jeu. La page dit seulement où sonne le son :
//   sonner(geste, force) : joue le son du geste, sur le téléphone (SOLO) ou en l'envoyant à l'ordinateur
//   biper(type)          : 'debut' (1 bip) | 'coup' (petit bip aigu : coup compté) | 'gesteFini' (2 bips) | 'fin' (3 bips montants), au même endroit
// Il faut gestes.js, apprentissage.js (et gestes-defaut.js) avant ce fichier.
(function (racine) {
  const GESTES = [
    { id: 'bas', nom: 'coup vers le BAS ↓', son: 'Grosse caisse', couleur: '#e8643c' },
    { id: 'haut', nom: 'coup vers le HAUT ↑', son: 'Cymbale', couleur: '#e8c43c' },
    { id: 'gauche', nom: '← coup vers la GAUCHE', son: 'Caisse claire', couleur: '#4c9be8' },
  ];
  const PAR_GESTE = 10, FENETRE = 200;   // ms de mesures gardées après chaque coup
  // Mêmes gestes pour les trois apps (même adresse seb102.github.io) : appris une fois, valables partout
  // gyro-gestes-6 : mémoire des 3 gestes (22/10/2026 au soir) ; les apprentissages d'avant (gyro-gestes-5 et plus anciens, à
  // 4 gestes) sont ignorés : les exemples et l'attente par défaut s'appliquent dès l'ouverture
  // SOLO (23/10/2026) : mémoire propre, gyro-solo-gestes-7, qui CUMULE les apprentissages (au plus MAX_APPRIS coups par geste,
  // les plus récents) ; l'apprentissage de SOLO du 23/10 au matin est déjà dans ses exemples par défaut, celui des autres apps
  // (gyro-gestes-6) n'est pas repris
  const CLE = 'gyro-solo-gestes-7', MAX_APPRIS = 50;
  // Gaucher : téléphone dans la main gauche, tenu en miroir de la main droite (écran vers la paume, haut du téléphone du même
  // côté ; c'est donc l'autre grand côté qui est en bas). Ses mouvements sont l'image dans un miroir de ceux d'un droitier :
  // ramenés en droitier, la rotation autour de l'axe x du téléphone (vertical dans cette prise en main) est gardée, celles
  // autour de y et z sont inversées, et l'accélération selon x est inversée (rotation = vecteur axial : ω' = −Pω, a' = Pa,
  // P = symétrie de l'axe x). Les exemples (par défaut ou appris) restent en droitier ; le coup « gauche » se fait vers la droite.
  const miroir = (r, a) => [{ alpha: r.alpha, beta: typeof r.beta === 'number' ? -r.beta : r.beta, gamma: typeof r.gamma === 'number' ? -r.gamma : r.gamma },
    a && { x: typeof a.x === 'number' ? -a.x : a.x, y: a.y, z: a.z }];
  const lire = () => { try { return JSON.parse(localStorage.getItem(CLE) || '{}'); } catch { return {}; } };
  const ecrire = (o) => { try { localStorage.setItem(CLE, JSON.stringify(o)); } catch {} };

  // nomDuSon(geste, i) : nom affiché (version multi : le son choisi sur l'ordinateur pour ce téléphone)
  // parDefaut : exemples fournis d'office ({ geste, t, mesures })
  // attenteDefaut : attente tant que rien n'est appris (celle de la séance qui a fourni les exemples par défaut)
  function creerJeu({ $, seuil, sonner, biper, nomDuSon = (g) => g.son, parDefaut = racine.GESTES_DEFAUT || [], attenteDefaut = racine.ATTENTE_DEFAUT }) {
    const gestes = GESTES, parGeste = PAR_GESTE;
    let gaucher = false;
    const nomGeste = (g) => (gaucher && g.id === 'gauche' ? 'coup vers la DROITE →' : g.nom);   // pour un gaucher, le coup latéral part vers la droite
    const parDefautIds = new Set(parDefaut.map((e) => e.geste));
    // gestes à apprendre : ceux sans exemples par défaut ; s'ils en ont tous, le bouton réapprend les 3
    const sansDefaut = gestes.filter((g) => !parDefautIds.has(g.id));
    const A_APPRENDRE = sansDefaut.length ? sansDefaut : gestes;
    const aApprendre = new Set(A_APPRENDRE.map((g) => g.id));
    // exemples du jeu : les exemples par défaut PLUS tous les coups appris (SOLO : « Réapprendre » ajoute, il ne remplace plus)
    const tousLesExemples = (appris) => [...parDefaut, ...(appris || []).filter((e) => aApprendre.has(e.geste))];
    // cumul des apprentissages : anciens puis nouveaux, en gardant les MAX_APPRIS plus récents de chaque geste
    const cumuler = (anciens, nouveaux) => {
      const tous = [...(anciens || []).filter((e) => aApprendre.has(e.geste)), ...nouveaux], garde = [];
      for (const g of gestes) garde.push(...tous.filter((e) => e.geste === g.id).slice(-MAX_APPRIS));
      return garde;
    };
    let nbExemples = 0;
    const historique = Gestes.creerHistorique(800);
    let declencheur = Gestes.creerDeclencheur({ seuil }), seuilActuel = seuil;
    let apprentissage = null, modele = null, attente = 30, timerFlash;
    const copie = (t) => historique.mesures.filter((m) => m.t >= t - Gestes.AVANT - 20 && m.t <= t + FENETRE)
      .map((m) => ({ t: Math.round(m.t), rot: m.rot.map((x) => Math.round(x * 10) / 10), acc: m.acc.map((x) => Math.round(x * 100) / 100) }));
    const flash = (html, fond = '#234') => { $('flash').style.background = fond; $('flash').style.color = ''; $('flash').innerHTML = html; };
    const texte = (titre, detail = '', bas = '') => `<div style="font-size:20px;line-height:1.5">${titre}<br><span style="font-size:15px;font-weight:400;color:#bbb">${detail}</span>${bas}</div>`;
    const consigne = (e) => flash(texte(`Geste ${e.etape + 1} sur ${A_APPRENDRE.length} : ${nomGeste(e.geste)}`,
      `${nomDuSon(e.geste, gestes.indexOf(e.geste))} · fais ${parGeste} coups variés (forts, doux, bras haut, bras bas)`,
      `<div style="font-size:30px;margin-top:8px">${e.coups} / ${parGeste}</div>`));

    function surEvenement(e) {
      if (e.type === 'preparation') flash(texte('Prépare-toi…', 'tiens le téléphone comme pour jouer'));
      if (e.type === 'debut') { consigne(e); biper('debut'); }
      if (e.type === 'coup') { consigne(e); biper('coup'); }   // on entend chaque coup compté, sans regarder l'écran
      // le dernier coup d'un geste bipe aussi, puis les bips de fin (décalés de 0,15 s par la page)
      if (e.type === 'gesteFini') { flash(texte('C\'est noté !', `geste suivant : ${nomGeste(e.suivant)}`)); biper('coup'); biper('gesteFini'); }
      if (e.type === 'fin') {
        biper('coup'); biper('fin');
        apprentissage = null;
        const cumul = cumuler(lire().exemples, e.exemples);
        const { precisions, attente: choix } = Apprentissage.choisirAttente(tousLesExemples(cumul));   // avec les exemples par défaut
        ecrire({ exemples: cumul, attente: choix });
        charger();
        flash(texte('Appris !', `${precisions[Apprentissage.ATTENTES.indexOf(choix)]} % de gestes reconnus · à toi de jouer`), '');
      }
    }

    function apprendre() {
      if (apprentissage) apprentissage.annuler();
      apprentissage = Apprentissage.creerApprentissage({ gestes: A_APPRENDRE, parGeste,
        signaler: surEvenement });
    }
    function charger() {
      const m = lire(), exemples = tousLesExemples(m.exemples);
      nbExemples = exemples.length;
      if (!gestes.every((g) => exemples.some((e) => e.geste === g.id))) { modele = null; return false; }   // reste à apprendre
      const { attente: choix } = Apprentissage.choisirAttente(exemples);   // attente : réglée d'office, plus de choix à l'écran
      attente = Apprentissage.ATTENTES.includes(m.attente) ? m.attente : Apprentissage.ATTENTES.includes(attenteDefaut) ? attenteDefaut : choix;
      const somme = exemples.filter((e) => e.geste === 'gauche').map((e) => Apprentissage.sensDuCoup(e.mesures, e.t))
        .reduce((p, v) => { const n = Math.hypot(...v) || 1; return p.map((x, i) => x + v[i] / n); }, [0, 0, 0]), n = Math.hypot(...somme);
      dirLaterale = n ? somme.map((x) => x / n) : null;
      modele = Gestes.entrainer(exemples.map((e) => ({ geste: e.geste, resume: Gestes.resumer(e.mesures, e.t, attente) })));
      return true;
    }
    // Retour muet pour gauche : le retour du poignet après un coup latéral est un mouvement en sens inverse,
    // presque aussi vif que le coup (iPhone, 22/10/2026 : 0,13 à 0,73 s après le coup) ; il jouerait « Oh ! ». Après un coup
    // vers la gauche, un mouvement en sens INVERSE dans les RETOUR_MUET ms ne sonne donc pas, quel que soit le son reconnu.
    // « En sens inverse » = opposé à la direction APPRISE du geste (moyenne de ses exemples), à cos < −0,6 : le coup latéral joué
    // vite est souvent mêlé au mouvement précédent, et le comparer à lui-même rendait muets des coups bas/haut presque
    // perpendiculaires (SOLO, iPhone 23/10 : 7 coups sur 51, cos −0,22 à +0,32 avec la direction apprise ; les vrais retours sont
    // à −0,98 en médiane, 171 sur 180 sous −0,6).
    // Haut et bas ne sont pas concernés (leurs retours sont nettement plus faibles et passent bien).
    const RETOUR_MUET = 600;
    let dernierLateral = null;   // { t } du dernier coup vers la gauche joué
    let dirLaterale = null;      // direction apprise du coup vers la gauche (vecteur unité), calculée au chargement
    // delai : temps à attendre avant de reconnaître le geste (l'attente choisie ; 0 si ses mesures sont déjà là)
    function jouer(t, sens, delai = attente) {
      const muet = dernierLateral && dirLaterale && t - dernierLateral.t < RETOUR_MUET && sens.reduce((s, x, i) => s + x * dirLaterale[i], 0) < -0.6 * Math.hypot(...sens);
      if (muet) return;
      setTimeout(() => {
        const id = modele.classer(Gestes.resumer(historique.mesures, t, attente));
        const i = gestes.findIndex((g) => g.id === id), g = gestes[i];
        dernierLateral = id === 'gauche' ? { t } : null;
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
      if (t - e.tPic > ARRET.rebondDelai || t - e.t > ARRET.max) enCours = null;   // pas d'arrêt net : muet
    }
    // e : événement devicemotion ; renvoie la vitesse de rotation totale (°/s) pour l'affichage, ou null sans gyroscope
    function surMouvement(e, t = performance.now()) {
      let r = e.rotationRate, acc = e.acceleration;
      if (!r || ![r.alpha, r.beta, r.gamma].some((v) => typeof v === 'number')) return null;
      if (gaucher) [r, acc] = miroir(r, acc);
      historique.ajouter(t, r, acc);
      if (enCours && !apprentissage) suivreArret(r, t);
      if (declencheur.traiter(r, t)) {
        if (apprentissage) {
          if (apprentissage.ecoute(t)) {
            const a = apprentissage, etape = a.etape;
            // repos : téléphone presque immobile (< 100 °/s) entre 350 et 80 ms avant le déclenchement
            const repos = historique.mesures.filter((m) => m.t >= t - 350 && m.t <= t - 80).every((m) => Math.hypot(...m.rot) < 100);
            setTimeout(() => {   // attendre la fin de la fenêtre de mesure
              a.coup(t, etape, copie(t), repos);
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
    function changerMain(g) { gaucher = !!g; enCours = null; }
    function changerSeuil(s) { seuilActuel = s; declencheur = Gestes.creerDeclencheur({ seuil: s }); }
    // au démarrage : jeu si des gestes sont déjà appris, sinon apprentissage
    function commencer() { if (charger()) flash(texte('Joue !', `les ${gestes.length} gestes sont prêts`), ''); else apprendre(); }
    return { surMouvement, apprendre, charger, commencer, changerSeuil, changerMoment, changerMain, get gaucher() { return gaucher; }, get moment() { return moment; }, get enApprentissage() { return !!apprentissage; }, get attente() { return attente; }, get nbExemples() { return nbExemples; }, A_APPRENDRE,
      exemplesEnCours: () => (apprentissage ? apprentissage.exemples : []) };
  }

  racine.JeuGestes = { creerJeu, GESTES, CLE, miroir };
})(this);
