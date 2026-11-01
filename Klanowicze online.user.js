// ==UserScript==
// @name         Klanowicze Online (NI)
// @namespace    margonem-ni-addons
// @version      2.0
// @description  Okienko z klanowiczami online: nick, lvl, lokacja. Nowy interfejs Margonem.
// @match        https://*.margonem.pl/*
// @match        https://*.margonem.com/*
// @author       Bancewald
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  // zabezpieczenie przed podwójnym uruchomieniem (dwa okna / podwójny nasłuch)
  if (window.__koKlanowiczeOnline) return;
  window.__koKlanowiczeOnline = true;

  /* ================== USTAWIENIA ================== */
  const REFRESH_MS = 5 * 1000;    // co ile odświeżać listę
  const STALE_MAX_MS = 60 * 1000; // tyle czasu pokazujemy stare dane, gdy odświeżenie się nie udaje
  const DEBUG = false;            // true = surowy rekord w stopce + logi w konsoli (F12)

  // Odpowiedź serwera (clan&a=members -> members) to PŁASKA lista:
  //   [ liczba_wstępna, rekord, rekord, ... ]  – każdy rekord ma 11 pól:
  // [0 nick, 1 lvl, 2 lvl operacyjny, 3 prof, 4 mapa, 5 x, 6 y, 7 ranga, 8 sekundy_od_logowania, 9 ikona, 10 id]
  const IDX = { NICK: 0, LVL: 1, OPLVL: 2, PROF: 3, MAP: 4, X: 5, Y: 6, RANK: 7, LAST: 8, ICON: 9, ID: 10 };
  const TUPLE = 11;

  // Pole LAST = sekundy od ostatniego logowania; 0 = gracz jest teraz w grze.
  const isOnline = (last) => Number(last) <= 0;
  /* ================================================= */

  const STORE_KEY = 'ni_klanowicze_online_v2';
  const PROFS = { w: 'Wojownik', m: 'Mag', p: 'Paladyn', h: 'Łowca', b: 'Tropiciel', t: 'Tancerz ostrzy' };

  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  };
  const save = (patch) => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...load(), ...patch })); } catch (e) { /* ignoruj */ }
  };

  /* ---------- pobieranie członków klanu ---------- */
  // Zwraca { flat, reason }. flat = lista rekordów albo null.
  const fetchMembers = () =>
    new Promise((resolve) => {
      // Jeśli gra nie ma jeszcze Engine.clan, wstawiamy tymczasową atrapę,
      // żeby domyślna obsługa odpowiedzi nie rzuciła błędu. Istniejącego obiektu nie ruszamy.
      const stubbed = !Engine.clan;
      if (stubbed) Engine.clan = { updateMembers() {} };

      let finished = false;
      const done = (flat, reason) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        if (stubbed) Engine.clan = undefined;
        resolve({ flat, reason });
      };
      const timeout = setTimeout(() => done(null, 'timeout – serwer nie odpowiedział w 10 s'), 10000);

      try {
        if (typeof window._g !== 'function') return done(null, 'brak funkcji _g');
        window._g('clan&a=members', (res) => {
          if (DEBUG) console.log('[Klanowicze] odpowiedź:', res);
          if (!res || typeof res !== 'object') return done(null, 'pusta odpowiedź serwera');

          let list = res.members2 || res.members;
          if (list && typeof list === 'object' && !Array.isArray(list)) list = Object.values(list);
          if (!Array.isArray(list)) {
            return done(null, 'brak members (klucze: ' + Object.keys(res).join(', ') + ')');
          }
          done(list, null);
        });
      } catch (err) {
        console.error('[Klanowicze] błąd zapytania:', err);
        done(null, 'wyjątek: ' + (err && err.message));
      }
    });

  const toMember = (r) => ({
    id: r[IDX.ID],
    nick: String(r[IDX.NICK]),
    lvl: Number(r[IDX.LVL]) || 0,
    oplvl: Number(r[IDX.OPLVL]) || 0,
    prof: String(r[IDX.PROF] || ''),
    map: String(r[IDX.MAP] || '').trim(),
    x: r[IDX.X],
    y: r[IDX.Y],
    last: r[IDX.LAST],
    raw: r,
  });

  const parseMembers = (list) => {
    if (!list.length) return [];
    // (na wszelki wypadek) lista rekordów-tablic
    if (Array.isArray(list[0])) return list.map(toMember);
    // płaska lista: pierwszy rekord zaczyna się od pierwszego tekstu (nicku), wcześniej jest liczba wstępna
    let start = list.findIndex((v) => typeof v === 'string');
    if (start < 0) return [];
    const out = [];
    for (let i = start; i + TUPLE <= list.length; i += TUPLE) out.push(toMember(list.slice(i, i + TUPLE)));
    return out;
  };

  // pole LAST = sekundy od ostatniego logowania
  const lastSeenText = (sec) => {
    const v = Number(sec);
    if (!(v > 0)) return 'online';
    if (v < 3600) return `${Math.max(1, Math.round(v / 60))} min temu`;
    if (v < 86400) return `${Math.round(v / 3600)} godz. temu`;
    return `${Math.floor(v / 86400)} dni temu`;
  };

  /* ---------- UI ---------- */
  const css = `
    #ko-win{position:fixed;z-index:9999;width:300px;background:#1b1712;color:#e8dcc0;
      border:2px solid #6b5a33;border-radius:6px;font:12px/1.35 Arial,sans-serif;
      box-shadow:0 4px 14px rgba(0,0,0,.6);user-select:none;display:flex;flex-direction:column}
    #ko-head,#ko-foot{flex:0 0 auto}
    #ko-resize{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;z-index:2;
      background:linear-gradient(135deg,transparent 0 45%,#8a7340 45% 55%,transparent 55% 70%,#8a7340 70% 80%,transparent 80%)}
    #ko-head{display:flex;align-items:center;gap:6px;padding:5px 8px;cursor:move;
      background:linear-gradient(#3a2f1a,#2a2212);border-bottom:1px solid #6b5a33;border-radius:4px 4px 0 0}
    #ko-title{flex:1;font-weight:bold;color:#f1d58a}
    .ko-btn{cursor:pointer;background:#4a3d22;border:1px solid #7a6639;color:#f1d58a;
      border-radius:3px;padding:0 6px;line-height:18px;font-size:12px}
    .ko-btn:hover{background:#5d4c2a}
    .ko-btn.on{background:#7a6639}
    #ko-win,#ko-win *{box-sizing:border-box}
    #ko-body{overscroll-behavior:contain;max-height:320px;flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden}
    #ko-body table{width:100%;table-layout:auto;border-collapse:collapse;margin:0}
    #ko-body th,#ko-body td{display:table-cell;position:static;float:none;height:auto;
      padding:3px 6px;margin:0;text-align:left;vertical-align:middle;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      font:12px/1.35 Arial,sans-serif;border:0;border-bottom:1px solid #2c2618;background:transparent}
    #ko-body th{color:#b9a56a;font-weight:normal;background:#2a2212;border-bottom:1px solid #4a3d22}
    #ko-body tr:hover td{background:#2a2414}
    #ko-body tr.ko-off td{opacity:.5}
    #ko-body td.ko-lvl{text-align:right;color:#9fd18b}
    /* nick i lvl: tylko tyle miejsca, ile potrzebuje najdłuższa wartość; resztę dostaje lokacja */
    #ko-body th.ko-c-nick,#ko-body td.ko-nick{width:1%;max-width:200px}
    #ko-body th.ko-c-lvl,#ko-body td.ko-lvl{width:1%}
    #ko-body th.ko-c-loc,#ko-body td.ko-loc{width:auto;max-width:0}
    #ko-body td.ko-nick{color:#fff;cursor:pointer}
    #ko-empty,#ko-foot{padding:6px 8px;color:#a39572}
    #ko-foot{font-size:10px;border-top:1px solid #2c2618;white-space:normal;word-break:break-all}
  `;

  const el = (tag, props = {}, text) => {
    const n = document.createElement(tag);
    Object.assign(n, props);
    if (text !== undefined) n.textContent = text;
    return n;
  };

  const state = { showAll: false, members: null, reason: null, fetchedAt: 0, pausedUntil: 0 };

  const buildWindow = () => {
    document.head.appendChild(el('style', {}, css));

    const saved = load();
    state.showAll = !!saved.showAll;

    const win = el('div', { id: 'ko-win' });
    win.style.top = (saved.top ?? 80) + 'px';
    win.style.left = (saved.left ?? 20) + 'px';
    win.style.width = Math.min(saved.width ?? 300, window.innerWidth - 10) + 'px';

    const head = el('div', { id: 'ko-head' });
    const title = el('span', { id: 'ko-title' }, 'Klanowicze online');
    const allBtn = el('span', { className: 'ko-btn' + (state.showAll ? ' on' : ''), title: 'Pokaż też offline' }, '👥');
    const refreshBtn = el('span', { className: 'ko-btn', title: 'Odśwież' }, '⟳');
    const minBtn = el('span', { className: 'ko-btn', title: 'Zwiń/rozwiń' }, '–');
    head.append(title, allBtn, refreshBtn, minBtn);

    const body = el('div', { id: 'ko-body' });
    const foot = el('div', { id: 'ko-foot' }, 'Ładowanie…');
    const handle = el('div', { id: 'ko-resize', title: 'Przeciągnij, aby zmienić rozmiar' });
    win.append(head, body, foot, handle);
    document.body.appendChild(win);

    // rozmiar: zapisana wysokość wyłącza domyślny limit wysokości listy
    const MIN_W = 220, MIN_H = 110;
    const applyHeight = (h) => {
      if (h) { win.style.height = h + 'px'; body.style.maxHeight = 'none'; }
      else { win.style.height = ''; body.style.maxHeight = ''; }
    };
    if (saved.height) applyHeight(Math.min(saved.height, window.innerHeight - 10));

    let rs = null;
    handle.addEventListener('mousedown', (e) => {
      rs = { x: e.clientX, y: e.clientY, w: win.offsetWidth, h: win.offsetHeight };
      e.preventDefault();
      e.stopPropagation();
    });
    document.addEventListener('mousemove', (e) => {
      if (!rs) return;
      const w = Math.max(MIN_W, Math.min(window.innerWidth - win.offsetLeft - 4, rs.w + e.clientX - rs.x));
      const h = Math.max(MIN_H, Math.min(window.innerHeight - win.offsetTop - 4, rs.h + e.clientY - rs.y));
      win.style.width = w + 'px';
      applyHeight(h);
    });
    document.addEventListener('mouseup', () => {
      if (!rs) return;
      rs = null;
      save({ width: win.offsetWidth, height: win.offsetHeight });
    });
    // dwuklik w uchwyt = przywróć domyślny rozmiar
    handle.addEventListener('dblclick', () => {
      win.style.width = '300px';
      applyHeight(0);
      save({ width: 300, height: 0 });
    });

    // kółko myszy przewija listę (a nie zoom/mapę gry)
    win.addEventListener('wheel', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? body.clientHeight : 1;
      body.scrollTop += e.deltaY * k;
    }, { passive: false });

    // przeciąganie
    let drag = null;
    head.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('ko-btn')) return;
      drag = { dx: e.clientX - win.offsetLeft, dy: e.clientY - win.offsetTop };
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!drag) return;
      win.style.left = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - drag.dx)) + 'px';
      win.style.top = Math.max(0, Math.min(window.innerHeight - 30, e.clientY - drag.dy)) + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!drag) return;
      drag = null;
      save({ left: win.offsetLeft, top: win.offsetTop });
    });

    // zwijanie
    const setCollapsed = (c) => {
      body.style.display = foot.style.display = c ? 'none' : '';
      handle.style.display = c ? 'none' : '';
      if (c) win.style.height = 'auto';
      else { const h = load().height; if (h) applyHeight(h); }
      save({ collapsed: c });
    };
    minBtn.addEventListener('click', () => setCollapsed(body.style.display !== 'none'));
    if (saved.collapsed) setCollapsed(true);

    return { body, foot, title, refreshBtn, allBtn };
  };

  const render = (ui) => {
    ui.body.textContent = '';
    const members = state.members;

    if (members === null) {
      ui.body.appendChild(el('div', { id: 'ko-empty' }, 'Nie udało się pobrać listy klanu.'));
      ui.foot.textContent = 'Powód: ' + (state.reason || 'nieznany');
      return;
    }

    const byLvl = (a, b) => b.lvl - a.lvl || a.nick.localeCompare(b.nick);
    const online = members.filter((m) => isOnline(m.last)).sort(byLvl);
    const shown = state.showAll ? [...members].sort((a, b) => (isOnline(b.last) - isOnline(a.last)) || byLvl(a, b)) : online;

    ui.title.textContent = `Klanowicze online (${online.length}/${members.length})`;

    if (!shown.length) {
      ui.body.appendChild(el('div', { id: 'ko-empty' },
        'Nikt z klanu nie jest teraz online. (Kliknij 👥, aby zobaczyć wszystkich.)'));
    } else {
      const table = el('table');
      const thead = el('thead');
      const hr = el('tr');
      ['Nick', 'Lvl', 'Lokacja'].forEach((h, i) => hr.appendChild(el('th', { className: ['ko-c-nick', 'ko-c-lvl', 'ko-c-loc'][i] }, h)));
      thead.appendChild(hr);
      table.appendChild(thead);

      const tbody = el('tbody');
      shown.forEach((m) => {
        const tr = el('tr', { className: isOnline(m.last) ? '' : 'ko-off' });
        const tip = `${m.nick} – ${PROFS[m.prof.toLowerCase()] || m.prof}\n`
          + `Lvl ${m.lvl} (operacyjny ${m.oplvl})\n`
          + `Ostatnio: ${lastSeenText(m.last)} [sekundy: ${m.last}]\n`
          + 'Kliknij, aby skopiować nick';
        const nick = el('td', { className: 'ko-nick', title: tip }, m.nick);
        nick.addEventListener('click', () => {
          if (navigator.clipboard) navigator.clipboard.writeText(m.nick).catch(() => {});
        });
        const lvl = el('td', { className: 'ko-lvl' }, m.lvl + m.prof);
        const loc = el('td', { className: 'ko-loc', title: `${m.map} (${m.x}, ${m.y})` }, m.map);
        tr.append(nick, lvl, loc);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      ui.body.appendChild(table);
    }

    const time = new Date(state.fetchedAt).toLocaleTimeString('pl-PL');
    ui.foot.textContent = state.reason
      ? `Nie udało się odświeżyć – dane z ${time} (${state.reason})`
      : `Odświeżono: ${time}`;
    if (DEBUG && members.length) ui.foot.textContent += ' | rekord: ' + JSON.stringify(members[0].raw);
  };

  /* ---------- start ---------- */
  // Zapytania do serwera w trakcie przelogowywania (wylogowania) mogą je przerwać,
  // dlatego wstrzymujemy odświeżanie, gdy gra zaczyna zmianę postaci.
  const RELOG_RE = /logoff|logout|relog|change_?char|change_?player|switch_?char/i;
  const PAUSE_MS = 90 * 1000; // bezpiecznik: wznowienie, gdyby 'logoff&a=stop' nigdy nie nadszedł

  // nick własnej postaci – wykluczamy ją z listy
  const myNick = () => {
    const h = window.Engine && Engine.hero;
    const n = h && ((h.d && h.d.nick) || h.nick);
    return n ? String(n) : '';
  };

  const gameReady = () => !!(window.Engine && Engine.allInit && Engine.hero);
  const isPaused = () => Date.now() < state.pausedUntil || !gameReady();

  const installRelogGuard = (ui) => {
    const pause = (ms, why) => {
      state.pausedUntil = Date.now() + ms;
      ui.foot.textContent = 'Wstrzymano odświeżanie (przelogowywanie)…';
      if (DEBUG) console.log('[Klanowicze] pauza:', why);
    };

    const resume = (why) => {
      state.pausedUntil = 0;
      ui.foot.textContent = 'Wznowiono odświeżanie.';
      if (DEBUG) console.log('[Klanowicze] wznowienie:', why);
    };

    // 1) strona się zamyka / przeładowuje (typowe przy zmianie postaci)
    window.addEventListener('beforeunload', () => pause(Infinity, 'beforeunload'));
    window.addEventListener('pagehide', () => pause(Infinity, 'pagehide'));

    // 2) gra wysyła zapytanie o wylogowanie / zmianę postaci
    try {
      const orig = window._g;
      if (typeof orig === 'function' && !window.__koRelogHook) {
        const wrapped = function (task) {
          try {
            if (typeof task === 'string') {
              if (DEBUG && !task.startsWith('clan&a=members')) console.log('[Klanowicze] _g:', task);
              if (/^logoff&a=stop/i.test(task)) resume(task);       // przelogowanie zakończone/anulowane
              else if (RELOG_RE.test(task)) pause(PAUSE_MS, task);  // np. logoff&a=start
            }
          } catch (e) { /* nie blokuj gry */ }
          return orig.apply(this, arguments);
        };
        Object.assign(wrapped, orig);
        window.__koRelogHook = true;
        window._g = wrapped;
      }
    } catch (e) {
      console.warn('[Klanowicze] nie udało się podpiąć nasłuchu przelogowania:', e);
    }
  };

  const start = () => {
    const h = Engine.hero;
    const clan = h && ((h.d && h.d.clan) || h.clan);
    if (!clan) return; // gracz bez klanu – dodatek nic nie robi

    const ui = buildWindow();
    installRelogGuard(ui);

    let busy = false;
    const refresh = async () => {
      if (busy) return;
      if (isPaused()) {
        if (Date.now() < state.pausedUntil) ui.foot.textContent = 'Wstrzymano odświeżanie (przelogowywanie)…';
        return;
      }
      busy = true;
      try {
        const { flat, reason } = await fetchMembers();
        const me = myNick();
        if (flat) {
          state.members = parseMembers(flat).filter((m) => !me || m.nick !== me);
          state.fetchedAt = Date.now();
          state.reason = null;
        } else {
          // nieudane pobranie: zostawiamy stare dane, o ile nie są starsze niż STALE_MAX_MS
          state.reason = reason;
          if (!state.members || Date.now() - state.fetchedAt > STALE_MAX_MS) state.members = null;
        }
        render(ui);
      } finally {
        busy = false;
      }
    };

    ui.refreshBtn.addEventListener('click', refresh);
    ui.allBtn.addEventListener('click', () => {
      state.showAll = !state.showAll;
      ui.allBtn.classList.toggle('on', state.showAll);
      save({ showAll: state.showAll });
      render(ui);
    });

    refresh();
    setInterval(refresh, REFRESH_MS);
  };

  const waitForGame = () => {
    if (window.Engine && Engine.allInit && typeof window._g === 'function') start();
    else setTimeout(waitForGame, 1500);
  };
  waitForGame();
})();