// OFF LIGHT im Stil von Ayocin (Nebenstrang 07.10.2026, seit 15.10.2026 Benis Version im Branch beni)
// Alles hängt am Scrollweg, nichts rastet ein, nichts schaltet von selbst weiter. Ausnahmen wie auf der
// Startseite: die Box im Einstieg, das ruhige Flackern der Flamme und die eine Fahrt des Lichtschiebers.
// Ein gemeinsamer Takt (jeBild) zeichnet alle scrollgebundenen Teile. Gemessen wird nur beim Laden und
// bei Größenänderung (vermessen), im Takt selbst wird nur scrollY gelesen.
(() => {
  const G = window.OFFLIGHT_GEOMETRIE;
  const E = G ? G.ebenen : null;
  const W = G ? G.groesse[0] : 1254;
  const reduziert = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const handyMq = matchMedia('(max-width: 760px)');
  const klemm = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const weich = (a, b, x) => { const t = klemm((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const sanft = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const quad = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const flackern = t => 0.93 + 0.035 * Math.sin(t * 8.2) + 0.025 * Math.sin(t * 18.1 + 1.2) + 0.012 * Math.sin(t * 38.3 + 0.4);
  const warte = ms => new Promise(f => setTimeout(f, ms));
  const $ = (s, w = document) => w.querySelector(s);
  const $$ = (s, w = document) => [...w.querySelectorAll(s)];
  const oben = el => el.getBoundingClientRect().top + scrollY;
  // Fokus per Tastatur (nicht per Klick): nur dann darf ein Fokus die Seite verschieben
  const tastatur = el => { try { return el.matches(':focus-visible'); } catch (_) { return true; } };
  // Jeder Teil läuft für sich, damit ein Fehler in einem Teil nicht die ganze Seite lahmlegt
  const teil = (name, los) => { try { los(); } catch (fehler) { console.error(`OFF LIGHT, ${name}:`, fehler); } };

  const jeBild = [];      // (t in s, scrollY) => zeichnen
  const vermessen = [];   // () => Lage neu messen
  const nachSchrift = []; // () => nach dem Laden der Schrift und bei Größenänderung (Zeilen, Wortmarke)
  const handy = () => handyMq.matches;
  const api = {};

  // Text in Zeilen teilen, damit jede Zeile aus einer Maske steigen kann. Wörter behalten ihre Klasse.
  function inZeilen(el) {
    if (!el._woerter) {
      const woerter = [];
      const sammeln = (knoten, klasse) => knoten.childNodes.forEach(n => {
        if (n.nodeType === 3) n.textContent.split(/\s+/).filter(Boolean).forEach(w => woerter.push({ w, klasse }));
        else if (n.nodeType === 1) sammeln(n, n.className || klasse);
      });
      sammeln(el, '');
      el._woerter = woerter;
    }
    const woerter = el._woerter;
    const wort = (x) => { const s = document.createElement('span'); s.textContent = x.w; if (x.klasse) s.className = x.klasse; return s; };
    el.textContent = '';
    const spans = woerter.map((x, i) => {
      const s = wort(x);
      el.appendChild(s);
      if (i < woerter.length - 1) el.appendChild(document.createTextNode(' '));
      return s;
    });
    const zeilen = [];
    let z0 = null;
    spans.forEach((s, i) => {
      const t = s.offsetTop;
      if (z0 === null || t - z0 > 2) { zeilen.push([]); z0 = t; }
      zeilen[zeilen.length - 1].push(i);
    });
    el.textContent = '';
    zeilen.forEach((liste, z) => {
      const zeile = document.createElement('span');
      zeile.className = 'zeile';
      const innen = document.createElement('span');
      innen.style.setProperty('--z', z);
      liste.forEach((i, k) => { innen.appendChild(wort(woerter[i])); if (k < liste.length - 1) innen.appendChild(document.createTextNode(' ')); });
      zeile.appendChild(innen);
      el.appendChild(zeile);
    });
  }

  // ---------- Leiste: Glas ab 70 px, kleine Wortmarke erst, wenn die große weg ist, Schriftfarbe je Abschnitt ----------
  teil('Leiste', () => {
    const leiste = $('.leiste');
    const abschnitte = $$('main > section').map(el => ({ el, oben: 0, unten: 0, z: 0 }));
    let wmUnten = 0, leisteH = 76;
    vermessen.push(() => {
      abschnitte.forEach(a => {
        const r = a.el.getBoundingClientRect();
        a.oben = r.top + scrollY; a.unten = r.bottom + scrollY;
        a.z = parseInt(getComputedStyle(a.el).zIndex, 10) || 0;
      });
      const wm = $('.wortmarke');
      wmUnten = wm ? wm.getBoundingClientRect().bottom + scrollY : 0;
      leisteH = leiste.offsetHeight;
    });
    let ton = null;
    jeBild.push((t, y) => {
      leiste.classList.toggle('glas', y > 70);
      leiste.classList.toggle('marke-da', y > wmUnten - leisteH);
      // oberster Abschnitt an der Stelle 30 px unter der Oberkante (überlappende Abschnitte: höchster z-index)
      const stelle = y + 30;
      let bester = null;
      for (const a of abschnitte) if (a.oben <= stelle && a.unten > stelle && (!bester || a.z >= bester.z)) bester = a;
      const neu = bester ? (bester.el.dataset.tonJetzt || bester.el.dataset.ton) : 'dunkel';
      if (neu !== ton) { leiste.dataset.ton = neu; ton = neu; }
    });
    api.leiste = leiste;
    setTimeout(() => leiste.classList.add('da'), 2500); // falls der Einstieg nicht startet
  });

  // ---------- Einstieg: offen mit leuchtendem Handy, dann schließt die Box und die Kerze geht an ----------
  teil('Einstieg', () => {
    const abschnitt = $('.einstieg');
    const flaeche = $('.einstieg-buehne');
    if (!abschnitt || !flaeche || !window.OffBuehne || !E) return;
    const b = OffBuehne(flaeche);
    const wort = $('.wortmarke');
    const buchst = $$('.wm-b', wort);
    buchst.forEach((s, i) => s.style.setProperty('--v', buchst.length - 1 - i)); // von rechts nach links

    // Wortmarke genau auf die Inhaltsbreite, gemessen an der Tinte: die Luft vor dem O und hinter dem T zählt nicht.
    // Die Lage der Buchstaben kommt aus dem Satz, die Tinte je Buchstabe aus Pixeln: O und T werden einmal in ein
    // Canvas gezeichnet (measureText liefert in Safari keine Tinte). Rückfall: feste Werte für Libre Baskerville 400.
    function tinte(zeichen, schrift) {
      const g = 200, w = 300, h = 280, ursprung = 50;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.font = `${schrift.fontWeight} ${g}px ${schrift.fontFamily}`;
      x.fillStyle = '#000';
      x.fillText(zeichen, ursprung, 220);
      const d = x.getImageData(0, 0, w, h).data;
      let links = -1, rechts = -1;
      for (let s = 0; s < w; s++) {
        for (let z = 0; z < h; z++) if (d[(z * w + s) * 4 + 3] > 96) { if (links < 0) links = s; rechts = s + 1; break; }
      }
      if (links < 0) throw new Error('keine Tinte');
      return { links: (links - ursprung) / g, rechts: (rechts - ursprung) / g };   // in em ab dem Ursprung
    }
    nachSchrift.push(() => {
      wort.style.removeProperty('--wm');
      wort.style.removeProperty('--wm-l');
      const cs = getComputedStyle(wort), fs = parseFloat(cs.fontSize);
      const erster = buchst[0], letzter = buchst[buchst.length - 1];
      let vor = 0.055 * fs, rechts = 0.79 * fs;
      try { vor = tinte(erster.textContent, cs).links * fs; rechts = tinte(letzter.textContent, cs).rechts * fs; } catch (_) {}
      const links = erster.getBoundingClientRect().left + vor;
      const breite = letzter.getBoundingClientRect().left + rechts - links;   // nicht „tinte“ nennen: das verdeckt die Funktion oben
      if (!(breite > 0)) return;
      const k = wort.clientWidth / breite;
      wort.style.setProperty('--wm', `${(fs * k).toFixed(2)}px`);
      wort.style.setProperty('--wm-l', `${(-vor * k).toFixed(2)}px`);
    });

    const DAUER = 3.4; // Sekunden für einmal ganz öffnen, wie auf der Startseite
    const warm = p => 1 - weich(0.0, 0.12, p);
    const hub = p => sanft(klemm((p - 0.14) / (0.80 - 0.14)));
    const fuge = p => 1 - weich(0.14, 0.19, p);
    const kerzenSchatten = p => 1 - weich(0.14, 0.17, p);
    const kalt = p => weich(0.66, 1.0, p);
    let p = reduziert ? 0 : 1, ziel = p, tempo = 1, ein = 0, einStart = null, letzte = null, hoehe = 1, vorigesY = 0, drin = false;
    vermessen.push(() => { hoehe = abschnitt.offsetHeight; });

    const setzeZiel = (wert, schnell = false) => {
      ziel = wert; tempo = schnell ? 2.2 : 1;
      flaeche.setAttribute('aria-pressed', ziel > 0.5 ? 'true' : 'false');
    };
    jeBild.push((t, y) => {
      if (letzte !== null) {
        const dt = Math.min(0.05, t - letzte);
        if (p !== ziel) { const v = tempo / DAUER; p = reduziert ? ziel : ziel > p ? Math.min(ziel, p + v * dt) : Math.max(ziel, p - v * dt); }
        if (einStart !== null && ein < 1) ein = reduziert ? 1 : klemm((t * 1000 - einStart) / 800);
      }
      letzte = t;
      // Beim Weiterscrollen nach unten schließt die Box zügig, der Einstieg dunkelt ab und fährt wie ein Vorhang weg.
      // Steht die Seite still, bleibt ein Tipp oder Enter stehen, auch etwas weiter unten.
      if (y > hoehe * 0.12 && y > vorigesY && ziel > 0) { setzeZiel(0, true); drin = false; }
      vorigesY = y;
      abschnitt.style.setProperty('--dunkel', handy() ? '0' : (0.35 * klemm(y / hoehe)).toFixed(3));
      if (y > hoehe + 50) return;
      const w = warm(p);
      b.zeichnen({ deckel: hub(p), kerze: hub(p), warm: w, kalt: kalt(p), fuge: fuge(p), kerzenSchatten: kerzenSchatten(p), ein }, t);
      abschnitt.style.setProperty('--licht', (w * (reduziert ? 1 : flackern(t))).toFixed(3));
    });

    // Maus auf der Box öffnet, Maus weg schließt, Finger und Tastatur schalten um. Ob der Zeiger auf der Box ist,
    // entscheidet die Lage von Boxkörper, Deckel und Kerze, nicht die Stapelordnung: Wortmarke und Zeile liegen darüber.
    // Körper und Deckel sind im Bild Trapeze (hinten schmaler). Die offene Box zählt als lückenlose Säule:
    // die Kerze reicht bis auf den Deckel, der Deckel bis auf den Körper.
    const M = E.masse ? E.masse.box : null;
    const EINZUG = M ? (M.hintenLinks - M.links) / (M.rechts - M.links) : 0.072;            // hinten schmaler, je Seite
    const SCHRAEG = M ? (M.vorneOben - M.hintenOben) / (E.deckel.h || 277) : 0.58;           // Anteil der Deckelhöhe bis zur Vorderkante
    function inTrapez(x, y, links, rechts, oben, vorne, unten) {
      if (y < oben || y > unten) return false;
      const e = (rechts - links) * EINZUG * (1 - klemm((y - oben) / Math.max(1, vorne - oben)));
      return x >= links + e && x <= rechts - e;
    }
    function aufBox(x, y) {
      const r = flaeche.getBoundingClientRect(), s = r.width / W;
      const d = b.el.deckel.getBoundingClientRect(), k = b.el.kerze.getBoundingClientRect();
      if (M && inTrapez(x, y, r.left + M.links * s, r.left + M.rechts * s, r.top + M.hintenOben * s, r.top + M.vorneOben * s, r.top + M.unten * s)) return true;
      const koerperOben = M ? r.top + M.hintenOben * s : d.bottom;
      if (inTrapez(x, y, d.left, d.right, d.top, d.top + d.height * SCHRAEG, Math.max(d.bottom, koerperOben))) return true;
      return x >= k.left && x <= k.right && y >= k.top && y <= Math.max(k.bottom, d.top);
    }
    let verzoegerung = null, intro = false, art = null;
    function maus(neu) {
      abschnitt.classList.toggle('ueber-box', neu);
      if (neu && scrollY > hoehe * 0.12) neu = false;   // weiter unten zählt der Zeiger erst wieder, wenn man zurück ist
      if (neu === drin) return;
      drin = neu;
      clearTimeout(verzoegerung);
      if (reduziert) return;
      if (drin) verzoegerung = setTimeout(() => { intro = false; setzeZiel(1); }, 140);
      else { intro = false; setzeZiel(0); }
    }
    abschnitt.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') maus(aufBox(e.clientX, e.clientY)); });
    abschnitt.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') maus(false); });
    // Die Art des Zeigers kommt aus pointerdown: Safari meldet den Klick nach einem Tippen als „mouse“
    abschnitt.addEventListener('pointerdown', e => { art = e.pointerType; });
    abschnitt.addEventListener('click', e => {
      const a = art || e.pointerType; art = null;
      if (e.target.closest('a, button') || !aufBox(e.clientX, e.clientY)) return;
      if (a === 'mouse' && !reduziert) return;
      intro = false; setzeZiel(ziel > 0.5 ? 0 : 1);
    });
    flaeche.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      intro = false; setzeZiel(ziel > 0.5 ? 0 : 1);
    });

    // Auftakt: Box blendet offen ein, Buchstaben steigen, die Leiste fährt herein, dann schließt die Box
    const schrift = document.fonts ? document.fonts.ready : Promise.resolve();
    Promise.all([b.bereit, Promise.race([schrift, warte(2500)])]).then(() => {
      nachSchrift.forEach(f => f());
      einStart = performance.now();
      abschnitt.classList.add('los');
      setTimeout(() => api.leiste && api.leiste.classList.add('da'), reduziert ? 0 : 300);
      if (reduziert) { p = 0; setzeZiel(0); return; }
      intro = true;
      setTimeout(() => { if (intro && !drin && scrollY < hoehe * 0.12) setzeZiel(0); intro = false; }, 1300);
    });
    api.einstieg = { setze: wert => { p = klemm(wert); setzeZiel(p); }, get p() { return p; } };
  });

  // ---------- 1. Momente: ein Kapitel, drei Bildpaare, umschalten über die Karte oder einen Wisch ----------
  teil('Momente', () => {
    const abschnitt = $('.momente');
    if (!abschnitt) return;
    const fest = $('.momente-fest', abschnitt);
    const bild = $('.momente-bild', abschnitt);
    const dunkel = $('.momente-bild .abdunkeln', abschnitt);
    const paare = $$('.m-paar', abschnitt);
    const saetze = $$('.m-satz', abschnitt);
    const tabs = $$('.m-wahl [role="tab"]', abschnitt);
    const panel = $('.m-saetze', abschnitt);
    const status = $('[data-moment-status]', abschnitt);
    const namen = tabs.map(t => $('.m-tab-name', t).textContent);
    nachSchrift.push(() => saetze.forEach(inZeilen));

    // Lichtschieber wie auf der Startseite (Anruf-Schieber), mit zwei Lagen: Handylicht und Kerzenlicht.
    // Dazwischen steht er nur, solange man zieht; losgelassen gleitet er in die nähere Lage. Das Bild blendet
    // nur im mittleren Teil des Wegs über, damit kein Doppelbild stehen bleibt (beim Essen liegen die Handys
    // im einen Bild auf dem Tisch, im anderen in der Box). Tippen oder Klicken schaltet um.
    // --griff ist die Lage des Griffs, --kerze der Anteil des Kerzenbilds.
    const spur = $('.regler-spur', abschnitt);
    const griff = $('.regler-griff', abschnitt);
    const bildAnteil = w => weich(0.25, 0.75, w);
    let wert = 0, mix = 0, fahrt = 0;
    function setze(w, bildMit = true) {
      wert = klemm(w);
      abschnitt.style.setProperty('--griff', wert.toFixed(3));
      if (bildMit) { mix = bildAnteil(wert); abschnitt.style.setProperty('--kerze', mix.toFixed(3)); }
      griff.setAttribute('aria-checked', String(wert >= 0.5));
    }
    const ausPunkt = x => { const r = spur.getBoundingClientRect(); return (x - r.left - 32) / (r.width - 64); };
    function nach(zielWert, dauer = null, bildMit = true) {
      const id = ++fahrt, start = wert, t0 = performance.now();
      const d = reduziert ? 0 : dauer ?? 250 + 650 * Math.abs(zielWert - start);
      const schritt = jetzt => {
        if (id !== fahrt) return;
        const t = d ? klemm((jetzt - t0) / d) : 1;
        setze(start + (zielWert - start) * sanft(t), bildMit);
        if (t < 1) requestAnimationFrame(schritt);
      };
      requestAnimationFrame(schritt);
    }
    const naechste = () => (wert >= 0.5 ? 1 : 0);
    // Ein Zug beginnt mit dem Drücken. Maus und Finger auf dem Griff ziehen ab 4 px Bewegung (der Griff scrollt
    // die Seite nie). Ein Finger auf der Spur zieht erst, wenn er klar waagerecht geht; senkrecht scrollt die Seite.
    let zug = null;
    spur.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      fahrt++;
      const maus = e.pointerType === 'mouse', aufGriff = griff.contains(e.target);
      zug = { id: e.pointerId, x: e.clientX, y: e.clientY, maus, aufGriff, ab: null };
      if (maus || aufGriff) { try { spur.setPointerCapture(e.pointerId); } catch (_) {} }
      if (maus) e.preventDefault();
    });
    spur.addEventListener('pointermove', e => {
      if (!zug || e.pointerId !== zug.id) return;
      if (zug.ab === null) {
        const dx = e.clientX - zug.x, dy = e.clientY - zug.y;
        if (!zug.maus && !zug.aufGriff) {
          if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { zug = null; return; }
          if (!(Math.abs(dx) >= 12 && Math.abs(dx) > 2 * Math.abs(dy))) return;
          try { spur.setPointerCapture(e.pointerId); } catch (_) {}
        } else if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        const punkt = ausPunkt(zug.x);
        zug.ab = zug.aufGriff ? punkt - wert : 0;
        if (!zug.aufGriff) setze(punkt);
        spur.classList.add('zieht');
      }
      setze(ausPunkt(e.clientX) - zug.ab);
    });
    const los = e => {
      if (!zug || e.pointerId !== zug.id) return;
      const gezogen = zug.ab !== null;
      zug = null; spur.classList.remove('zieht');
      if (gezogen) nach(naechste());
      else if (e.type === 'pointerup') nach(1 - naechste());
    };
    spur.addEventListener('pointerup', los);
    spur.addEventListener('pointercancel', los);
    griff.addEventListener('keydown', e => {
      const z = { ArrowRight: 1, ArrowUp: 1, PageUp: 1, End: 1, ArrowLeft: 0, ArrowDown: 0, PageDown: 0, Home: 0 }[e.key];
      if (z !== undefined) { e.preventDefault(); fahrt++; nach(z); return; }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fahrt++; nach(1 - naechste()); }
    });

    // Moment wählen: das neue Bildpaar wischt von unten herein, das alte dunkelt ab, die Zeilen wechseln
    let aktiv = 0, gezeigt = false;
    const aufraeumen = new Map();
    function waehle(i) {
      i = (i + paare.length) % paare.length;
      if (i === aktiv) return;
      const alt = aktiv;
      aktiv = i;
      // Das gehende Paar behält sein Licht, bis es verdeckt ist; das neue kommt mit Handylicht
      const kerzeVon = el => $('.m-kerze', el);
      const altKerze = kerzeVon(paare[alt]);
      clearTimeout(aufraeumen.get(altKerze));
      altKerze.style.opacity = mix.toFixed(3);
      aufraeumen.set(altKerze, setTimeout(() => { altKerze.style.opacity = ''; }, reduziert ? 0 : 950));
      const neuKerze = kerzeVon(paare[i]);
      clearTimeout(aufraeumen.get(neuKerze));
      neuKerze.style.opacity = '';
      if (wert > 0 || mix > 0) { fahrt++; mix = 0; abschnitt.style.setProperty('--kerze', '0'); nach(0, 350, false); }
      paare.forEach((el, n) => {
        clearTimeout(aufraeumen.get(el));
        el.classList.remove('rein');
        if (n === i) {
          el.classList.remove('geht');
          if (!reduziert) { el.classList.add('rein', 'an'); void el.offsetWidth; el.classList.remove('rein'); } else el.classList.add('an');
        } else if (n === alt) {
          el.classList.remove('an'); el.classList.add('geht');
          aufraeumen.set(el, setTimeout(() => el.classList.remove('geht'), reduziert ? 0 : 950));
        } else el.classList.remove('an', 'geht');
      });
      saetze.forEach((s, n) => {
        clearTimeout(aufraeumen.get(s));
        s.setAttribute('aria-hidden', String(n !== i));
        if (n === i) {
          s.classList.add('sofort'); s.classList.remove('an', 'geht'); void s.offsetWidth; s.classList.remove('sofort');
          s.classList.add('an');
        } else if (n === alt) {
          s.classList.remove('an'); s.classList.add('geht');
          aufraeumen.set(s, setTimeout(() => s.classList.remove('geht'), reduziert ? 0 : 900));
        } else s.classList.remove('an', 'geht');
      });
      tabs.forEach((k, n) => { k.setAttribute('aria-selected', String(n === i)); k.tabIndex = n === i ? 0 : -1; });
      panel.setAttribute('aria-labelledby', tabs[i].id);
      if (status) status.textContent = `${namen[i]}, ${i + 1} von ${paare.length}`;
    }
    tabs.forEach((k, n) => {
      k.addEventListener('click', () => waehle(n));
      k.addEventListener('keydown', e => {
        const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        const z = (aktiv + d + tabs.length) % tabs.length;
        waehle(z);
        tabs[z].focus();
      });
    });

    // Wischen (Finger): waagerecht wechselt den Moment, senkrecht scrollt die Seite
    let wisch = null;
    fest.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || e.target.closest('.regler, .m-karte button')) return;
      wisch = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    fest.addEventListener('pointerup', e => {
      if (!wisch || e.pointerId !== wisch.id) return;
      const dx = e.clientX - wisch.x, dy = e.clientY - wisch.y;
      wisch = null;
      if (Math.abs(dx) > 44 && Math.abs(dx) > 1.5 * Math.abs(dy)) waehle(aktiv + (dx < 0 ? 1 : -1));
    });
    fest.addEventListener('pointercancel', () => { wisch = null; });

    // Beim ersten Erscheinen fährt der Schieber einmal von selbst bis Kerzenlicht, aber nur, wenn man ihn sieht.
    // Am Desktop: solange das Kapitel steht. Am Handy: sobald der Schieber ganz im Bild ist.
    // Ist man nach 350 ms schon weiter, fährt er beim nächsten Erscheinen.
    let einstiegH = 1, festH = 1, weg = 1, abschnittOben = 0, folgeOben = 0, reglerZuSehen = false;
    const steht = y => y >= einstiegH * 0.55 && y < folgeOben - festH;   // bis Kapitel 2 den Schieber erreicht
    const siehtMan = () => (handy() ? reglerZuSehen : steht(scrollY));
    function zeigen() {
      if (gezeigt || reduziert) return;
      gezeigt = true;
      setTimeout(() => {
        if (!siehtMan()) { gezeigt = false; return; }
        if (wert === 0) nach(1, 1600);
      }, 350);
    }
    new IntersectionObserver(e => {
      reglerZuSehen = e[e.length - 1].intersectionRatio >= 0.89;   // gebündelte Meldungen: die jüngste zählt
      if (handy() && reglerZuSehen) zeigen();
    }, { threshold: [0, 0.9] }).observe($('.regler', abschnitt));

    setze(0);
    saetze.forEach((s, n) => s.setAttribute('aria-hidden', String(n !== 0)));
    if (status) status.textContent = '';

    // Tastatur: liegt das Kapitel noch unter dem Einstieg oder schon unter Kapitel 2, an die Stelle scrollen, wo es frei steht
    fest.addEventListener('focusin', e => {
      if (handy() || !tastatur(e.target)) return;
      const y = scrollY;
      if (y < einstiegH - 2 || y > folgeOben - festH + 2) requestAnimationFrame(() => scrollTo({ top: einstiegH, behavior: reduziert ? 'auto' : 'smooth' }));
    });

    // Am Scrollweg: Vorhang des Einstiegs, leichter Zoom, Überdecken durch Kapitel 2
    vermessen.push(() => {
      einstiegH = $('.einstieg').offsetHeight;
      festH = fest.offsetHeight;
      abschnittOben = oben(abschnitt);
      weg = Math.max(1, abschnitt.offsetHeight - festH);
      folgeOben = oben($('.schritte'));
    });
    jeBild.push((t, y) => {
      if (handy()) {   // auch nach dem Drehen oder Schmalziehen des Fensters aufräumen
        fest.style.transform = ''; bild.style.removeProperty('--zoom'); dunkel.style.removeProperty('--dunkel');
        return;
      }
      if (!gezeigt && steht(y)) zeigen();
      const u = klemm((y - abschnittOben) / weg);
      if (!reduziert) bild.style.setProperty('--zoom', (1 + 0.04 * u).toFixed(4));
      const f = klemm(1 - (folgeOben - y) / festH);
      dunkel.style.setProperty('--dunkel', (0.35 * f).toFixed(3));
      fest.style.transform = f > 0 && !reduziert ? `translateY(${(-0.5 * f * festH).toFixed(1)}px)` : '';
    });
    api.momente = { waehle, get aktiv() { return aktiv; }, get licht() { return Math.round(wert * 100); } };
  });

  // ---------- 2. So geht’s: Box links, Karte rechts, Hotspot mit gestrichelter Linie ----------
  teil('Schritte', () => {
    const abschnitt = $('.schritte');
    const flaeche = $('.schritte-buehne');
    if (!abschnitt || !flaeche || !window.OffBuehne || !E) return;
    const b = OffBuehne(flaeche);
    const spur = $('.schritte-spur', abschnitt);
    const fest = $('.schritte-fest', abschnitt);
    const dunkel = $('.abdunkeln', fest);
    const karte = $('.schritte-karte', abschnitt);
    const knoepfe = $$('.sk-nummern button', karte);
    const nummern = $('.sk-nummern', karte);
    const band = $('.sk-band', karte);
    const schritte = $$('.sk-schritt', karte);
    const fort = $('.sk-fortschritt span', karte);
    const hotspot = $('.hotspot', abschnitt);
    const linie = $('.sk-linie path', abschnitt);
    const S0 = 0.02, S1 = 0.75;   // Anteil des klebenden Wegs: Schritte von S0 bis S1, danach schiebt sich „Farben“ darüber

    // Zustand der Box als Funktion des Scrollwegs s (0 bis 4); je Schritt 70 % Bewegung, 30 % Ruhe (aus spur.js)
    const lauf = (a, c, u) => sanft(klemm((u - a) / (c - a)));
    function zustand(s) {
      const n = Math.min(3, Math.floor(s)), u = klemm((s - n) / 0.7);
      const z = { deckel: 0, kerze: 0, warm: 1, kalt: 0 };
      if (s <= 0) return z;
      if (n === 0) { z.warm = 1 - lauf(0, 0.3, u); z.kerze = lauf(0.25, 1, u); }
      if (n === 1) { z.warm = 0; z.kerze = 1; z.deckel = lauf(0, 0.75, u); z.kalt = lauf(0.6, 1, u); }
      if (n === 2) { z.warm = 0; z.kerze = 1; z.kalt = 1 - lauf(0, 0.3, u); z.deckel = 1 - lauf(0.25, 1, u); }
      if (n === 3) { z.kerze = 1 - lauf(0, 0.7, u); z.warm = lauf(0.65, 1, u); }
      return z;
    }
    // Stelle des Hotspots auf der Bühne (Anteil der Bühnenbreite); die Teile bewegen sich mit
    const K = E.kerze, D = E.deckel, F = E.flamme;
    function stelle(nr, z) {
      if (nr === 1) return [(K.x + K.w / 2) / W, (K.y + K.h * 0.5 + K.zu.ty * (1 - z.kerze)) / W];
      if (nr === 2) return [0.5, 0.65];
      if (nr === 3) return [(D.x + D.w / 2) / W, (D.y + D.h * 0.72 + D.zu.ty * (1 - z.deckel)) / W];
      return [(F.x + F.w / 2) / W, (F.y + F.h * 0.55 - K.zu.ty * z.kerze) / W];
    }

    let spurOben = 0, weg = 1, festH = 1, folgeOben = 0, kartenH = 0, nummernMitte = 0;
    let bx = 0, by = 0, bs = 1, kartenLinks = 0, fw = 1;
    vermessen.push(() => {
      spurOben = oben(spur);
      festH = fest.offsetHeight;
      fw = fest.offsetWidth;
      weg = Math.max(1, spur.offsetHeight - festH);
      folgeOben = oben($('.farben'));
      schritte.forEach(s => { s.style.height = 'auto'; });
      const fh = Math.max(...schritte.map(s => s.offsetHeight));
      schritte.forEach(s => { s.style.height = ''; });
      karte.style.setProperty('--fh', `${Math.ceil(fh)}px`);
      kartenH = karte.offsetHeight;
      nummernMitte = nummern.offsetTop + nummern.offsetHeight / 2;
      kartenLinks = karte.offsetLeft;
      bx = flaeche.offsetLeft; by = flaeche.offsetTop; bs = flaeche.offsetWidth;
    });

    let nr = 0, hx = null, hy = null, letzte = null;
    function oeffne(n) {
      nr = n;
      knoepfe.forEach(k => { if (Number(k.dataset.nr) === n) k.setAttribute('aria-current', 'step'); else k.removeAttribute('aria-current'); });
      schritte.forEach(s => s.setAttribute('aria-hidden', String(Number(s.dataset.nr) !== n)));
    }
    // Antippen einer Nummer: an die Ruhestelle dieses Schritts gleiten
    knoepfe.forEach(k => k.addEventListener('click', () => {
      const s = Number(k.dataset.nr) - 0.15;
      const u = S0 + (s / 4) * (S1 - S0);
      scrollTo({ top: spurOben + u * weg, behavior: reduziert ? 'auto' : 'smooth' });
    }));

    jeBild.push((t, y) => {
      const Y = spurOben - y;
      if (Y > festH * 1.5 || Y < -(weg + festH)) { letzte = null; return; }
      const u = klemm(-Y / weg);
      const roh = 4 * klemm((u - S0) / (S1 - S0));
      const s = reduziert ? Math.round(roh) : roh;   // reduzierte Bewegung: die Zustände springen
      const z = zustand(s);
      b.zeichnen(z, t);
      const n = s <= 0 ? 1 : Math.min(4, Math.floor(s) + 1);
      if (n !== nr) oeffne(n);
      // Der Karteninhalt gleitet am Scrollweg: in den ersten 20 % eines Schritts schiebt sich der neue Text herein
      const nr0 = reduziert || n === 1 ? n - 1 : n - 2 + sanft(klemm((s - (n - 1)) / 0.2));
      band.style.setProperty('--nr0', nr0.toFixed(4));
      fort.style.setProperty('--sp', klemm(s - (n - 1)).toFixed(3));

      // Karte wandert mit dem Fortschritt nach unten (am Handy steht sie unten fest)
      const mobil = handy();
      const k0 = 94, k1 = Math.max(k0, festH - 18 - kartenH);
      const ky = mobil ? 0 : k0 + (k1 - k0) * klemm(u / S1);
      if (!mobil) karte.style.setProperty('--ky', `${ky.toFixed(1)}px`); else karte.style.removeProperty('--ky');

      // Hotspot gleitet zum Teil des Schritts und folgt ihm
      const [sx, sy] = stelle(n, z);
      const zx = bx + sx * bs, zy = by + sy * bs;
      const dt = letzte === null ? 1 : Math.min(0.1, t - letzte);
      letzte = t;
      if (hx === null || reduziert) { hx = zx; hy = zy; } else { const a = 1 - Math.exp(-dt * 9); hx += (zx - hx) * a; hy += (zy - hy) * a; }
      hotspot.style.setProperty('--hx', `${hx.toFixed(1)}px`);
      hotspot.style.setProperty('--hy', `${hy.toFixed(1)}px`);
      hotspot.dataset.licht = n === 2 && z.kalt > 0.5 ? 'kalt' : n === 4 && z.warm > 0.3 ? 'warm' : '';

      // Gestrichelte Linie: vom linken Kartenrand auf Höhe der Nummern 10 % der Fensterbreite nach links, dann zum Ring
      if (!mobil && fw >= 960) {
        const x0 = kartenLinks, y0 = ky + nummernMitte, x1 = x0 - 0.1 * fw;
        const dx = hx - x1, dy = hy - y0, l = Math.hypot(dx, dy) || 1;
        const ex = hx - dx / l * 20, ey = hy - dy / l * 20;
        linie.setAttribute('d', `M${x0.toFixed(1)} ${y0.toFixed(1)}H${x1.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}`);
        linie.style.strokeDashoffset = String((-y * 0.25) % 12);
      }

      // „Farben“ schiebt sich darüber: abdunkeln, die Bühne läuft mit halbem Tempo weiter
      const f = mobil ? 0 : klemm(1 - (folgeOben - y) / festH);
      dunkel.style.setProperty('--dunkel', (0.35 * f).toFixed(3));
      fest.style.transform = f > 0 && !reduziert ? `translateY(${(-0.5 * f * festH).toFixed(1)}px)` : '';
    });
    oeffne(1);
    api.schritte = { get nr() { return nr; } };
  });

  // ---------- Farben und Vormerken: zwei Szenen übereinander, beim Wechsel blendet nur die Boxfarbe über ----------
  teil('Farben', () => {
    const abschnitt = $('.farben');
    if (!abschnitt) return;
    const F = window.OFFLIGHT_FARBEN || { groesse: [1254, 836], farben: {} };
    const [FW] = F.groesse;
    const buehne = $('.produkt-buehne', abschnitt);
    const licht = $('.produkt-licht', abschnitt);
    const fest = $('.farben-fest', abschnitt);
    const dunkel = $('.abdunkeln', fest);
    const superzeile = $('.superzeile', abschnitt);
    const szenen = $$('.produkt-szene', licht).slice(0, 2).map(el => ({
      el, aus: $('.p-aus', el), schein: $('.p-schein', el), flamme: $('.p-flamme', el), farbe: null,
    }));
    let vorn = 0;
    const felder = $$('.farbe');                       // Farbfelder der Farbkarte
    const namen = $$('[data-farbname]');               // Farbname in Farbkarte und Vormerkkarte
    // Zwei Formulare: in der Farbkarte und schlank im Finale. Beide merken dieselbe Farbe vor.
    const formen = $$('.vormerken').map(form => ({
      form, email: $('[name="email"]', form), farbe: $('[name="farbe"]', form), meldung: $('[data-meldung]', form),
    }));
    let gewaehlt = null;
    const pfad = (farbe, t) => `bilder/farben/${farbe}-${t}.webp?v=${F.farben[farbe].version || 0}`;

    const vorrat = {};
    function vorladen(farbe) {
      if (!vorrat[farbe]) vorrat[farbe] = Promise.all(['aus', 'schein', 'flamme'].map(t => { const img = new Image(); img.src = pfad(farbe, t); return img.decode().catch(() => {}); }));
      return vorrat[farbe];
    }
    const z = { warm: 0, hell: 0, mix: 0 };
    let k = 1;
    const massstab = () => { k = licht.clientWidth / FW; };
    const aktuell = () => szenen[vorn].farbe;
    let lauf = 0, zielFarbe = null;
    async function belade(sz, farbe, id = null) {
      await vorladen(farbe);
      if (id !== null && id !== lauf) return false;
      const fl = F.farben[farbe].flamme, s = sz.flamme.style;
      sz.farbe = farbe;
      sz.aus.src = pfad(farbe, 'aus'); sz.schein.src = pfad(farbe, 'schein'); sz.flamme.src = pfad(farbe, 'flamme');
      s.left = `${fl.x / FW * 100}%`; s.top = `${fl.y / F.groesse[1] * 100}%`; s.width = `${fl.w / FW * 100}%`; s.height = `${fl.h / F.groesse[1] * 100}%`;
      await Promise.all([sz.aus, sz.schein, sz.flamme].map(img => img.decode().catch(() => {})));
      return id === null || id === lauf;
    }
    const beschriften = () => { const g = F.farben[aktuell()]; if (g) buehne.setAttribute('aria-label', `OFF LIGHT in ${g.name}, die Kerze auf dem Deckel brennt`); };
    function zeichneSzene(sz, t, lebt) {
      if (!sz.farbe) return;
      const w = z.warm;
      sz.schein.style.opacity = w * (lebt ? flackern(t) : 1);
      const fl = F.farben[sz.farbe].flamme, fs = sz.flamme.style;
      const zu = lebt ? 1 + 0.035 * Math.sin(t * 13.7) + 0.02 * Math.sin(t * 29.3 + 0.8) : 1;
      fs.transformOrigin = `${fl.fuss[0] * k}px ${fl.fuss[1] * k}px`;
      fs.transform = `scale(${1 - (zu - 1) * 0.5}, ${(0.55 + 0.45 * Math.sqrt(w)) * zu})`;
      fs.opacity = w * (lebt ? 0.94 + 0.06 * Math.sin(t * 11.3 + 2.1) : 1);
    }
    function zeichnen(t) {
      const lebt = !reduziert;
      licht.style.opacity = z.hell;
      const vorne = szenen[vorn], neu = szenen[1 - vorn];
      vorne.el.style.zIndex = 1; vorne.el.style.opacity = 1;
      neu.el.style.zIndex = 2; neu.el.style.opacity = z.mix;
      zeichneSzene(vorne, t, lebt);
      if (z.mix > 0) zeichneSzene(neu, t, lebt);
      // „Flamme.“ leuchtet nur, wenn die Kerze im Foto brennt und das Foto zu sehen ist
      superzeile.style.setProperty('--licht', (z.warm * z.hell * (lebt ? flackern(t) : 1)).toFixed(3));
    }
    function tween(schluessel, ziel, dauer, id) {
      const start = z[schluessel];
      if (reduziert || dauer <= 0 || start === ziel) { z[schluessel] = ziel; return Promise.resolve(); }
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
    function tauschen() { if (z.mix >= 1) vorn = 1 - vorn; z.mix = 0; beschriften(); }
    function markiere(farbe) {
      // Eine andere Farbe nach dem Vormerken: die Formulare stehen wieder offen
      if (farbe !== gewaehlt) formen.forEach(f => { if (f.form.classList.contains('fertig')) { f.form.classList.remove('fertig'); f.meldung.textContent = ''; } });
      felder.forEach(f => { const an = f.dataset.farbe === farbe; f.setAttribute('aria-checked', String(an)); f.tabIndex = an ? 0 : -1; });
      namen.forEach(n => { n.textContent = F.farben[farbe] ? F.farben[farbe].name : farbe; });
      formen.forEach(f => { f.farbe.value = farbe; });
      gewaehlt = farbe;
    }
    async function waehle(farbe) {
      if (!F.farben[farbe]) return;
      const vorher = gewaehlt;
      markiere(farbe);
      if (farbe === vorher && aktuell() === farbe && z.mix === 0) return;
      if (z.mix > 0 && szenen[1 - vorn].farbe === farbe && zielFarbe === farbe) return;
      const id = ++lauf;
      zielFarbe = farbe;
      if (z.mix > 0) { await tween('mix', 1, 160 * (1 - z.mix), id); if (id !== lauf) return; tauschen(); }
      const nebenher = Promise.all([tween('hell', 1, 400 * (1 - z.hell), id), tween('warm', 1, 600 * (1 - z.warm), id)]);
      if (farbe !== aktuell()) {
        if (!(await belade(szenen[1 - vorn], farbe, id))) return;
        await tween('mix', 1, 750, id);
        if (id !== lauf) return;
        tauschen();
      }
      await nebenher;
    }
    felder.forEach(f => {
      f.addEventListener('click', () => waehle(f.dataset.farbe));
      f.addEventListener('keydown', e => {
        const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        const gruppe = $$('.farbe', f.closest('.muster'));
        const naechstes = gruppe[(gruppe.indexOf(f) + d + gruppe.length) % gruppe.length];
        naechstes.focus();
        waehle(naechstes.dataset.farbe);
      });
    });

    // Vormerken in Leiste, Menü und Einstieg sowie „Farbe ändern“ im Finale führen zur Farbwahl. Am Handy liegt die Farbkarte unter dem Produktfoto:
    // dann so weit scrollen, dass die ganze Karte mit Feld und Knopf zu sehen ist.
    $$('a[href="#farben"]:is(.knopf-hell, .knopf-umriss, .preis-link, .fk-link)').forEach(a => a.addEventListener('click', e => {
      if (!handy()) return;
      e.preventDefault();
      requestAnimationFrame(() => {
        const karte = $('.farbkarte', abschnitt).getBoundingClientRect();
        const ziel = scrollY + karte.bottom - innerHeight + 16;
        scrollTo({ top: Math.max(oben(abschnitt), ziel), behavior: reduziert ? 'auto' : 'smooth' });
      });
    }));

    // Noch ohne Versand: die Warteliste ist nicht angebunden (wie auf der Startseite). Wer einmal vorgemerkt hat,
    // sieht auch im anderen Formular den Dank statt eines leeren Felds.
    formen.forEach(({ form, email, meldung }) => {
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
        formen.forEach(f => {
          f.email.removeAttribute('aria-invalid');
          f.meldung.classList.remove('fehler');
          f.form.classList.add('fertig');
          f.meldung.textContent = 'Danke. Die Warteliste ist noch nicht angebunden, deine Adresse wurde nicht gespeichert.';
        });
        // Feld und Knopf sind jetzt versteckt: der Fokus wandert auf die Meldung (wie auf der Startseite)
        meldung.tabIndex = -1;
        meldung.focus({ preventScroll: true });
      });
      email.addEventListener('input', () => {
        if (email.getAttribute('aria-invalid') !== 'true') return;
        email.removeAttribute('aria-invalid'); meldung.classList.remove('fehler'); meldung.textContent = '';
      });
    });

    // Start: Oliv; beim ersten Erscheinen blendet die Box ein, dann geht die Kerze an
    markiere('oliv');
    massstab();
    vorladen('oliv').then(() => (lauf === 0 ? belade(szenen[vorn], 'oliv').then(beschriften) : null)).then(() => {
      massstab();
      Object.keys(F.farben).forEach(vorladen);
      const erstes = new IntersectionObserver(async e => {
        if (!e[e.length - 1].isIntersecting) return;
        erstes.disconnect();
        if (lauf) return;
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
    addEventListener('resize', massstab);

    // Am Scrollweg: das Foto steigt 200 px von unten auf, 100 px beim Hereinfahren und 100 px, während der
    // Abschnitt steht. Danach schiebt sich Kapitel 3 darüber.
    let farbenOben = 0, festH = 1, folgeOben = 0;
    vermessen.push(() => { farbenOben = oben(abschnitt); festH = fest.offsetHeight; folgeOben = oben($('.kapitel-box')); massstab(); });

    // Die Superzeile rückt so weit herunter, dass die Flamme sie am Ende des Anstiegs fast berührt, wie Ayocins
    // Lampe die zweite Zeile. Nie höher als gesetzt und nie bis an die Karten unten. Stünde die Flamme schon
    // hinter der Schrift (mittlere Breiten), wird stattdessen das Produkt etwas kleiner, die Unterkante bleibt.
    const zweite = $$('.sz', superzeile)[1];
    vermessen.push(() => {
      superzeile.style.removeProperty('--sz-y');
      buehne.style.removeProperty('--p-skal');
      if (handy() || !zweite || !F.farben.oliv) { massstab(); return; }
      const fs = parseFloat(getComputedStyle(superzeile).fontSize);
      const zeile = zweite.getBoundingClientRect();
      let grundlinie = zeile.top + fs * 0.86;   // Rückfall bei Zeilenhöhe 1
      try {
        const c = document.createElement('canvas').getContext('2d');
        const cs = getComputedStyle(superzeile);
        c.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
        const m = c.measureText(zweite.textContent);
        grundlinie = zeile.top + (fs - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
      } catch (_) {}
      const r = buehne.getBoundingClientRect();
      const py = parseFloat(buehne.style.getPropertyValue('--p-y')) || 0;
      const anteil = F.farben.oliv.flamme.y / F.groesse[1];   // Flammenspitze als Anteil der Bühnenhöhe
      const spitze = r.top - py + anteil * r.height;
      const karten = Math.min(...$$('.farbkarte, .farben-text', fest).filter(el => el.offsetParent).map(el => el.getBoundingClientRect().top));
      const luft = spitze - 0.04 * fs - grundlinie;
      if (luft > 0) {
        const weg = Math.min(luft, karten - 24 - zeile.bottom);
        if (weg > 0) superzeile.style.setProperty('--sz-y', `${weg.toFixed(1)}px`);
      } else if (luft < 0) {
        const skal = klemm(1 + luft / ((1 - anteil) * r.height), 0.75, 1);
        buehne.style.setProperty('--p-skal', skal.toFixed(4));
      }
      massstab();
    });
    let sichtbar = false;
    new IntersectionObserver(e => { sichtbar = e[e.length - 1].isIntersecting; }, { rootMargin: '200px 0px' }).observe(abschnitt);
    jeBild.push((t, y) => {
      if (!sichtbar) return;
      zeichnen(t);
      if (handy()) {
        if (fest.style.transform) fest.style.transform = '';
        buehne.style.removeProperty('--p-y'); dunkel.style.removeProperty('--dunkel');
        return;
      }
      const Y = klemm(farbenOben + festH - y, 0, 2 * festH);
      if (!reduziert) buehne.style.setProperty('--p-y', `${(100 * Y / festH).toFixed(1)}px`);
      const f = klemm(1 - (folgeOben - y) / festH);
      dunkel.style.setProperty('--dunkel', (0.35 * f).toFixed(3));
      fest.style.transform = f > 0 && !reduziert ? `translateY(${(-0.5 * f * festH).toFixed(1)}px)` : '';
    });
    api.farbe = waehle;
  });

  // ---------- 3. Die Box: Bild zoomt am Scrollweg von 1,1 auf 1,0 ----------
  teil('Box', () => {
    const fig = $('.box-bild');
    if (!fig) return;
    let figOben = 0, h = 1;
    vermessen.push(() => { figOben = oben(fig); h = innerHeight; });
    jeBild.push((t, y) => {
      const r = klemm((y + h - figOben) / h);
      if (r <= 0 || r >= 1 && fig._fertig) return;
      fig._fertig = r >= 1;
      fig.style.setProperty('--bz', (1.1 - 0.1 * r).toFixed(4));
    });
    nachSchrift.push(() => $$('[data-zeilen]').forEach(inZeilen));
  });

  // ---------- PHONE OFF. LIGHT ON.: aus der Mitte des Laufbands wächst eine Flamme ----------
  teil('Finale', () => {
    const abschnitt = $('.finale');
    const bild = $('.finale-bild');
    if (!abschnitt || !bild) return;
    const an = $('.fb-an', bild);
    const fest = $('.finale-fest', abschnitt);
    const foto = $('.finale-foto', abschnitt);
    const baender = $$('.band-lauf', abschnitt);
    const karte = $('.vormerkkarte', abschnitt);
    // Flammenform nach der Helligkeit von ebenen/warm-flamme.webp: Spitze oben, breiteste Stelle bei 43 %,
    // nach unten schmaler und rund. Die breiteste Stelle (ANKER) liegt auf der breitesten Stelle der echten Flamme.
    const FLAMME = 'M50 0C62 22 100 62 100 112C100 178 80 260 50 260C20 260 0 178 0 112C0 62 38 22 50 0Z';
    const VERH = 100 / 260, ANKER = 0.43;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 260' preserveAspectRatio='none'><path d='${FLAMME}'/></svg>`;
    foto.style.setProperty('--flammen-maske', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
    // Halbe Breite der Flammenform je Höhe (v 0 oben bis 1 unten, als Anteil der Breite), aus den zwei rechten
    // Bögen des Pfads abgetastet. Damit schaltet die Leiste auf den dunklen Ton, sobald das Foto sie ganz deckt.
    const halbeBreite = (() => {
      const bez = (a, b, c, d, t) => { const s = 1 - t; return s * s * s * a + 3 * s * s * t * b + 3 * s * t * t * c + t * t * t * d; };
      const punkte = [];
      for (const [a, b, c, d] of [[[50, 0], [62, 22], [100, 62], [100, 112]], [[100, 112], [100, 178], [80, 260], [50, 260]]]) {
        for (let i = 0; i <= 40; i++) punkte.push([bez(a[0], b[0], c[0], d[0], i / 40), bez(a[1], b[1], c[1], d[1], i / 40)]);
      }
      return v => {
        const y = v * 260;
        if (!(y > 0 && y < 260)) return 0;
        const i = punkte.findIndex(p => p[1] >= y);
        if (i < 1) return 0;
        const [x0, y0] = punkte[i - 1], [x1, y1] = punkte[i];
        return ((y1 > y0 ? x0 + (x1 - x0) * (y - y0) / (y1 - y0) : x1) - 50) / 100;
      };
    })();

    let abschnittOben = 0, weg = 1, festH = 1, festW = 1, kopie = 1, fx = 0, fy = 0, deckt = 1, groesste = 1, leisteH = 76;
    vermessen.push(() => {
      abschnittOben = oben(abschnitt);
      festH = fest.offsetHeight; festW = fest.offsetWidth;
      leisteH = $('.leiste').offsetHeight;
      weg = Math.max(1, abschnitt.offsetHeight - festH);
      kopie = baender[0].children[0].offsetWidth;
      const cs = getComputedStyle(abschnitt);
      fx = parseFloat(cs.getPropertyValue('--fx')) / 100 * festW;
      fy = parseFloat(cs.getPropertyValue('--fy')) / 100 * festH;
      // Ab dieser Maskenhöhe liegt das ganze Fenster in der Flamme (innerer Kasten der Form: 27 bis 74 % der Höhe,
      // dort mindestens 41 % der halben Breite); die Maske wächst bis knapp darüber
      deckt = Math.max(Math.max(fx, festW - fx) / (0.41 * VERH), fy / (ANKER - 0.27), (festH - fy) / (0.74 - ANKER));
      groesste = deckt * 1.12;
      // Kerzenfoto (1536 x 1024, Flamme bei x 768, breiteste Stelle y 444): so breit, dass es das Fenster
      // um die Flamme herum deckt, aber höchstens 1,2 Fensterbreiten (am Handy 1,6), sonst wird die Kerze
      // riesig. Wo es nicht ganz reicht, läuft es weich in die Nacht aus wie Kerzenlicht.
      const FX = 768 / 1536, FY = 444 / 1024, HOCH = 1024 / 1536;
      const breit = Math.max(fx / FX, (festW - fx) / (1 - FX));
      const hoch = Math.max(fy / FY, (festH - fy) / (1 - FY)) / HOCH;
      bild.style.setProperty('--fb-b', `${Math.min(Math.max(breit, hoch), (handy() ? 1.6 : 1.2) * festW).toFixed(1)}px`);
    });
    karte.addEventListener('focusin', () => {
      // Tastatur: springt jemand in die noch verborgene Karte, an ihre Stelle scrollen. Erst im nächsten Bild,
      // sonst bricht der eigene Fokus-Scroll von WebKit das weiche Scrollen ab.
      const u = klemm((scrollY - abschnittOben) / weg);
      if (u < 0.9) requestAnimationFrame(() => scrollTo({ top: abschnittOben + 0.95 * weg, behavior: reduziert ? 'auto' : 'smooth' }));
    });
    let war = false;
    jeBild.push((t, y) => {
      const Y = abschnittOben - y;
      const imBild = Y < festH * 1.2 && Y > -(weg + festH);
      if (!imBild) { if (war) war = false; return; }
      war = true;
      const u = klemm(-Y / weg);
      // Laufband: 0,4 px nach links je gescrolltem px, steht, wenn niemand scrollt
      const bx = reduziert ? 0 : -(((festH - Y) * 0.4) % kopie);
      for (const l of baender) l.style.transform = `translateX(${bx.toFixed(1)}px)`;
      // Maske wächst von der Mitte des Bands bis über das ganze Fenster
      const m = reduziert ? 1 : klemm(u / 0.7);
      const mh = quad(m) * groesste, mw = mh * VERH;
      const gedeckt = mh >= deckt;
      if (gedeckt) foto.classList.add('offen');
      else {
        foto.classList.remove('offen');
        foto.style.setProperty('--mw', `${mw.toFixed(1)}px`);
        foto.style.setProperty('--mh', `${mh.toFixed(1)}px`);
        foto.style.setProperty('--mx', `${(fx - mw / 2).toFixed(1)}px`);
        foto.style.setProperty('--my', `${(fy - ANKER * mh).toFixed(1)}px`);
      }
      bild.style.setProperty('--fz', (1 + 0.08 * quad(m)).toFixed(4));
      // Ab 60 % des Maskenwegs geht im Foto die Kerze an; brennt sie, atmet das Licht ganz leicht
      const warm = reduziert ? 1 : sanft(klemm((u - 0.42) / 0.2));
      an.style.opacity = (warm * (reduziert ? 1 : Math.min(1, 0.975 + 0.5 * (flackern(t) - 0.93)))).toFixed(3);
      // Vormerkkarte fährt von unten herein und bleibt stehen
      const k = reduziert ? 1 : klemm((u - 0.72) / 0.2);
      karte.style.setProperty('--vk-y', `${((1 - k) * festH).toFixed(1)}px`);
      karte.style.setProperty('--vk-o', klemm(k * 2.5).toFixed(3));
      karte.style.pointerEvents = k > 0.5 ? '' : 'none';
      // Leiste: dunkler Ton (helle Schrift), sobald das Foto die ganze Breite der Leiste deckt. Vorher bleibt sie
      // hell, so steht ihre Schrift nie auf einem Rest Wachs unter dunklem Glas.
      let ueberFoto = gedeckt;
      if (!gedeckt) {
        const v = (leisteH / 2 - Math.max(0, Y) - (fy - ANKER * mh)) / (mh || 1);
        const hb = halbeBreite(v) * mw;
        ueberFoto = hb > 0 && fx - hb <= 0 && fx + hb >= festW;
      }
      abschnitt.dataset.tonJetzt = ueberFoto ? 'dunkel' : 'hell';
    });
  });

  // ---------- Menü am Handy ----------
  teil('Menü', () => {
    const knopf = $('.menue-knopf'), menue = $('#menue'), leiste = $('.leiste');
    if (!knopf || !menue) return;
    // Hinter dem offenen Menü ist die Seite gesperrt (Vorleser, Tastatur). Die Leiste mit dem Schließen-Knopf bleibt bedienbar.
    const dahinter = [$('main'), $('.fuss')].filter(Boolean);
    const offen = () => knopf.getAttribute('aria-expanded') === 'true';
    $$('nav a', menue).forEach((a, i) => a.style.setProperty('--i', i));
    let zeit = null;
    function auf() {
      clearTimeout(zeit);
      menue.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => menue.classList.add('offen')));
      document.documentElement.classList.add('menue-offen');
      leiste.classList.add('menue-auf');
      dahinter.forEach(el => { el.inert = true; });
      knopf.setAttribute('aria-expanded', 'true');
      knopf.setAttribute('aria-label', 'Menü schließen');
      const erster = $('nav a', menue);
      if (erster) requestAnimationFrame(() => erster.focus({ preventScroll: true }));
    }
    function zu(fokus = false) {
      menue.classList.remove('offen');
      document.documentElement.classList.remove('menue-offen');
      leiste.classList.remove('menue-auf');
      dahinter.forEach(el => { el.inert = false; });
      knopf.setAttribute('aria-expanded', 'false');
      knopf.setAttribute('aria-label', 'Menü öffnen');
      zeit = setTimeout(() => { menue.hidden = true; }, reduziert ? 0 : 1000);
      if (fokus) knopf.focus();
    }
    knopf.addEventListener('click', () => (offen() ? zu(true) : auf()));
    menue.addEventListener('click', e => { if (e.target.closest('a')) zu(); });
    // Auch die Sprünge in der Leiste (Vormerken, kleine Wortmarke) schließen das Menü
    leiste.addEventListener('click', e => { if (offen() && e.target.closest('a[href^="#"]')) zu(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && offen()) zu(true); });
    handyMq.addEventListener('change', () => { if (!handy() && offen()) zu(); });
  });

  // ---------- Erscheinen: Zeilen und Blöcke steigen einmal auf ----------
  teil('Erscheinen', () => {
    const io = new IntersectionObserver(eintraege => eintraege.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('da');
      io.unobserve(e.target);
    }), { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    $$('[data-steigt], [data-zeilen]').forEach(el => io.observe(el));
  });

  // ---------- Takt und Messen ----------
  function messen() { vermessen.forEach(f => { try { f(); } catch (e) { console.error('OFF LIGHT, Messen:', e); } }); }
  function schleife(ms) {
    const t = ms / 1000, y = scrollY;
    for (const f of jeBild) { try { f(t, y); } catch (e) { console.error('OFF LIGHT, Bild:', e); } }
    requestAnimationFrame(schleife);
  }
  let umbruch = null, breite = innerWidth;
  addEventListener('resize', () => {
    clearTimeout(umbruch);
    umbruch = setTimeout(() => {
      // Zeilen nur neu teilen, wenn sich die Breite ändert (am Handy ändert die Adressleiste nur die Höhe)
      if (innerWidth !== breite) { breite = innerWidth; nachSchrift.forEach(f => f()); }
      messen();
    }, 120);
  });
  // Spät ladende Bilder oder neue Zeilen ändern die Seitenhöhe: dann neu messen, damit Bühnen und Maske stimmen
  let nachmessen = null;
  if (window.ResizeObserver) new ResizeObserver(() => { clearTimeout(nachmessen); nachmessen = setTimeout(messen, 120); }).observe($('main'));
  // Fokus darf die Bühnen nicht innen verschieben: sie schneiden mit overflow hidden ab und würden sonst scrollen
  $$('.einstieg, .momente-fest, .schritte-fest, .farben-fest, .finale-fest').forEach(el => el.addEventListener('scroll', () => {
    if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0; }
  }));
  // Tastatur im Fuß: der Fuß liegt unter dem Finale und wird erst am Seitenende aufgedeckt
  const fuss = $('.fuss');
  if (fuss) fuss.addEventListener('focusin', e => {
    if (handy() || !tastatur(e.target)) return;
    const ende = document.documentElement.scrollHeight - innerHeight;
    if (scrollY < ende - 2) requestAnimationFrame(() => scrollTo({ top: ende, behavior: reduziert ? 'auto' : 'smooth' }));
  });
  addEventListener('load', messen);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { nachSchrift.forEach(f => f()); messen(); });
  messen();
  requestAnimationFrame(schleife);
  window.offlight = api;
})();
