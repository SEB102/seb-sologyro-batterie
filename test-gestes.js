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

// ---- Écran du téléphone (jeu-gestes.js : 3 gestes, bas, haut, gauche) chargé avec un faux écran et une horloge simulée ----
const TROIS = ['bas', 'haut', 'gauche'];
function jeuSimule(parDefaut = [], { attenteDefaut, memoire = {}, seuil = 216 } = {}) {
  const vm = require('vm'), fs = require('fs');
  let horloge = 0; const file = [];
  const ctx = { performance: { now: () => horloge }, setTimeout: (f, ms) => file.push([horloge + ms, f]), clearTimeout() {}, localStorage: { m: memoire, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = String(v); } }, Math, JSON };
  ctx.window = ctx; vm.createContext(ctx);
  for (const f of ['gestes.js', 'apprentissage.js', 'jeu-gestes.js']) vm.runInContext(fs.readFileSync(__dirname + '/' + f, 'utf8').replace(/typeof module !== 'undefined'/g, 'false'), ctx);
  const elements = {}, $ = (id) => (elements[id] = elements[id] || { style: {}, innerHTML: '', textContent: '', hidden: false, querySelectorAll: () => [] });
  const bips = [];
  const sortie = { sonner() {} };
  const jeu = ctx.JeuGestes.creerJeu({ $, seuil, sonner: (g, f) => sortie.sonner(g, f), biper: (b) => bips.push(b), parDefaut, attenteDefaut });
  const avancer = (t) => { for (;;) { file.sort((a, b) => a[0] - b[0]); if (!file.length || file[0][0] > t) break; const [q, f] = file.shift(); horloge = q; f(); } horloge = t; };
  const mouvement = (rot, acc = [0, 0, 0]) => jeu.surMouvement({ rotationRate: { alpha: rot[0], beta: rot[1], gamma: rot[2] }, acceleration: { x: acc[0], y: acc[1], z: acc[2] } }, horloge);
  // joue des échantillons (t relatif) à partir de maintenant ; arret() vrai → on s'arrête (comme l'utilisateur aux 2 bips de fin de geste)
  const jouer = (ech, arret = () => false) => { const h0 = horloge; for (const e of ech) { if (arret()) break; avancer(h0 + e.t); mouvement(e.rot, e.acc); } };
  const finDeGeste = () => { const n = bips.filter((b) => b === 'gesteFini' || b === 'fin').length; return () => bips.filter((b) => b === 'gesteFini' || b === 'fin').length > n; };
  return { jeu, bips, avancer, jouer, finDeGeste, elements, JeuGestes: ctx.JeuGestes, get horloge() { return horloge; }, set sonner(f) { sortie.sonner = f; }, stockage: ctx.localStorage };
}
const immobile = () => { const l = []; for (let t = 0; t < 3000; t += 1000 / 60) l.push({ t, rot: [entre(-3, 3), entre(-3, 3), entre(-3, 3)], acc: [0, 0, 0] }); return l; };
const exemplesDe = (seq) => exemples(seq).map((e) => ({ geste: e.geste, t: e.t, mesures: e.mesures }));
// apprend les 3 gestes simulés dans le vrai jeu-gestes.js (13 coups joués par geste, on s'arrête aux 2 bips), puis immobile 3 s
function jeuAppris(parDefaut = []) {
  const s = jeuSimule(parDefaut), sons = [];
  s.sonner = (g) => sons.push(g.id);
  s.jeu.apprendre(); s.avancer(1700);
  for (const g of s.jeu.A_APPRENDRE.map((x) => x.id)) { s.jouer(seance(Array(13).fill(g), { retour: 1 }).ech, s.finDeGeste()); s.avancer(s.horloge + 1800); }
  s.jouer(immobile());
  return { s, sons };
}

test('gestes : bas → grosse caisse, haut → cymbale, gauche → caisse claire ; plus de « droite »', () => {
  const s = jeuSimule();
  assert.strictEqual(s.JeuGestes.GESTES.map((g) => g.id + ':' + g.son).join(' '), 'bas:Grosse caisse haut:Cymbale gauche:Caisse claire');
  assert.strictEqual(s.JeuGestes.CLE, 'gyro-gestes-6');
});

test('apprentissage : 10 petits bips par geste (le 10e suivi des 2 bips de fin de geste)', () => {
  const s = jeuSimule();
  s.jeu.apprendre(); s.avancer(1700);
  for (const g of TROIS) { s.jouer(seance(Array(13).fill(g), { retour: 1 }).ech, s.finDeGeste()); s.avancer(s.horloge + 1800); }
  const n = (b) => s.bips.filter((x) => x === b).length;
  assert.deepStrictEqual([n('debut'), n('coup'), n('gesteFini'), n('fin')], [3, 30, 2, 1], s.bips.join(' '));
  assert.ok(s.bips.indexOf('gesteFini') > 0 && s.bips[s.bips.indexOf('gesteFini') - 1] === 'coup', 'le 10e coup doit biper avant les 2 bips');
  const stocke = JSON.parse(s.stockage.getItem('gyro-gestes-6'));
  assert.strictEqual(TROIS.map((g) => stocke.exemples.filter((e) => e.geste === g).length).join(' '), '10 10 10');
});

test('apprentissage : un mouvement d\'installation juste après le départ (sans repos avant) ne fixe pas le sens du geste', () => {
  const s = jeuSimule();
  s.jeu.apprendre(); s.avancer(1400);
  const agitation = []; for (let t = 0; t < 400; t += 1000 / 60) agitation.push({ t, rot: [entre(-150, 150), entre(-150, 150), entre(-150, 150)], acc: [0, 0, 0] });
  s.jouer(agitation);
  s.jouer(seance(['haut'], { calme: 0 }).ech);
  s.jouer(seance(Array(13).fill('bas'), { retour: 1 }).ech, s.finDeGeste());
  const m = s.jeu.exemplesEnCours();
  assert.strictEqual(s.bips.filter((b) => b === 'coup').length, 10, s.bips.join(' '));
  const { ech } = seance(['bas'], {}), k = ech.findIndex((e) => Math.hypot(...e.rot) > 216), bas = ech[k].rot;
  for (const e of m) assert.ok(A.sensDuCoup(e.mesures, e.t).reduce((a, x, i) => a + x * bas[i], 0) > 0, 'exemple de « bas » dans le mauvais sens');
  assert.strictEqual(m.length, 10);
});

test('jeu : le retour du poignet après un coup vers la gauche ne sonne pas (5 séances de 6 coups avec retours rapides)', () => {
  let enTrop = 0, justes = 0;
  for (let k = 0; k < 5; k++) {
    const { s, sons } = jeuAppris(), seq = Array(6).fill('gauche');
    sons.length = 0; s.jouer(seance(seq, { retour: 1 }).ech); s.avancer(s.horloge + 1000);
    enTrop += Math.max(0, sons.length - seq.length); justes += seq.filter((g, i) => sons[i] === g).length;
  }
  assert.ok(enTrop <= 5, enTrop + ' retour(s) ont sonné');
  assert.ok(justes >= 25, justes + '/30 coups justes');
});

test('jeu : gauche, bas et haut à une seconde d\'intervalle (sans retour) sonnent tous', () => {
  const { s, sons } = jeuAppris(), attendu = ['gauche', 'bas', 'gauche', 'haut', 'bas', 'haut', 'gauche', 'bas', 'haut'];
  sons.length = 0; s.jouer(seance(attendu).ech); s.avancer(s.horloge + 1000);
  assert.strictEqual(sons.length, attendu.length, sons.join(' '));
  assert.ok(attendu.filter((g, i) => sons[i] === g).length >= attendu.length - 1, sons.join(' '));
});

test('exemples par défaut partiels (bas et haut seulement) : l\'apprentissage ne demande que la gauche (10 coups), puis les 3 gestes jouent', () => {
  const defaut = exemplesDe(Array.from({ length: 30 }, (_, k) => ['bas', 'haut'][k % 2]));
  const s0 = jeuSimule(defaut); assert.strictEqual(s0.jeu.charger(), false);
  const { s, sons } = jeuAppris(defaut);
  assert.strictEqual(s.jeu.A_APPRENDRE.map((g) => g.id).join(' '), 'gauche');
  assert.strictEqual(s.bips.filter((b) => b === 'coup').length, 10, s.bips.join(' '));
  sons.length = 0; const attendu = ['bas', 'haut', 'gauche', 'bas', 'haut', 'gauche'];
  s.jouer(seance(attendu).ech); s.avancer(s.horloge + 1000);
  assert.ok(sons.length === 6 && attendu.filter((g, i) => sons[i] === g).length >= 5, sons.join(' '));
});

test('exemples par défaut (vrais coups iPhone, SOLO 22/10 19 h 46) : 10 de chaque, 100 % distingués, attente par défaut 0 ms', () => {
  const D = require('./gestes-defaut.js');
  assert.strictEqual(TROIS.map((g) => D.filter((e) => e.geste === g).length).join(' '), '10 10 10');
  assert.strictEqual(D.length, 30);
  assert.strictEqual(G.evaluer(D, 0).precision, 1);
  const c = {}; require('vm').runInNewContext(require('fs').readFileSync(__dirname + '/gestes-defaut.js', 'utf8').replace('(this)', '(globalThis)'), c);
  assert.strictEqual(c.ATTENTE_DEFAUT, 0);
});

test('à l\'ouverture : exemples et attente par défaut appliqués d\'office, même si un ancien apprentissage (gyro-gestes-5, 4 gestes) est en mémoire', () => {
  const D = require('./gestes-defaut.js');
  const ancien = exemplesDe(Array.from({ length: 40 }, (_, k) => ['bas', 'haut', 'droite', 'gauche'][k % 4]));
  const s = jeuSimule(D, { attenteDefaut: 0, memoire: { 'gyro-gestes-5': JSON.stringify({ exemples: ancien, attente: 60 }) } });
  assert.strictEqual(s.jeu.charger(), true);
  assert.strictEqual(s.jeu.attente, 0);
  assert.strictEqual(s.stockage.getItem('gyro-gestes-6'), null);   // rien d'écrit tant qu'on ne réapprend pas
});

test('« Réapprendre » : 3 gestes × 10 coups remplacent les exemples par défaut, enregistrés dans gyro-gestes-6', () => {
  const defaut = exemplesDe(Array.from({ length: 30 }, (_, k) => TROIS[k % 3]));
  const s0 = jeuSimule(defaut); assert.strictEqual(s0.jeu.charger(), true);
  assert.strictEqual(s0.jeu.A_APPRENDRE.map((g) => g.id).join(' '), 'bas haut gauche');
  const { s, sons } = jeuAppris(defaut);
  assert.strictEqual(s.bips.filter((b) => b === 'coup').length, 30, s.bips.join(' '));
  const stocke = JSON.parse(s.stockage.getItem('gyro-gestes-6'));
  assert.strictEqual(stocke.exemples.length, 30);
  sons.length = 0; const attendu = ['bas', 'haut', 'gauche', 'bas', 'haut', 'gauche'];
  s.jouer(seance(attendu).ech); s.avancer(s.horloge + 1000);
  assert.ok(sons.length === 6 && attendu.filter((g, i) => sons[i] === g).length >= 5, sons.join(' '));
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
  assert.strictEqual(sons.length, 1, 'arrêt net : ' + sons.join(' '));
  sons.length = 0; s.jouer(mouvementSens(u, { descente: 400 })); s.avancer(s.horloge + 500);
  assert.strictEqual(sons.length, 0, 'arrêt en douceur : ' + sons.join(' '));
  s.jeu.changerMoment('debut');
  sons.length = 0; s.jouer(mouvementSens(u, { descente: 400 })); s.avancer(s.horloge + 500);
  assert.strictEqual(sons.length, 1, 'début du geste : ' + sons.join(' '));
});

test('moment du son « arrêt » : le son part à l\'arrêt (après le sommet), et une suite de vrais coups est jouée en entier', () => {
  const { s, sons } = jeuAppris();
  const instants = []; s.sonner = (g) => { sons.push(g.id); instants.push(s.horloge); };
  sons.length = 0;
  s.jeu.changerMoment('arret');
  const h0 = s.horloge;
  s.jouer(seance(['haut']).ech); s.avancer(s.horloge + 500);
  assert.strictEqual(sons.length, 1, sons.join(' '));
  assert.ok(instants[0] - h0 >= 450 + 50, `son à ${Math.round(instants[0] - h0 - 450)} ms du début du geste`);
  sons.length = 0; const attendu = ['bas', 'haut', 'gauche', 'bas', 'haut', 'gauche', 'bas', 'haut'];
  s.jouer(seance(attendu).ech); s.avancer(s.horloge + 1000);
  assert.strictEqual(sons.length, 8, sons.join(' '));
  assert.ok(attendu.filter((g, i) => sons[i] === g).length >= 7, sons.join(' '));
});

// ---- Gaucher : téléphone dans la main gauche, tenu en miroir (écran vers la paume, haut du téléphone du même côté) ----
const miroirDe = () => jeuSimule().JeuGestes.miroir;
// mesure (rot [α, β, γ], acc [x, y, z]) passée par le miroir du module
const enMiroir = (m) => { const [r, a] = miroirDe()({ alpha: m.rot[0], beta: m.rot[1], gamma: m.rot[2] }, { x: m.acc[0], y: m.acc[1], z: m.acc[2] }); return { ...m, rot: [r.alpha, r.beta, r.gamma], acc: [a.x, a.y, a.z] }; };

test('gaucher, géométrie : le miroir du module est exactement celui d\'une main gauche tenant le téléphone en miroir (écran vers la paume, haut devant)', () => {
  // pièce : X devant, Y à gauche, Z en haut ; M = miroir gauche/droite ; P = symétrie de l'axe x du téléphone
  const mul = (A, B) => A.map((l) => B[0].map((_, j) => l.reduce((s, x, k) => s + x * B[k][j], 0)));
  const app = (A, v) => A.map((l) => l.reduce((s, x, k) => s + x * v[k], 0)), tr = (A) => A[0].map((_, j) => A.map((l) => l[j]));
  const M = [[1, 0, 0], [0, -1, 0], [0, 0, 1]], P = [[-1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const rot = (u, a) => { const c = Math.cos(a), s = Math.sin(a), [x, y, z] = u; return [[c + x * x * (1 - c), x * y * (1 - c) - z * s, x * z * (1 - c) + y * s], [y * x * (1 - c) + z * s, c + y * y * (1 - c), y * z * (1 - c) - x * s], [z * x * (1 - c) - y * s, z * y * (1 - c) + x * s, c + z * z * (1 - c)]]; };
  const det = (A) => A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
  const m = miroirDe();
  for (let k = 0; k < 200; k++) {
    const u = [entre(-1, 1), entre(-1, 1), entre(-1, 1)], n = Math.hypot(...u), R = rot(u.map((x) => x / n), entre(-3, 3));   // tenue quelconque (téléphone → pièce)
    const w = [entre(-900, 900), entre(-900, 900), entre(-900, 900)], a = [entre(-20, 20), entre(-20, 20), entre(-20, 20)];   // dans le repère du téléphone
    const Rg = mul(mul(M, R), P);                                         // même tenue, main gauche, en miroir
    assert.ok(Math.abs(det(Rg) - 1) < 1e-9, 'la tenue miroir doit être un vrai téléphone');
    const wg = app(tr(Rg), app(M, app(R, w)).map((x) => -x));             // rotation : vecteur axial, ω' = −M ω dans la pièce
    const ag = app(tr(Rg), app(M, app(R, a)));                            // accélération : vecteur ordinaire
    const [r2, a2] = m({ alpha: wg[0], beta: wg[1], gamma: wg[2] }, { x: ag[0], y: ag[1], z: ag[2] });   // ramené en droitier
    assert.ok([r2.alpha - w[0], r2.beta - w[1], r2.gamma - w[2], a2.x - a[0], a2.y - a[1], a2.z - a[2]].every((d) => Math.abs(d) < 1e-6), 'miroir faux');
  }
  // prise en main de l'iPhone (x vertical, y devant) : le geste « gauche » droitier (lacet vers la gauche, +Z) devient pour le gaucher un lacet vers la droite
  const R = [[0, 1, 0], [0, 0, 1], [1, 0, 0]];   // colonnes : x → haut, y → devant, z → gauche
  const Rg = mul(mul(M, R), P);
  assert.deepStrictEqual(tr(Rg).map((c) => c.map(Math.round)), [[0, 0, -1], [1, 0, 0], [0, -1, 0]], 'main gauche : x vers le bas, y devant, z vers la droite');
  const gw = app(M, [0, 0, 1]).map((x) => -x); assert.deepStrictEqual(gw.map((x) => x + 0), [0, 0, -1]);
});

test('gaucher, vrais coups iPhone passés en miroir : en mode gaucher chacun sonne son geste ; en mode droitier haut et bas sont échangés', () => {
  const D = require('./gestes-defaut.js');
  for (const modeGaucher of [true, false]) {
    const s = jeuSimule(D, { attenteDefaut: 0, seuil: 178 }), sons = [];
    s.sonner = (g) => sons.push(g.id); s.jeu.charger(); s.jeu.changerMain(modeGaucher);
    const joues = [];
    for (const e of D) {
      s.jouer(immobile().slice(0, 40));
      s.jouer(e.mesures.map((m) => enMiroir({ ...m, t: m.t + 100 })));   // ce que produit un gaucher : l'image en miroir du coup
      s.jouer(immobile().slice(0, 40)); joues.push(e.geste);
    }
    if (modeGaucher) assert.deepStrictEqual(sons, joues, sons.join(' '));
    // sans le mode gaucher, le téléphone tenu en miroir (l'autre grand côté en bas) échange haut et bas ; le coup latéral, lui, reste
    // reconnu (le lacet vers la droite, téléphone retourné, tourne dans le même sens autour de son axe x que le lacet droitier)
    else assert.deepStrictEqual(sons, joues.map((g) => ({ bas: 'haut', haut: 'bas', gauche: 'gauche' })[g]), 'droitier : ' + sons.join(' '));
  }
});

test('gaucher : un apprentissage fait en mode gaucher (gestes en miroir) est enregistré en droitier et joue juste dans les deux modes', () => {
  const s = jeuSimule(), sons = []; s.sonner = (g) => sons.push(g.id);
  s.jeu.changerMain(true); assert.strictEqual(s.jeu.gaucher, true);
  s.jeu.apprendre(); s.avancer(1700);
  for (const g of TROIS) { s.jouer(seance(Array(13).fill(g), { retour: 1 }).ech.map(enMiroir), s.finDeGeste()); s.avancer(s.horloge + 1800); }
  assert.strictEqual(s.bips.filter((b) => b === 'coup').length, 30, s.bips.join(' '));
  s.jouer(immobile());
  const attendu = ['bas', 'haut', 'gauche', 'bas', 'gauche', 'haut'];
  sons.length = 0; s.jouer(seance(attendu).ech.map(enMiroir)); s.avancer(s.horloge + 1000);
  assert.ok(sons.length === 6 && attendu.filter((g, i) => sons[i] === g).length >= 5, 'gaucher : ' + sons.join(' '));
  s.jeu.changerMain(false); s.jouer(immobile());
  sons.length = 0; s.jouer(seance(attendu).ech); s.avancer(s.horloge + 1000);
  assert.ok(sons.length === 6 && attendu.filter((g, i) => sons[i] === g).length >= 5, 'droitier : ' + sons.join(' '));
});

test('gaucher : l\'écran d\'apprentissage annonce le coup latéral vers la droite', () => {
  const s = jeuSimule([], {}); s.jeu.changerMain(true); s.jeu.apprendre(); s.avancer(1700);
  s.jouer(seance(Array(13).fill('bas'), { retour: 1 }).ech, s.finDeGeste()); s.avancer(s.horloge + 1800);
  s.jouer(seance(Array(13).fill('haut'), { retour: 1 }).ech.map(enMiroir), s.finDeGeste()); s.avancer(s.horloge + 1800);
  assert.ok(/vers la DROITE/.test(s.elements.flash.innerHTML) && !/GAUCHE/.test(s.elements.flash.innerHTML), s.elements.flash.innerHTML);
});

console.log(`\n${ok} tests réussis${process.exitCode ? ' — DES ÉCHECS' : ''}`);
