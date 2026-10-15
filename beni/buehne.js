// Bühne der Box, herausgelöst aus startseite.js: setzt die Ebenen nach geometrie.js und zeichnet einen Zustand.
// Zustand: deckel und kerze 0 = zu bzw. aufgesetzt, 1 = oben; warm und kalt 0 = aus, 1 = an.
// Freiwillig: ein (0 bis 1) blendet die ganze Box ein, fuge und kerzenSchatten setzen die Schatten selbst.
// Verwendung: const b = OffBuehne(element); b.zeichnen({ deckel, kerze, warm, kalt }, sekunden);
// Die Lichtebenen haben keinen Alphakanal und werden addiert (plus-lighter). Sie müssen deshalb im selben
// Stapel liegen wie das Grundbild. Im Einstieg liegt die Wortmarke dazwischen, dort trägt jede Ebene ihren
// eigenen z-index (hinten 1, vorne 3) und die Fläche bildet keinen eigenen Stapel.
(() => {
  const G = window.OFFLIGHT_GEOMETRIE;
  if (!G) return;
  const [W, H] = G.groesse;
  const E = G.ebenen;
  const reduziert = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const klemm = x => Math.min(1, Math.max(0, x));
  const flackern = t => 0.93 + 0.035 * Math.sin(t * 8.2) + 0.025 * Math.sin(t * 18.1 + 1.2) + 0.012 * Math.sin(t * 38.3 + 0.4);
  const EBENEN = [
    ['basis', 'img', 'hinten voll'], ['offenAn', 'img', 'hinten voll'], ['schattenFuge', 'div', 'hinten schatten'],
    ['deckel', 'img', 'vorne'], ['kaltDeckel', 'img', 'vorne licht'], ['schattenKerze', 'div', 'vorne schatten kerze'],
    ['kerze', 'img', 'vorne'], ['warmSchein', 'img', 'vorne licht voll'], ['flamme', 'img', 'vorne licht'],
  ];
  const DATEI = { basis: 'basis', offenAn: 'offen-an', deckel: 'deckel', kaltDeckel: 'kalt-deckel', kerze: 'kerze', warmSchein: 'warm-schein', flamme: 'warm-flamme' };

  window.OffBuehne = function (flaeche, pfad = 'ebenen/') {
    // Ebenen anlegen, falls die Fläche leer ist
    if (!flaeche.querySelector('[data-ebene]')) {
      for (const [name, tag, klasse] of EBENEN) {
        const e = document.createElement(tag);
        e.dataset.ebene = name;
        e.className = klasse;
        if (tag === 'img') { e.alt = ''; e.decoding = 'async'; e.src = `${pfad}${DATEI[name]}.webp?v=${G.version || 0}`; }
        flaeche.appendChild(e);
      }
    }
    const el = {};
    flaeche.querySelectorAll('[data-ebene]').forEach(e => { el[e.dataset.ebene] = e; });
    const voll = { x: 0, y: 0, w: W, h: H };
    const kasten = { basis: voll, offenAn: voll, warmSchein: voll, deckel: E.deckel, kaltDeckel: E.kaltDeckel, kerze: E.kerze, flamme: E.flamme, schattenFuge: E.schattenFuge, schattenKerze: E.schattenKerze };
    for (const [n, k] of Object.entries(kasten)) {
      const s = el[n].style;
      s.left = `${k.x / W * 100}%`; s.top = `${k.y / H * 100}%`; s.width = `${k.w / W * 100}%`; s.height = `${k.h / H * 100}%`;
    }
    const fg = E.schattenFuge;
    el.schattenFuge.style.background = `linear-gradient(to bottom, ${fg.stopps.map(([o, c]) => `${c} ${(o / fg.h) * 100}%`).join(', ')})`;
    const teilVon = { deckel: E.deckel, kaltDeckel: E.deckel, schattenKerze: E.deckel, kerze: E.kerze };
    let k = 1;
    const massstab = () => { k = flaeche.clientWidth / W; };
    function teil(name, m) {
      const t = teilVon[name], box = kasten[name], r = 1 - m, [ax, ay] = t.anker, [sx, sy] = t.skal, s = el[name].style;
      s.transformOrigin = `${(ax - box.x) * k}px ${(ay - box.y) * k}px`;
      s.transform = `translate(${t.zu.tx * r * k}px, ${t.zu.ty * r * k}px) scale(${sx}, ${sy})`;
    }
    function zeichnen(z, t = performance.now() / 1000, lebt = !reduziert) {
      const ein = z.ein ?? 1;
      teil('deckel', z.deckel); teil('kaltDeckel', z.deckel); teil('schattenKerze', z.deckel); teil('kerze', z.kerze);
      el.basis.style.opacity = ein; el.deckel.style.opacity = ein; el.kerze.style.opacity = ein;
      el.schattenFuge.style.opacity = ein * (z.fuge ?? 1 - klemm(z.deckel * 500));
      el.schattenKerze.style.opacity = ein * (z.kerzenSchatten ?? (1 - klemm(z.kerze * 500)) * (1 - klemm(z.deckel * 500)));
      el.offenAn.style.opacity = ein * z.kalt; el.kaltDeckel.style.opacity = ein * z.kalt;
      const w = z.warm;
      el.warmSchein.style.opacity = ein * w * (lebt ? flackern(t) : 1);
      const fl = E.flamme, fs = el.flamme.style;
      const zu = lebt ? 1 + 0.035 * Math.sin(t * 13.7) + 0.02 * Math.sin(t * 29.3 + 0.8) : 1;
      fs.transformOrigin = `${fl.fuss[0] * k}px ${fl.fuss[1] * k}px`;
      fs.transform = `scale(${1 - (zu - 1) * 0.5}, ${(0.55 + 0.45 * Math.sqrt(w)) * zu})`;
      fs.opacity = ein * w * (lebt ? 0.94 + 0.06 * Math.sin(t * 11.3 + 2.1) : 1);
    }
    massstab();
    addEventListener('resize', massstab);
    const bilder = [...flaeche.querySelectorAll('img')];
    const bereit = Promise.race([
      Promise.all(bilder.map(i => (i.complete && i.naturalWidth) ? Promise.resolve() : new Promise(f => { i.addEventListener('load', f, { once: true }); i.addEventListener('error', f, { once: true }); }))),
      new Promise(f => setTimeout(f, 4000)),
    ]).then(() => { massstab(); flaeche.classList.add('bereit'); });
    return { massstab, zeichnen, bereit, el };
  };
})();
