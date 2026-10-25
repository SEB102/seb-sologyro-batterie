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
  const api = { estIphone, versIphone };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Android = api;
})(this);
