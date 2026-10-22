// Tests du prototype « plusieurs gestes » : node test-gestes.js
const assert = require('assert');
const G = require('./gestes.js');
let ok = 0;
function test(nom, f) { try { f(); ok++; console.log('OK  ', nom); } catch (e) { console.log('ÉCHEC', nom, '\n     ', e.message); process.exitCode = 1; } }

// ---- Simulateur : téléphone tenu debout dans le poing, avant-bras vers l'avant, pivot au coude (0,25 m) ----
// Repère de la pièce : X devant, Y à gauche, Z en haut. Chaque geste = rotation autour d'un axe de la pièce.
let graine = 7; const hasard = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
const entre = (a, b) => a + (b - a) * hasard();
const rotation = (a, ang, v) => {   // formule de Rodrigues
  const c = Math.cos(ang), s = Math.sin(ang), d = a[0] * v[0] + a[1] * v[1] + a[2] * v[2];
  const x = [a[1] * v[2] - a[2] * v[1], a[2] * v[0] - a[0] * v[2], a[0] * v[1] - a[1] * v[0]];
  return [0, 1, 2].map((i) => v[i] * c + x[i] * s + a[i] * d * (1 - c));
};
const TYPES = {
  bas: { axe: [0, 1, 0], amp: 50, duree: 140 },          // le bout descend
  haut: { axe: [0, 1, 0], amp: -50, duree: 140 },        // le bout monte
  droite: { axe: [0, 0, 1], amp: -50, duree: 140 },      // le bout part vers la droite
  gauche: { axe: [0, 0, 1], amp: 50, duree: 140 },       // le bout part vers la gauche
};
// rebond : vitesse du retour du poignet juste après le coup, en fraction de la vitesse du coup (0 = petit retour lent).
// Mesuré sur un vrai iPhone (21/10) : 17 à 50 % de la vitesse du coup, 70 à 230 ms après.
// retour : le poignet revient de tout l'angle du coup, à cette fraction de la vitesse du coup (0 = petit retour lent)
function seance(sequence, { hz = 60, calme = 900, rebond = 0, retour = 0 } = {}) {
  const dt = 1000 / hz, ech = [], vrais = [];
  let t = 0;
  for (const nom of sequence) {
    const T = TYPES[nom], amp = T.amp * entre(0.75, 1.25) * Math.PI / 180, duree = T.duree * entre(0.8, 1.2);
    const elev = entre(-20, 30) * Math.PI / 180, roulis = entre(-20, 20) * Math.PI / 180;
    // tenue de départ : avant-bras (x du téléphone) vers l'avant, haut du téléphone (y) vers le plafond, levé de « elev »
    let ex = rotation([0, 1, 0], -elev, [1, 0, 0]), ey = rotation([0, 1, 0], -elev, [0, 0, 1]);
    ey = rotation(ex, roulis, ey);
    const ez = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]];
    const aller = (u) => (u <= 0 ? 0 : u >= 1 ? amp : amp * (1 - Math.cos(Math.PI * u)) / 2);
    const dr = retour && 1 / retour, fin = duree * (1 + (retour ? 0.5 + dr : 0));
    const angle = retour
      ? (u) => aller(u) - (u <= 1.5 ? 0 : u >= 1.5 + dr ? amp : amp * (1 - Math.cos(Math.PI * (u - 1.5) / dr)) / 2)
      : rebond
      ? (u) => { const dr = 0.3 / rebond; return aller(u) - (u <= 1 ? 0 : u >= 1 + dr ? 0.3 * amp : 0.3 * amp * (1 - Math.cos(Math.PI * (u - 1) / dr)) / 2); }   // retour de 30 % du geste
      : (u) => aller(u) - (u > 1.3 ? 0.3 * amp * Math.min(1, (u - 1.3) / 1.5) : 0);   // + petit retour lent
    const pos = (tt) => rotation(T.axe, angle((tt - t - calme / 2) / duree), ex).map((x) => x * 0.25);
    vrais.push({ geste: nom, t: t + calme / 2 });
    for (let tt = t; tt < t + calme + fin; tt += dt) {
      const u = (tt - t - calme / 2) / duree, h = 1;
      const w = (angle((tt + h - t - calme / 2) / duree) - angle((tt - h - t - calme / 2) / duree)) / (2 * h / 1000);   // rad/s
      const base = [ex, ey, ez].map((e) => rotation(T.axe, angle(u), e));
      const p0 = pos(tt - h), p1 = pos(tt), p2 = pos(tt + h), acc = [0, 1, 2].map((i) => (p2[i] - 2 * p1[i] + p0[i]) / (h / 1000) ** 2);
      ech.push({ t: tt, rot: base.map((e) => (w * (T.axe[0] * e[0] + T.axe[1] * e[1] + T.axe[2] * e[2]) * 180 / Math.PI) + entre(-3, 3)),
        acc: base.map((e) => acc[0] * e[0] + acc[1] * e[1] + acc[2] * e[2] + entre(-0.2, 0.2)) });
    }
    t += calme + fin;
  }
  return { ech, vrais };
}
// Détecte les coups d'une séance et garde les mesures autour de chacun (comme la page)
function exemples(sequence) {
  const { ech, vrais } = seance(sequence), dec = G.creerDeclencheur(), h = G.creerHistorique(), coups = [];
  for (const e of ech) { h.ajouter(e.t, e.rot, e.acc); if (dec.traiter(e.rot, e.t)) coups.push({ t: e.t, i: ech.indexOf(e) }); }
  // mesures de -AVANT à +150 ms autour de chaque déclenchement, rattachées au geste réellement fait
  return coups.map((c) => {
    const vrai = vrais.reduce((a, b) => (Math.abs(b.t - c.t) < Math.abs(a.t - c.t) ? b : a));
    return { geste: vrai.geste, t: c.t, mesures: ech.filter((e) => e.t >= c.t - 200 && e.t <= c.t + 200) };
  });
}
const SEQUENCE = [];
const QUATRE = ['bas', 'haut', 'droite', 'gauche'];
for (let k = 0; k < 15; k++) for (const g of QUATRE) SEQUENCE.push(g);

test('détection : chaque geste (y compris vers la droite et vers la gauche) donne exactement un coup', () => {
  const ex = exemples(SEQUENCE);
  assert.strictEqual(ex.length, SEQUENCE.length, `${ex.length} coups pour ${SEQUENCE.length} gestes`);
  assert.deepStrictEqual(ex.map((e) => e.geste), SEQUENCE);
});

test('détection : coups enchaînés vite (20 séances de 12 coups par tempo) : tous détectés jusqu\'à 5 par seconde, ≥ 99 % à 6, ≥ 95 % à 8, jamais en double', () => {
  const sauve = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, v.duree]));
  for (const [tempo, duree, minimum] of [[2, 140, 1], [4, 100, 1], [5, 90, 1], [6, 80, 0.99], [8, 70, 0.95]]) {
    for (const k of Object.keys(TYPES)) TYPES[k].duree = duree;
    let total = 0;
    for (let s = 0; s < 20; s++) {
      const seq = []; for (let k = 0; k < 12; k++) seq.push(QUATRE[(k + s) % 4]);
      const { ech } = seance(seq, { calme: Math.max(0, 1000 / tempo - duree) }), dec = G.creerDeclencheur();
      let n = 0; for (const e of ech) if (dec.traiter(e.rot, e.t)) n++;
      assert.ok(n <= 12, `${tempo} coups/s : ${n} sons pour 12 coups`);
      total += n;
    }
    assert.ok(total >= minimum * 240, `${tempo} coups/s : ${total}/240`);
  }
  for (const [k, d] of Object.entries(sauve)) TYPES[k].duree = d;
});

test('détection : le rebond du poignet (jusqu\'à 50 % de la vitesse du coup, comme mesuré sur iPhone) ne compte pas comme un second coup', () => {
  for (const rebond of [0.3, 0.5]) for (const calme of [900, 250]) {
    const seq = ['bas', 'haut', 'droite', 'gauche', 'bas', 'gauche', 'haut', 'droite', 'gauche', 'droite', 'bas', 'haut'];
    const { ech } = seance(seq, { calme, rebond }), dec = G.creerDeclencheur();
    let n = 0; for (const e of ech) if (dec.traiter(e.rot, e.t)) n++;
    assert.strictEqual(n, 12, `rebond ${rebond * 100} %, ${calme} ms entre les coups : ${n} coups pour 12`);
  }
});

test('reconnaissance : précision selon l\'attente après le déclenchement (15 exemples par geste)', () => {
  const ex = exemples(SEQUENCE), lignes = [];
  for (const attente of [0, 30, 60, 100]) {
    const r = G.evaluer(ex, attente);
    lignes.push(`      attente ${String(attente).padStart(3)} ms : ${Math.round(r.precision * 100)} %` + (Object.keys(r.confusions).length ? '  (confusions : ' + Object.entries(r.confusions).map(([c, n]) => `${c} ×${n}`).join(', ') + ')' : ''));
    if (attente === 30) assert.ok(r.precision >= 0.95, `${Math.round(r.precision * 100)} % à 30 ms`);
  }
  console.log(lignes.join('\n'));
});

test('reconnaissance : un modèle entraîné sur une séance reconnaît les gestes d\'une autre séance', () => {
  const app = exemples(SEQUENCE), jeu = exemples(['droite', 'gauche', 'bas', 'haut', 'gauche', 'bas', 'droite', 'haut', 'haut', 'gauche', 'droite', 'bas', 'gauche', 'haut', 'droite', 'bas']);
  const modele = G.entrainer(app.map((e) => ({ geste: e.geste, resume: G.resumer(e.mesures, e.t, 60) })));
  const trouves = jeu.map((e) => modele.classer(G.resumer(e.mesures, e.t, 60)));
  const justes = trouves.filter((g, i) => g === jeu[i].geste).length;
  assert.ok(justes >= 15, `${justes}/16 : ${trouves.join(' ')}`);
});

test('cas limites : un seul exemple, aucun exemple, mesures absentes', () => {
  const r = Array.from({ length: 36 }, (_, i) => i / 10);
  assert.strictEqual(G.entrainer([{ geste: 'bas', resume: r }]).classer(r), 'bas');
  assert.strictEqual(G.entrainer([]), null);
  const h = G.creerHistorique(); h.ajouter(0, null, null); h.ajouter(16, { alpha: NaN }, { x: 1 });
  assert.strictEqual(G.resumer(h.mesures, 8, 30).length, 36);
  assert.strictEqual(G.evaluer([], 30).precision, 0);
});

// ---- Geste en deux élans (hésitation au milieu) ----
// Vitesse de rotation autour d'un seul axe, bosses successives : [début ms, durée ms, sommet °/s (signe = sens)]
function bosses(liste, hz = 60) {
  const fin = Math.max(...liste.map(([d, l]) => d + l)) + 300, ech = [];
  for (let t = 0; t < fin; t += 1000 / hz) {
    let w = 0; for (const [d, l, s] of liste) if (t >= d && t <= d + l) w += s * Math.sin(Math.PI * (t - d) / l);
    ech.push({ t, rot: [0, 0, w + entre(-3, 3)], acc: [0, 0, 0] });
  }
  return ech;
}
const compterBosses = (liste) => { const d = G.creerDeclencheur(); let n = 0; for (const e of bosses(liste)) if (d.traiter(e.rot, e.t)) n++; return n; };

test('détection : un geste qui hésite au milieu puis repart dans le même sens ne compte qu\'une fois', () => {
  // profil relevé sur iPhone le 21/10 : 366 °/s, creux à 116 °/s, puis 632 °/s dans le même sens
  assert.strictEqual(compterBosses([[0, 130, 366], [120, 200, 632]]), 1);
});

test('détection : deux coups dans le même sens séparés par un retour comptent deux fois, même vite (le retour est aussi un mouvement détecté)', () => {
  assert.strictEqual(compterBosses([[0, 120, 600], [130, 120, -500], [260, 120, 600]]), 3);   // coup, retour, coup : ~4 coups/s
  // mouvements de 110 ms (environ 4 coups par seconde avec retour) : limite du détecteur avant cette correction, à garder
  assert.strictEqual(compterBosses([0, 1, 2, 3, 4].map((k) => [k * 115, 110, k % 2 ? -500 : 600])), 5);
});

test('détection : coup puis un autre dans une autre direction, sans retour → les deux comptent', () => {
  const d = G.creerDeclencheur(); let n = 0;
  for (const e of bosses([[0, 130, 600]])) if (d.traiter(e.rot, e.t)) n++;
  for (const e of bosses([[0, 130, 600]])) if (d.traiter([e.rot[2], 0, 0], e.t + 450)) n++;   // vers un autre axe, 450 ms après
  assert.strictEqual(n, 2);
});

test('vraies mesures iPhone : le geste en deux élans de 21 383/21 533 ms n\'est plus compté deux fois', () => {
  const vrai = require('./mesures-iphone.json').mesures, d = G.creerDeclencheur({ seuil: 216 }), t = [];
  for (const e of vrai) if (d.traiter(e[1], e[0])) t.push(e[0]);
  assert.ok(t.includes(21383) && !t.includes(21533), t.join(' '));
  // 26 266/26 500 ms : le 2e élan part ~65° à côté du premier (geste qui tourne) ; il reste compté à part, pour ne jamais
  // fusionner deux vrais coups dans des directions voisines quand l'inclinaison du téléphone change
  // les autres détections ne bougent pas
  for (const x of [18417, 18866, 19467, 19850, 21966, 22516, 22900, 23483, 23966, 25816, 27133, 27567]) assert.ok(t.includes(x), x + ' a disparu : ' + t.join(' '));
});

// ---- Apprentissage guidé (apprentissage.js) ----
const A = require('./apprentissage.js');
// Joue une séance d'apprentissage simulée comme la page : détection, puis coup transmis après la fenêtre de mesure
function apprendre(parGesteJoue, { retour = 0, gestes = QUATRE } = {}) {
  const evenements = [], attentes = [];
  let horloge = 0;
  const app = A.creerApprentissage({ gestes: gestes.map((id) => ({ id })), signaler: (e) => evenements.push(e),
    maintenant: () => horloge, minuterie: (f, ms) => attentes.push([horloge + ms, f]) });
  const resultats = [];
  let decalage = 2000;   // la séance commence après la préparation
  for (const [k, id] of gestes.entries()) {
    const { ech } = seance(Array(parGesteJoue).fill(id), { retour }), dec = G.creerDeclencheur(), h = G.creerHistorique(), enAttente = [];
    for (const e of ech) {
      if (app.etape !== k && !enAttente.length) break;   // on s'arrête aux deux bips, comme en vrai
      const t = e.t + decalage; horloge = t;
      for (const [quand, f] of attentes.splice(0)) if (quand <= t) f(); else attentes.push([quand, f]);
      h.ajouter(t, e.rot, e.acc);
      if (dec.traiter(e.rot, t) && app.ecoute(t)) enAttente.push({ t, etape: app.etape });
      for (const c of enAttente.filter((c) => t >= c.t + 220)) {
        enAttente.splice(enAttente.indexOf(c), 1);
        resultats.push(app.coup(c.t, c.etape, h.mesures.filter((m) => m.t >= c.t - 100 && m.t <= c.t + 200)));
      }
    }
    decalage += ech[ech.length - 1].t + 1500;
  }
  return { evenements, resultats, app };
}

test('apprentissage : 10 coups par geste avec des retours aussi rapides que le coup → retours ignorés, 40 exemples justes', () => {
  const { evenements, resultats } = apprendre(12, { retour: 1 });
  const fin = evenements.find((e) => e.type === 'fin');
  assert.ok(fin, 'apprentissage non terminé : ' + resultats.join(' '));
  assert.ok(resultats.includes('retour'), 'aucun retour détecté : le test ne prouve rien');
  assert.strictEqual(fin.exemples.length, 40);
  assert.deepStrictEqual(QUATRE.map((g) => fin.exemples.filter((e) => e.geste === g).length), [10, 10, 10, 10]);
  // chaque exemple tourne dans le sens de son geste : aucun retour appris
  const sensMoyen = {};
  for (const e of fin.exemples) { const s = A.sensDuCoup(e.mesures, e.t), n = Math.hypot(...s); sensMoyen[e.geste] = (sensMoyen[e.geste] || [0, 0, 0]).map((x, i) => x + s[i] / n); }
  for (const e of fin.exemples) assert.ok(A.sensDuCoup(e.mesures, e.t).reduce((a, x, i) => a + x * sensMoyen[e.geste][i], 0) > 0, 'un retour a été appris comme ' + e.geste);
  assert.ok(fin.precisions.length === 4 && A.ATTENTES.includes(fin.attente));
});

test('apprentissage : sans retour détecté, chaque coup compte, et les événements arrivent dans l\'ordre', () => {
  const { evenements, resultats } = apprendre(10);
  assert.ok(resultats.every((r) => r === 'compte'), resultats.join(' '));
  const types = evenements.map((e) => e.type + (e.etape !== undefined ? e.etape : ''));
  assert.deepStrictEqual(types.filter((x) => !x.startsWith('coup')), ['preparation', 'debut0', 'gesteFini0', 'debut1', 'gesteFini1', 'debut2', 'gesteFini2', 'debut3', 'fin']);
  assert.strictEqual(types.filter((x) => x.startsWith('coup')).length, 4 * 9);
});

test('apprentissage : un coup qui déborde sur le geste suivant, ou arrivé après la fin, est ignoré', () => {
  const app = A.creerApprentissage({ gestes: [{ id: 'bas' }, { id: 'haut' }], parGeste: 1, signaler: () => {}, maintenant: () => 0, minuterie: () => {} });
  const m = (sens) => [0, 20, 40, 60].map((t) => ({ t, rot: [0, sens * 300, 0], acc: [0, 0, 0] }));
  assert.strictEqual(app.coup(0, 0, m(1)), 'compte');
  assert.strictEqual(app.coup(0, 0, m(1)), 'deborde');   // détecté pendant le geste 1, arrivé après la fin de celui-ci
  assert.strictEqual(app.coup(0, 1, m(-1)), 'compte');
  assert.strictEqual(app.fini, true);
  assert.strictEqual(app.coup(0, 1, m(-1)), 'deborde');
});

test('apprentissage : le jeu de 4 gestes appris (retours ignorés) reconnaît droite puis le retour vers la gauche', () => {
  const { evenements } = apprendre(12, { retour: 1 });
  const fin = evenements.find((e) => e.type === 'fin');
  const modele = G.entrainer(fin.exemples.map((e) => ({ geste: e.geste, resume: G.resumer(e.mesures, e.t, fin.attente) })));
  const jeu = exemples(['droite', 'gauche', 'droite', 'gauche', 'bas', 'haut', 'bas', 'haut']);
  const trouves = jeu.map((e) => modele.classer(G.resumer(e.mesures, e.t, fin.attente)));
  assert.ok(trouves.filter((g, i) => g === jeu[i].geste).length >= 7, trouves.join(' '));
});

// ---- Écran du téléphone (jeu-gestes.js) chargé avec un faux écran et une horloge simulée ----
function jeuSimule(parDefaut = []) {
  const vm = require('vm'), fs = require('fs');
  let horloge = 0; const file = [];
  const ctx = { performance: { now: () => horloge }, setTimeout: (f, ms) => file.push([horloge + ms, f]), clearTimeout() {}, localStorage: { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = String(v); } }, Math, JSON };
  ctx.window = ctx; vm.createContext(ctx);
  for (const f of ['gestes.js', 'apprentissage.js', 'jeu-gestes.js']) vm.runInContext(fs.readFileSync(__dirname + '/' + f, 'utf8').replace(/typeof module !== 'undefined'/g, 'false'), ctx);
  const elements = {}, $ = (id) => (elements[id] = elements[id] || { style: {}, innerHTML: '', textContent: '', hidden: false, querySelectorAll: () => [] });
  const bips = [];
  const sortie = { sonner() {} };
  const jeu = ctx.JeuGestes.creerJeu({ $, seuil: 216, sonner: (g, f) => sortie.sonner(g, f), biper: (b) => bips.push(b), parDefaut });
  const avancer = (t) => { for (;;) { file.sort((a, b) => a[0] - b[0]); if (!file.length || file[0][0] > t) break; const [q, f] = file.shift(); horloge = q; f(); } horloge = t; };
  const mouvement = (rot, acc = [0, 0, 0]) => jeu.surMouvement({ rotationRate: { alpha: rot[0], beta: rot[1], gamma: rot[2] }, acceleration: { x: acc[0], y: acc[1], z: acc[2] } }, horloge);
  // joue des échantillons (t relatif) à partir de maintenant
  // arret() vrai → on s'arrête (comme l'utilisateur aux 2 bips de fin de geste)
  const jouer = (ech, arret = () => false) => { const h0 = horloge; for (const e of ech) { if (arret()) break; avancer(h0 + e.t); mouvement(e.rot, e.acc); } };
  const finDeGeste = () => { const n = bips.filter((b) => b === 'gesteFini' || b === 'fin').length; return () => bips.filter((b) => b === 'gesteFini' || b === 'fin').length > n; };
  return { jeu, bips, avancer, jouer, finDeGeste, get horloge() { return horloge; }, set sonner(f) { sortie.sonner = f; }, stockage: ctx.localStorage };
}

test('apprentissage : 15 petits bips par geste (le 15e suivi des 2 bips de fin de geste)', () => {
  const s = jeuSimule();
  s.jeu.apprendre(); s.avancer(1700);
  for (const g of QUATRE) { s.jouer(seance(Array(17).fill(g), { retour: 1 }).ech, s.finDeGeste()); s.avancer(s.horloge + 1800); }
  const n = (b) => s.bips.filter((x) => x === b).length;
  assert.deepStrictEqual([n('debut'), n('coup'), n('gesteFini'), n('fin')], [4, 60, 3, 1], s.bips.join(' '));
  assert.ok(s.bips.indexOf('gesteFini') > 0 && s.bips[s.bips.indexOf('gesteFini') - 1] === 'coup', 'le 15e coup doit biper avant les 2 bips');
});

test('apprentissage : un mouvement d\'installation juste après le départ (sans repos avant) ne fixe pas le sens du geste', () => {
  const s = jeuSimule();
  s.jeu.apprendre(); s.avancer(1400);
  // on remet le téléphone en position : agitation continue, puis un mouvement vif VERS LE HAUT (l'inverse du geste « bas »)
  const agitation = []; for (let t = 0; t < 400; t += 1000 / 60) agitation.push({ t, rot: [entre(-150, 150), entre(-150, 150), entre(-150, 150)], acc: [0, 0, 0] });
  s.jouer(agitation);
  s.jouer(seance(['haut'], { calme: 0 }).ech);
  // puis les coups vers le bas, avec leurs retours rapides
  s.jouer(seance(Array(17).fill('bas'), { retour: 1 }).ech, s.finDeGeste());
  const m = s.jeu.exemplesEnCours();
  assert.strictEqual(s.bips.filter((b) => b === 'coup').length, 15, s.bips.join(' '));
  // chaque exemple appris tourne dans le sens du coup « bas » simulé (pas de l'installation ni des retours)
  const { ech } = seance(['bas'], {}), k = ech.findIndex((e) => Math.hypot(...e.rot) > 216), bas = ech[k].rot;
  for (const e of m) assert.ok(A.sensDuCoup(e.mesures, e.t).reduce((a, x, i) => a + x * bas[i], 0) > 0, 'exemple de « bas » dans le mauvais sens');
  assert.strictEqual(m.length, 15);
});

// ---- Vrai apprentissage sur iPhone (22/10/2026) : élan avant le coup, coup vif, retour ----
// Rejoue chaque geste de l'enregistrement : mouvements détectés par le téléphone, décision de l'apprentissage
function rejouerApprentissageReel() {
  const j = require('./apprentissage-iphone.json');
  const mes = j.mesures.map(([t, rot, acc]) => ({ t, rot, acc }));
  const bornes = j.evenements.filter((e) => e[1] === 'debut').map((e) => e[0]);
  const fins = j.evenements.filter((e) => e[1] === 'gesteFini' || e[1] === 'fin').map((e) => e[0]);
  return bornes.map((debut, k) => {
    const app = A.creerApprentissage({ gestes: [{ id: QUATRE[k] }], parGeste: 1000, signaler: () => {}, maintenant: () => debut, minuterie: () => {}, preparation: 0 });
    const coups = j.decisions.filter((d) => d.etape === k && d.t >= debut && d.t <= fins[k] + 300).map((d) => {
      const m = mes.filter((x) => x.t >= d.t - 100 && x.t <= d.t + 200);
      return { t: d.t, sens: A.sensDuCoup(m, d.t), resultat: app.coup(d.t, 0, m, d.repos) };
    });
    return { geste: QUATRE[k], coups, exemples: app.exemples };
  });
}

test('vrai apprentissage iPhone : l\'élan (plus lent, en sens inverse) ne fixe plus le sens ; les coups vifs sont comptés, élans et retours écartés', () => {
  for (const { geste, coups, exemples } of rejouerApprentissageReel()) {
    const force = (c) => Math.hypot(...c.sens);
    // sens du geste = celui des mouvements les plus vifs (le vrai coup est toujours nettement plus vif que l'élan et le retour)
    const vifs = [...coups].sort((a, b) => force(b) - force(a)).slice(0, 4);
    const sensVif = vifs.reduce((s, c) => s.map((x, i) => x + c.sens[i] / force(c)), [0, 0, 0]);
    const ecartes = coups.filter((c) => c.resultat !== 'compte' && c.resultat !== 'recommence');
    const dot = (c) => c.sens.reduce((a, x, i) => a + x * sensVif[i], 0);
    // les exemples appris vont tous dans le sens des coups vifs (un élan compté au début est retiré)
    const mauvais = exemples.filter((e) => A.sensDuCoup(e.mesures, e.t).reduce((a, x, i) => a + x * sensVif[i], 0) <= 0);
    assert.strictEqual(mauvais.length, 0, `${geste} : ${mauvais.length} exemple(s) sur ${exemples.length} dans le mauvais sens`);
    // aucun coup vif dans le bon sens n'est écarté
    const perdus = ecartes.filter((c) => dot(c) > 0 && force(c) > 0.6 * force(vifs[3]) && c.resultat !== 'deborde' && c.resultat !== 'pasDeRepos');
    assert.strictEqual(perdus.length, 0, `${geste} : ${perdus.length} coup(s) vif(s) écarté(s)`);
  }
});

// ---- Jeu : retour muet pour droite / gauche ----
// Apprend les 4 gestes simulés dans le vrai jeu-gestes.js, puis joue ; renvoie les gestes sonnés
// retours à la moitié de la vitesse du coup pendant l'apprentissage (sur iPhone : 0,3 à 1 fois). Des retours parfaitement
// symétriques seraient identiques aux coups du geste inverse : appris comme « rien », ils feraient taire ces coups.
function jeuAppris() {
  const s = jeuSimule(), sons = [];
  s.sonner = (g) => sons.push(g.id);
  s.jeu.apprendre(); s.avancer(1700);
  for (const g of QUATRE) { s.jouer(seance(Array(17).fill(g), { retour: 0.5 }).ech, s.finDeGeste()); s.avancer(s.horloge + 1800); }
  // téléphone immobile 3 s (un vrai téléphone envoie ses mesures en continu)
  const immobile = []; for (let t = 0; t < 3000; t += 1000 / 60) immobile.push({ t, rot: [entre(-3, 3), entre(-3, 3), entre(-3, 3)], acc: [0, 0, 0] });
  s.jouer(immobile);
  return { s, sons };
}

test('jeu : le retour du poignet après un coup vers la droite (ou la gauche) ne sonne pas (5 séances de 6 coups avec retours rapides)', () => {
  let enTrop = 0, justes = 0;
  for (let k = 0; k < 5; k++) {
    const { s, sons } = jeuAppris(), seq = ['droite', 'droite', 'droite', 'gauche', 'gauche', 'gauche'];
    sons.length = 0; s.jouer(seance(seq, { retour: 1 }).ech); s.avancer(s.horloge + 1000);
    enTrop += Math.max(0, sons.length - seq.length); justes += seq.filter((g, i) => sons[i] === g).length;
  }
  // sans retour muet, les 30 retours sonnaient tous ; il en reste quelques-uns, quand le coup lui-même a été mal reconnu
  assert.ok(enTrop <= 5, enTrop + ' retour(s) ont sonné');
  assert.ok(justes >= 25, justes + '/30 coups justes');
});

test('jeu : droite puis gauche à une seconde d\'intervalle (sans retour) sonnent tous les deux ; haut et bas inchangés', () => {
  const { s, sons } = jeuAppris();
  sons.length = 0; s.jouer(seance(['droite', 'gauche', 'droite', 'gauche', 'bas', 'haut', 'bas', 'haut']).ech); s.avancer(s.horloge + 1000);
  // aucun son perdu (le retour muet ne touche pas un vrai coup donné une seconde plus tard), et presque tous justes
  const attendu = ['droite', 'gauche', 'droite', 'gauche', 'bas', 'haut', 'bas', 'haut'];
  assert.strictEqual(sons.length, 8, sons.join(' '));
  assert.ok(attendu.filter((g, i) => sons[i] === g).length >= 7, sons.join(' '));
});

// ---- Haut / bas par défaut (gestes-defaut.js : vrais coups iPhone du 22/10/2026, 15 h 39) ----
test('haut/bas par défaut : reconnaissent les vrais coups haut/bas d\'une autre séance (22/10, 15 h 19)', () => {
  const D = require('./gestes-defaut.js');
  // modèle sans les exemples tirés de cette séance-là (15 h 19), ni « rien » : reconnaissance des seuls vrais coups
  const modele = G.entrainer(D.filter((e) => e.s !== '15h19' && e.geste !== 'rien').map((e) => ({ geste: e.geste, resume: G.resumer(e.mesures, e.t, 30) })));
  // coups vifs haut/bas de l'autre séance (les 4 plus vifs de chaque geste donnent le sens, puis tous ceux qui vont dans ce sens)
  let justes = 0, total = 0;
  for (const { geste, coups } of rejouerApprentissageReel().filter((x) => x.geste === 'bas' || x.geste === 'haut')) {
    const force = (c) => Math.hypot(...c.sens), vifs = [...coups].sort((a, b) => force(b) - force(a)).slice(0, 4);
    const sensVif = vifs.reduce((s, c) => s.map((x, i) => x + c.sens[i] / force(c)), [0, 0, 0]);
    const mes = require('./apprentissage-iphone.json').mesures.map(([t, rot, acc]) => ({ t, rot, acc }));
    for (const c of coups.filter((c) => c.sens.reduce((a, x, i) => a + x * sensVif[i], 0) > 0 && force(c) > 0.5 * force(vifs[3]))) {
      total++; if (modele.classer(G.resumer(mes.filter((m) => m.t >= c.t - 100 && m.t <= c.t + 200), c.t, 30)) === geste) justes++;
    }
  }
  assert.ok(total >= 15 && justes / total >= 0.95, `${justes}/${total}`);
});

// exemples haut/bas « par défaut » pour la simulation (les vrais sont propres à l'iPhone de l'utilisateur et à sa prise en main)
const defautSimule = () => exemples(['bas', 'haut', 'bas', 'haut', 'bas', 'haut', 'bas', 'haut', 'bas', 'haut', 'bas', 'haut', 'bas', 'haut', 'bas', 'haut', 'bas', 'haut', 'bas', 'haut', 'bas', 'haut', 'bas', 'haut', 'bas', 'haut', 'bas', 'haut', 'bas', 'haut'])
  .map((e) => ({ geste: e.geste, t: e.t, mesures: e.mesures }));

test('haut/bas par défaut : l\'apprentissage ne demande que droite et gauche (2 × 15 coups), puis les 4 gestes jouent', () => {
  const s = jeuSimule(defautSimule()), sons = [];
  s.sonner = (g) => sons.push(g.id);
  assert.strictEqual(s.jeu.A_APPRENDRE.map((g) => g.id).join(' '), 'droite gauche');
  s.jeu.apprendre(); s.avancer(1700);
  for (const g of ['droite', 'gauche']) { s.jouer(seance(Array(17).fill(g), { retour: 0.5 }).ech, s.finDeGeste()); s.avancer(s.horloge + 1800); }
  const n = (b) => s.bips.filter((x) => x === b).length;
  assert.deepStrictEqual([n('debut'), n('coup'), n('gesteFini'), n('fin')], [2, 30, 1, 1], s.bips.join(' '));
  const immobile = []; for (let t = 0; t < 3000; t += 1000 / 60) immobile.push({ t, rot: [entre(-3, 3), entre(-3, 3), entre(-3, 3)], acc: [0, 0, 0] });
  s.jouer(immobile);
  const attendu = ['bas', 'haut', 'droite', 'gauche', 'bas', 'haut', 'droite', 'gauche'];
  s.jouer(seance(attendu).ech); s.avancer(s.horloge + 1000);
  assert.strictEqual(sons.length, 8, sons.join(' '));
  assert.ok(attendu.filter((g, i) => sons[i] === g).length >= 7, sons.join(' '));
});

test('haut/bas par défaut : sans rien d\'appris, il faut apprendre droite/gauche ; un ancien apprentissage des 4 gestes garde ses droite/gauche', () => {
  const s = jeuSimule(defautSimule());
  assert.strictEqual(s.jeu.charger(), false);   // rien d'appris : pas encore de jeu
  // ancien apprentissage complet, dont les exemples haut/bas sont remplacés par ceux par défaut
  const ancien = exemples(['bas', 'haut', 'droite', 'gauche', 'bas', 'haut', 'droite', 'gauche', 'droite', 'gauche']).map((e) => ({ geste: e.geste, t: e.t, mesures: e.mesures }));
  s.stockage.setItem('gyro-gestes-5', JSON.stringify({ exemples: ancien, attente: 30 }));
  assert.strictEqual(s.jeu.charger(), true);
});

test('exemples par défaut (5 séances iPhone du 22/10) : chaque séance, reconnue avec ce qui a été appris sur les 4 autres → ≥ 85 % de vrais coups justes, ≤ 8 % de mouvements « rien » qui sonnent', () => {
  const D = require('./gestes-defaut.js');
  assert.ok(QUATRE.every((g) => D.filter((e) => e.geste === g).length >= 50) && D.filter((e) => e.geste === 'rien').length >= 200);
  let justes = 0, coups = 0, sonnent = 0, rien = 0; const detail = [];
  for (const seance of [...new Set(D.map((e) => e.s))]) {
    const mod = G.entrainer(D.filter((e) => e.s !== seance).map((e) => ({ geste: e.geste, resume: G.resumer(e.mesures, e.t, 30) })));
    let a = 0, b = 0, c = 0, d = 0;
    for (const e of D.filter((e) => e.s === seance)) { const p = mod.classer(G.resumer(e.mesures, e.t, 30));
      if (e.geste === 'rien') { d++; if (p !== 'rien') c++; } else { b++; if (p === e.geste) a++; } }
    justes += a; coups += b; sonnent += c; rien += d; detail.push(`${seance} ${a}/${b} · ${c}/${d}`);
  }
  console.log('      ' + detail.join(' | '));
  assert.ok(justes / coups >= 0.85, `vrais coups justes ${justes}/${coups}`);
  assert.ok(sonnent / rien <= 0.08, `« rien » qui sonnent ${sonnent}/${rien}`);
});

test('jeu : un mouvement reconnu « rien » ne sonne pas, et les vrais coups sonnent', () => {
  // « rien » simulé : petits mouvements lents de travers (réajustements)
  const reajuster = () => { const ech = []; const u = unite([entre(-1, 1), 1, entre(-1, 1)]); for (let t = 0; t < 700; t += 1000 / 60) { const x = t - 200, w = x > 0 && x < 300 ? 260 * Math.sin(Math.PI * x / 300) : 0; ech.push({ t, rot: u.map((c) => c * w + entre(-3, 3)), acc: [0, 0, 0] }); } return ech; };
  const unite = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
  const rien = []; for (let k = 0; k < 20; k++) { const ech = reajuster(), i = ech.findIndex((e) => Math.hypot(...e.rot) > 216); if (i > 0) rien.push({ geste: 'rien', t: ech[i].t, mesures: ech }); }
  const defaut = [...exemples(Array.from({ length: 60 }, (_, k) => QUATRE[k % 4])).map((e) => ({ geste: e.geste, t: e.t, mesures: e.mesures })), ...rien];
  const s = jeuSimule(defaut), sons = [];
  s.sonner = (g) => sons.push(g.id);
  assert.strictEqual(s.jeu.charger(), true);
  for (let k = 0; k < 5; k++) s.jouer(reajuster());
  s.avancer(s.horloge + 500);
  assert.ok(sons.length <= 1, '« rien » a sonné : ' + sons.join(' '));
  sons.length = 0; s.jouer(seance(['bas', 'haut', 'droite', 'gauche']).ech); s.avancer(s.horloge + 800);
  assert.ok(sons.length >= 3, 'vrais coups : ' + sons.join(' '));
});

test('4 gestes par défaut : on joue sans rien apprendre ; « Réapprendre » refait les 4 gestes, qui remplacent les exemples par défaut', () => {
  const defaut = exemples(Array.from({ length: 60 }, (_, k) => QUATRE[k % 4])).map((e) => ({ geste: e.geste, t: e.t, mesures: e.mesures }));
  const s = jeuSimule(defaut), sons = [];
  s.sonner = (g) => sons.push(g.id);
  assert.strictEqual(s.jeu.charger(), true);   // rien à apprendre
  assert.strictEqual(s.jeu.A_APPRENDRE.map((g) => g.id).join(' '), 'bas haut droite gauche');
  s.jeu.apprendre(); s.avancer(1700);
  for (const g of QUATRE) { s.jouer(seance(Array(17).fill(g), { retour: 0.5 }).ech, s.finDeGeste()); s.avancer(s.horloge + 1800); }
  assert.strictEqual(s.bips.filter((b) => b === 'coup').length, 60, s.bips.join(' '));
  const stocke = JSON.parse(s.stockage.getItem('gyro-gestes-5'));
  assert.strictEqual([...new Set(stocke.exemples.map((e) => e.geste))].join(' '), 'bas haut droite gauche');
  const immobile = []; for (let t = 0; t < 3000; t += 1000 / 60) immobile.push({ t, rot: [entre(-3, 3), entre(-3, 3), entre(-3, 3)], acc: [0, 0, 0] });
  s.jouer(immobile);
  const attendu = ['bas', 'haut', 'droite', 'gauche', 'bas', 'haut', 'droite', 'gauche'];
  s.jouer(seance(attendu).ech); s.avancer(s.horloge + 1000);
  assert.strictEqual(sons.length, 8, sons.join(' '));
  assert.ok(attendu.filter((g, i) => sons[i] === g).length >= 7, sons.join(' '));
});

// ---- Moment du son : au début du geste (rapide) ou à son arrêt (un coup s'arrête net ; élan et retour ralentissent en douceur) ----
// mouvement dans le sens u : montée en « montee » ms jusqu'à « pic » °/s, puis descente en « descente » ms
function mouvementSens(u, { montee = 60, pic = 700, descente = 50 } = {}) {
  const ech = [];
  for (let t = 0; t < 300 + montee + descente + 300; t += 1000 / 60) {
    const x = t - 300, w = x < 0 ? 0 : x < montee ? pic * Math.sin(Math.PI / 2 * x / montee) : x < montee + descente ? pic * Math.cos(Math.PI / 2 * (x - montee) / descente) : 0;
    ech.push({ t, rot: u.map((c) => c * w + entre(-3, 3)), acc: [0, 0, 0] });
  }
  return ech;
}
// sens de rotation d'un coup simulé (au sommet)
const sensDe = (g) => { const { ech } = seance([g], {}), e = ech.reduce((a, b) => (Math.hypot(...b.rot) > Math.hypot(...a.rot) ? b : a)); const n = Math.hypot(...e.rot); return e.rot.map((x) => x / n); };

test('moment du son « arrêt » : un coup qui s\'arrête net sonne ; un mouvement qui ralentit en douceur (élan, retour) se tait', () => {
  const { s, sons } = jeuAppris();
  s.jeu.changerMoment('arret');
  const u = sensDe('bas');
  sons.length = 0; s.jouer(mouvementSens(u, { descente: 50 })); s.avancer(s.horloge + 500);
  assert.strictEqual(sons.join(' '), 'bas', 'arrêt net : ' + sons.join(' '));
  sons.length = 0; s.jouer(mouvementSens(u, { descente: 400 })); s.avancer(s.horloge + 500);
  assert.strictEqual(sons.length, 0, 'arrêt en douceur : ' + sons.join(' '));
  // au début du geste (réglage par défaut), le même mouvement doux sonne
  s.jeu.changerMoment('debut');
  sons.length = 0; s.jouer(mouvementSens(u, { descente: 400 })); s.avancer(s.horloge + 500);
  assert.strictEqual(sons.join(' '), 'bas', 'début du geste : ' + sons.join(' '));
});

test('moment du son « arrêt » : le son part à l\'arrêt (après le sommet), et une suite de vrais coups est jouée en entier', () => {
  const { s, sons } = jeuAppris();
  const instants = []; s.sonner = (g) => { sons.push(g.id); instants.push(s.horloge); };
  s.jeu.changerMoment('arret');
  // coup du simulateur : le geste part à 450 ms, son sommet de vitesse est à mi-parcours (~70 ms plus tard)
  const h0 = s.horloge;
  s.jouer(seance(['haut']).ech); s.avancer(s.horloge + 500);
  assert.strictEqual(sons.length, 1, sons.join(' '));   // un seul son (la reconnaissance elle-même est vérifiée ailleurs)
  assert.ok(instants[0] - h0 >= 450 + 50, `son à ${Math.round(instants[0] - h0 - 450)} ms du début du geste`);
  sons.length = 0; const attendu = ['bas', 'haut', 'droite', 'gauche', 'bas', 'haut', 'droite', 'gauche'];
  s.jouer(seance(attendu).ech); s.avancer(s.horloge + 1000);
  assert.strictEqual(sons.length, 8, sons.join(' '));
  assert.ok(attendu.filter((g, i) => sons[i] === g).length >= 7, sons.join(' '));
});

console.log(`\n${ok} tests réussis${process.exitCode ? ' — DES ÉCHECS' : ''}`);
