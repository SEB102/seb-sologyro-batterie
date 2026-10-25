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

// ---- 3D par la baguette : coup de poignet réaliste, avec l'effet « manège » (accélération vers le coude) ----
// Défaut constaté sur iPhone : un coup vers le haut, bras déjà levé, était lu « vers le bas » (l'accélération
// centripète tire alors le téléphone vers le bas). Correction : la calibration apprend quel axe du téléphone est
// « la baguette », puis le sens vient de la vitesse du BOUT de la baguette (rotation × axe, projetée sur la verticale).
const { calibrerBaguette } = require('./detecteur.js');
function poignet({ coups = [[+1, 0]], r = 0.12, duree = 150, amplitude = 60, tenue = 1, ecran = 1, convention = 'navigateurs', inverse = false, hz = 60, calme = 500, debout = false, roulis = 0, decalage = 0 } = {}) {
  const dt = 1000 / hz, ech = [], rad = Math.PI / 180;
  // déroulé de l'angle de la baguette θ (élévation) : pour chaque coup [sens, angle de départ]
  const segments = []; let t = calme;
  for (const [sens, depart] of coups) { segments.push({ t0: t, sens, depart }); t += duree + calme; }
  const fin = t;
  const etat = (tt) => {   // θ, θ', θ'' en rad, rad/s, rad/s²
    let s = segments[0];
    for (const x of segments) if (tt >= x.t0 - calme / 2) s = x;
    const u = (tt - s.t0) / duree, D = s.sens * amplitude * rad, T = duree / 1000;
    if (u <= 0) return { th: s.depart * rad, w: 0, al: 0, u };
    if (u >= 1) return { th: s.depart * rad + D, w: 0, al: 0, u };
    return { th: s.depart * rad + D * (1 - Math.cos(Math.PI * u)) / 2, w: D * Math.PI / (2 * T) * Math.sin(Math.PI * u), al: D * Math.PI ** 2 / (2 * T * T) * Math.cos(Math.PI * u), u };
  };
  for (let tt = 0; tt < fin; tt += dt) {
    const { th, w, al, u } = etat(tt);
    const c = Math.cos(th), s = Math.sin(th);
    const lin = [r * al * -s - r * w * w * c, 0, r * al * c - r * w * w * s];      // tangentielle + centripète
    const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    let ex, ey, ez;
    if (debout) { ex = [tenue * c, 0, tenue * s]; ey = [-s * ecran, 0, c * ecran]; ez = croix(ex, ey); }   // debout dans le poing : l'avant-bras (la baguette) le long de x
    else { ey = [tenue * c, 0, tenue * s]; ez = [0, ecran, 0]; ex = croix(ey, ez); }
    // tenue qui varie dans la main : téléphone tourné autour de la baguette (roulis) ou incliné (décalage)
    { const rr = roulis * Math.PI / 180, cr = Math.cos(rr), sr = Math.sin(rr), bx = ex, bz = ez; ex = bx.map((x, i) => x * cr + bz[i] * sr); ez = bx.map((x, i) => -x * sr + bz[i] * cr); }
    { const dd = decalage * Math.PI / 180, cd = Math.cos(dd), sd = Math.sin(dd), bx = ex, by = ey; ex = bx.map((x, i) => x * cd + by[i] * sd); ey = bx.map((x, i) => -x * sd + by[i] * cd); }
    const tel = (v) => [ex, ey, ez].map((e) => e[0] * v[0] + e[1] * v[1] + e[2] * v[2]);
    const wTel = tel([0, -w, 0]).map((x) => x / rad);                                  // °/s dans le repère du téléphone
    const rot = convention === 'navigateurs' ? wTel : [wTel[2], wTel[0], wTel[1]];     // [alpha, beta, gamma]
    const k = inverse ? -1 : 1;
    ech.push({ t: tt, u, rot, acc: tel(lin).map((x) => k * x), accG: tel([lin[0], lin[1], lin[2] + 9.81]).map((x) => k * x) });
  }
  return ech;
}
const avecAxes = (ech) => ech.map((e) => ({ ...e, axes: e.rot }));
function jouer3D(o, { baguette = true } = {}) {
  const calibration = poignet({ ...o, coups: [[1, 0], [-1, 0], [1, 10]] });
  const cal = calibrer(avecAxes(calibration)), b = baguette ? calibrerBaguette(calibration) : null;
  const v = creerVerticale({ baguette: b }), det = creerDetecteur({ seuil: 182, precoce: !!o.precoce }), sens = [];
  for (const e of poignet(o)) { v.ajouter(e.t, e.acc, e.accG, e.rot); if (det.traiter(e.rot[cal.axe] * cal.signe * cal.facteur, e.t)) sens.push(v.sens()); }
  return sens;
}
const DEPARTS = [[1, -30], [1, 0], [1, 30], [1, 60], [-1, -20], [-1, 0], [-1, 60], [-1, 90]];

test('baguette : le défaut est bien reproduit sans elle (coup vers le haut bras levé lu « vers le bas »)', () => {
  assert.deepStrictEqual(jouer3D({ coups: [[1, 60]] }, { baguette: false }), [-1]);
});

test('baguette : coups vers le haut et vers le bas, baguette partant de -30° à +90°, pivot poignet ou coude', () => {
  for (const r of [0.12, 0.35]) for (const [sens, depart] of DEPARTS) {
    assert.deepStrictEqual(jouer3D({ coups: [[sens, depart]], r }), [sens], `pivot ${r} m, sens ${sens}, départ ${depart}°`);
  }
});

test('baguette : la séquence signalée (bas, remontée, haut ×2) donne bas, haut, bas, haut', () => {
  assert.deepStrictEqual(jouer3D({ coups: [[-1, 40], [1, 0], [-1, 40], [1, 0]] }), [-1, 1, -1, 1]);
});

test('baguette : téléphone tenu dans l\'autre sens, écran de l\'autre côté, convention d\'axes de la norme, signes inversés', () => {
  for (const o of [{ tenue: -1 }, { ecran: -1 }, { convention: 'norme' }, { inverse: true }, { tenue: -1, ecran: -1, convention: 'norme', inverse: true }])
    for (const [sens, depart] of DEPARTS) assert.deepStrictEqual(jouer3D({ ...o, coups: [[sens, depart]] }), [sens], `${JSON.stringify(o)} sens ${sens}, départ ${depart}°`);
});

test('baguette : téléphone tenu debout dans le poing (comme sur l\'iPhone mesuré), toutes tenues', () => {
  for (const o of [{ debout: true }, { debout: true, tenue: -1 }, { debout: true, ecran: -1 }, { debout: true, inverse: true, convention: 'norme' }])
    for (const [sens, depart] of DEPARTS) assert.deepStrictEqual(jouer3D({ ...o, coups: [[sens, depart]] }), [sens], `${JSON.stringify(o)} sens ${sens}, départ ${depart}°`);
});

test('baguette : juste aussi en déclenchement précoce', () => {
  for (const [sens, depart] of DEPARTS) assert.deepStrictEqual(jouer3D({ precoce: true, coups: [[sens, depart]] }), [sens], `sens ${sens}, départ ${depart}°`);
});

test('baguette : rien à apprendre si le téléphone ne bouge pas', () => {
  assert.strictEqual(calibrerBaguette(poignet({ coups: [[1, 0]], amplitude: 0 })), null);
  assert.strictEqual(calibrerBaguette([]), null);
});

test('baguette : vraies mesures de l\'iPhone (21/10) — coups vers le haut partis franchement vers le haut → cymbale', () => {
  const vrai = require('./mesures-iphone.json');
  const ech = vrai.mesures.map(([t, rot, acc, accG]) => ({ t, rot, acc, accG }));
  const b = calibrerBaguette(ech);
  assert.ok(b, 'baguette non trouvée');
  const cal = vrai.reglages.calibration, v = creerVerticale({ baguette: b }), det = creerDetecteur({ seuil: vrai.reglages.seuil }), sons = {};
  for (const e of ech) { v.ajouter(e.t, e.acc, e.accG, e.rot); if (det.traiter(e.rot[cal.axe] * cal.signe * cal.facteur, e.t)) sons[e.t] = v.sens() > 0 ? 'cymbale' : 'grosse-caisse'; }
  // mêmes instants de coup que sur le téléphone
  assert.deepStrictEqual(Object.keys(sons).map(Number), vrai.coups.map((c) => c.t));
  // coups dont le début du geste montait nettement (+0,36 et +0,41 m/s) : cymbale ; coups nettement vers le bas : grosse caisse
  for (const t of [21717, 22683]) assert.strictEqual(sons[t], 'cymbale', `coup ${t}`);
  for (const t of [19067, 20905, 23083]) assert.strictEqual(sons[t], 'grosse-caisse', `coup ${t}`);
});

// ---- Calibration guidée : « 2 coups vers le BAS, puis 2 vers le HAUT » ----
// L'app sait dans quel sens va chaque coup : elle trouve la baguette et son sens sans rien estimer.
const { calibrerBaguetteGuidee } = require('./detecteur.js');
const GUIDE = [[-1, 0], [-1, 10], [1, 0], [1, -10]];   // [sens demandé, angle de départ]
function jouerGuide(o, jeu) {
  const calibration = poignet({ ...o, coups: GUIDE });
  const cal = calibrer(avecAxes(calibration)), b = calibrerBaguetteGuidee(avecAxes(calibration), GUIDE.map((c) => c[0]));
  if (!b) return null;
  const v = creerVerticale({ baguette: b }), det = creerDetecteur({ seuil: 182 }), sens = [];
  for (const e of poignet({ ...o, ...jeu })) { v.ajouter(e.t, e.acc, e.accG, e.rot); if (det.traiter(e.rot[cal.axe] * cal.signe * cal.facteur, e.t)) sens.push(v.sens()); }
  return sens;
}
const TENUES = [{}, { debout: true }, { tenue: -1 }, { ecran: -1 }, { convention: 'norme', inverse: true }, { debout: true, inverse: true, tenue: -1 }];

test('guidée : toutes les tenues, puis coups vers le haut et vers le bas de -30° à +90° → bons sons', () => {
  for (const o of TENUES) for (const [sens, depart] of DEPARTS) {
    assert.deepStrictEqual(jouerGuide(o, { coups: [[sens, depart]] }), [sens], `${JSON.stringify(o)} sens ${sens}, départ ${depart}°`);
  }
});

test('guidée : coups donnés dans le mauvais sens (4 vers le bas au lieu de 2 bas + 2 haut) → refusée', () => {
  const faux = poignet({ coups: [[-1, 0], [-1, 10], [-1, 0], [-1, 10]] });
  assert.strictEqual(calibrerBaguetteGuidee(avecAxes(faux), [-1, -1, 1, 1]), null);
});

test('guidée : pas assez de coups, ou téléphone immobile → refusée', () => {
  assert.strictEqual(calibrerBaguetteGuidee(avecAxes(poignet({ coups: [[-1, 0], [1, 0]] })), [-1, -1, 1, 1]), null);
  assert.strictEqual(calibrerBaguetteGuidee(avecAxes(poignet({ coups: GUIDE, amplitude: 0 })), [-1, -1, 1, 1]), null);
  assert.strictEqual(calibrerBaguetteGuidee([], [-1, -1, 1, 1]), null);
});

test('guidée : la tenue peut varier un peu après la calibration (roulis jusqu\'à 60°, inclinaison jusqu\'à ±30°)', () => {
  for (const base of [{ debout: true }, {}]) for (const variation of [{ roulis: 30 }, { roulis: 60 }, { decalage: -15 }, { decalage: 15 }, { decalage: -30 }, { decalage: 30 }]) {
    const DEP = [[-1, 0], [1, 20], [-1, 30], [1, -20], [-1, 60], [1, 0], [-1, -30], [1, 40]];
    const justes = DEP.filter(([sens, depart]) => { const r = jouerGuide(base, { ...variation, coups: [[sens, depart]] }); return r && r[0] === sens; }).length;
    assert.ok(justes >= 7, `${JSON.stringify(base)} ${JSON.stringify(variation)} : ${justes}/8`);
  }
});

// ---- Sens par la rotation du poignet, appris à la calibration guidée ----
// Constat sur iPhone tenu debout (21/10, 2e enregistrement) : la baguette apprise était presque verticale, la décision
// dépendait alors d'une inclinaison infime et basculait toute seule (« tout devient grosse caisse ou cymbale »).
// Un coup vers le bas plie toujours le poignet dans le même sens, même bras levé : la calibration guidée apprend
// quel sens de rotation veut dire « bas » ; c'est lui qui choisit le son.
const { calibrerSensRotation } = require('./detecteur.js');
function jouerRotation(oCal, oJeu) {
  const calibration = avecAxes(poignet({ ...oCal, coups: GUIDE }));
  const cal = calibrer(calibration), m = cal && calibrerSensRotation(calibration, cal, GUIDE.map((c) => c[0]));
  if (!m) return null;
  const det = creerDetecteur({ seuil: 182, precoce: !!oJeu.precoce }), sens = [];
  for (const e of poignet({ ...oCal, ...oJeu })) { const c = det.traiter(e.rot[cal.axe] * cal.signe * cal.facteur, e.t); if (c) sens.push((c.type === 'grosse-caisse' ? -1 : 1) * m); }
  return sens;
}

test('rotation : toutes les tenues, coups de -30° à +90° (bras levé compris), sommet et précoce → bons sons', () => {
  for (const o of TENUES) for (const precoce of [false, true]) for (const [sens, depart] of DEPARTS) {
    assert.deepStrictEqual(jouerRotation(o, { precoce, coups: [[sens, depart]] }), [sens], `${JSON.stringify(o)} précoce ${precoce} sens ${sens} départ ${depart}°`);
  }
});

test('rotation : la tenue peut varier pendant le jeu (roulis jusqu\'à 60°, inclinaison ±45°) sans changer les sons', () => {
  for (const o of [{ debout: true }, {}]) for (const v of [{ roulis: 60 }, { decalage: -45 }, { decalage: 45 }]) for (const [sens, depart] of DEPARTS) {
    assert.deepStrictEqual(jouerRotation(o, { ...v, coups: [[sens, depart]] }), [sens], `${JSON.stringify(o)} ${JSON.stringify(v)} sens ${sens} départ ${depart}°`);
  }
});

test('rotation : calibration refusée si les coups ne suivent pas la consigne (4 vers le bas)', () => {
  const faux = avecAxes(poignet({ coups: [[-1, 0], [-1, 10], [-1, 0], [-1, 10]] }));
  const cal = calibrer(faux);
  assert.strictEqual(cal && calibrerSensRotation(faux, cal, [-1, -1, 1, 1]), null);
});

test('rotation : vraies mesures iPhone (1er enregistrement) — le sens de rotation donne les sons des coups certains', () => {
  const vrai = require('./mesures-iphone.json'), cal = vrai.reglages.calibration;
  // coups certains (début du geste nettement vers le haut / le bas) : 21717 et 22683 haut ; 19067, 20905, 23083 bas
  const sons = Object.fromEntries(vrai.coups.map((c) => [c.t, c.sensRotation]));
  const m = sons[19067] === 'grosse-caisse' ? 1 : -1;   // sens appris sur un coup vers le bas, comme le ferait la calibration
  const son = (t) => ((sons[t] === 'grosse-caisse' ? -1 : 1) * m < 0 ? 'grosse-caisse' : 'cymbale');
  for (const t of [21717, 22683]) assert.strictEqual(son(t), 'cymbale', `coup ${t}`);
  for (const t of [19067, 20905, 23083]) assert.strictEqual(son(t), 'grosse-caisse', `coup ${t}`);
});

test('rotation : calibration dans l\'ordre « 2 vers le haut, puis 2 vers le bas » → mêmes bons sons', () => {
  const INVERSE = [[1, 0], [1, 10], [-1, 0], [-1, 10]];
  for (const o of TENUES) {
    const calibration = avecAxes(poignet({ ...o, coups: INVERSE }));
    const cal = calibrer(calibration), m = cal && calibrerSensRotation(calibration, cal, INVERSE.map((c) => c[0]));
    assert.ok(m, `${JSON.stringify(o)} : calibration refusée`);
    for (const [sens, depart] of DEPARTS) {
      const det = creerDetecteur({ seuil: 182, precoce: true }), sons = [];
      for (const e of poignet({ ...o, coups: [[sens, depart]] })) { const c = det.traiter(e.rot[cal.axe] * cal.signe * cal.facteur, e.t); if (c) sons.push((c.type === 'grosse-caisse' ? -1 : 1) * m); }
      assert.deepStrictEqual(sons, [sens], `${JSON.stringify(o)} sens ${sens} départ ${depart}°`);
    }
  }
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

// ---- Android (25/10/2026) : accélération de signe opposé à l'iPhone sur les 3 axes, rotation identique (android.js) ----
// Vérité de référence : le sens de rotation du coup (même convention sur les deux), à cos > 0,7 de la direction apprise du geste.
function rejouerAndroid(convertir) {
  const G = require('./gestes.js'), A = require('./apprentissage.js'), D = require('./gestes-defaut.js'), j = require('./jeu-android-1055.json');
  const modele = G.entrainer(D.map((e) => ({ geste: e.geste, resume: G.resumer(e.mesures, e.t, 0) })));
  const dir = (g) => { const v = D.filter((e) => e.geste === g).map((e) => A.sensDuCoup(e.mesures, e.t)).reduce((p, x) => { const n = Math.hypot(...x); return p.map((y, i) => y + x[i] / n); }, [0, 0, 0]); const n = Math.hypot(...v); return v.map((x) => x / n); };
  const DIR = { bas: dir('bas'), haut: dir('haut'), gauche: dir('gauche') };
  const m = j.mesures.filter((x) => x[1][0] !== null).map(([t, r, a]) => {
    const e = convertir({ rotationRate: { alpha: r[0], beta: r[1], gamma: r[2] }, acceleration: { x: a[0], y: a[1], z: a[2] } });
    return { t, rot: [e.rotationRate.alpha, e.rotationRate.beta, e.rotationRate.gamma], acc: [e.acceleration.x, e.acceleration.y, e.acceleration.z] };
  });
  const dec = G.creerDeclencheur({ seuil: j.seuil }); let justes = 0, total = 0;
  for (const x of m) if (dec.traiter(x.rot, x.t)) {
    const fen = m.filter((y) => y.t >= x.t - 100 && y.t <= x.t + 200), v = A.sensDuCoup(fen, x.t), n = Math.hypot(...v);
    const vrai = Object.keys(DIR).find((g) => v.reduce((s, c, i) => s + c * DIR[g][i], 0) / n > 0.7);
    if (!vrai) continue;
    total++; if (modele.classer(G.resumer(m.filter((y) => y.t <= x.t + 1), x.t, 0)) === vrai) justes++;
  }
  return { justes, total };
}
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
test('Android : accélération remise dans la convention de l\'iPhone → coups reconnus (8 sur 10 au lieu de 1)', () => {
  const { versIphone } = require('./android.js');
  const brut = rejouerAndroid((e) => e), corrige = rejouerAndroid((e) => versIphone(e, UA_ANDROID));
  assert.ok(brut.justes <= 1, `sans correction : ${brut.justes}/${brut.total}`);
  assert.ok(corrige.total === 10 && corrige.justes >= 8, `avec correction : ${corrige.justes}/${corrige.total}`);
});
test('Android : seule l\'accélération change de signe ; iPhone et iPad : mesures inchangées', () => {
  const { versIphone, estIphone } = require('./android.js'), e = { rotationRate: { alpha: 1, beta: -2, gamma: 3 }, acceleration: { x: 0.5, y: -1, z: null } };
  assert.ok(estIphone(UA_IPHONE));
  assert.ok(estIphone('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 'MacIntel', 5));   // iPad
  assert.ok(!estIphone(UA_ANDROID, 'Linux armv8l', 5));
  assert.strictEqual(versIphone(e, UA_IPHONE), e);
  const a = versIphone(e, UA_ANDROID, 'Linux armv8l', 5);
  assert.deepStrictEqual(a.rotationRate, e.rotationRate);
  assert.deepStrictEqual(a.acceleration, { x: -0.5, y: 1, z: null });
});

console.log(`\n${ok} tests réussis${process.exitCode ? ' — DES ÉCHECS' : ''}`);
