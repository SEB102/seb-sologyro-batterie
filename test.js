// Tests : node test.js
const assert = require('assert');
const { creerDetecteur } = require('./detecteur.js');

let ok = 0;
function test(nom, f) {
  try { f(); ok++; console.log('OK  ', nom); }
  catch (e) { console.log('ÉCHEC', nom, '\n     ', e.message); process.exitCode = 1; }
}

// Fabrique un signal échantillonné à 60 Hz à partir de segments [durée ms, fonction(u 0..1) -> °/s]
function signal(segments, hz = 60) {
  const out = []; let t = 0; const dt = 1000 / hz;
  for (const [duree, f] of segments) {
    const n = Math.round(duree / dt);
    for (let i = 0; i < n; i++) { out.push([f(i / n), t]); t += dt; }
  }
  return out;
}
const cloche = (amp) => (u) => amp * Math.sin(Math.PI * u);
const zero = () => 0;
function passer(sig, reglages) {
  const d = creerDetecteur(reglages);
  return sig.map(([v, t]) => d.traiter(v, t)).filter(Boolean);
}

test('coup vers le bas → une grosse caisse', () => {
  const ev = passer(signal([[100, zero], [120, cloche(-800)], [200, zero]]));
  assert.deepStrictEqual(ev.map(e => e.type), ['grosse-caisse']);
});

test('coup vers le haut → une cymbale', () => {
  const ev = passer(signal([[100, zero], [120, cloche(800)], [200, zero]]));
  assert.deepStrictEqual(ev.map(e => e.type), ['cymbale']);
});

test('rebond du poignet après la grosse caisse → pas de cymbale fantôme', () => {
  const ev = passer(signal([[50, zero], [120, cloche(-900)], [100, cloche(450)], [200, zero]]));
  assert.deepStrictEqual(ev.map(e => e.type), ['grosse-caisse']);
});

test('inclinaison lente → rien', () => {
  const ev = passer(signal([[1000, cloche(-150)], [1000, cloche(200)]]));
  assert.strictEqual(ev.length, 0);
});

test('deux grosses caisses à 250 ms d\'écart → deux coups', () => {
  const ev = passer(signal([[50, zero], [120, cloche(-700)], [130, zero], [120, cloche(-700)], [100, zero]]));
  assert.deepStrictEqual(ev.map(e => e.type), ['grosse-caisse', 'grosse-caisse']);
});

test('grosse caisse puis cymbale à 400 ms → les deux', () => {
  const ev = passer(signal([[50, zero], [120, cloche(-700)], [280, zero], [120, cloche(700)], [100, zero]]));
  assert.deepStrictEqual(ev.map(e => e.type), ['grosse-caisse', 'cymbale']);
});

test('la force suit la vitesse du geste et reste dans 0..1', () => {
  const f = (amp) => passer(signal([[50, zero], [120, cloche(amp)], [100, zero]]))[0].force;
  const faible = f(-400), moyen = f(-700), fort = f(-3000);
  assert.ok(faible < moyen && moyen < fort, `${faible} ${moyen} ${fort}`);
  assert.ok(faible > 0 && fort === 1);
});

test('déclenché au sommet du geste (latence < 1 échantillon après le pic)', () => {
  const sig = signal([[50, zero], [120, cloche(-800)], [100, zero]]);
  const d = creerDetecteur();
  let tCoup = null;
  for (const [v, t] of sig) if (d.traiter(v, t)) { tCoup = t; break; }
  const tPic = sig.reduce((a, b) => (Math.abs(b[0]) > Math.abs(a[0]) ? b : a))[1];
  assert.ok(tCoup !== null && tCoup - tPic <= 2 * 1000 / 60, `pic ${tPic} coup ${tCoup}`);
});

test('valeurs absentes (null/NaN) ignorées sans planter', () => {
  const d = creerDetecteur();
  assert.strictEqual(d.traiter(null, 0), null);
  assert.strictEqual(d.traiter(NaN, 10), null);
});

test('le geste continue sans rien redéclencher tant qu\'on n\'est pas revenu au calme', () => {
  // coup avec une vitesse qui oscille au-dessus du seuil
  const ev = passer(signal([[50, zero], [300, (u) => -500 - 300 * Math.sin(6 * Math.PI * u)], [100, zero]]));
  assert.strictEqual(ev.length, 1);
});

// ---- Calibration : 3 coups vers le bas, quelle que soit la façon dont le navigateur les rapporte ----
const { calibrer } = require('./detecteur.js');
let graine = 1; const hasard = () => ((graine = (graine * 16807) % 2147483647) / 2147483647) - 0.5;
// geste(u) -> valeur sur l'axe principal pour un coup ; les autres axes reçoivent un peu du mouvement + bruit
function seance(geste, { axe = 1, echelle = 1, bruit = 5, coups = 3, duree = 160, autres = 0.25 } = {}) {
  const segs = [[300, zero]];
  for (let i = 0; i < coups; i++) segs.push([duree, geste], [500, zero]);
  return signal(segs).map(([v, t]) => {
    const axes = [0, 0, 0].map(() => hasard() * bruit * echelle);
    axes[axe] += v * echelle;
    axes[(axe + 1) % 3] += v * autres * echelle;
    return { t, axes };
  });
}
// Rejoue une séance calibrée dans le détecteur
function rejouer(ech, cal) {
  const d = creerDetecteur();
  return ech.map((e) => d.traiter(e.axes[cal.axe] * cal.signe * cal.facteur, e.t)).filter(Boolean).map((e) => e.type);
}
const coupGyro = (amp) => (u) => (u < 0.6 ? amp * Math.sin(Math.PI * u / 0.6) : -0.4 * amp * Math.sin(Math.PI * (u - 0.6) / 0.4)); // coup + rebond

const configurations = [
  ['gyroscope en °/s, axe X (Chrome Android / spec récente)', seance(coupGyro(-800), { axe: 0 })],
  ['gyroscope en °/s, axe Y, sens positif vers le bas (autre convention)', seance(coupGyro(800), { axe: 1 })],
  ['gyroscope en rad/s (navigateurs anciens)', seance(coupGyro(-800), { axe: 0, echelle: Math.PI / 180 })],
  ['accéléromètre seul, arrêt brusque plus fort que l\'élan', seance((u) => (u < 0.5 ? -12 * Math.sin(Math.PI * u / 0.5) : 30 * Math.sin(Math.PI * (u - 0.5) / 0.5)), { axe: 2, bruit: 0.3 })],
  ['coups faibles et irréguliers', seance((u) => -350 * Math.sin(Math.PI * u), { axe: 0, coups: 4, bruit: 15 })],
];
for (const [nom, ech] of configurations) {
  test(`calibration : ${nom} → les coups vers le bas donnent la grosse caisse`, () => {
    const cal = calibrer(ech);
    assert.ok(cal, 'calibration impossible');
    const sons = rejouer(ech, cal);
    assert.ok(sons.length >= 3 && sons.every((s) => s === 'grosse-caisse'), sons.join(','));
  });
}

test('calibration : le même geste vers le haut donne la cymbale', () => {
  const bas = seance(coupGyro(-800), { axe: 1 });
  const cal = calibrer(bas);
  const haut = seance(coupGyro(800), { axe: 1 });
  const sons = rejouer(haut, cal);
  assert.ok(sons.length >= 3 && sons.every((s) => s === 'cymbale'), sons.join(','));
});

test('calibration : téléphone immobile ou un seul coup → refusée', () => {
  assert.strictEqual(calibrer(seance(zero, { coups: 3 })), null);
  assert.strictEqual(calibrer(seance(coupGyro(-800), { coups: 1 })), null);
  assert.strictEqual(calibrer([]), null);
});

// ---- Alternance : chaque coup, dans n'importe quel sens, alterne grosse caisse / cymbale ----
test('alternance : bas, bas, haut, bas, haut → GC, CY, GC, CY, GC (rebonds non comptés)', () => {
  const { creerAlternance } = require('./detecteur.js');
  const prochain = creerAlternance();
  const sig = signal([[50, zero], [160, coupGyro(-800)], [400, zero], [160, coupGyro(-800)], [400, zero],
    [160, coupGyro(800)], [400, zero], [160, coupGyro(-600)], [400, zero], [160, coupGyro(900)], [300, zero]]);
  const sons = passer(sig).map(() => prochain());
  assert.deepStrictEqual(sons, ['grosse-caisse', 'cymbale', 'grosse-caisse', 'cymbale', 'grosse-caisse']);
});

// ---- Sons : grosse caisse et cymbale jouées sans erreur (faux Web Audio) ----
test('sons : grosse caisse et cymbale se jouent sans erreur', () => {
  const noeud = () => new Proxy(function () {}, {
    get: (t, k) => (k === 'connect' ? (x) => x : typeof k === 'string' && /Ramp|setValue|start|stop/.test(k) ? () => {} : noeud()),
    set: () => true, apply: () => noeud(),
  });
  const ctx = { currentTime: 0, sampleRate: 48000, destination: noeud(), createDynamicsCompressor: noeud, createOscillator: noeud,
    createGain: noeud, createBiquadFilter: noeud, createBufferSource: noeud, createBuffer: (c, l) => ({ getChannelData: () => new Float32Array(l) }) };
  const bac = {}; require('vm').runInNewContext(require('fs').readFileSync(__dirname + '/sons.js', 'utf8'), bac);
  const s = bac.creerSons(ctx);
  for (const f of [s.grosseCaisse, s.cymbale]) { f(0); f(1); }
});

console.log(`\n${ok} tests réussis${process.exitCode ? ' — DES ÉCHECS' : ''}`);
