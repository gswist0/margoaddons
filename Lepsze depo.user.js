// ==UserScript==
// @name         Lepsze depo
// @namespace    margonem.depo.swap
// @version      3.4
// @description  Dodatkowe funkcje depozytu w margonem (które powinny być 10 lat temu bazowo)
// @match        https://*.margonem.pl/*
// @match        https://*.margonem.com/*
// @author       Bancewald
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /* ---------------- KONFIGURACJA ---------------- */
  const DEBUG = false;      // logi w konsoli
  const GRID_W = 12;       // szerokość siatki depozytu (kolumny) - dopasuj
  const GRID_H = 8;        // wysokość siatki depozytu (wiersze) - dopasuj
  const STEP_TIMEOUT = 2500; // awaryjny limit oczekiwania na odpowiedź serwera po każdym kroku (ms)
  const RESPONSE_GRACE = 120; // po odpowiedzi serwera: ile jeszcze ms czekać, aż klient przetworzy dane przedmiotów
  const MERGE_CMD = 'moveitem&st=0&id={id}&x={x}&y={y}'; // scalenie w ekwipunku: upuszczenie {id} na stack na polu {x},{y}
  const EQ_TYPE_OPTION = true;     // nowa opcja w filtrze typu gry: pancerze + bronie + biżuteria
  const EQ_TYPE_LABEL = 'Ekwipunek';
  const PRESET_BUTTON = true;      // przycisk: Ekwipunek + profesja postaci + poziom postaci +- PRESET_LVL_RANGE
  const PRESET_LABEL = 'Dla mnie';
  const PRESET_LVL_RANGE = 20;
  const QUALITY_FILTER = true;    // dodatkowy filtr jakości przedmiotów w oknie depozytu
  const QUALITY_OPTIONS = [       // pozycje menu filtra jakości (val = wartość statystyki "rarity")
    { text: 'Jakość', val: 0 },
    { text: 'Zwykły', val: 'common' },
    { text: 'Unikatowy', val: 'unique' },
    { text: 'Heroiczny', val: 'heroic' },
    { text: 'Ulepszony', val: 'upgraded' },
    { text: 'Legendarny', val: 'legendary' }
  ];
  const BTN_LABEL = 'Wrzuć zawartość do depozytu'; // napis przycisku w menu torby
  const CONFIRM_BULK = false;      // pytaj o potwierdzenie przed wrzuceniem zawartości torby (ustaw false, gdy wszystko działa)
  const BAG_CLASS = null;         // klasa przedmiotu (item.cl) rozpoznawana jako torba - uzupełnij, jeśli torba nie jest rozpoznawana
  const BAG_SWITCH_CLICK = true;  // przed wrzucaniem kliknij torbę, aby przełączyć widok na jej zawartość
  const FALLBACK_OWN_MENU = true; // gdy nie uda się dopisać przycisku do menu gry - pokaż własne małe menu
  const BULK_PARALLEL = 3;        // ile poleceń naraz może czekać na odpowiedź serwera przy wrzucaniu torby
  const AUTO_STACK = true;   // dokładaj stackowalne przedmioty do istniejącego stacka w depo
  const POLL = 25;           // co ile ms sprawdzamy, czy krok został wykonany
  const BAG_LOC = 'g';     // oznaczenie ekwipunku (plecaka) w Engine.items.fetchLocationItems
  /* ------------------------------------------------ */

  const log = (...a) => DEBUG && console.log('[LepszeDepo]', ...a);
  const notify = txt => {
    log(txt);
    try { if (typeof window.message === 'function') window.message(txt); } catch (e) {}
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- dostęp do przedmiotów ---------- */
  function getLoc(loc) {
    try {
      return Object.values(Engine.items.fetchLocationItems(loc) || {}).filter(Boolean);
    } catch (e) { return []; }
  }
  const getDepoItems = () =>
    getLoc('d').filter(i => i.x !== undefined && i.y !== undefined);
  const itemById = id => getDepoItems().find(i => String(i.id) === String(id));

  // Okno depozytu gry (Engine.depo) - o ile jest otwarte
  function depoWnd() {
    try {
      const d = window.Engine && Engine.depo;
      return d && typeof d.getDepoItemTable === 'function' ? d : null;
    } catch (e) { return null; }
  }

  // Wolne pola aktualnej zakładki - według geometrii samej gry (tej samej, której używa setDepoItem).
  // Zwraca null, gdy nie da się jej odczytać.
  function depoFreeSlots() {
    const d = depoWnd();
    if (!d) return null;
    try {
      const r = d.getDepoOpenTabs().getSlotsDataToFindFirstFreeSlot(d.getVisible());
      const table = d.getDepoItemTable() || {};
      const out = [];
      for (let y = r.yStart; y < r.yEnd; y++) {
        for (let x = r.xStart; x < r.xEnd; x++) {
          const cell = table[x] && table[x][y];
          if (!cell || !Object.keys(cell).length) out.push({ x, y });
        }
      }
      return out;
    } catch (e) { return null; }
  }
  const itemAt = (x, y, ignoreId) =>
    getDepoItems().find(
      i => Number(i.x) === x && Number(i.y) === y && String(i.id) !== String(ignoreId)
    );
  const inDepo = id => getLoc('d').some(i => String(i.id) === String(id));
  const inBag = id => getLoc(BAG_LOC).some(i => String(i.id) === String(id));

  /* ---------- stackowanie ---------- */
  function parseStat(str) {
    const o = {};
    String(str || '').split(';').forEach(p => {
      const i = p.indexOf('=');
      if (i > 0) o[p.slice(0, i)] = p.slice(i + 1);
    });
    return o;
  }
  function amountOf(it) {
    if (!it) return null;
    let a = typeof it.stat === 'string' ? parseStat(it.stat).amount : undefined;
    if (a === undefined && it._cachedStats && typeof it._cachedStats === 'object') a = it._cachedStats.amount;
    if (a === undefined || a === null || a === '') return null;
    const n = Number(a);
    return isNaN(n) ? null : n;
  }
  // Klucz tożsamości stacka: nazwa + ikona + staty bez "amount"
  function stackKey(it) {
    const stat = typeof it.stat === 'string'
      ? it.stat.split(';').filter(p => p && !p.startsWith('amount=')).sort().join(';')
      : '';
    return [it.name, it.icon, stat].join('|');
  }
  function getItem(id) {
    try { return Engine.items.getItemById(id); } catch (e) { return null; }
  }
  function findStackCandidates(id) {
    const it = getItem(id);
    if (!it || amountOf(it) === null) return [];
    const key = stackKey(it);
    return getDepoItems().filter(s =>
      String(s.id) !== String(id) && amountOf(s) !== null && stackKey(s) === key
    ).sort((a, b) => amountOf(a) - amountOf(b)); // najpierw najmniejsze stacki (największa szansa, że nie są pełne)
  }

  function findFreeSlot() {
    const free = depoFreeSlots();
    if (free) return free[0] || null;
    // awaryjnie (gdy nie da się odczytać geometrii gry) - siatka pierwszej zakładki
    const taken = new Set(getDepoItems().map(i => Number(i.x) + ',' + Number(i.y)));
    for (let y = 0; y < GRID_H; y++)
      for (let x = 0; x < GRID_W; x++)
        if (!taken.has(x + ',' + y)) return { x, y };
    return null;
  }

  /* ---------- polecenia depozyt <-> ekwipunek ---------- */
  const CMD_TO_BAG = 'depo&get={id}';                        // depozyt -> ekwipunek
  const CMD_FROM_BAG = 'depo&put={id}&x={x}&y={y}';          // ekwipunek -> depozyt

  const fill = (tpl, id, x, y) =>
    tpl.split('{id}').join(id).split('{x}').join(x).split('{y}').join(y);

  /* ---------- wysyłanie i czekanie na odpowiedź serwera ---------- */
  let rawG = null;
  let swapping = false;
  let autoPlaceId = null;

  // Rozpoznawanie przeciągania: gra rusza przedmiot dopiero po przesunięciu kursora o kilka px (distance: 6),
  // a polecenie depo&put z upuszczenia wysyła w trakcie puszczenia przycisku. Zapamiętujemy, czy ostatnie
  // puszczenie przycisku zakończyło przeciąganie - wtedy przedmiot ma trafić dokładnie na wskazane pole.
  let ptrDown = null, lastUp = null;
  function initDragTracker() {
    if (window.__depoSwapDrag) return;
    window.__depoSwapDrag = true;
    document.addEventListener('pointerdown', e => { ptrDown = { x: e.clientX, y: e.clientY, moved: 0 }; }, true);
    document.addEventListener('pointermove', e => {
      if (!ptrDown) return;
      ptrDown.moved = Math.max(ptrDown.moved, Math.abs(e.clientX - ptrDown.x), Math.abs(e.clientY - ptrDown.y));
    }, true);
    document.addEventListener('pointerup', () => {
      lastUp = { time: performance.now(), drag: !!ptrDown && ptrDown.moved > 5 };
      ptrDown = null;
    }, true);
  }
  // czy polecenie wysłane teraz pochodzi z upuszczenia przeciąganego przedmiotu?
  const fromDrag = () => (!!ptrDown && ptrDown.moved > 5) ||
                         (!!lastUp && lastUp.drag && performance.now() - lastUp.time < 500);   // id przedmiotu wkładanego przez grę na pierwsze wolne miejsce (kliknięcie w ekwipunku)
  const moveCmd = (id, x, y) => `depo&move=${id}&x=${x}&y=${y}`;

  // Czeka na spełnienie warunku (sprawdzanie stanu gry), bez stałych pauz
  async function waitFor(cond, timeout = STEP_TIMEOUT, poll = POLL) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try { if (cond()) return true; } catch (e) {}
      await sleep(poll);
    }
    return false;
  }
  const nextFrames = (n = 2) => new Promise(r => {
    const f = () => (--n <= 0 ? r() : requestAnimationFrame(f));
    requestAnimationFrame(f);
  });

  // Wysyła polecenie i kończy, gdy:
  //  - warunek jest spełniony (sukces - natychmiast po przetworzeniu odpowiedzi),
  //  - serwer odpowiedział (callback _g), a warunek nadal nie jest spełniony (porażka - bez czekania na timeout),
  //  - minie awaryjny timeout (gdyby callback nie został wywołany).
  function sendAndWait(cmd, cond, timeout = STEP_TIMEOUT) {
    log('wysyłam:', cmd);
    return new Promise(resolve => {
      const t0 = Date.now();
      let respAt = 0, done = false;
      const iv = setInterval(() => {
        if (done) return;
        let ok = false;
        try { ok = !!cond(); } catch (e) {}
        const now = Date.now();
        if (ok || (respAt && now - respAt > RESPONSE_GRACE) || now - t0 > timeout) {
          done = true; clearInterval(iv); resolve(ok);
        }
      }, POLL);
      try { rawG(cmd, () => { if (!respAt) respAt = Date.now(); }); }
      catch (e) { log('błąd wysyłania', e); }
    });
  }

  const isAt = (id, x, y) => {
    const it = itemById(id);
    return !!it && Number(it.x) === x && Number(it.y) === y;
  };

  /* ---------- zamiana przez wolne pole w depozycie ---------- */
  async function swapViaDepo(a, b, tmp) {
    const ax = Number(a.x), ay = Number(a.y);
    const bx = Number(b.x), by = Number(b.y);

    // A -> wolne pole
    if (!(await sendAndWait(moveCmd(a.id, tmp.x, tmp.y), () => isAt(a.id, tmp.x, tmp.y)))) {
      log('serwer nie przeniósł A na wolne pole - przerywam');
      return;
    }
    // B -> dawne miejsce A
    if (!(await sendAndWait(moveCmd(b.id, ax, ay), () => isAt(b.id, ax, ay)))) {
      notify('Zamiana przerwana: przedmiot "' + (a.name || a.id) + '" został na polu ' + tmp.x + ',' + tmp.y + '.');
      return;
    }
    // A -> dawne miejsce B
    await sendAndWait(moveCmd(a.id, bx, by), () => isAt(a.id, bx, by));
  }

  /* ---------- zamiana przez ekwipunek ---------- */
  async function swapViaBag(a, b) {
    const ax = Number(a.x), ay = Number(a.y);
    const bx = Number(b.x), by = Number(b.y);

    // A -> ekwipunek
    if (!(await sendAndWait(fill(CMD_TO_BAG, a.id, ax, ay), () => inBag(a.id) && !inDepo(a.id)))) {
      notify('Zamiana przerwana: brak miejsca w ekwipunku.');
      return;
    }
    // B -> dawne miejsce A
    if (!(await sendAndWait(moveCmd(b.id, ax, ay), () => isAt(b.id, ax, ay)))) {
      notify('Zamiana przerwana: przedmiot "' + (a.name || a.id) + '" został w ekwipunku.');
      return;
    }
    // A -> dawne miejsce B
    if (!(await sendAndWait(fill(CMD_FROM_BAG, a.id, bx, by), () => isAt(a.id, bx, by)))) {
      notify('Uwaga: przedmiot "' + (a.name || a.id) + '" mógł zostać w ekwipunku - sprawdź.');
    }
  }

  /* ---------- dokładanie do istniejącego stacka ---------- */
  // Serwer odrzuca "put" na zajęte pole, więc scalamy przez ekwipunek. Dla kolejnych stacków S (od najmniejszego):
  // 1) pobierz S do ekwipunku,
  // 2) w ekwipunku upuść A na S (moveitem ... x,y pola S) - serwer scala (do limitu stacka),
  // 3) odłóż S z powrotem do depo na jego pole.
  // Jeśli S był pełny albo po scaleniu została reszta A - bierzemy następny stack, i tak dalej.
  // Resztę, której nie dało się nigdzie dołożyć, odkładamy tam, gdzie chciał gracz.
  const maxStack = {}; // klucz stacka -> maksymalna ilość (uczona z częściowych scaleń)

  async function stackIntoDepo(id, candidates, originalTask) {
    swapping = true;
    const putCmd = (pid, x, y) => `depo&put=${pid}&x=${x}&y=${y}`;
    try {
      const A = getItem(id);
      const key = A ? stackKey(A) : null;
      const op = new URLSearchParams(originalTask.slice('depo&'.length));
      const ox = parseInt(op.get('x'), 10), oy = parseInt(op.get('y'), 10);
      let mergedAny = false;

      for (const s of candidates) {
        if (!inBag(id)) break;                         // A został w całości scalony
        const sid = s.id;
        const cur = itemById(sid);
        if (!cur) continue;                            // stack zniknął
        const sx = Number(cur.x), sy = Number(cur.y);

        if (key && maxStack[key] && amountOf(cur) >= maxStack[key]) {
          log('pomijam pełny stack:', cur.name, '(' + amountOf(cur) + '/' + maxStack[key] + ')');
          continue;
        }

        log('stackowanie: pobieram', cur.name, '(' + amountOf(cur) + ') do ekwipunku');
        // S -> ekwipunek
        if (!(await sendAndWait(fill(CMD_TO_BAG, sid, sx, sy), () => !inDepo(sid), 1500))) {
          log('nie udało się pobrać stacka (brak miejsca w ekwipunku?) - kończę scalanie');
          break;
        }
        const ready = await waitFor(() => {
          const it = getItem(sid);
          return inBag(sid) && it && it.x !== undefined && it.y !== undefined;
        }, 1500);
        if (!ready) {
          log('S nie pojawił się w ekwipunku z pozycją - odkładam z powrotem');
          if (inBag(sid)) await sendAndWait(putCmd(sid, sx, sy), () => !inBag(sid), 1500);
          continue;
        }

        const sBag = getItem(sid);
        const bx = Number(sBag.x), by = Number(sBag.y);
        const sAmt = amountOf(sBag);
        const aAmt = amountOf(getItem(id));

        // A -> na stack S w ekwipunku (serwer scala do limitu stacka)
        const changed = await sendAndWait(fill(MERGE_CMD, id, bx, by), () => {
          if (!inBag(id)) return true;
          const a = getItem(id), sn = getItem(sid);
          return (sn && amountOf(sn) !== null && amountOf(sn) > sAmt) ||
                 (a && amountOf(a) !== null && aAmt !== null && amountOf(a) !== aAmt);
        }, 1200);

        const aLeft = inBag(id) ? amountOf(getItem(id)) : 0;
        const sNow = amountOf(getItem(sid));
        log('scalanie:', changed ? 'OK' : 'brak efektu (stack pełny?)',
            '| S:', sAmt, '->', sNow, '| A:', aAmt, '->', aLeft);
        if (changed) mergedAny = true;
        if (changed && aLeft > 0 && key && sNow !== null) {
          maxStack[key] = sNow;                        // część się zmieściła, reszta nie => S jest pełny
          log('wykryto limit stacka:', sNow);
        }

        // S wraca do depo na swoje pole
        if (inBag(sid)) {
          if (!(await sendAndWait(putCmd(sid, sx, sy), () => !inBag(sid), 1500))) {
            notify('Stackowanie: stack "' + cur.name + '" został w ekwipunku - sprawdź.');
            break;
          }
        }
      }

      // reszta A (nie zmieściła się w żadnym stacku): tam gdzie chciał gracz, a jeśli zajęte - na wolne pole
      if (inBag(id)) {
        const target = (!isNaN(ox) && !isNaN(oy) && !itemAt(ox, oy, id)) ? { x: ox, y: oy } : findFreeSlot();
        if (target && !(await sendAndWait(putCmd(id, target.x, target.y), () => !inBag(id), 1500))) {
          const slot = findFreeSlot();
          if (slot) await sendAndWait(putCmd(id, slot.x, slot.y), () => !inBag(id), 1500);
        }
      }

      if (inBag(id)) {
        notify('Stackowanie: część przedmiotów została w ekwipunku - sprawdź.');
      } else {
        log(mergedAny ? 'scalono ze stackiem/stackami' : 'nie scalono - przedmiot odłożony osobno');
      }
    } catch (e) {
      log('błąd stackowania', e);
      try { if (inBag(id)) rawG(originalTask); } catch (_) {}
    } finally {
      swapping = false;
    }
  }

  async function swap(a, b) {
    swapping = true;
    try {
      const tmp = findFreeSlot();
      if (tmp) await swapViaDepo(a, b, tmp);
      else await swapViaBag(a, b);
    } catch (e) {
      log('błąd podczas zamiany', e);
    } finally {
      swapping = false;
    }
  }

  /* ---------- wrzucanie zawartości torby do depozytu ---------- */
  let bulkRunning = false;
  const ITEM_LOCS = ['g', 'e', 'd'];

  function findItemFromElement(target) {
    let el = target, depth = 0;
    while (el && el !== document.body && depth++ < 8) {
      const cls = typeof el.className === 'string' ? el.className : '';
      const m = ((el.id || '') + ' ' + cls).match(/\d{6,}/);
      if (m) { const it = getItem(m[0]); if (it) { findItemFromElement.el = el; return it; } }
      el = el.parentElement;
    }
    for (const loc of ITEM_LOCS) {
      for (const it of getLoc(loc)) {
        try { const e0 = it.$ && it.$[0]; if (e0 && e0.contains(target)) { findItemFromElement.el = e0; return it; } } catch (e) {}
      }
    }
    return null;
  }

  function isBagItem(it) {
    if (!it) return false;
    if (BAG_CLASS !== null && Number(it.cl) === BAG_CLASS) return true;
    const st = typeof it.stat === 'string' ? parseStat(it.stat) : {};
    return Object.keys(st).some(k => /^bag/i.test(k));
  }

  // Czy widok przedmiotu jest faktycznie widoczny na ekranie (zawartość nieotwartych toreb jest ukryta)
  function isShown(it) {
    try {
      const el = it.$ && it.$[0];
      if (!el || !el.isConnected || el.offsetParent === null) return false;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) !== 0;
    } catch (e) { return false; }
  }
  function clickEl(el) {
    ['mousedown', 'mouseup', 'click'].forEach(t =>
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, button: 0 })));
  }
  // id przedmiotów, których elementy DOM (id/klasa zawierają numer przedmiotu) są widoczne na ekranie
  function visibleDomIds() {
    const ids = new Set();
    document.querySelectorAll('[id],[class]').forEach(el => {
      const cls = typeof el.className === 'string' ? el.className : '';
      const m = ((el.id || '') + ' ' + cls).match(/\d{6,}/g);
      if (!m || el.offsetParent === null) return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      m.forEach(x => ids.add(x));
    });
    return ids;
  }
  function dumpBag() {
    const dom = visibleDomIds();
    console.table(getLoc(BAG_LOC).map(i => ({
      name: i.name, st: i.st, x: i.x, y: i.y, cl: i.cl, torba: isBagItem(i),
      widok$: isShown(i), widokDOM: dom.has(String(i.id))
    })));
  }
  // diagnostyka: wypisuje pola/metody obiektów Engine, w których nazwie jest bag/torb/tab/slot
  window.depoSwapFindBagApi = () => {
    const out = [];
    const names = o => {
      let r = [];
      try {
        r = Object.getOwnPropertyNames(o);
        let p = Object.getPrototypeOf(o);
        while (p && p !== Object.prototype) { r = r.concat(Object.getOwnPropertyNames(p)); p = Object.getPrototypeOf(p); }
      } catch (e) {}
      return r;
    };
    names(Engine).forEach(k => {
      let v; try { v = Engine[k]; } catch (e) { return; }
      if (/bag|torb|tab|slot/i.test(k)) out.push('Engine.' + k + ' (' + typeof v + ')');
      if (v && typeof v === 'object' && !(v instanceof Node)) {
        names(v).forEach(n => { if (/bag|torb|tab|slot/i.test(n)) out.push('Engine.' + k + '.' + n); });
      }
    });
    console.log('[DepoSwap] kandydaci API toreb:', out);
    return out;
  };
  window.depoSwapDump = dumpBag; // diagnostyka: wpisz depoSwapDump() w konsoli

  function fullClick(el) {
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1,
                clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    const up = Object.assign({}, o, { buttons: 0 });
    try { el.dispatchEvent(new PointerEvent('pointerdown', Object.assign({ pointerType: 'mouse', isPrimary: true }, o))); } catch (e) {}
    el.dispatchEvent(new MouseEvent('mousedown', o));
    try { el.dispatchEvent(new PointerEvent('pointerup', Object.assign({ pointerType: 'mouse', isPrimary: true }, up))); } catch (e) {}
    el.dispatchEvent(new MouseEvent('mouseup', up));
    el.dispatchEvent(new MouseEvent('click', up));
  }

  function visibleBagItems() {
    const dom = visibleDomIds();
    const inBags = getLoc(BAG_LOC).filter(i => !isBagItem(i) && Number(i.st) === 0);
    return { inBags, items: inBags.filter(i => isShown(i) || dom.has(String(i.id))), dom };
  }
  const bagSignature = () => visibleBagItems().items.map(i => i.id).sort().join(',');

  // Który element z łańcucha (torba / jej rodzice) przełącza widok torby - zapamiętywane po pierwszym udanym przełączeniu
  const SWITCH_KEY = 'depoSwapSwitchDepth';
  let switchDepth = null;
  try { const v = localStorage.getItem(SWITCH_KEY); if (v !== null && !isNaN(parseInt(v, 10))) switchDepth = parseInt(v, 10); } catch (e) {}
  const ACTIVE_RE = /(^|\s)(active|selected|current|chosen)(\s|$)/i;

  // Torba oznaczona przez grę jako aktywna (klasa na elemencie torby lub jego bezpośrednim rodzicu)
  function bagLooksActive(el) {
    for (let e = el, d = 0; e && d < 2; e = e.parentElement, d++) {
      if (typeof e.className === 'string' && ACTIVE_RE.test(e.className)) return true;
    }
    return false;
  }

  // Przełącza widok na klikniętą torbę. Zwraca:
  //  'switched' - widok się zmienił,
  //  'already'  - torba była już otwarta (gra oznacza ją jako aktywną albo znany przełącznik nie zmienił widoku),
  //  'unknown'  - nie wiadomo (pierwsze użycie i żadne kliknięcie nie zmieniło widoku).
  async function switchToBag(el) {
    if (bagLooksActive(el)) return 'already';
    const before = bagSignature();
    const chain = [];
    for (let e = el, d = 0; e && e !== document.body && d < 4; e = e.parentElement, d++) chain.push(e);
    const order = (switchDepth !== null && chain[switchDepth]) ? [switchDepth] : chain.map((_, i) => i);
    for (const i of order) {
      try { fullClick(chain[i]); } catch (e) {}
      // czekamy tylko aż widok się zmieni (sprawdzanie stanu), bez stałej pauzy
      if (await waitFor(() => bagSignature() !== before, 350, 50)) {
        if (switchDepth !== i) {
          switchDepth = i;
          try { localStorage.setItem(SWITCH_KEY, String(i)); } catch (e) {}
        }
        await nextFrames(2);
        return 'switched';
      }
    }
    return switchDepth !== null ? 'already' : 'unknown';
  }

  // Czy otwarte jest okno depozytu prywatnego (tylko do niego wysyłamy polecenia depo&put)?
  function privateDepoOpen() {
    const d = depoWnd();
    if (!d || !d.wnd || !d.wnd.$) return false;
    try {
      if (!d.wnd.$.is(':visible')) return false;
      if (d.wnd.$.hasClass('depo-clan') || d.wnd.$.find('.depo-clan').length) return false;
    } catch (e) { return false; }
    return true;
  }

  async function depositBag(bag, bagEl) {
    if (bulkRunning || swapping) { notify('Trwa inna operacja - spróbuj za chwilę.'); return; }
    if (!privateDepoOpen()) { notify('Najpierw otwórz depozyt (prywatny).'); return; }

    let switched = null;
    if (BAG_SWITCH_CLICK && bagEl) {
      switched = await switchToBag(bagEl);
      log('przełączenie widoku na torbę:', switched);
    }
    if (!privateDepoOpen()) { notify('Depozyt został zamknięty - przerywam.'); return; }

    const { inBags, items, dom } = visibleBagItems();
    log('torba:', bag.name, '| przedmiotów st=0:', inBags.length,
        '| widocznych przez $:', inBags.filter(isShown).length,
        '| widocznych przez DOM:', inBags.filter(i => dom.has(String(i.id))).length);
    if (DEBUG) dumpBag();
    if (!items.length) {
      notify('Nie znaleziono przedmiotów w otwartej torbie (st=0: ' + inBags.length + ', widocznych: 0). Wpisz depoSwapDump() w konsoli.');
      return;
    }

    const unsure = switched === 'unknown';
    if (CONFIRM_BULK || unsure) {
      const names = items.slice(0, 12).map(i => '- ' + i.name).join('\n') + (items.length > 12 ? '\n...' : '');
      const head = unsure
        ? 'Nie wykryto przełączenia widoku na torbę "' + bag.name + '" (może być już otwarta).\nWrzucić zawartość AKTUALNIE OTWARTEJ torby'
        : 'Torba: ' + bag.name + '\nWrzucić zawartość torby';
      if (!window.confirm(head + ' (' + items.length + ' przedmiotów) do aktualnej zakładki depozytu?\n\n' + names)) return;
    }

    bulkRunning = true;
    try {
      // 1) stackowalne, które mają już stack w depo - scalamy po kolei
      if (AUTO_STACK) {
        for (const it of items) {
          if (!privateDepoOpen()) break;
          if (!inBag(it.id)) continue;
          const cands = findStackCandidates(it.id);
          if (!cands.length) continue;
          const slot = findFreeSlot();
          if (!slot) break;
          await stackIntoDepo(it.id, cands, `depo&put=${it.id}&x=${slot.x}&y=${slot.y}`);
        }
      }

      // 2) reszta - seria poleceń "put" na kolejne wolne pola (2 podejścia; nieprzyjęte = nie da się włożyć)
      let full = false;
      for (let attempt = 0; attempt < 2 && !full; attempt++) {
        const pending = items.filter(i => inBag(i.id));
        if (!pending.length) break;
        const freeList = depoFreeSlots();          // wolne pola aktualnej zakładki (geometria gry)
        const occupied = new Set(getDepoItems().map(i => Number(i.x) + ',' + Number(i.y)));
        let fi = 0;
        const jobs = [];
        for (const it of pending) {
          let slot = null;
          if (freeList) {
            slot = freeList[fi++] || null;
          } else {
            search: for (let y = 0; y < GRID_H; y++) {
              for (let x = 0; x < GRID_W; x++) {
                if (!occupied.has(x + ',' + y)) { occupied.add(x + ',' + y); slot = { x, y }; break search; }
              }
            }
          }
          if (!slot) { full = true; break; }
          jobs.push({ it, slot });
        }
        // kilka poleceń naraz; następne idzie dopiero, gdy serwer odpowie na poprzednie
        await Promise.all(Array.from({ length: BULK_PARALLEL }, async () => {
          while (jobs.length) {
            if (!privateDepoOpen()) { jobs.length = 0; break; }   // depozyt zamknięty w trakcie - przerywamy
            const j = jobs.shift();
            await sendAndWait(`depo&put=${j.it.id}&x=${j.slot.x}&y=${j.slot.y}`, () => !inBag(j.it.id), 1500);
          }
        }));
      }

      const left = items.filter(i => inBag(i.id));
      const moved = items.length - left.length;
      log('nie wrzucono:', left.map(i => i.name));
      notify('Wrzucono ' + moved + '/' + items.length + ' przedmiotów do depozytu' +
        (left.length ? ' (' + left.length + (full ? ' - brak miejsca w zakładce)' : ' - nie da się włożyć)') : '.'));
    } catch (e) {
      log('błąd wrzucania torby', e);
    } finally {
      bulkRunning = false;
    }
  }

  /* ---------- przycisk w menu kontekstowym torby ---------- */
  function setLabel(el, label) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n, first = null;
    while ((n = w.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      if (!first) { first = n; n.nodeValue = label; } else n.nodeValue = '';
    }
    if (!first) el.textContent = label;
  }

  function closeGameMenu(root) {
    try {
      ['mousedown', 'mouseup', 'click'].forEach(t =>
        document.body.dispatchEvent(new MouseEvent(t, { bubbles: true })));
    } catch (e) {}
    nextFrames(2).then(() => { try { if (root.isConnected) root.style.display = 'none'; } catch (e) {} });
  }

  function showOwnMenu(x, y, label, onClick) {
    document.querySelectorAll('.depoSwapMenu').forEach(n => n.remove());
    const d = document.createElement('div');
    d.className = 'depoSwapMenu';
    d.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;z-index:2147483647;background:#1b1b1b;' +
      'border:1px solid #777;border-radius:4px;padding:2px;font:12px sans-serif;color:#eee;cursor:pointer;box-shadow:0 2px 8px #000a';
    const b = document.createElement('div');
    b.textContent = label;
    b.style.cssText = 'padding:6px 10px;white-space:nowrap';
    b.onmouseenter = () => { b.style.background = '#333'; };
    b.onmouseleave = () => { b.style.background = ''; };
    b.onclick = () => { d.remove(); onClick(); };
    d.appendChild(b);
    document.body.appendChild(d);
    const off = ev => {
      if (!d.contains(ev.target)) { d.remove(); document.removeEventListener('mousedown', off, true); }
    };
    setTimeout(() => document.addEventListener('mousedown', off, true), 0);
  }

  // Klasy oznaczające pozycję wyszarzoną/podświetloną - nie mogą trafić do kopii
  const ROW_DISABLED_RE = /disabled|inactive|unavailable|locked|gr[ae]y/i;
  const ROW_STATE_RE = /hover|pressed|focus|selected/i;

  function rowLooksDisabled(row) {
    const els = [row].concat(Array.from(row.querySelectorAll('*')));
    for (const el of els) {
      const cls = typeof el.className === 'string' ? el.className : '';
      if (ROW_DISABLED_RE.test(cls)) return true;
      if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return true;
    }
    try {
      const cs = getComputedStyle(row);
      if (Number(cs.opacity) < 0.95 || cs.pointerEvents === 'none') return true;
    } catch (e) {}
    return false;
  }

  function sanitizeRow(el) {
    [el].concat(Array.from(el.querySelectorAll('*'))).forEach(n => {
      if (typeof n.className === 'string' && n.className) {
        n.className = n.className.split(/\s+/).filter(c => c && !ROW_DISABLED_RE.test(c) && !ROW_STATE_RE.test(c)).join(' ');
      }
      n.removeAttribute('disabled');
      n.removeAttribute('aria-disabled');
    });
  }

  // Wstawia nową pozycję do menu gry jako kopię JEDNEJ istniejącej, aktywnej opcji (wygląda tak samo jak reszta).
  // Zwraca false, gdy menu jest jeszcze niekompletne albo nie rozpoznano jego struktury.
  function injectRow(root, label, onClick) {
    const labels = Array.from(root.querySelectorAll('*')).filter(el =>
      Array.from(el.childNodes).some(n => n.nodeType === 3 && n.nodeValue.trim()));
    if (labels.length < 2) return false;                 // tytuł + przynajmniej jedna opcja
    const count = el => labels.filter(l => el.contains(l)).length;

    // wiersz = najwyższy przodek zawierający dokładnie jedną etykietę
    const rowOf = lab => {
      let row = lab;
      while (row.parentElement && row.parentElement !== root && count(row.parentElement) === 1) row = row.parentElement;
      return row;
    };
    // wzór: ostatnia opcja, która nie jest wyszarzona (wybór zależy od stanu torby, więc ostatnia bywa nieaktywna)
    const rows = labels.slice(1).map(rowOf);             // pierwszy tekst to tytuł menu
    const tpl = rows.slice().reverse().find(r => !rowLooksDisabled(r)) || rows[rows.length - 1];
    if (!tpl || !tpl.parentElement || count(tpl.parentElement) < 2) return false;

    const btn = tpl.cloneNode(true);
    btn.removeAttribute('id');
    sanitizeRow(btn);
    btn.setAttribute('data-deposwap', '1');
    setLabel(btn, label);
    if (btn.textContent.trim() !== label) return false;
    imp(btn, { opacity: '1', 'pointer-events': 'auto' });
    ['mousedown', 'mouseup'].forEach(t => btn.addEventListener(t, ev => ev.stopPropagation(), true));
    btn.addEventListener('click', ev => {
      ev.stopPropagation(); ev.preventDefault();
      closeGameMenu(root);
      onClick();
    }, true);
    // wstawiamy za ostatnią opcją (na końcu listy)
    const last = rows[rows.length - 1];
    const parent = last.parentElement || tpl.parentElement;
    parent.insertBefore(btn, last.nextSibling);
    return btn;
  }

  // Doklejamy własny przycisk bezpośrednio pod menu gry (osobny element - nie kopiujemy pozycji menu)
  function attachButtonUnder(root, label, onClick) {
    const r = root.getBoundingClientRect();
    const rcs = getComputedStyle(root);
    const lab = Array.from(root.querySelectorAll('*')).find(el =>
      Array.from(el.childNodes).some(n => n.nodeType === 3 && n.nodeValue.trim()));
    const lcs = lab ? getComputedStyle(lab) : rcs;

    const d = document.createElement('div');
    d.setAttribute('data-deposwap', '1');
    d.textContent = label;
    const transparent = !rcs.backgroundColor || rcs.backgroundColor === 'rgba(0, 0, 0, 0)';
    const bw = parseFloat(rcs.borderTopWidth) > 0;
    d.style.cssText = 'position:fixed;box-sizing:border-box;z-index:2147483647;cursor:pointer;white-space:nowrap;' +
      'padding:6px 10px;left:' + r.left + 'px;min-width:' + r.width + 'px;' +
      'background-color:' + (transparent ? '#1b1b1b' : rcs.backgroundColor) + ';' +
      (rcs.backgroundImage && rcs.backgroundImage !== 'none' ? 'background-image:' + rcs.backgroundImage + ';' : '') +
      'border:' + (bw ? rcs.borderTopWidth + ' ' + rcs.borderTopStyle + ' ' + rcs.borderTopColor : '1px solid #777') + ';' +
      'font-family:' + lcs.fontFamily + ';font-size:' + lcs.fontSize + ';font-weight:' + lcs.fontWeight + ';color:' + lcs.color + ';';
    document.body.appendChild(d);
    const h = d.getBoundingClientRect().height;
    d.style.top = (r.bottom + 2 + h > window.innerHeight ? r.top - h - 2 : r.bottom + 2) + 'px';

    d.onmouseenter = () => { d.style.filter = 'brightness(1.35)'; };
    d.onmouseleave = () => { d.style.filter = ''; };
    ['mousedown', 'mouseup', 'contextmenu'].forEach(t => d.addEventListener(t, ev => ev.stopPropagation()));

    const off = ev => { if (!d.contains(ev.target)) cleanup(); };
    const iv = setInterval(() => {
      const cs = root.isConnected ? getComputedStyle(root) : null;
      if (!cs || cs.display === 'none' || cs.visibility === 'hidden') cleanup();
    }, 150);
    function cleanup() {
      d.remove(); clearInterval(iv);
      document.removeEventListener('mousedown', off, true);
    }
    setTimeout(() => document.addEventListener('mousedown', off, true), 0);
    d.addEventListener('click', ev => {
      ev.stopPropagation(); ev.preventDefault();
      closeGameMenu(root);
      cleanup();
      onClick();
    });
  }

  const countLabels = el => {
    let n = 0;
    for (const x of el.querySelectorAll('*')) {
      if (Array.from(x.childNodes).some(c => c.nodeType === 3 && c.nodeValue.trim())) { if (++n >= 6) break; }
    }
    return n;
  };
  // podpowiedzi (tooltip) przedmiotów nie są menu - ich nie ruszamy
  const isTipLike = el =>
    /tip/i.test((el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : '')) ||
    el.hasAttribute('tip-id') || el.hasAttribute('data-tip-type');

  // Menu, które gra tylko pokazała (istniejący element), nie pojawia się w DOM jako "nowy węzeł" -
  // wtedy szukamy go po tym, co leży tuż przy kursorze. Menu musi zawierać tytuł (nazwę torby).
  function findMenuByPoint(ctx, title) {
    const offs = [[6, 6], [-6, 6], [6, -6], [-6, -6], [16, 16]];
    for (const [dx, dy] of offs) {
      let els = [];
      try { els = document.elementsFromPoint(ctx.x + dx, ctx.y + dy); } catch (e) { continue; }
      for (const start of els) {
        if (start.hasAttribute('data-deposwap')) continue;
        let best = null;
        for (let el = start, d = 0; el && el !== document.body && d < 8; el = el.parentElement, d++) {
          const r = el.getBoundingClientRect();
          if (r.width > 400 || r.height > 600) break;
          if (isTipLike(el)) { best = null; break; }
          if (r.width >= 40 && countLabels(el) >= 2 && (!title || (el.textContent || '').indexOf(title) >= 0)) best = el;
        }
        if (best) return best;
      }
    }
    return null;
  }

  // Czy wstawiona pozycja jest naprawdę widoczna (nie ucięta ani zasłonięta)?
  function rowIsVisible(btn) {
    if (!btn.isConnected) return false;
    const r = btn.getBoundingClientRect();
    if (r.width < 5 || r.height < 5) return false;
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && (top === btn || btn.contains(top));
  }

  // Zdejmuje ograniczenia (stała wysokość, overflow:hidden) z elementów między pozycją a korzeniem menu
  function unclipMenu(btn, root) {
    for (let el = btn.parentElement; el && el !== document.body; el = el.parentElement) {
      imp(el, { overflow: 'visible', 'max-height': 'none' });
      if (el.style.height) imp(el, { height: 'auto' });
      if (el === root) break;
    }
  }

  // Wykrywa menu kontekstowe gry (nowy element przy kursorze albo już istniejący, tylko pokazany),
  // dopisuje do niego pozycję i sprawdza, czy ta przetrwała i jest widoczna. Gra buduje menu stopniowo
  // (a czasem przebudowuje je po chwili), więc przy niepowodzeniu próbujemy ponownie; przycisk zastępczy
  // pod menu jest ostatecznością.
  function addMenuButton(ctx, label, onClick, title) {
    const added = [];
    let finished = false, scheduled = false, root = null, btn = null;
    let frames = 0, okFrames = 0, unclipped = false;

    const finish = () => { finished = true; mo.disconnect(); clearTimeout(giveUp); };
    const fallbackUnder = why => {
      finish();
      if (root && root.isConnected) {
        log('menu gry (HTML):', root.outerHTML.slice(0, 1500));
        attachButtonUnder(root, label, onClick);
        log('dodano przycisk pod menu gry (' + why + ')');
      } else {
        log('nie znaleziono menu gry. Dodane elementy:', added.slice(0, 8).map(el => {
          const r = el.getBoundingClientRect();
          return { tag: el.tagName, klasa: String(el.className).slice(0, 60), x: Math.round(r.left), y: Math.round(r.top),
                   w: Math.round(r.width), h: Math.round(r.height), tekst: (el.textContent || '').trim().slice(0, 40) };
        }), '| pod kursorem:', (document.elementsFromPoint(ctx.x + 6, ctx.y + 6) || []).slice(0, 6).map(el =>
          el.tagName + '.' + String(el.className).slice(0, 40)));
        if (FALLBACK_OWN_MENU) showOwnMenu(ctx.x, ctx.y, label, onClick);
      }
    };

    const pickFromAdded = relaxed => {
      const near = added.filter(el => {
        if (!el.isConnected || !el.textContent.trim() || el.hasAttribute('data-deposwap') || isTipLike(el)) return false;
        if (!relaxed && title && el.textContent.indexOf(title) < 0) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 10 || r.width > 400 || r.height > 600) return false;
        const dx = Math.max(r.left - ctx.x, 0, ctx.x - r.right);
        const dy = Math.max(r.top - ctx.y, 0, ctx.y - r.bottom);
        return dx <= 30 && dy <= 30;
      });
      near.sort((a, b) => {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return rb.width * rb.height - ra.width * ra.height;
      });
      return near[0] || null;
    };

    const tryAttach = () => {
      scheduled = false;
      if (finished) return;
      frames++;

      if (btn) {                                         // pozycja wstawiona - czy przetrwała i jest widoczna?
        if (rowIsVisible(btn)) {
          if (++okFrames >= 6) {
            finish();
            log('dodano pozycję do menu gry (widoczna, ' + frames + ' klatek)');
            return;
          }
        } else {
          okFrames = 0;
          if (!btn.isConnected) { btn = null; root = null; }                 // gra przebudowała menu - wstawiamy ponownie
          else if (!unclipped) { unclipped = true; unclipMenu(btn, root); }  // pozycja ucięta - zdejmujemy ograniczenia
          else if (frames > 25) {
            const r = btn.getBoundingClientRect();
            const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            log('pozycja nadal niewidoczna:', { w: Math.round(r.width), h: Math.round(r.height),
                naWierzchu: top ? top.tagName + '.' + String(top.className).slice(0, 40) : null });
            btn.remove(); btn = null;
            fallbackUnder('pozycja w menu była niewidoczna');
            return;
          }
        }
      } else {
        const relaxed = frames >= 12;                    // po kilkunastu klatkach nie wymagamy już tytułu w menu
        if (!root || !root.isConnected) root = pickFromAdded(relaxed) || findMenuByPoint(ctx, relaxed ? null : title);
        if (root) {
          try {
            document.querySelectorAll('[data-deposwap]').forEach(n => n.remove());
            btn = injectRow(root, label, onClick) || null;
            okFrames = 0;
          } catch (e) { log('błąd dodawania pozycji do menu', e); }
        }
      }
      if (frames < 40) { scheduled = true; requestAnimationFrame(tryAttach); }
    };

    const mo = new MutationObserver(muts => {
      for (const m of muts) m.addedNodes.forEach(n => { if (n.nodeType === 1) added.push(n); });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    scheduled = true;
    requestAnimationFrame(tryAttach);

    const giveUp = setTimeout(() => {
      if (finished) return;
      if (btn && btn.isConnected) btn.remove();
      fallbackUnder(btn ? 'pozycja nie ustabilizowała się w menu' : 'nie rozpoznano struktury menu');
    }, 900);
  }

  function initBagMenu() {
    if (window.__depoSwapBagMenu) return;
    window.__depoSwapBagMenu = true;
    let lastCtxTs = -1e9;
    document.addEventListener('contextmenu', e => {
      try {
        if (e.timeStamp - lastCtxTs < 400) return; // to samo kliknięcie nie może dodać przycisku kilka razy
        const it = findItemFromElement(e.target);
        if (!it) return;
        const bag = isBagItem(it);
        log('PPM na przedmiot:', { id: it.id, name: it.name, cl: it.cl, st: it.st, x: it.x, y: it.y, loc: it.loc, stat: it.stat, torba: bag });
        if (!bag) return;
        if (!privateDepoOpen()) return;                 // bez otwartego depozytu opcja nie ma sensu
        lastCtxTs = e.timeStamp;
        const bagEl = findItemFromElement.el || e.target;
        if (DEBUG) {
          const chain = [];
          for (let x = bagEl, d = 0; x && x !== document.body && d < 5; x = x.parentElement, d++) {
            chain.push(x.cloneNode(false).outerHTML.slice(0, 200));
          }
          log('łańcuch DOM torby (od elementu w górę):', chain);
        }
        addMenuButton({ x: e.clientX, y: e.clientY }, BTN_LABEL, () => depositBag(it, bagEl), it.name);
      } catch (err) { log('błąd menu torby', err); }
    }, true);
  }

  /* ---------- filtr jakości w oknie depozytu ---------- */
  // Gra ma prywatną zmienną filtrów, więc dopinamy się do publicznych metod instancji Engine.depo:
  // isMatch (dodatkowy warunek), setValueInLastSearch (obsługa nowego menu) i searchDepoItem
  // (własne przeszukiwanie, bo oryginał kończy się od razu, gdy nie ustawiono żadnego ze znanych filtrów).
  const RARITY_CLASSES = ['legendary', 'upgraded', 'heroic', 'unique', 'artefact'];

  function getQuality(it, el) {
    let r = null;
    try { if (typeof it.getItemStat === 'function') r = it.getItemStat('rarity'); } catch (e) {}
    if ((r === null || r === undefined || r === false || r === '') && typeof it.stat === 'string') {
      r = parseStat(it.stat).rarity;
    }
    if (r !== null && r !== undefined && r !== false && r !== '') {
      return String(r).split(',')[0].trim().toLowerCase();
    }
    if (el && el.classList) {                       // awaryjnie: klasa CSS ikony przedmiotu
      for (const q of RARITY_CLASSES) if (el.classList.contains(q)) return q;
    }
    return 'common';
  }

  // diagnostyka: wpisz depoSwapQualityDump() przy otwartym depozycie
  window.depoSwapQualityDump = () => {
    const d = depoWnd();
    if (!d) { console.log('[DepoSwap] otwórz najpierw depozyt'); return; }
    const counts = {}, sample = {};
    const table = d.getDepoItemTable() || {};
    for (const x in table) for (const y in table[x]) for (const id in (table[x][y] || {})) {
      const cell = table[x][y][id];
      const q = getQuality(cell.itemData, cell.$itemClone && cell.$itemClone[0]);
      counts[q] = (counts[q] || 0) + 1;
      if (!sample[q]) sample[q] = { name: cell.itemData.name, stat: cell.itemData.stat };
    }
    console.table(counts);
    console.log('[DepoSwap] przykłady:', sample);
    return counts;
  };

  // Wysokości elementów nadrzędnych sekcji filtrów (zapamiętane PRZED dodaniem nowego wiersza)
  function heightChain(el) {
    const out = [];
    for (let a = el.parentElement, i = 0; a && a !== document.body && i < 8; a = a.parentElement, i++) {
      out.push({ el: a, h: a.offsetHeight });
    }
    return out;
  }

  // Przenosi nowe menu do osobnego wiersza pod pozostałymi filtrami (separator pełnej szerokości wymusza zawinięcie).
  // Kolejne elementy dodane później do sekcji trafią do tego samego wiersza. Zwraca wrapper menu albo null.
  function placeQualityOnNewRow(d, section) {
    try {
      const secEl = section[0];
      const el = section.children().last()[0];       // wrapper dopiero co dodany przez createMenu
      const first = section.children().first()[0];
      if (!secEl || !el || !first || el === first) return null;

      if (getComputedStyle(secEl).display.indexOf('flex') >= 0) secEl.style.flexWrap = 'wrap';

      const br = document.createElement('div');
      br.setAttribute('data-deposwap-br', '1');
      br.style.cssText = 'flex:0 0 100%;width:100%;height:0;grid-column:1 / -1;display:block;clear:both;';
      secEl.insertBefore(br, el);

      // ta sama szerokość i odstęp co pierwszy filtr, mały odstęp od wiersza nad nim
      const w = first.getBoundingClientRect().width;
      if (w > 0) { el.style.width = w + 'px'; el.style.flex = '0 0 auto'; }
      el.style.marginLeft = getComputedStyle(first).marginLeft;
      el.style.marginTop = '4px';
      return el;
    } catch (e) {
      log('nie udało się przenieść filtra jakości do nowego wiersza', e);
      return null;
    }
  }

  // Okno depozytu ma stałą wysokość - powiększamy je o wysokość nowego wiersza (liczoną po dodaniu wszystkich jego elementów)
  function growWindowForRow(section, chain, els) {
    try {
      const secEl = section[0];
      if (secEl.scrollHeight > secEl.clientHeight + 1) {   // sekcja o stałej wysokości ucinałaby nowy wiersz
        secEl.style.height = 'auto';
        secEl.style.maxHeight = 'none';
        secEl.style.overflow = 'visible';
      }
      const delta = Math.max(0, ...els.filter(Boolean).map(e => e.offsetHeight)) + 4;
      let grown = 0;
      for (const c of chain || []) {
        if (c.el.offsetHeight < c.h + delta - 1) { c.el.style.height = (c.h + delta) + 'px'; grown++; }
      }
      log('nowy wiersz filtrów: +' + delta + 'px | powiększono elementów o stałej wysokości:', grown);
    } catch (e) { log('nie udało się powiększyć okna depozytu', e); }
  }

  // Ustawia style z !important - arkusze stylów gry (reguły ogólne dla input/span itp.) nie mogą ich przesłonić
  function imp(el, props) {
    Object.keys(props).forEach(k => el.style.setProperty(k, props[k], 'important'));
  }

  /* ---------- menu filtrów gry: nowa opcja typu + programowy wybór ---------- */
  // Menu filtrów depozytu tworzy wtyczka jQuery $.fn.createMenu(lista, flaga, callback). Owijamy ją, żeby:
  //  - do listy typów dopisać opcję "Ekwipunek" (suma klas z grup pancerze, bronie, biżuteria),
  //  - zapamiętać każde menu filtrów (element, lista opcji, callback) do późniejszego wyboru z kodu.
  const depoMenus = {};
  let eqTypeVal = null;
  let menuPluginHooked = false;

  const toClassList = v => Array.isArray(v) ? v.map(Number)
    : (typeof v === 'string' && v.indexOf(',') >= 0 ? v.split(',').map(Number) : null);

  function addEqOption(items) {
    // grupy wielu klas w kolejności z gry: cl_gear (pancerze), cl_weapons (bronie), cl_jewellery (biżuteria)
    const groups = items.filter(o => { const l = toClassList(o.val); return l && l.length > 1; });
    if (groups.length < 3) { log('filtr typu: nie znaleziono grup pancerze/bronie/biżuteria', groups); return items; }
    const [gear, weapons, jewel] = groups;
    const union = Array.from(new Set([].concat(toClassList(gear.val), toClassList(weapons.val), toClassList(jewel.val))));
    eqTypeVal = Array.isArray(gear.val) ? union : union.join(',');
    const copy = items.slice();
    copy.splice(copy.indexOf(jewel) + 1, 0, { text: EQ_TYPE_LABEL, val: eqTypeVal });
    log('filtr typu: dodano opcję "' + EQ_TYPE_LABEL + '" (' + gear.text + ' + ' + weapons.text + ' + ' + jewel.text + ')');
    return copy;
  }

  function hookMenuPlugin() {
    const jq = window.jQuery || window.$;
    if (!jq || !jq.fn || typeof jq.fn.createMenu !== 'function') return false;
    if (jq.fn.createMenu.__depoSwap) return true;
    const orig = jq.fn.createMenu;
    const wrapped = function (items, flag, cb) {
      try {
        if (Array.isArray(items) && this.closest && this.closest('.filter-section').length) {
          const key = ['bind', 'prof', 'type', 'stat', 'quality'].find(c => this.hasClass(c));
          if (key === 'type' && EQ_TYPE_OPTION) items = addEqOption(items);
          if (key) depoMenus[key] = { $menu: this, items, cb };
        }
      } catch (e) { log('błąd menu filtrów', e); }
      return orig.call(this, items, flag, cb);
    };
    wrapped.__depoSwap = true;
    jq.fn.createMenu = wrapped;
    return true;
  }

  function textNodesIn(root) {
    const out = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) if (n.nodeValue.trim()) out.push(n);
    return out;
  }
  function nodeRect(n) {
    const r = document.createRange();
    r.selectNodeContents(n);
    return r.getBoundingClientRect();
  }
  // tekst wyświetlany na samym przycisku menu (nie na rozwiniętej liście)
  function menuLabelNode(menuEl) {
    const mr = menuEl.getBoundingClientRect();
    return textNodesIn(menuEl).find(n => {
      const r = nodeRect(n);
      return r.width > 0 && r.top >= mr.top - 1 && r.bottom <= mr.bottom + 1;
    }) || null;
  }
  const visibleTextMatches = text => textNodesIn(document.body).filter(n => {
    if (n.nodeValue.trim() !== text) return false;
    const r = nodeRect(n);
    return r.width > 0 && r.height > 0;
  });

  // Wybiera opcję w menu filtrów tak, jakby zrobił to gracz (rozwinięcie listy i kliknięcie opcji),
  // dzięki czemu menu pokazuje wybór i "X". Gdy to się nie uda - wywołuje obsługę menu bezpośrednio.
  async function selectMenuValue(key, val) {
    const reg = depoMenus[key];
    if (!reg || !reg.$menu || !reg.$menu[0] || !reg.$menu[0].isConnected) { log('brak menu filtra:', key); return false; }
    const opt = reg.items.find(o => String(o.val).toLowerCase() === String(val).toLowerCase());
    if (!opt) { log('menu', key, ': brak opcji o wartości', val); return false; }
    const menuEl = reg.$menu[0];
    const labelText = () => { const n = menuLabelNode(menuEl); return n ? n.nodeValue.trim() : ''; };
    if (labelText() === opt.text) return true;

    const before = new Set(visibleTextMatches(opt.text));
    try {
      const mr = menuEl.getBoundingClientRect();
      const hit = document.elementFromPoint(mr.left + mr.width / 2, mr.top + mr.height / 2);
      fullClick(hit && menuEl.contains(hit) ? hit : menuEl);           // rozwinięcie listy
      let target = null;
      await waitFor(() => {
        target = visibleTextMatches(opt.text).find(n => !before.has(n)) || null;
        return !!target;
      }, 500, 40);
      if (target) {
        fullClick(target.parentElement);                              // kliknięcie opcji
        if (await waitFor(() => labelText() === opt.text, 500, 30)) return true;
      }
    } catch (e) { log('wybór w menu nie powiódł się', e); }

    // plan B: obsługa menu wywołana bezpośrednio + podmiana napisu
    try { ['mousedown', 'mouseup', 'click'].forEach(t => document.body.dispatchEvent(new MouseEvent(t, { bubbles: true }))); } catch (e) {}
    try { reg.cb(Array.isArray(opt.val) ? opt.val.join(',') : opt.val); } catch (e) { log('błąd obsługi menu', e); }
    const n = menuLabelNode(menuEl);
    if (n) n.nodeValue = opt.text;
    log('menu', key, ': wybór ustawiony bez interfejsu menu');
    return true;
  }

  // przycisk o wyglądzie zielonych przycisków okna depozytu (kopia "Pay in" itp.)
  function buildPresetButton(d, onClick) {
    let btn = null;
    try {
      const src = Array.from(d.wnd.$.find('.button.green')).find(b => b.offsetParent !== null) ||
                  Array.from(d.wnd.$.find('.button')).find(b => b.offsetParent !== null);
      if (src) {
        btn = src.cloneNode(true);
        btn.removeAttribute('id');
        const lab = btn.querySelector('.label');
        if (lab) lab.textContent = PRESET_LABEL; else btn.textContent = PRESET_LABEL;
      }
    } catch (e) {}
    if (!btn) {
      btn = document.createElement('div');
      btn.textContent = PRESET_LABEL;
      imp(btn, { padding: '3px 10px', background: '#2d5a1f', color: '#fff', border: '1px solid #7fb05a',
                 'border-radius': '4px', 'font-size': '12px' });
    }
    btn.setAttribute('data-deposwap-preset', '1');
    // position: relative - tło przycisku gry jest pozycjonowane absolutnie i musi zostać w obrębie przycisku
    imp(btn, { position: 'relative', left: 'auto', top: 'auto', right: 'auto', bottom: 'auto', float: 'none',
               flex: '0 0 auto', 'align-self': 'center', margin: '4px 0 0 8px', cursor: 'pointer',
               'white-space': 'nowrap', overflow: 'hidden' });
    ['mousedown', 'mouseup'].forEach(t => btn.addEventListener(t, ev => ev.stopPropagation()));
    btn.addEventListener('click', ev => { ev.stopPropagation(); ev.preventDefault(); onClick(); });
    return btn;
  }

  // Ustawia wbudowany filtr poziomu gry (dolny pasek okna: Lvl Min/Max): wpisuje wartości w jego pola
  // i wywołuje jego zdarzenia (żeby pola pokazały wartości), a stan filtra ustawia przez lvlFilterOnChange.
  function setBuiltInLevel(d, min, max) {
    try {
      const ins = Array.from(d.wnd.$.find('.bottom-bar input'));
      const minI = ins.find(i => /min/i.test(i.placeholder || '')) || ins[0];
      const maxI = ins.find(i => /max/i.test(i.placeholder || '')) || ins[1];
      [[minI, min], [maxI, max]].forEach(([inp, v]) => {
        if (!inp) return;
        inp.value = v === null ? '' : String(v);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: '0' }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      });
      if (!minI || !maxI) log('nie znaleziono pól wbudowanego filtra poziomu - ustawiam tylko jego stan');
    } catch (e) { log('błąd wpisywania poziomu w filtr gry', e); }
    if (typeof d.lvlFilterOnChange === 'function') {
      d.lvlFilterOnChange('minLvl', min);
      d.lvlFilterOnChange('maxLvl', max);
    }
  }

  let presetBusy = false;
  async function applyPreset(d) {
    if (presetBusy) return;
    presetBusy = true;
    try {
      const hero = window.Engine && Engine.hero;
      const hd = hero && (hero.d || hero);
      const lvl = hd ? Number(hd.lvl) : NaN;
      const prof = hd ? hd.prof : null;
      log('Dla mnie: poziom', lvl, '| profesja', prof);

      if (eqTypeVal !== null) await selectMenuValue('type', eqTypeVal);
      else log('brak opcji "' + EQ_TYPE_LABEL + '" w filtrze typu');
      if (prof) await selectMenuValue('prof', prof);
      else log('nie udało się odczytać profesji postaci');

      if (!isNaN(lvl) && lvl > 0) setBuiltInLevel(d, Math.max(1, lvl - PRESET_LVL_RANGE), lvl + PRESET_LVL_RANGE);
      else notify('Nie udało się odczytać poziomu postaci.');
    } catch (e) { log('błąd przycisku "' + PRESET_LABEL + '"', e); }
    finally { presetBusy = false; }
  }

  function patchDepoQuality(d, section) {
    let quality = null, lvlMin = null, lvlMax = null;
    let ownOnce = false, sched = false, curEl = null;
    const ownActive = () => quality !== null || lvlMin !== null || lvlMax !== null;
    const origIsMatch = d.isMatch;
    const origSearch = d.searchDepoItem;
    const origSet = d.setValueInLastSearch;

    d.isMatch = function (item) {
      if (!origIsMatch.call(this, item)) return false;
      if (quality !== null && getQuality(item, curEl) !== quality) return false;
      if (lvlMin !== null || lvlMax !== null) {
        let lv = NaN;
        try { if (item.issetLvlStat()) lv = Number(item.getLvlStat()); } catch (e) {}
        if (!isNaN(lv)) {                               // przedmioty bez wymagania poziomu zawsze przechodzą ten filtr
          if (lvlMin !== null && lv < lvlMin) return false;
          if (lvlMax !== null && lv > lvlMax) return false;
        }
      }
      return true;
    };

    // Wbudowany filtr poziomu gry (dolny pasek) wyszarza przedmioty bez wymagania poziomowego.
    // Przejmujemy jego wartości: gra dostaje null (jej filtr poziomu jest "pusty"), a poziom sprawdza nasz isMatch,
    // który przedmioty bez poziomu zawsze przepuszcza. Pola i "X" w dolnym pasku działają bez zmian.
    if (typeof d.lvlFilterOnChange === 'function') {
      const toLvl = v => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return isNaN(n) ? null : n; };
      d.lvlFilterOnChange = function (key, val) {
        const v = toLvl(val);
        if (key === 'minLvl' && v !== lvlMin) { lvlMin = v; ownOnce = true; }
        if (key === 'maxLvl' && v !== lvlMax) { lvlMax = v; ownOnce = true; }
        d.searchDepoItem();
      };
    }

    d.setValueInLastSearch = function (val, key) {
      if (key === 'quality') {
        const nq = (val === 0 || val === '0' || val === null || val === undefined) ? null : String(val);
        if (nq !== quality) { quality = nq; ownOnce = true; }
        return;
      }
      return origSet.apply(this, arguments);
    };

    const ownSearch = () => {
      d.hideBacklight();
      const table = d.getDepoItemTable();
      if (!table) return;
      const counts = {};
      let mismatch = false;
      for (const x in table) {
        for (const y in table[x]) {
          const cell = table[x][y];
          if (!cell) continue;
          for (const id in cell) {
            const data = cell[id].itemData, $clone = cell[id].$itemClone;
            curEl = $clone && $clone[0];
            if (d.isMatch(data)) {
              try { const t = d.getTabIndexOfItem(data); counts[t] = (counts[t] || 0) + 1; } catch (e) {}
            } else {
              mismatch = true;
              d.backlightSlot($clone);
            }
          }
        }
      }
      curEl = null;
      if (!ownActive() && !mismatch) { d.hideBacklight(); return; } // żaden filtr nie jest aktywny
      for (const t in counts) d.backlightCard(t, counts[t]);
    };

    d.searchDepoItem = function () {
      if (ownActive() || ownOnce) {
        ownOnce = false;
        if (!sched) {
          sched = true;
          requestAnimationFrame(() => { sched = false; try { ownSearch(); } catch (e) { log('błąd filtrów depozytu', e); } });
        }
        return;
      }
      return origSearch.apply(this, arguments);
    };

    // --- interfejs: menu jakości + przycisk "Dla mnie" w nowym wierszu pod pozostałymi filtrami ---
    const chain = heightChain(section[0]);
    d.createMenu(QUALITY_OPTIONS, 'quality', section);
    const qEl = placeQualityOnNewRow(d, section);

    let presetEl = null;
    if (PRESET_BUTTON) {
      try {
        presetEl = buildPresetButton(d, () => applyPreset(d));
        if (qEl && qEl.parentElement === section[0]) section[0].insertBefore(presetEl, qEl.nextSibling);
        else section[0].appendChild(presetEl);
      } catch (e) { log('błąd tworzenia przycisku "' + PRESET_LABEL + '"', e); presetEl = null; }
    }

    growWindowForRow(section, chain, [qEl, presetEl]);
    log('dodano filtry depozytu: jakość' + (presetEl ? ' + "' + PRESET_LABEL + '"' : ''));
  }

  function initDepoPatches() {
    if (window.__depoSwapPatches) return;
    window.__depoSwapPatches = true;
    setInterval(() => {
      try {
        if (!menuPluginHooked) menuPluginHooked = hookMenuPlugin();
        const d = depoWnd();
        if (!d || !d.wnd || !d.wnd.$) return;
        if (!d.__depoAuto && typeof d.setDepoItem === 'function') {
          d.__depoAuto = true;
          patchDepoAutoPlace(d);
        }
        if (QUALITY_FILTER && !d.__depoQ && typeof d.createMenu === 'function') {
          const section = d.wnd.$.find('.filter-section');
          if (!section.length || !section.find('.menu').length) return;   // okno jeszcze się buduje
          d.__depoQ = true;
          patchDepoQuality(d, section);
        }
      } catch (e) { log('błąd inicjalizacji dodatków depozytu', e); }
    }, 250);
  }

  /* ---------- hook na _g ---------- */
  function hook() {
    if (typeof window._g !== 'function' || !window.Engine || !Engine.items || !Engine.items.fetchLocationItems) {
      return setTimeout(hook, 500);
    }
    if (window._g.__depoSwapHooked) return;

    rawG = window._g;
    const wrapped = function (task, ...rest) {
      try {
        if (!swapping && !bulkRunning && typeof task === 'string') {
          if (task.startsWith('depo&move=')) {
            const p = new URLSearchParams(task.slice('depo&'.length));
            const id = p.get('move');
            const x = parseInt(p.get('x'), 10);
            const y = parseInt(p.get('y'), 10);
            log('przechwycono:', task);

            const dragged = itemById(id);
            const target = dragged && itemAt(x, y, id);
            if (dragged && target) {
              log('zamiana', dragged.name, '<->', target.name);
              swap(dragged, target);
              return; // blokujemy oryginalne polecenie
            }
          }
          if (AUTO_STACK && task.startsWith('depo&put=') && fromDrag()) log('przeciągnięcie do depozytu - bez stackowania:', task);
          if (AUTO_STACK && task.startsWith('depo&put=') && !fromDrag()) {
            const p = new URLSearchParams(task.slice('depo&'.length));
            const id = p.get('put');
            const cands = findStackCandidates(id);
            if (cands.length) {
              log('przechwycono put (stackowalny):', task);
              stackIntoDepo(id, cands, task);
              return; // blokujemy oryginalne polecenie
            }
          }
        }
      } catch (e) { log('błąd hooka', e); }
      return rawG.call(this, task, ...rest);
    };
    wrapped.__depoSwapHooked = true;
    window._g = wrapped;
    initBagMenu();
    menuPluginHooked = hookMenuPlugin();
    initDragTracker();
    initDepoPatches();

    const items = getDepoItems();
    log('dodatek aktywny; depo:', items.length,
        '| ekwipunek (' + BAG_LOC + '):', getLoc(BAG_LOC).length,
        '| max x:', Math.max(...items.map(i => Number(i.x))),
        'max y:', Math.max(...items.map(i => Number(i.y))));
  }

  hook();
})();