// Android : Chrome donne l'accélération (sans gravité) avec le signe opposé à celui de l'iPhone, sur les 3 axes ; la rotation,
// elle, est identique. Les exemples par défaut viennent d'un iPhone : on remet donc l'accélération dans la convention de l'iPhone
// dès son arrivée, avant tout le reste (jeu et apprentissage). Enregistrement de jeu Android du 25/10/2026 (jeu-android-1055.json),
// rejoué : 1 coup juste sur 10 sans cette correction, 8 sur 10 avec.
(function (racine) {
  // iPad récent : se présente comme un Mac, mais avec un écran tactile
  const estIphone = (ua, plateforme = '', toucher = 0) => /iPhone|iPad|iPod/.test(ua) || (plateforme === 'MacIntel' && toucher > 1);
  const oppose = (v) => (typeof v === 'number' ? -v : v);
  function versIphone(e, ua, plateforme, toucher) {
    if (estIphone(ua, plateforme, toucher) || !e.acceleration) return e;
    const a = e.acceleration;
    return { rotationRate: e.rotationRate, acceleration: { x: oppose(a.x), y: oppose(a.y), z: oppose(a.z) }, accelerationIncludingGravity: e.accelerationIncludingGravity };
  }
  // Rotation seule hors iPhone : même corrigée de signe, l'accélération sans gravité reste propre à chaque téléphone (calculée par
  // le fabricant ; sur l'Android du 25/10, 5 à 10 fois plus forte que sur l'iPhone : 5 BAS reconnus sur 21). La rotation est mesurée
  // directement, en °/s partout. Renvoie une copie du module de reconnaissance dont le résumé met à zéro sa moitié « accélération »
  // (les 3 premiers canaux sont la rotation), pour les exemples comme pour les coups joués ; sur iPhone, le module tel quel.
  function rotationSeule(Gestes, ua, plateforme, toucher) {
    if (estIphone(ua, plateforme, toucher)) return Gestes;
    const complet = Gestes.resumer;   // gardé à part : la page recopie ce résumé dans le module lui-même
    const resumer = (...args) => { const r = complet(...args); return r.map((v, i) => (i < r.length / 2 ? v : 0)); };
    return { ...Gestes, resumer };
  }
  const api = { estIphone, versIphone, rotationSeule };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Android = api;
})(this);
