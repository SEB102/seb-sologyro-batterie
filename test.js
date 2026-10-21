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

// ---- Déclenchement précoce : le coup part dès que le geste dépasse le seuil, sans attendre son sommet ----
const PRECOCE = { precoce: true };
test('précoce : coup vers le bas → une grosse caisse ; vers le haut → une cymbale', () => {
  assert.deepStrictEqual(passer(signal([[100, zero], [120, cloche(-800)], [200, zero]]), PRECOCE).map((e) => e.type), ['grosse-caisse']);
  assert.deepStrictEqual(passer(signal([[100, zero], [120, cloche(800)], [200, zero]]), PRECOCE).map((e) => e.type), ['cymbale']);
});

test('précoce : rebond du poignet non compté, deux coups rapprochés comptés, inclinaison lente ignorée', () => {
  assert.strictEqual(passer(signal([[50, zero], [120, cloche(-900)], [100, cloche(450)], [200, zero]]), PRECOCE).length, 1);
  assert.strictEqual(passer(signal([[50, zero], [120, cloche(-700)], [130, zero], [120, cloche(-700)], [100, zero]]), PRECOCE).length, 2);
  assert.strictEqual(passer(signal([[1000, cloche(-150)], [1000, cloche(200)]]), PRECOCE).length, 0);
});

test('précoce : la force suit la vitesse du geste et reste dans 0..1', () => {
  const f = (amp) => passer(signal([[50, zero], [120, cloche(amp)], [100, zero]]), PRECOCE)[0].force;
  const faible = f(-400), moyen = f(-700), fort = f(-3000);
  assert.ok(faible < moyen && moyen < fort && faible >= 0 && fort <= 1, `${faible} ${moyen} ${fort}`);
});

// Gain : écart entre le coup « au sommet » et le coup « précoce » sur le même geste, à 60 mesures/s
function instantDuCoup(sig, reglages) {
  const d = creerDetecteur(reglages);
  for (const [v, t] of sig) if (d.traiter(v, t)) return t;
  return null;
}
const GAINS = [];
test('précoce : part au moins 2 mesures (33 ms) plus tôt que le mode « sommet », pour des gestes de 80 à 200 ms', () => {
  for (const duree of [80, 120, 160, 200]) for (const amp of [400, 700, 1000, 1500]) {
    const sig = signal([[50, zero], [duree, cloche(-amp)], [100, zero]]);
    const gain = instantDuCoup(sig) - instantDuCoup(sig, PRECOCE);
    GAINS.push(gain);
    assert.ok(gain >= 2 * 1000 / 60 - 0.01, `geste ${duree} ms à ${amp} °/s : gain ${gain.toFixed(1)} ms`);
  }
  console.log(`      gain moyen ${(GAINS.reduce((a, b) => a + b, 0) / GAINS.length).toFixed(0)} ms (de ${Math.min(...GAINS).toFixed(0)} à ${Math.max(...GAINS).toFixed(0)} ms)`);
});

test('précoce : le gain mesuré en direct (surGain) égale l\'écart avec le mode « sommet »', () => {
  const sig = signal([[50, zero], [140, cloche(-900)], [200, zero]]);
  const mesures = [];
  const d = creerDetecteur({ precoce: true, surGain: (ms) => mesures.push(ms) });
  sig.forEach(([v, t]) => d.traiter(v, t));
  assert.strictEqual(mesures.length, 1);
  assert.ok(Math.abs(mesures[0] - (instantDuCoup(sig) - instantDuCoup(sig, PRECOCE))) < 0.01, `${mesures[0]}`);
});

test('mode « sommet » (par défaut) inchangé : surGain jamais appelé', () => {
  const mesures = [];
  const d = creerDetecteur({ surGain: (ms) => mesures.push(ms) });
  signal([[50, zero], [140, cloche(-900)], [200, zero]]).forEach(([v, t]) => d.traiter(v, t));
  assert.strictEqual(mesures.length, 0);
});

// ---- 3D : le sens du coup DANS LA PIÈCE décide (vers le sol = grosse caisse, vers le plafond = cymbale) ----
// Simulation : repère de la pièce (z vers le haut) ; le téléphone est tourné de « inclinaison » degrés autour de son
// axe x (0 = à plat écran en l'air, +80 = pointé vers le haut bras levé, -80 = pointé vers le sol) et tourne encore
// pendant le geste. Le navigateur fournit acceleration (sans gravité) et accelerationIncludingGravity, dans le repère
// du téléphone ; au repos, accelerationIncludingGravity vaut +9,81 vers le haut (convention de la norme).
const { creerVerticale } = require('./detecteur.js');
function geste3D({ sens = -1, inclinaison = 0, balayage = 35, duree = 160, A = 25, inverse = false, sansLineaire = false, repos = 1000, hz = 60 } = {}) {
  const ech = [], dt = 1000 / hz;
  const rad = (d) => d * Math.PI / 180;
  const versTel = (w, phi) => {   // vecteur de la pièce → repère du téléphone (rotation autour de x)
    const c = Math.cos(rad(phi)), s = Math.sin(rad(phi));
    return [w[0], c * w[1] + s * w[2], -s * w[1] + c * w[2]];
  };
  const n = Math.round((repos + duree + 300) / dt);
  for (let i = 0; i < n; i++) {
    const t = i * dt, u = (t - repos) / duree, dedans = u >= 0 && u <= 1;
    const a = dedans ? A * Math.sin(2 * Math.PI * u) : 0;                    // élan puis freinage
    const lin = [0.2 * a, 0.6 * a, sens * a];                                 // vertical + un peu d'arc vers l'avant
    const phi = inclinaison + (dedans ? balayage * (1 - Math.cos(Math.PI * u)) / 2 : u > 1 ? balayage : 0);
    const k = inverse ? -1 : 1;
    const acc = versTel(lin, phi).map((x) => k * x);
    const accG = versTel([lin[0], lin[1], lin[2] + 9.81], phi).map((x) => k * x);
    ech.push({ t, u, acc: sansLineaire ? null : acc, accG });
  }
  return ech;
}
// Sens donné par la verticale à un moment du geste (u = 0,5 : coup « au sommet » ; u = 0,25 : coup précoce)
function sensA(ech, uVoulu) {
  const v = creerVerticale();
  for (const e of ech) { v.ajouter(e.t, e.acc, e.accG); if (e.u >= uVoulu) return v.sens(); }
  return null;
}

test('3D : téléphone à plat, coup vers le sol → bas, vers le plafond → haut', () => {
  assert.strictEqual(sensA(geste3D({ sens: -1 }), 0.5), -1);
  assert.strictEqual(sensA(geste3D({ sens: +1 }), 0.5), +1);
});

test('3D : quelle que soit l\'inclinaison du téléphone (pointé vers le sol … bras levé), seul le sens du geste compte', () => {
  for (const inclinaison of [-80, -45, -10, 0, 30, 60, 80]) for (const sens of [-1, +1]) {
    assert.strictEqual(sensA(geste3D({ sens, inclinaison }), 0.5), sens, `inclinaison ${inclinaison}°, sens ${sens}`);
  }
});

test('3D : bras levé, téléphone pointé vers le haut, coup sec vers le bas → grosse caisse (bas)', () => {
  assert.strictEqual(sensA(geste3D({ sens: -1, inclinaison: 80, balayage: -40 }), 0.5), -1);
});

test('3D : convention de signe inversée (certains navigateurs) → même résultat', () => {
  for (const inclinaison of [-60, 0, 70]) for (const sens of [-1, +1]) {
    assert.strictEqual(sensA(geste3D({ sens, inclinaison, inverse: true }), 0.5), sens, `inclinaison ${inclinaison}°, sens ${sens}`);
  }
});

test('3D : sans « acceleration » (gravité retirée par filtrage), y compris téléphone qui tourne pendant le geste', () => {
  for (const inclinaison of [-60, 0, 70]) for (const sens of [-1, +1]) {
    assert.strictEqual(sensA(geste3D({ sens, inclinaison, sansLineaire: true }), 0.5), sens, `inclinaison ${inclinaison}°, sens ${sens}`);
  }
});

test('3D : déjà juste au début du geste (déclenchement précoce)', () => {
  for (const inclinaison of [-60, 0, 70]) for (const sens of [-1, +1]) {
    assert.strictEqual(sensA(geste3D({ sens, inclinaison }), 0.25), sens, `inclinaison ${inclinaison}°, sens ${sens}`);
  }
});

test('3D : pas de mesure → sens 0 (la page garde alors le sens de rotation), valeurs absentes sans planter', () => {
  const v = creerVerticale();
  assert.strictEqual(v.sens(), 0);
  v.ajouter(0, null, null); v.ajouter(16, { x: NaN }, null);
  assert.strictEqual(v.sens(), 0);
});

test('3D : deux coups successifs dans des sens opposés sont bien distingués', () => {
  const v = creerVerticale(), bas = geste3D({ sens: -1, inclinaison: 20 }), haut = geste3D({ sens: +1, inclinaison: 20 });
  const sensAuMilieu = [];
  for (const [ech, decal] of [[bas, 0], [haut, 1600]]) {
    let note = false;
    for (const e of ech) { v.ajouter(e.t + decal, e.acc, e.accG); if (!note && e.u >= 0.5) { sensAuMilieu.push(v.sens()); note = true; } }
  }
  assert.deepStrictEqual(sensAuMilieu, [-1, +1]);
});

// ---- Comptage des coups pendant la calibration (affiché en direct sur le téléphone) ----
test('calibration : les coups reconnus se comptent au fur et à mesure (0, 1, 2, 3)', () => {
  const { compterCoups } = require('./detecteur.js');
  const ech = seance(coupGyro(-800), { axe: 0, coups: 3 });
  // coupures : avant le 1er coup, après le 1er, après le 2e, à la fin (séance : 300 ms calme puis coups de 160 ms + 500 ms)
  const jusqua = (ms) => ech.filter((e) => e.t <= ms);
  assert.strictEqual(compterCoups(jusqua(250)), 0);
  assert.strictEqual(compterCoups(jusqua(300 + 160 + 200)), 1);
  assert.strictEqual(compterCoups(jusqua(300 + 2 * 660)), 2);
  assert.strictEqual(compterCoups(ech), 3);
});

test('calibration : comptage juste aussi en rad/s, à l\'accéléromètre seul, et pour des coups faibles', () => {
  const { compterCoups } = require('./detecteur.js');
  assert.strictEqual(compterCoups(seance(coupGyro(-800), { axe: 0, echelle: Math.PI / 180 })), 3);
  assert.strictEqual(compterCoups(seance((u) => (u < 0.5 ? -12 * Math.sin(Math.PI * u / 0.5) : 30 * Math.sin(Math.PI * (u - 0.5) / 0.5)), { axe: 2, bruit: 0.3 })), 3);
  assert.strictEqual(compterCoups(seance((u) => -350 * Math.sin(Math.PI * u), { axe: 0, coups: 4, bruit: 15 })), 4);
  assert.strictEqual(compterCoups(seance(zero, { coups: 3 })), 0);
  assert.strictEqual(compterCoups([]), 0);
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
