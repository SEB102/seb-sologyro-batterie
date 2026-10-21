// Grosse caisse et cymbale synthétisées en Web Audio (aucun fichier son).
(function (racine) {
  function creerSons(ctx) {
    const sortie = ctx.createDynamicsCompressor();
    sortie.threshold.value = -10; sortie.ratio.value = 4;
    sortie.connect(ctx.destination);

    // Bruit blanc réutilisé (2 s)
    const bruit = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = bruit.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    const volume = (force) => 0.25 + 0.75 * Math.min(1, Math.max(0, force));

    function grosseCaisse(force = 0.7) {
      const t = ctx.currentTime, v = volume(force);
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(170, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(g).connect(sortie);
      osc.start(t); osc.stop(t + 0.55);
      // petit claquement d'attaque
      const clic = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gc = ctx.createGain();
      clic.buffer = bruit; f.type = 'lowpass'; f.frequency.value = 3000;
      gc.gain.setValueAtTime(0.35 * v, t);
      gc.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
      clic.connect(f).connect(gc).connect(sortie);
      clic.start(t); clic.stop(t + 0.02);
    }

    function cymbale(force = 0.7) {
      const t = ctx.currentTime, v = volume(force), duree = 1.2 + 1.3 * force;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
      const passeBande = ctx.createBiquadFilter(); passeBande.type = 'bandpass'; passeBande.frequency.value = 9000;
      const passeHaut = ctx.createBiquadFilter(); passeHaut.type = 'highpass'; passeHaut.frequency.value = 6000;
      passeBande.connect(passeHaut).connect(g).connect(sortie);
      // six carrés désaccordés, façon TR-808
      for (const fr of [205.3, 304.4, 369.6, 522.7, 540, 800]) {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr * 1.7;
        o.connect(passeBande); o.start(t); o.stop(t + duree);
      }
      // souffle
      const b = ctx.createBufferSource(), gb = ctx.createGain();
      b.buffer = bruit; gb.gain.value = 0.6;
      b.connect(gb).connect(passeHaut);
      b.start(t); b.stop(t + Math.min(duree, 2));
    }

    // ---- Autres instruments (prototype multi-téléphones) ----
    // Enveloppe percussive : montée 2 ms, descente exponentielle
    function enveloppe(t, v, duree) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
      g.connect(sortie);
      return g;
    }
    function souffle(t, duree, type, frequence, q, destination) {
      const b = ctx.createBufferSource(), f = ctx.createBiquadFilter();
      b.buffer = bruit; f.type = type; f.frequency.value = frequence; f.Q.value = q || 1;
      b.connect(f).connect(destination); b.start(t); b.stop(t + duree);
    }
    function tonal(t, de, a, glisse, duree, destination, type = 'sine') {
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(de, t); o.frequency.exponentialRampToValueAtTime(a, t + glisse);
      o.connect(destination); o.start(t); o.stop(t + duree);
    }

    function caisseClaire(force = 0.7) {
      const t = ctx.currentTime, v = volume(force);
      tonal(t, 330, 180, 0.05, 0.15, enveloppe(t, 0.5 * v, 0.12), 'triangle');
      souffle(t, 0.25, 'highpass', 1500, 0.7, enveloppe(t, 0.7 * v, 0.22));
    }
    function tom(hauteur) {
      return (force = 0.7) => {
        const t = ctx.currentTime, v = volume(force);
        tonal(t, hauteur * 1.6, hauteur, 0.18, 0.5, enveloppe(t, 0.9 * v, 0.45));
      };
    }
    function charleston(ouvert) {
      return (force = 0.7) => {
        const t = ctx.currentTime, v = volume(force), duree = ouvert ? 0.6 : 0.07;
        souffle(t, duree, 'highpass', 8000, 0.8, enveloppe(t, 0.45 * v, duree));
      };
    }
    function clap(force = 0.7) {
      const t = ctx.currentTime, v = volume(force);
      for (const d of [0, 0.011, 0.023]) souffle(t + d, 0.02, 'bandpass', 1200, 1.5, enveloppe(t + d, 0.7 * v, 0.02));
      souffle(t + 0.03, 0.25, 'bandpass', 1200, 1.5, enveloppe(t + 0.03, 0.5 * v, 0.2));
    }
    function cloche(force = 0.7) {
      const t = ctx.currentTime, v = volume(force), sortieCloche = enveloppe(t, 0.25 * v, 0.6);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2640; f.Q.value = 1;
      f.connect(sortieCloche);
      for (const fr of [587, 845]) tonal(t, fr, fr, 0.01, 0.6, f, 'square');
    }

    // Voix « wobble » : souffle « h » puis voyelle (filtres de formants), formants qui ondulent
    // formants : [fréquence, niveau] — « é » ouvert : F2 haut ; « o » fermé : F2 bas
    function voix(formants) {
      return (force = 0.7) => {
        const t = ctx.currentTime, v = volume(force), duree = 0.45;
        const sortieVoix = ctx.createGain(); sortieVoix.gain.value = 1.2; sortieVoix.connect(sortie);   // niveau mesuré ≈ celui de la grosse caisse
        const lfo = ctx.createOscillator(); lfo.frequency.value = 7;   // l'ondulation « wobble »
        const filtres = formants.map(([f, niveau]) => {
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = f / 90;
          const prof = ctx.createGain(); prof.gain.value = f * 0.15; lfo.connect(prof).connect(bp.frequency);
          const g = ctx.createGain(); g.gain.value = niveau;
          bp.connect(g).connect(sortieVoix);
          return bp;
        });
        // « h » : souffle bref dans les mêmes formants
        const b = ctx.createBufferSource(), gh = ctx.createGain();
        b.buffer = bruit;
        gh.gain.setValueAtTime(0.0001, t); gh.gain.exponentialRampToValueAtTime(0.35 * v, t + 0.01);
        gh.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
        b.connect(gh); filtres.forEach((f) => gh.connect(f));
        b.start(t); b.stop(t + 0.08);
        // voyelle : dent de scie qui descend un peu, comme une exclamation
        const o = ctx.createOscillator(), gv = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(120, t + duree);
        gv.gain.setValueAtTime(0.0001, t + 0.03); gv.gain.exponentialRampToValueAtTime(v, t + 0.07);
        gv.gain.exponentialRampToValueAtTime(0.0001, t + duree);
        o.connect(gv); filtres.forEach((f) => gv.connect(f));
        o.start(t); o.stop(t + duree + 0.02);
        lfo.start(t); lfo.stop(t + duree + 0.02);
      };
    }

    // Catalogue : nom affiché → fonction(force)
    const instruments = {
      'Grosse caisse': grosseCaisse, 'Caisse claire': caisseClaire, 'Clap': clap,
      'Charleston fermé': charleston(false), 'Charleston ouvert': charleston(true),
      'Tom aigu': tom(220), 'Tom grave': tom(110), 'Cloche': cloche, 'Cymbale': cymbale,
      'Wobble « Hé » (ouvert)': voix([[400, 1], [2100, 0.6], [2700, 0.3]]),
      'Wobble « Ho » (fermé)': voix([[400, 1], [780, 0.7], [2800, 0.15]]),
    };

    return { grosseCaisse, cymbale, instruments };
  }
  racine.creerSons = creerSons;
})(this);
