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
function seance(sequence, { hz = 60, calme = 900, rebond = 0 } = {}) {
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
    const angle = rebond
      ? (u) => { const dr = 0.3 / rebond; return aller(u) - (u <= 1 ? 0 : u >= 1 + dr ? 0.3 * amp : 0.3 * amp * (1 - Math.cos(Math.PI * (u - 1) / dr)) / 2); }   // retour de 30 % du geste
      : (u) => aller(u) - (u > 1.3 ? 0.3 * amp * Math.min(1, (u - 1.3) / 1.5) : 0);   // + petit retour lent
    const pos = (tt) => rotation(T.axe, angle((tt - t - calme / 2) / duree), ex).map((x) => x * 0.25);
    vrais.push({ geste: nom, t: t + calme / 2 });
    for (let tt = t; tt < t + calme + duree; tt += dt) {
      const u = (tt - t - calme / 2) / duree, h = 1;
      const w = (angle((tt + h - t - calme / 2) / duree) - angle((tt - h - t - calme / 2) / duree)) / (2 * h / 1000);   // rad/s
      const base = [ex, ey, ez].map((e) => rotation(T.axe, angle(u), e));
      const p0 = pos(tt - h), p1 = pos(tt), p2 = pos(tt + h), acc = [0, 1, 2].map((i) => (p2[i] - 2 * p1[i] + p0[i]) / (h / 1000) ** 2);
      ech.push({ t: tt, rot: base.map((e) => (w * (T.axe[0] * e[0] + T.axe[1] * e[1] + T.axe[2] * e[2]) * 180 / Math.PI) + entre(-3, 3)),
        acc: base.map((e) => acc[0] * e[0] + acc[1] * e[1] + acc[2] * e[2] + entre(-0.2, 0.2)) });
    }
    t += calme + duree;
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

console.log(`\n${ok} tests réussis${process.exitCode ? ' — DES ÉCHECS' : ''}`);
