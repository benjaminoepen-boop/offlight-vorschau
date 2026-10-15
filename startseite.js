// OFF LIGHT Startseite: Einstieg mit der Animation, die vier Schritte zum Anklicken, Farbwahl.
// Ebenen und Geometrie liegen in ebenen/ und geometrie.js (erzeugt von ../animation-test/vorbereiten.py). Die Box besteht in jedem Zustand aus
// denselben Teilen des offenen Bildes, es wird nie auf ein anderes Foto umgeschaltet.
(() => {
  const G = window.OFFLIGHT_GEOMETRIE;
  const [W, H] = G.groesse;
  const E = G.ebenen;
  const reduziert = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const klemm = x => Math.min(1, Math.max(0, x));
  const weich = (a, b, x) => { const t = klemm((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const sanft = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const warte = ms => new Promise(fertig => setTimeout(fertig, ms));
  // unregelmäßig wirkendes, ruhiges Flackern aus überlagerten Sinuswellen
  const flackern = t => 0.93 + 0.035 * Math.sin(t * 8.2) + 0.025 * Math.sin(t * 18.1 + 1.2) + 0.012 * Math.sin(t * 38.3 + 0.4);
  const geladen = img => (img.complete && img.naturalWidth
    ? Promise.resolve()
    : new Promise(fertig => {
      img.addEventListener('load', fertig, { once: true });
      img.addEventListener('error', fertig, { once: true });
    }));

  // Eine Bühne: setzt die Ebenen nach der Geometrie und zeichnet einen Zustand.
  // Zustand: deckel und kerze 0 = zu bzw. aufgesetzt, 1 = oben; warm und kalt 0 = aus, 1 = an;
  // fuge und kerzenSchatten sind die Deckkraft der beiden Schatten.
  function Buehne(wurzel) {
    const flaeche = wurzel.querySelector('.buehne') || wurzel;
    const el = {};
    flaeche.querySelectorAll('[data-ebene]').forEach(e => {
      el[e.dataset.ebene] = e;
      if (e.dataset.src) e.src = `${e.dataset.src}?v=${G.version || 0}`; // nicht aus dem Zwischenspeicher
    });
    const voll = { x: 0, y: 0, w: W, h: H };
    const kasten = {
      basis: voll, offenAn: voll, warmSchein: voll,
      deckel: E.deckel, kaltDeckel: E.kaltDeckel, kerze: E.kerze,
      flamme: E.flamme, schattenFuge: E.schattenFuge, schattenKerze: E.schattenKerze,
    };
    for (const [name, k] of Object.entries(kasten)) {
      const s = el[name].style;
      s.left = `${k.x / W * 100}%`;
      s.top = `${k.y / H * 100}%`;
      s.width = `${k.w / W * 100}%`;
      s.height = `${k.h / H * 100}%`;
    }
    // Fuge: Zeile für Zeile so dunkel bzw. hell wie im Foto
    const fg = E.schattenFuge;
    el.schattenFuge.style.background =
      `linear-gradient(to bottom, ${fg.stopps.map(([o, c]) => `${c} ${(o / fg.h) * 100}%`).join(', ')})`;

    const teilVon = { deckel: E.deckel, kaltDeckel: E.deckel, schattenKerze: E.deckel, kerze: E.kerze };
    let k = 1; // CSS-Pixel je Bildpixel
    const massstab = () => { k = flaeche.clientWidth / W; };

    // Teil bei Öffnung m: Punkt p landet bei anker + zu * (1 - m) + (p - anker) * skal
    function teil(name, m) {
      const t = teilVon[name];
      const box = kasten[name];
      const r = 1 - m;
      const [ax, ay] = t.anker;
      const [sx, sy] = t.skal;
      const s = el[name].style;
      s.transformOrigin = `${(ax - box.x) * k}px ${(ay - box.y) * k}px`;
      s.transform = `translate(${t.zu.tx * r * k}px, ${t.zu.ty * r * k}px) scale(${sx}, ${sy})`;
    }

    function zeichnen(z, t, lebt) {
      teil('deckel', z.deckel);
      teil('kaltDeckel', z.deckel);
      teil('schattenKerze', z.deckel);
      teil('kerze', z.kerze);
      el.schattenFuge.style.opacity = z.fuge;
      el.schattenKerze.style.opacity = z.kerzenSchatten;
      el.offenAn.style.opacity = z.kalt;
      el.kaltDeckel.style.opacity = z.kalt;
      const w = z.warm;
      el.warmSchein.style.opacity = w * (lebt ? flackern(t) : 1);
      // Flamme wächst beim Anzünden nach und züngelt danach leicht
      const fl = E.flamme;
      const fs = el.flamme.style;
      const zuengeln = lebt ? 1 + 0.035 * Math.sin(t * 13.7) + 0.02 * Math.sin(t * 29.3 + 0.8) : 1;
      fs.transformOrigin = `${fl.fuss[0] * k}px ${fl.fuss[1] * k}px`;
      fs.transform = `scale(${1 - (zuengeln - 1) * 0.5}, ${(0.55 + 0.45 * Math.sqrt(w)) * zuengeln})`;
      fs.opacity = w * (lebt ? 0.94 + 0.06 * Math.sin(t * 11.3 + 2.1) : 1);
    }

    // Nur zeichnen, solange die Bühne im Bild ist
    let sichtbar = true;
    new IntersectionObserver(eintraege => { sichtbar = eintraege[0].isIntersecting; }, { rootMargin: '120px 0px' })
      .observe(flaeche);

    const bilder = Object.values(el).filter(e => e.tagName === 'IMG');
    const bereit = Promise.race([Promise.all(bilder.map(geladen)), warte(4000)]).then(() => {
      massstab();
      flaeche.classList.add('bereit');
    });
    return { massstab, zeichnen, bereit, get sichtbar() { return sichtbar; } };
  }

  const api = {};

  // Einstieg: startet offen mit leuchtendem Handy, schließt sich, dann geht die Kerze an.
  // Maus auf die Box öffnet, Maus weg schließt, Finger und Tastatur schalten um.
  const einstieg = document.querySelector('.buehne-einstieg');
  if (einstieg) {
    const b = Buehne(einstieg);
    const abschnitt = einstieg.closest('.einstieg');
    const q = new URLSearchParams(location.search);
    const festP = q.has('p') ? klemm(parseFloat(q.get('p'))) : null;
    const DAUER = 3.4; // Sekunden für einmal ganz öffnen

    // Ablauf beim Öffnen, beim Schließen genau rückwärts
    const warm = p => 1 - weich(0.0, 0.12, p);                   // Kerze geht aus
    const hub = p => sanft(klemm((p - 0.14) / (0.80 - 0.14)));   // Deckel und Kerze fahren hoch
    const fugenSchatten = p => 1 - weich(0.14, 0.19, p);         // Deckel verlässt das Unterteil
    const kerzenSchatten = p => 1 - weich(0.14, 0.17, p);        // Kerze verlässt den Deckel
    const kalt = p => weich(0.66, 1.0, p);                        // Handy geht an

    let p = festP ?? 1;
    let ziel = p;
    let licht = null;

    // das „on.“ im Satz leuchtet mit der Kerze, auch wenn die Bühne gerade nicht im Bild ist
    function setzeLicht() {
      const l = warm(p).toFixed(3);
      if (l !== licht) { abschnitt.style.setProperty('--licht', l); licht = l; }
    }
    function zeichnen(t) {
      const h = hub(p);
      b.zeichnen({ deckel: h, kerze: h, warm: warm(p), kalt: kalt(p), fuge: fugenSchatten(p), kerzenSchatten: kerzenSchatten(p) },
        t, festP === null && !reduziert);
      setzeLicht();
    }

    const setzeZiel = wert => {
      ziel = wert;
      einstieg.setAttribute('aria-pressed', ziel > 0.5 ? 'true' : 'false');
    };

    let letzte = null;
    function schritt(jetzt) {
      const t = jetzt / 1000;
      if (letzte !== null && p !== ziel) {
        const dt = Math.min(0.05, t - letzte);
        const v = 1 / DAUER;
        // reduzierte Bewegung: Zustand sofort wechseln, ohne Fahrt
        p = reduziert ? ziel : ziel > p ? Math.min(ziel, p + v * dt) : Math.max(ziel, p - v * dt);
      }
      letzte = t;
      if (b.sichtbar) zeichnen(t); else setzeLicht();
      requestAnimationFrame(schritt);
    }

    let verzoegerung = null;
    let introLaeuft = false;
    const umschalten = () => { introLaeuft = false; setzeZiel(ziel > 0.5 ? 0 : 1); };

    let drin = false; // eine echte Maus steht auf der Box
    einstieg.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') drin = true; });
    einstieg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') drin = false; });
    einstieg.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'mouse' || festP !== null || reduziert) return;
      clearTimeout(verzoegerung);
      verzoegerung = setTimeout(() => { introLaeuft = false; setzeZiel(1); }, 140);
    });
    einstieg.addEventListener('pointerleave', e => {
      if (e.pointerType !== 'mouse' || festP !== null || reduziert) return;
      clearTimeout(verzoegerung);
      introLaeuft = false;
      setzeZiel(0);
    });
    let zeiger = null; // manche Browser liefern den Klick ohne pointerType
    einstieg.addEventListener('pointerdown', e => { zeiger = e.pointerType; });
    einstieg.addEventListener('click', e => {
      const art = e.pointerType || zeiger;
      zeiger = null;
      if (festP !== null || (art === 'mouse' && !reduziert)) return;
      umschalten();
    });
    einstieg.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (festP === null) umschalten();
    });

    api.einstieg = {
      setzeP(wert) { p = klemm(wert); setzeZiel(p); zeichnen(performance.now() / 1000); },
      ziel(wert) { setzeZiel(klemm(wert)); },
      get p() { return p; },
    };

    b.bereit.then(() => {
      if (festP === null && !reduziert) {
        p = 1; setzeZiel(1); introLaeuft = true;
        // steht die Maus schon auf der Box, bleibt sie offen, bis die Maus geht
        setTimeout(() => {
          if (introLaeuft && !drin) setzeZiel(0);
          introLaeuft = false;
        }, 1300);
      } else if (festP === null) {
        p = 0; setzeZiel(0);
      }
      zeichnen(performance.now() / 1000);
      requestAnimationFrame(schritt);
    });
    addEventListener('resize', () => { b.massstab(); zeichnen(performance.now() / 1000); });
  }

  // Wofür: drei Momente, je ein Bildpaar. Der breite Schieber (wie beim Annehmen eines Anrufs)
  // blendet vom Handylicht zum Kerzenlicht: ziehen, auf die Spur tippen oder mit den Pfeiltasten.
  const wofuer = document.querySelector('.wofuer');
  if (wofuer) {
    const tabs = [...wofuer.querySelectorAll('.moment-tab')];
    const szenen = [...wofuer.querySelectorAll('.moment-szene')];
    const panel = wofuer.querySelector('.moment');
    const spur = wofuer.querySelector('.regler-spur');
    const griff = wofuer.querySelector('.regler-griff');

    let wert = 0; // 0 = Handylicht, 1 = Kerzenlicht
    // Screenreader lesen nur das Bild vor, das gerade zu sehen ist
    function sichtbarkeit() {
      szenen.forEach(s => {
        const an = s.classList.contains('sichtbar');
        s.setAttribute('aria-hidden', String(!an));
        s.querySelector('.m-handy').setAttribute('aria-hidden', String(!an || wert >= 0.5));
        s.querySelector('.m-kerze').setAttribute('aria-hidden', String(!an || wert < 0.5));
      });
    }
    function setze(w) {
      const vorher = wert >= 0.5;
      wert = klemm(w);
      if ((wert >= 0.5) !== vorher) sichtbarkeit();
      wofuer.style.setProperty('--kerze', wert.toFixed(3));
      const prozent = Math.round(wert * 100);
      griff.setAttribute('aria-valuenow', String(prozent));
      griff.setAttribute('aria-valuetext', prozent === 0 ? 'Handylicht' : prozent === 100 ? 'Kerzenlicht' : `${prozent} Prozent Kerzenlicht`);
    }
    // Knopfmitte läuft von 32 px bis Spurbreite minus 32 px
    const ausPunkt = x => { const r = spur.getBoundingClientRect(); return (x - r.left - 32) / (r.width - 64); };

    let fahrt = 0;
    function reglerNach(ziel) {
      const id = ++fahrt;
      const start = wert;
      const dauer = reduziert ? 0 : 250 + 650 * Math.abs(ziel - start);
      const t0 = performance.now();
      const schritt = jetzt => {
        if (id !== fahrt) return;
        const t = dauer ? klemm((jetzt - t0) / dauer) : 1;
        setze(start + (ziel - start) * sanft(t));
        if (t < 1) requestAnimationFrame(schritt);
      };
      requestAnimationFrame(schritt);
    }

    // Maus: sofort ziehen bzw. an die Stelle springen. Finger: erst ziehen, wenn die Bewegung
    // waagerecht ist, sonst scrollt die Seite; kurzes Antippen gleitet an die Stelle.
    let zieht = null;   // Versatz zwischen Zeiger und Knopfmitte beim Ziehen
    let finger = null;  // Startpunkt einer Berührung, solange noch offen ist, ob gezogen wird
    function beginne(e) {
      const punkt = ausPunkt(e.clientX);
      zieht = griff.contains(e.target) ? punkt - wert : 0;
      if (!griff.contains(e.target)) setze(punkt);
      try { spur.setPointerCapture(e.pointerId); } catch (_) { /* Zeiger schon weg */ }
      spur.classList.add('zieht');
    }
    spur.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      fahrt++; // wer selbst zieht, hält jede Fahrt an
      if (e.pointerType === 'mouse') { beginne(e); e.preventDefault(); return; }
      finger = { x: e.clientX, y: e.clientY, ziel: e.target, id: e.pointerId, vorher: wert };
    });
    spur.addEventListener('pointermove', e => {
      if (finger && e.pointerId === finger.id) {
        const dx = e.clientX - finger.x;
        const dy = e.clientY - finger.y;
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { finger = null; return; } // senkrecht: Seite scrollt
        if (Math.abs(dx) >= 12 && Math.abs(dx) > 2 * Math.abs(dy)) {
          const start = { clientX: finger.x, target: finger.ziel, pointerId: finger.id };
          vorherWert = finger.vorher;
          finger = null;
          beginne(start);
        }
      }
      if (zieht !== null) setze(ausPunkt(e.clientX) - zieht);
    });
    let vorherWert = null; // Wert vor einem Finger-Ziehen, falls der Browser doch scrollt
    const loslassen = e => {
      if (finger && e.type === 'pointerup' && !griff.contains(finger.ziel)) reglerNach(klemm(ausPunkt(finger.x)));
      if (e.type === 'pointercancel' && zieht !== null && vorherWert !== null) setze(vorherWert);
      vorherWert = null;
      finger = null;
      zieht = null;
      spur.classList.remove('zieht');
    };
    spur.addEventListener('pointerup', loslassen);
    spur.addEventListener('pointercancel', loslassen);
    griff.addEventListener('keydown', e => {
      const schritt = { ArrowRight: .05, ArrowUp: .05, ArrowLeft: -.05, ArrowDown: -.05, PageUp: .25, PageDown: -.25 }[e.key];
      if (schritt !== undefined) { e.preventDefault(); fahrt++; setze(wert + schritt); return; }
      if (e.key === 'Home') { e.preventDefault(); reglerNach(0); }
      if (e.key === 'End') { e.preventDefault(); reglerNach(1); }
    });

    function waehleMoment(tab) {
      tabs.forEach(t => {
        const an = t === tab;
        t.setAttribute('aria-selected', String(an));
        t.tabIndex = an ? 0 : -1;
      });
      szenen.forEach(s => s.classList.toggle('sichtbar', s.dataset.moment === tab.dataset.moment));
      panel.setAttribute('aria-labelledby', tab.id);
      sichtbarkeit();
    }
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => waehleMoment(tab));
      tab.addEventListener('keydown', e => {
        const weiter = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!weiter) return;
        e.preventDefault();
        const naechster = tabs[(i + weiter + tabs.length) % tabs.length];
        naechster.focus();
        waehleMoment(naechster);
      });
    });
    setze(0);
    sichtbarkeit();
    api.momente = {
      waehle: name => waehleMoment(tabs.find(t => t.dataset.moment === name)),
      reglerNach: z => reglerNach(z / 100),
      get licht() { return Math.round(wert * 100); },
    };
  }

  // Die vier Schritte: erst Licht aus, beim Öffnen Kerze vor Deckel,
  // beim Schließen Deckel vor Kerze, dann Licht an
  const modul = document.querySelector('.modul-schritte');
  if (modul) {
    const b = Buehne(modul.querySelector('.buehne-schritte'));
    const status = modul.querySelector('[data-status]');
    const eintraege = [...modul.querySelectorAll('.schritt')];
    const knoepfe = eintraege.map(li => li.querySelector('.schritt-kopf'));

    const z = { deckel: 0, kerze: 0, warm: 1, kalt: 0 };
    const ZIEL = {
      0: { deckel: 0, kerze: 0, warm: 1, kalt: 0 },
      1: { deckel: 0, kerze: 1, warm: 0, kalt: 0 },
      2: { deckel: 1, kerze: 1, warm: 0, kalt: 1 },
      3: { deckel: 0, kerze: 1, warm: 0, kalt: 0 },
      4: { deckel: 0, kerze: 0, warm: 1, kalt: 0 },
    };
    const TEXT = {
      1: 'Schritt 1 von 4: Kerze abnehmen.',
      2: 'Schritt 2 von 4: Handy hineinlegen.',
      3: 'Schritt 3 von 4: Deckel schließen.',
      4: 'Schritt 4 von 4: Kerze anzünden.',
    };

    function zeichnen(t) {
      b.zeichnen({
        deckel: z.deckel, kerze: z.kerze, warm: z.warm, kalt: z.kalt,
        fuge: 1 - klemm(z.deckel * 500),
        kerzenSchatten: (1 - klemm(z.kerze * 500)) * (1 - klemm(z.deckel * 500)),
      }, t, !reduziert);
    }
    const schleife = jetzt => { if (b.sichtbar) zeichnen(jetzt / 1000); requestAnimationFrame(schleife); };

    function plan(von, nach) {
      const phasen = [];
      const aus = [];
      if (nach.warm < von.warm) aus.push(['warm', nach.warm, 450]);
      if (nach.kalt < von.kalt) aus.push(['kalt', nach.kalt, 450]);
      if (aus.length) phasen.push(aus);
      if (nach.kerze > von.kerze) phasen.push([['kerze', nach.kerze, 1100]]);
      if (nach.deckel > von.deckel) phasen.push([['deckel', nach.deckel, 1250]]);
      if (nach.deckel < von.deckel) phasen.push([['deckel', nach.deckel, 1250]]);
      if (nach.kerze < von.kerze) phasen.push([['kerze', nach.kerze, 1100]]);
      const an = [];
      if (nach.kalt > von.kalt) an.push(['kalt', nach.kalt, 650]);
      if (nach.warm > von.warm) an.push(['warm', nach.warm, 800]);
      if (an.length) phasen.push(an);
      return phasen;
    }

    let lauf = 0; // Kennung des aktuellen Ablaufs, ein neuer Klick bricht den alten ab
    function tween(schluessel, ziel, dauer, id) {
      const start = z[schluessel];
      if (reduziert || dauer === 0) { z[schluessel] = ziel; return Promise.resolve(); }
      const t0 = performance.now();
      return new Promise(fertig => {
        const weiter = jetzt => {
          if (id !== lauf) return fertig();
          const t = klemm((jetzt - t0) / dauer);
          z[schluessel] = start + (ziel - start) * sanft(t);
          if (t < 1) requestAnimationFrame(weiter); else fertig();
        };
        requestAnimationFrame(weiter);
      });
    }
    async function geheZu(nr, id) {
      for (const phase of plan({ ...z }, ZIEL[nr])) {
        if (id !== lauf) return false;
        await Promise.all(phase.map(([s, ziel, d]) => tween(s, ziel, d, id)));
      }
      return id === lauf;
    }

    let aktiv = 0;

    // Aufklappen: Größe vorher und nachher messen und dazwischen weich animieren
    const groesse = new Map();
    function oeffne(nr) {
      const vorher = eintraege.map(li => li.getBoundingClientRect());
      eintraege.forEach(li => {
        const an = Number(li.dataset.schritt) === nr;
        li.classList.toggle('offen', an);
        li.querySelector('.schritt-kopf').setAttribute('aria-expanded', String(an));
        if (an) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      if (reduziert) return;
      eintraege.forEach((li, i) => {
        groesse.get(li)?.cancel();
        const a = vorher[i];
        const bb = li.getBoundingClientRect();
        if (Math.abs(a.width - bb.width) < 0.5 && Math.abs(a.height - bb.height) < 0.5) return;
        groesse.set(li, li.animate(
          [{ width: `${a.width}px`, height: `${a.height}px` }, { width: `${bb.width}px`, height: `${bb.height}px` }],
          { duration: 560, easing: 'cubic-bezier(.22, .9, .24, 1)' }));
      });
    }
    // feine Laufzeitlinie im offenen Schritt (Vorschlag Karten): läuft so lange wie die Bewegung
    function fortschritt(nr, dauer) {
      eintraege.forEach(li => li.classList.remove('laeuft'));
      const li = eintraege[nr - 1];
      if (!li || !dauer || reduziert) return;
      li.style.setProperty('--dauer', `${dauer}ms`);
      void li.offsetWidth; // Animation neu starten
      li.classList.add('laeuft');
    }
    const planDauer = nr => plan({ ...z }, ZIEL[nr]).reduce((summe, ph) => summe + Math.max(...ph.map(x => x[2])), 0);
    function markiere(nr) {
      aktiv = nr;
      oeffne(nr);
      status.textContent = TEXT[nr] || '';
    }
    async function starte(nr, id) {
      markiere(nr);
      fortschritt(nr, planDauer(nr));
      const ok = await geheZu(nr, id);
      if (ok) eintraege[nr - 1]?.classList.remove('laeuft');
      return ok;
    }
    async function schritt(nr) {
      const id = ++lauf;
      await starte(nr, id);
    }

    knoepfe.forEach((knopf, i) => {
      knopf.addEventListener('click', () => {
        const nr = Number(eintraege[i].dataset.schritt);
        if (nr !== aktiv) schritt(nr);
      });
      knopf.addEventListener('keydown', e => {
        const weiter = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!weiter) return;
        e.preventDefault();
        const naechster = knoepfe[(i + weiter + knoepfe.length) % knoepfe.length];
        naechster.focus();
        naechster.click();
      });
    });

    api.schritte = {
      schritt,
      setze(neu) { lauf++; Object.assign(z, neu); zeichnen(performance.now() / 1000); },
      get zustand() { return { ...z }; },
    };

    b.bereit.then(() => {
      zeichnen(performance.now() / 1000);
      requestAnimationFrame(schleife);
    });
    addEventListener('resize', () => { b.massstab(); zeichnen(performance.now() / 1000); });
  }

  // Farbwahl: die Box steht auf dem Grund, die Kerze brennt und flackert. Beim Farbwechsel brennt
  // die Kerze weiter und nur die Farbe der Box blendet über (Benis Wahl, 28.09.). Dafür liegen zwei
  // Szenen übereinander: die sichtbare und die hereinkommende.
  const produkt = document.querySelector('.produkt');
  if (produkt) {
    const F = window.OFFLIGHT_FARBEN || { groesse: [1254, 836], farben: {} };
    const [FW, FH] = F.groesse;
    const buehne = produkt.querySelector('.produkt-buehne');
    const licht = produkt.querySelector('.produkt-licht');
    const szenen = [...produkt.querySelectorAll('.produkt-szene')].map(el => ({
      el,
      aus: el.querySelector('.p-aus'),
      schein: el.querySelector('.p-schein'),
      flamme: el.querySelector('.p-flamme'),
      farbe: null,
    }));
    let vorn = 0; // sichtbare Szene; die andere kommt beim Wechsel darüber
    const felder = [...produkt.querySelectorAll('.farbe')];
    const name = produkt.querySelector('[data-farbname]');
    const form = produkt.querySelector('.vormerken');
    const email = form.querySelector('[name="email"]');
    const farbeFeld = form.querySelector('[name="farbe"]');
    const meldung = form.querySelector('[data-meldung]');
    const pfad = (farbe, teil) => `bilder/farben/${farbe}-${teil}.webp?v=${F.farben[farbe].version || 0}`;

    // Farben ohne Bilder bleiben sichtbar, lassen sich aber noch nicht wählen
    felder.forEach(f => {
      if (F.farben[f.dataset.farbe]) return;
      f.setAttribute('aria-disabled', 'true');
      f.title = `${f.dataset.name}: Bild folgt`;
    });
    const waehlbar = felder.filter(f => f.getAttribute('aria-disabled') !== 'true');

    // Bilder einer Farbe einmal laden und dekodieren
    const vorrat = {};
    function vorladen(farbe) {
      if (!vorrat[farbe]) {
        vorrat[farbe] = Promise.all(['aus', 'schein', 'flamme'].map(teil => {
          const img = new Image();
          img.src = pfad(farbe, teil);
          return img.decode().catch(() => {});
        }));
      }
      return vorrat[farbe];
    }

    // warm: Kerzenlicht, hell: Helligkeit der ganzen Szene, mix: Anteil der hereinkommenden Szene
    const z = { warm: 1, hell: 0, mix: 0 };
    let k = 1; // CSS-Pixel je Bildpixel
    const massstab = () => { k = licht.clientWidth / FW; };
    const aktuell = () => szenen[vorn].farbe;

    // id: Kennung des Wechsels; ist inzwischen neu gewählt worden, bleibt die Szene unberührt
    async function belade(sz, farbe, id = null) {
      await vorladen(farbe);
      if (id !== null && id !== lauf) return false;
      const g = F.farben[farbe];
      sz.farbe = farbe;
      sz.aus.src = pfad(farbe, 'aus');
      sz.schein.src = pfad(farbe, 'schein');
      sz.flamme.src = pfad(farbe, 'flamme');
      const fl = g.flamme;
      const s = sz.flamme.style;
      s.left = `${fl.x / FW * 100}%`;
      s.top = `${fl.y / FH * 100}%`;
      s.width = `${fl.w / FW * 100}%`;
      s.height = `${fl.h / FH * 100}%`;
      await Promise.all([sz.aus, sz.schein, sz.flamme].map(img => img.decode().catch(() => {})));
      return id === null || id === lauf;
    }
    function beschriften() {
      const g = F.farben[aktuell()];
      if (g) buehne.setAttribute('aria-label', `OFF LIGHT in ${g.name}, die Kerze auf dem Deckel brennt`);
    }

    function zeichneSzene(sz, t, lebt) {
      if (!sz.farbe) return;
      const w = z.warm;
      sz.schein.style.opacity = w * (lebt ? flackern(t) : 1);
      const fl = F.farben[sz.farbe].flamme;
      const fs = sz.flamme.style;
      const zuengeln = lebt ? 1 + 0.035 * Math.sin(t * 13.7) + 0.02 * Math.sin(t * 29.3 + 0.8) : 1;
      fs.transformOrigin = `${fl.fuss[0] * k}px ${fl.fuss[1] * k}px`;
      fs.transform = `scale(${1 - (zuengeln - 1) * 0.5}, ${(0.55 + 0.45 * Math.sqrt(w)) * zuengeln})`;
      fs.opacity = w * (lebt ? 0.94 + 0.06 * Math.sin(t * 11.3 + 2.1) : 1);
    }
    function zeichnen(t) {
      const lebt = !reduziert;
      licht.style.opacity = z.hell;
      const vorne = szenen[vorn];
      const neu = szenen[1 - vorn];
      vorne.el.style.zIndex = 1;
      vorne.el.style.opacity = 1;
      neu.el.style.zIndex = 2;
      neu.el.style.opacity = z.mix;
      zeichneSzene(vorne, t, lebt);
      if (z.mix > 0) zeichneSzene(neu, t, lebt);
    }

    let sichtbar = false;
    new IntersectionObserver(e => { sichtbar = e[0].isIntersecting; }, { rootMargin: '120px 0px' }).observe(buehne);
    const schleife = jetzt => { if (sichtbar) zeichnen(jetzt / 1000); requestAnimationFrame(schleife); };

    let lauf = 0; // ein neuer Klick bricht den laufenden Wechsel ab und setzt dort an
    let zielFarbe = null; // Ziel des laufenden Wechsels
    function tween(schluessel, ziel, dauer, id, kurve = sanft) {
      const start = z[schluessel];
      if (reduziert || dauer <= 0 || start === ziel) { z[schluessel] = ziel; return Promise.resolve(); }
      const t0 = performance.now();
      return new Promise(fertig => {
        const weiter = jetzt => {
          if (id !== lauf) return fertig();
          const t = klemm((jetzt - t0) / dauer);
          z[schluessel] = start + (ziel - start) * kurve(t);
          if (t < 1) requestAnimationFrame(weiter); else fertig();
        };
        requestAnimationFrame(weiter);
      });
    }
    // die hereingekommene Szene wird zur sichtbaren
    function tauschen() {
      if (z.mix >= 1) vorn = 1 - vorn;
      z.mix = 0;
      beschriften();
    }

    function markiere(farbe) {
      if (farbe !== farbeFeld.value && form.classList.contains('fertig')) {
        form.classList.remove('fertig');
        meldung.textContent = '';
      }
      felder.forEach(f => {
        const an = f.dataset.farbe === farbe;
        f.setAttribute('aria-checked', String(an));
        f.tabIndex = an ? 0 : -1;
      });
      name.textContent = F.farben[farbe].name;
      farbeFeld.value = farbe;
    }

    async function waehle(farbe) {
      if (!F.farben[farbe]) return;
      const vorher = farbeFeld.value;
      markiere(farbe);
      if (farbe === vorher && aktuell() === farbe && z.mix === 0) return;
      if (z.mix > 0 && szenen[1 - vorn].farbe === farbe && zielFarbe === farbe) return; // blendet schon herein
      const id = ++lauf;
      zielFarbe = farbe;
      if (z.mix > 0) {                                      // laufendes Überblenden erst abschließen
        await tween('mix', 1, 160 * (1 - z.mix), id);
        if (id !== lauf) return;
        tauschen();
      }
      // falls die Box gerade erst auftaucht: Licht und Kerze nebenher fertig machen
      const nebenher = Promise.all([tween('hell', 1, 400 * (1 - z.hell), id), tween('warm', 1, 600 * (1 - z.warm), id)]);
      if (farbe !== aktuell()) {
        if (!(await belade(szenen[1 - vorn], farbe, id))) return;
        await tween('mix', 1, 750, id);                     // die neue Farbe blendet über
        if (id !== lauf) return;
        tauschen();
      }
      await nebenher;
    }

    let hinweisZeit = null;
    function folgt(f) {
      clearTimeout(hinweisZeit);
      name.textContent = `${f.dataset.name} folgt`;
      hinweisZeit = setTimeout(() => { name.textContent = F.farben[farbeFeld.value].name; }, 2200);
    }
    felder.forEach(f => {
      f.addEventListener('click', () => {
        if (f.getAttribute('aria-disabled') === 'true') { folgt(f); return; }
        clearTimeout(hinweisZeit);
        waehle(f.dataset.farbe);
      });
      f.addEventListener('keydown', e => {
        const weiter = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!weiter) return;
        e.preventDefault();
        const i = waehlbar.indexOf(f);
        const naechstes = waehlbar[(Math.max(i, 0) + weiter + waehlbar.length) % waehlbar.length];
        naechstes.focus();
        waehle(naechstes.dataset.farbe);
      });
    });

    // Noch ohne Versand: Die Warteliste ist nicht angebunden. Sobald sie es ist, lautet die Bestätigung
    // „Danke. Wir melden uns, sobald OFF LIGHT in <Farbe> lieferbar ist.“
    form.addEventListener('submit', e => {
      e.preventDefault();
      const wert = email.value.trim();
      if (!wert || !email.checkValidity()) {
        email.setAttribute('aria-invalid', 'true');
        meldung.classList.add('fehler');
        meldung.textContent = wert ? 'Diese E-Mail-Adresse stimmt noch nicht.' : 'Bitte gib deine E-Mail-Adresse ein.';
        email.focus();
        return;
      }
      email.removeAttribute('aria-invalid');
      meldung.classList.remove('fehler');
      form.classList.add('fertig');
      meldung.textContent = 'Danke. Die Warteliste ist noch nicht angebunden, deine Adresse wurde nicht gespeichert.';
      meldung.tabIndex = -1;
      meldung.focus({ preventScroll: true });
    });
    email.addEventListener('input', () => {
      if (email.getAttribute('aria-invalid') !== 'true') return;
      email.removeAttribute('aria-invalid');
      meldung.classList.remove('fehler');
      meldung.textContent = '';
    });

    api.farbe = waehle;
    api.produkt = {
      waehle,
      setze(neu) { lauf++; Object.assign(z, neu); zeichnen(performance.now() / 1000); },
      get zustand() { return { ...z, farbe: aktuell() }; },
    };

    // Start: erste Farbe mit Bildern, Box erscheint mit brennender Kerze
    const start = (waehlbar.find(f => f.getAttribute('aria-checked') === 'true') || waehlbar[0])?.dataset.farbe;
    if (start) {
      markiere(start);
      massstab();
      requestAnimationFrame(schleife); // zeichnet, sobald eine Szene Bilder hat
      vorladen(start).then(() => {
        if (lauf === 0) return belade(szenen[vorn], start).then(beschriften);
      }).then(() => {
        massstab();
        zeichnen(performance.now() / 1000);
        // die übrigen Farben leise nachladen, damit der Wechsel ohne Warten geht
        waehlbar.forEach(f => vorladen(f.dataset.farbe));
        const erstes = new IntersectionObserver(async e => {
          if (!e[0].isIntersecting) return;
          erstes.disconnect();
          if (lauf) return; // schon eine Farbe gewählt: der Wechsel macht Licht und Kerze fertig
          const id = ++lauf;
          z.warm = 0;
          await tween('hell', 1, 700, id);
          if (id !== lauf) return;
          await warte(reduziert ? 0 : 200);
          if (id !== lauf) return;
          await tween('warm', 1, 900, id);
        }, { threshold: 0.4 });
        erstes.observe(buehne);
      });
    }
    addEventListener('resize', () => { massstab(); zeichnen(performance.now() / 1000); });
  }

  // Scrollen in Abschnitten (Desktop mit Maus oder Trackpad), ohne Zurückfedern.
  // Trackpad und Magic Mouse (ein Strom von Ereignissen): wie weit es geht, hängt von der Scrollstrecke
  // ab, ab STUFEN[0] einer Fensterhöhe ein Abschnitt, ab STUFEN[1] zwei, ab STUFEN[2] drei; kleine
  // Bewegungen verschieben nichts. Mausrad: eine einzelne Raste ein Abschnitt, bei einer Drehung zählt
  // jede Raste wie eine erste Stufe (etwa 10 Rasten zwei, 20 Rasten drei Abschnitte). Ein Abschnitt, der höher ist als das Fenster, scrollt innen frei bis zu seinem Rand.
  // Eine Feder gleitet ohne Ruck ans Ziel; sie gibt nach, sobald jemand anderes scrollt.
  (() => {
    const passt = matchMedia('(pointer: fine) and (min-width: 761px) and (min-height: 560px)');
    const abschnitte = [...document.querySelectorAll('.einstieg, .wofuer, .anleitung, .produkt')];
    if (reduziert || abschnitte.length < 2) return;
    const STUFEN = [0.2, 1.8, 3.4];
    const PAUSE = 180; // ms ohne Ereignis: die Bewegung ist zu Ende (Trackpad)
    const DREHPAUSE = 350; // ms zwischen Mausrad-Rasten, die noch zu einer Drehung gehören
    const TAKT = 25;   // Ereignisse im Bildtakt gehören zu einem Strom (Trackpad, Magic Mouse)
    const RASTE = 70;  // folgt einem Einzelereignis so lange nichts, war es eine Mausrad-Raste
    const OMEGA = 9;   // Federstärke: eingeschwungen nach etwa 0,8 s

    const oben = () => abschnitte.map(a => Math.round(a.getBoundingClientRect().top + scrollY));
    const maxY = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const letzter = abschnitte.length - 1;
    const begrenzt = i => Math.min(letzter, Math.max(0, i));
    // Wo die Seite ruhen darf: am Anfang jedes Abschnitts, in einem hohen Abschnitt bis zu seinem Ende
    function bereiche() {
      const t = oben();
      const m = maxY();
      return t.map((v, i) => {
        const a = Math.min(v, m);
        const b = Math.min((t[i + 1] ?? document.documentElement.scrollHeight) - innerHeight, m);
        return [a, Math.max(a, b)];
      });
    }
    const enthalten = y => { const t = oben(); let i = 0; t.forEach((v, j) => { if (v <= y + 2) i = j; }); return i; };
    // Ausgangspunkt einer Bewegung: der Abschnitt, von dem aus „einer weiter“ zählt
    function basis(richtung, y = scrollY) {
      const t = oben();
      if (richtung > 0) { const j = t.findIndex(v => v > y + 2); return j < 0 ? letzter : j - 1; }
      let j = -1;
      t.forEach((v, i) => { if (v < y - 2) j = i; });
      return j + 1;
    }

    // Feder, kritisch gedämpft: das Ziel darf sich unterwegs ändern, die Geschwindigkeit bleibt
    let laeuft = false, pos = 0, tempo = 0, zielY = 0, zielIndex = null, zuletzt = 0;
    let gesetzt = 0;       // zuletzt von der Feder gesetzte Lage, um fremdes Scrollen zu erkennen
    let umbau = -1e9;      // Zeit der letzten Größenänderung
    let ruheIndex = enthalten(scrollY); // zuletzt eingenommener Abschnitt, für Größenänderungen
    let ruheY = scrollY;                // zuletzt eingenommene Lage
    const merke = () => { ruheIndex = enthalten(scrollY); ruheY = scrollY; };
    function fahreY(y, index = null) {
      zielY = Math.max(0, Math.min(maxY(), y));
      zielIndex = index;
      if (laeuft) return;
      if (Math.abs(zielY - scrollY) < 1) { merke(); return; }
      pos = scrollY; gesetzt = scrollY; tempo = 0; laeuft = true; zuletzt = performance.now();
      requestAnimationFrame(tick);
    }
    // ein Ziel hinter dem letzten Abschnitt heißt: ans Seitenende
    function fahre(index) {
      if (index > letzter && (laeuft ? zielY : scrollY) >= oben()[letzter] - 2) { fahreY(maxY()); return; }
      const i = begrenzt(index);
      fahreY(oben()[i], i);
    }
    function tick(jetzt) {
      if (!laeuft) return;
      // scrollt jemand anderes (Scrollleiste, Fokus, Suche), gibt die Feder nach
      if (Math.abs(scrollY - gesetzt) > 3 && jetzt - umbau > 400) { laeuft = false; setTimeout(ruhig, 250); return; }
      if (zielIndex !== null) zielY = Math.min(maxY(), oben()[zielIndex]); // falls sich das Layout ändert
      const dt = Math.min(0.05, (jetzt - zuletzt) / 1000);
      zuletzt = jetzt;
      tempo += (-OMEGA * OMEGA * (pos - zielY) - 2 * OMEGA * tempo) * dt;
      pos += tempo * dt;
      if (Math.abs(pos - zielY) < 0.5 && Math.abs(tempo) < 10) { pos = zielY; laeuft = false; }
      window.scrollTo({ top: pos, behavior: 'instant' });
      gesetzt = scrollY;
      if (laeuft) requestAnimationFrame(tick); else merke();
    }

    let geste = null;  // { basis, richtung, summe, stufe, strom, rasten, spitze }
    let letzte = 0;    // Zeit des letzten Scrollereignisses
    let verlauf = [];  // letzte Beträge, um einen neuen Wisch mitten im Nachlauf zu erkennen
    let rastUhr = 0;
    let nativ = { richtung: 0, zeit: -1e9 }; // zuletzt vom Browser selbst gescrollte Richtung

    addEventListener('wheel', e => {
      if (!passt.matches || e.ctrlKey) return;                               // ctrl: Zoomen
      if (window.visualViewport && visualViewport.scale > 1.01) return;      // gezoomt: frei verschieben
      const jetzt = performance.now();
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;                    // waagerecht: Zurück/Vor
      const d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
      if (!d) return;
      const pause = jetzt - letzte;
      letzte = jetzt;
      const richtung = Math.sign(d);

      // hoher Abschnitt: innen frei scrollen, solange in dieser Richtung noch Inhalt kommt
      if (!laeuft) {
        const [a, b] = bereiche()[enthalten(scrollY)];
        const innen = richtung > 0 ? scrollY < b - 2 : scrollY > a + 2 && b > a + 2;
        if (innen && e.cancelable) {
          // selbst verschieben und am Rand anhalten; der Rest dieser Bewegung zählt nicht weiter
          e.preventDefault();
          window.scrollTo({ top: richtung > 0 ? Math.min(b, scrollY + d) : Math.max(a, scrollY + d), behavior: 'instant' });
          geste = { basis: 0, richtung, summe: 0, stufe: 99, strom: true, rasten: 0, spitze: Math.abs(d) };
          verlauf = [Math.abs(d)];
          merke();
          return;
        }
        if (innen) { geste = null; nativ = { richtung, zeit: jetzt }; return; }
      }
      if (!e.cancelable) { nativ = { richtung, zeit: jetzt }; return; } // Nachlauf lässt sich nicht abfangen
      e.preventDefault();

      const n = verlauf.length;
      const mittel = n ? verlauf.reduce((x, y) => x + y, 0) / n : 0;
      // ein neuer Wisch mitten im Nachlauf: erst wenn die Spitze klar abgeklungen ist
      const abgeklungen = geste && n >= 3 && Math.max(...verlauf) < 0.6 * geste.spitze
        && verlauf[n - 1] <= verlauf[n - 2] && verlauf[n - 2] <= verlauf[n - 3];
      const neuerWisch = abgeklungen && Math.abs(d) > 1.6 * mittel && Math.abs(d) > 20;
      const grenze = geste && !geste.strom ? DREHPAUSE : PAUSE;
      if (!geste || pause > grenze || richtung !== geste.richtung || neuerWisch) {
        geste = { basis: laeuft && zielIndex !== null ? zielIndex : basis(richtung), richtung, summe: 0, stufe: 0, strom: false, rasten: 0, spitze: 0 };
        verlauf = [];
      } else {
        // Trackpad und Magic Mouse: kleine oder schwankende Werte im Bildtakt; Rasten sind gleich groß
        const gleich = n > 0 && Math.abs(Math.abs(d) - verlauf[n - 1]) < 0.5;
        if (Math.abs(d) < 30 || (pause < TAKT && !gleich)) geste.strom = true;
      }
      verlauf.push(Math.abs(d));
      if (verlauf.length > 4) verlauf.shift();
      geste.spitze = Math.max(geste.spitze, Math.abs(d));

      geste.summe += Math.abs(d);
      let stufe = geste.stufe;
      if (geste.strom) {
        stufe = Math.max(stufe, STUFEN.filter(s => geste.summe >= s * innerHeight).length);
      } else {
        // Mausrad: jede weitere Raste einer Drehung zählt mindestens wie eine erste Stufe, die Weite
        // folgt dann denselben Stufen; eine einzelne Raste wird unten über den Zeitgeber gezählt
        geste.rasten += 1;
        if (geste.rasten >= 2) {
          geste.summe += Math.max(0, STUFEN[0] * innerHeight - Math.abs(d));
          stufe = Math.max(stufe, STUFEN.filter(s => geste.summe >= s * innerHeight).length);
        }
      }
      if (stufe > geste.stufe) { geste.stufe = stufe; fahre(geste.basis + richtung * stufe); }

      // die erste Raste: erst warten, ob ein Strom folgt
      clearTimeout(rastUhr);
      if (!geste.strom && geste.stufe === 0 && Math.abs(d) >= 3) {
        const g = geste;
        rastUhr = setTimeout(() => {
          if (geste === g && !g.strom && g.stufe === 0) { g.stufe = 1; fahre(g.basis + g.richtung); }
        }, RASTE);
      }
    }, { passive: false });

    // Tastatur: Pfeile, Bild auf/ab und Leertaste einen Abschnitt weiter (in hohen Abschnitten erst
    // innen weiter), Pos1 und Ende an Anfang und Ende der Seite
    addEventListener('keydown', e => {
      if (!passt.matches || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t.closest?.('input, textarea, select, [contenteditable]')) return;
      if (e.key === ' ' && t.closest?.('button, [role="button"], [role="radio"], [role="tab"]')) return;
      if (e.key === 'Home') { e.preventDefault(); fahre(0); return; }
      if (e.key === 'End') { e.preventDefault(); fahreY(maxY()); return; }
      const richtung = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1, ' ': e.shiftKey ? -1 : 1 }[e.key];
      if (!richtung) return;
      e.preventDefault();
      const y = laeuft ? zielY : scrollY;
      const [a, b] = bereiche()[enthalten(y)];
      if (richtung > 0 && y < b - 2) { fahreY(Math.min(b, y + innerHeight * 0.8)); return; }
      if (richtung < 0 && y > a + 2) { fahreY(Math.max(a, y - innerHeight * 0.8)); return; }
      fahre(basis(richtung, y) + richtung);
    });

    // Sprungmarken (Vormerken, Preis, Wortmarke) gleiten mit der Feder; der Fokus geht mit ans Ziel,
    // damit die Tab-Reihenfolge dort weitergeht
    let taste = false; // eine Maustaste ist gedrückt
    document.addEventListener('click', e => {
      if (!passt.matches || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const link = e.target.closest?.('a[href^="#"]');
      const ziel = link && document.getElementById(decodeURIComponent(link.getAttribute('href').slice(1)));
      if (!ziel) return;
      const i = ziel.contains(abschnitte[0]) ? 0 : abschnitte.findIndex(s => s === ziel || s.contains(ziel));
      if (i < 0) return;
      e.preventDefault();
      history.pushState(null, '', link.getAttribute('href'));
      if (!ziel.hasAttribute('tabindex')) ziel.setAttribute('tabindex', '-1');
      ziel.focus({ preventScroll: true });
      fahre(i);
    });

    // Tastaturfokus außerhalb des Bildes (Tab): zu dem Abschnitt gleiten, der das Element zeigt
    addEventListener('focusin', e => {
      if (!passt.matches || taste) return;
      const el = e.target;
      if (!(el instanceof Element) || el.matches('#produkt, #oben')) return;
      const i = abschnitte.findIndex(s => s.contains(el));
      if (i < 0) return;
      const r = el.getBoundingClientRect();
      const [a, b] = bereiche()[i];
      const y = Math.min(b, Math.max(a, scrollY + r.top - innerHeight * 0.3));
      if (laeuft) { pos = scrollY; gesetzt = scrollY; } // der Browser hat schon zum Element gescrollt
      if (Math.abs(y - (laeuft ? zielY : scrollY)) > 2) fahreY(y, a === b ? i : null);
    });

    // Steht die Seite doch einmal zwischen zwei Abschnitten (Scrollleiste, Suche im Text, Nachlauf
    // über einen Rand), gleitet sie zum nächsten erlaubten Punkt, sobald alles ruht. Hat der Browser
    // gerade selbst gescrollt, in dessen Richtung, damit nichts zurückfedert.
    addEventListener('mousedown', e => { if (e.button === 0) taste = true; });
    addEventListener('contextmenu', () => { taste = false; });
    // Touchscreen am Notebook: dort scrollt der Finger frei, danach nicht einrasten
    let finger = -1e9;
    addEventListener('touchmove', () => { finger = performance.now(); }, { passive: true });
    function ruhig() {
      if (!passt.matches || laeuft || taste) return;
      if (performance.now() - finger < 2000) return;
      const y = scrollY;
      const b = bereiche();
      if (b.some(([a, z]) => y >= a - 2 && y <= z + 2)) { merke(); return; }
      const punkte = b.flat();
      let best = punkte.reduce((p, v) => (Math.abs(v - y) < Math.abs(p - y) ? v : p), punkte[0]);
      if (performance.now() - nativ.zeit < 400 && Math.abs(y - ruheY) >= STUFEN[0] * innerHeight) {
        const vorn = punkte.filter(v => (nativ.richtung > 0 ? v > y : v < y));
        if (vorn.length) best = nativ.richtung > 0 ? Math.min(...vorn) : Math.max(...vorn);
      }
      fahreY(best);
    }
    const losgelassen = () => { taste = false; setTimeout(ruhig, 60); };
    addEventListener('mouseup', losgelassen);
    addEventListener('dragend', losgelassen);
    addEventListener('blur', () => { taste = false; });
    if ('onscrollend' in window) addEventListener('scrollend', ruhig);
    else { let ende = 0; addEventListener('scroll', () => { clearTimeout(ende); ende = setTimeout(ruhig, 600); }, { passive: true }); }

    // nach einer Größenänderung im zuletzt eingenommenen Abschnitt bleiben
    let groesse = 0;
    addEventListener('resize', () => {
      umbau = performance.now();
      clearTimeout(groesse);
      groesse = setTimeout(() => {
        if (!passt.matches || laeuft) return;
        window.scrollTo({ top: Math.min(maxY(), oben()[ruheIndex]), behavior: 'instant' });
      }, 160);
    });
    setTimeout(ruhig, 400); // falls der Browser beim Neuladen eine Zwischenlage wiederherstellt

    api.einrasten = { get laeuft() { return laeuft; }, STUFEN };
  })();

  window.offlight = api;
})();
