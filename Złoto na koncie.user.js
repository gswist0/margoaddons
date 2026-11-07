// ==UserScript==
// @name         Złoto na koncie
// @version      1.3
// @description  Zlicza łączne złoto wszystkich postaci i depo na koncie na danym serwerze. Pomija konta, na których jesteśmy zastępcą.
// @match        https://*.margonem.pl/
// @match        https://*.margonem.com/
// @author       Bancewald
// @grant        none
// @run-at       document-idle
// ==/UserScript==

// Gra podaje złoto tylko aktualnej postaci i otwartego depo, dlatego dodatek zapamiętuje ostatnio widziane wartości.
// Dane są zapisane osobno dla każdego serwera i konta (hero.d.account), więc konta się ze sobą nie mieszają.

(() => {
    'use strict';

    /* ================== INFORMACJA O NOWEJ WERSJI ================== */
    // Lista aktualnych wersji jest w pliku versions.json na GitHubie. Dodatek NIE aktualizuje się sam,
    // tylko pokazuje na dole swojego okna informację z linkiem do nowej wersji.
    const updateInfo = (() => {
        const ID = 'zloto-na-koncie';
        const RAW = 'https://raw.githubusercontent.com/gswist0/margoaddons/main/';
        const CACHE_KEY = 'margoaddons_wersje';
        const CACHE_MS = 3 * 60 * 60 * 1000;
        const TOAST_KEY = 'margoaddons_komunikat_' + ID;
        const TOAST_EVERY_MS = 24 * 60 * 60 * 1000;
        const script = typeof GM_info !== 'undefined' && GM_info && GM_info.script;
        const current = script && script.version;
        const notes = [];
        let latest = null;
        let toastName = null;

        const isNewer = (a, b) => {
            const x = String(a).split('.');
            const y = String(b).split('.');
            for (let i = 0; i < Math.max(x.length, y.length); i++) {
                const diff = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0);
                if (diff) return diff > 0;
            }
            return false;
        };

        const readCache = () => {
            try {
                const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
                return cached && Date.now() - cached.t < CACHE_MS ? cached.data : null;
            } catch (e) { return null; }
        };

        // Wszystkie dodatki na stronie korzystają z jednego zapytania, a wynik jest pamiętany przez kilka godzin.
        const load = () => {
            const cached = readCache();
            if (cached) return Promise.resolve(cached);
            if (!window.__margoaddonsVersions) {
                window.__margoaddonsVersions = fetch(RAW + 'versions.json', { cache: 'no-cache' })
                    .then(response => (response.ok ? response.json() : Promise.reject(response.status)))
                    .then(data => {
                        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data })); } catch (e) { /* bez pamięci podręcznej */ }
                        return data;
                    });
            }
            return window.__margoaddonsVersions;
        };

        const addStyle = () => {
            if (document.getElementById('ma-update-style')) return;
            const style = document.createElement('style');
            style.id = 'ma-update-style';
            style.textContent = `
                .ma-update { flex: none; padding: 4px 8px; border-top: 1px solid rgba(107, 90, 51, .6); color: #d9a35b; font: 11px/1.35 Arial, sans-serif; text-align: center; white-space: normal; }
                .ma-update a { color: #f1d58a; text-decoration: underline; cursor: pointer; }
                .ma-update a:hover { color: #fff; }
                #ma-update-toasts { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 10000; display: flex; flex-direction: column; align-items: center; gap: 4px; pointer-events: none; }
                #ma-update-toasts .ma-update { display: flex; align-items: center; gap: 8px; padding: 5px 8px 5px 10px; border: 1px solid #6b5a33; border-radius: 4px; background: rgba(27, 23, 18, .95); box-shadow: 0 2px 8px rgba(0, 0, 0, .6); pointer-events: auto; }
                #ma-update-toasts .ma-update-close { color: #d66; cursor: pointer; }
                #ma-update-toasts .ma-update-close:hover { color: #f88; }
            `;
            document.head.appendChild(style);
        };

        const fillText = (el, prefix) => {
            const link = document.createElement('a');
            link.href = latest.url;
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = 'zaktualizuj z GitHuba';
            link.title = 'Otwiera nową wersję dodatku - Tampermonkey zaproponuje jej instalację';
            const text = document.createElement('span');
            text.append(`${prefix}dostępna nowa wersja ${latest.version} (masz ${current}) – `, link);
            el.appendChild(text);
        };

        const fill = el => {
            if (!latest || el.childNodes.length) return;
            fillText(el, '⚠ Dodatek nieaktualny: ');
            el.style.display = '';
        };

        const showToast = () => {
            if (!latest || !toastName) return;
            // komunikat dopiero po wczytaniu gry, żeby nie zginął na ekranie ładowania
            if (!document.body || !window.Engine || !window.Engine.allInit) {
                setTimeout(showToast, 1000);
                return;
            }
            try {
                if (Date.now() - (Number(localStorage.getItem(TOAST_KEY)) || 0) < TOAST_EVERY_MS) return;
                localStorage.setItem(TOAST_KEY, String(Date.now()));
            } catch (e) { /* pokaż mimo to */ }
            addStyle();
            let box = document.getElementById('ma-update-toasts');
            if (!box) {
                box = document.createElement('div');
                box.id = 'ma-update-toasts';
                document.body.appendChild(box);
            }
            const toast = document.createElement('div');
            toast.className = 'ma-update';
            fillText(toast, `⚠ ${toastName}: `);
            const close = document.createElement('span');
            close.className = 'ma-update-close';
            close.title = 'Zamknij';
            close.textContent = '✕';
            close.addEventListener('click', () => toast.remove());
            toast.appendChild(close);
            box.appendChild(toast);
            setTimeout(() => toast.remove(), 60 * 1000);
            toastName = null;
        };

        if (current) {
            load().then(data => {
                const entry = data && data[ID];
                if (!entry || !entry.version || !entry.file || !isNewer(entry.version, current)) return;
                latest = { version: entry.version, url: RAW + encodeURIComponent(entry.file) };
                notes.splice(0).forEach(fill);
                showToast();
            }).catch(() => { /* brak informacji o wersjach - nic nie pokazujemy */ });
        }

        return {
            // Element na dół okna dodatku - widoczny tylko wtedy, gdy na GitHubie jest nowsza wersja.
            note() {
                addStyle();
                const el = document.createElement('div');
                el.className = 'ma-update';
                el.style.display = 'none';
                if (latest) fill(el);
                else notes.push(el);
                return el;
            },
            // Dla dodatków bez własnego okna: mały komunikat u góry ekranu, najwyżej raz na dobę.
            toast(name) {
                toastName = name;
                showToast();
            },
        };
    })();

    if (window.__zlotoNaKoncie) return;
    window.__zlotoNaKoncie = true;

    /* ================== USTAWIENIA ================== */

    const ADDON_NAME = 'Złoto na koncie';
    const WIDGET_KEY = 'zlotonakoncie';
    const WIDGET_ICON = 'https://raw.githubusercontent.com/gswist0/margoaddons/refs/heads/main/zl_clear.png';
    const DEFAULT_WIDGET_POSITION = [1, 'bottom-right-additional'];
    const PANEL_POSITION_KEY = 'zloto_pozycja';
    const PANEL_OPEN_KEY = 'zloto_otwarty';
    const PANEL_SIZE_KEY = 'zloto_rozmiar';
    const PANEL_DEFAULT_WIDTH = 280;
    const PANEL_MIN_WIDTH = 220;
    const PANEL_MIN_HEIGHT = 140;
    const REFRESH_MS = 5000;

    let world = '';
    let panel = null;
    let view = null;
    let heroRecorded = false;

    /* ================== DANE ================== */

    const hero = () => window.Engine.hero;

    // Tak samo jak gra: bohater bez pola guest należy do zalogowanego konta.
    function isDeputy() {
        const guest = hero().d.guest;
        return guest !== undefined && guest !== null && Number(guest) !== 0;
    }

    const accountKey = account => `zloto_${world}_${account}`;
    const lastAccountKey = () => `zloto_ostatnie_konto_${world}`;

    function loadAccount(account) {
        let data = null;
        try { data = JSON.parse(localStorage.getItem(accountKey(account))); } catch (e) { /* uszkodzony zapis */ }
        return { chars: (data && data.chars) || {}, depo: (data && data.depo) || null };
    }

    function saveAccount(account, data) {
        try { localStorage.setItem(accountKey(account), JSON.stringify(data)); } catch (e) { console.warn('[Złoto na koncie] zapis nieudany', e); }
    }

    // Konto zastępowane nigdy nie jest pokazywane - wtedy widać ostatnie własne konto z tej przeglądarki.
    function shownAccount() {
        if (!isDeputy()) return hero().d.account;
        return localStorage.getItem(lastAccountKey());
    }

    function parseGold(value) {
        if (value === undefined || value === null || value === '') return null;
        const gold = Number(value);
        return Number.isFinite(gold) && gold >= 0 ? gold : null;
    }

    function recordHeroGold(value) {
        if (isDeputy()) return;
        const gold = parseGold(value);
        if (gold === null) return;
        const { id, nick, lvl, account } = hero().d;
        const data = loadAccount(account);
        const previous = data.chars[id];
        if (heroRecorded && previous && previous.gold === gold) return;
        heroRecorded = true;
        data.chars[id] = { nick, lvl, gold, at: Date.now() };
        saveAccount(account, data);
        refresh();
    }

    function recordDepoGold(value) {
        if (isDeputy()) return;
        const gold = parseGold(value);
        if (gold === null) return;
        const { account } = hero().d;
        const data = loadAccount(account);
        data.depo = { gold, at: Date.now() };
        saveAccount(account, data);
        refresh();
    }

    // Lista postaci jest wiarygodna tylko na własnym koncie i gdy zawiera aktualnego bohatera (gra wczytuje ją asynchronicznie).
    function worldCharacters() {
        if (isDeputy()) return null;
        try {
            const list = window.Engine.characterList.getCharactersByWorld(world);
            return list.some(({ id }) => Number(id) === Number(hero().d.id)) ? list : null;
        } catch (e) {
            return null;
        }
    }

    // Postacie usunięte lub przeniesione na inny serwer nie liczą się do sumy; postacie jeszcze nieodwiedzone mają gold: null.
    function buildSummary(data) {
        const list = worldCharacters();
        const rows = list
            ? list.map(({ id, nick, lvl }) => {
                const saved = data.chars[id];
                return { id, nick, lvl, gold: saved ? saved.gold : null, at: saved ? saved.at : null };
            })
            : Object.entries(data.chars).map(([id, char]) => ({ id, ...char }));
        rows.sort((a, b) => (b.gold ?? -1) - (a.gold ?? -1) || String(a.nick).localeCompare(String(b.nick)));
        const known = rows.filter(row => row.gold !== null);
        const total = known.reduce((sum, row) => sum + row.gold, 0) + (data.depo ? data.depo.gold : 0);
        return { rows, total, missing: rows.length - known.length };
    }

    /* ================== PANEL ================== */

    const formatGold = gold => String(Math.round(gold)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    function formatAge(at) {
        if (!at) return '';
        const minutes = Math.floor((Date.now() - at) / 60000);
        if (minutes < 1) return 'przed chwilą';
        if (minutes < 60) return `${minutes} min temu`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} godz. temu`;
        const days = Math.floor(hours / 24);
        return days === 1 ? 'wczoraj' : `${days} dni temu`;
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function createRow(name, gold, age, className) {
        const row = createElement('div', `zl-row ${className || ''}`);
        const info = createElement('div', 'zl-row-info');
        info.append(createElement('div', 'zl-row-name', name));
        if (age) info.append(createElement('div', 'zl-row-age', age));
        row.append(info, createElement('div', 'zl-row-gold', gold === null ? '?' : formatGold(gold)));
        return row;
    }

    function charactersWord(count) {
        if (count === 1) return 'postać';
        const tens = count % 100;
        return count % 10 >= 2 && count % 10 <= 4 && (tens < 10 || tens >= 20) ? 'postacie' : 'postaci';
    }

    function missingText(missing, hasDepo) {
        const parts = [];
        if (missing) parts.push(`${missing} ${charactersWord(missing)} (wejdź na nie)`);
        if (!hasDepo) parts.push('depo (otwórz je)');
        return parts.length ? `Suma niepełna, brakuje: ${parts.join(' i ')}.` : '';
    }

    function render() {
        if (!panel || panel.hidden) return;
        const account = shownAccount();
        const deputy = isDeputy();
        view.deputy.hidden = !deputy;
        view.deputy.textContent = account
            ? 'Grasz jako zastępca. Złoto tej postaci i depo nie są liczone, poniżej Twoje konto.'
            : 'Grasz jako zastępca. Złoto tej postaci i depo nie są liczone. Wejdź na własną postać, żeby zacząć zliczanie.';
        view.summary.hidden = !account;
        if (!account) return;

        const data = loadAccount(account);
        const { rows, total, missing } = buildSummary(data);
        view.total.textContent = formatGold(total);
        const warning = missingText(missing, !!data.depo);
        view.missing.hidden = !warning;
        view.missing.textContent = warning;

        const currentId = deputy ? null : Number(hero().d.id);
        const rowElements = rows.map(row => {
            const current = Number(row.id) === currentId;
            const name = row.lvl ? `${row.nick} (${row.lvl} lvl)` : row.nick;
            const age = current ? 'aktualna postać' : row.gold === null ? 'jeszcze nie odwiedzono' : formatAge(row.at);
            return createRow(name, row.gold, age, current ? 'zl-current' : '');
        });
        const depo = data.depo;
        const depoRow = createRow('Depo', depo ? depo.gold : null, depo ? formatAge(depo.at) : 'jeszcze nie otwarto', 'zl-depo');
        // Panel odświeża się co kilka sekund i nie może przy tym przewijać listy na początek.
        const scrollTop = view.rows.scrollTop;
        view.rows.replaceChildren(depoRow, ...rowElements);
        view.rows.scrollTop = scrollTop;
    }

    // Na widgecie skrócona suma w zapisie gry (k, m, g). Tytuł w menu pod PPM to nadal nazwa dodatku.
    function updateWidgetTip() {
        if (!world) return;
        const account = shownAccount();
        const text = account ? window.roundShorten(buildSummary(loadAccount(account)).total) : ADDON_NAME;
        window.$(`.main-buttons-container .widget-${WIDGET_KEY}`).tip(text);
    }

    function refresh() {
        render();
        safely(updateWidgetTip);
    }

    function togglePanel() {
        if (!panel) return;
        panel.hidden = !panel.hidden;
        try { localStorage.setItem(PANEL_OPEN_KEY, panel.hidden ? '0' : '1'); } catch (e) { /* tylko wygoda */ }
        render();
    }

    function buildPanel() {
        const style = document.createElement('style');
        style.textContent = `
            .main-buttons-container .widget-button .icon.${WIDGET_KEY} { background-image: url("${WIDGET_ICON}"); background-position: 0; }
            #zl-panel { position: fixed; z-index: 9999; width: ${PANEL_DEFAULT_WIDTH}px; display: flex; flex-direction: column; background: #1b1712; color: #e8dcc0; border: 2px solid #6b5a33; border-radius: 6px; font: 12px/1.35 Arial, sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,.6); }
            #zl-panel, #zl-panel * { box-sizing: border-box; }
            #zl-panel .zl-head { flex: none; display: flex; align-items: center; gap: 6px; padding: 5px 8px; cursor: move; user-select: none; background: linear-gradient(#3a2f1a, #2a2212); border-bottom: 1px solid #6b5a33; border-radius: 4px 4px 0 0; }
            #zl-panel .zl-title { flex: 1; font-weight: bold; color: #f1d58a; }
            #zl-panel .zl-btn { cursor: pointer; background: #4a3d22; border: 1px solid #7a6639; color: #f1d58a; border-radius: 3px; padding: 0 6px; line-height: 18px; text-align: center; }
            #zl-panel .zl-btn:hover { background: #5d4c2a; }
            #zl-panel .zl-page, #zl-panel .zl-summary { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
            #zl-panel .zl-page { padding: 8px 8px 14px; }
            #zl-panel .zl-resize { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; background: linear-gradient(135deg, transparent 0 45%, #8a7340 45% 55%, transparent 55% 70%, #8a7340 70% 80%, transparent 80%); }
            #zl-panel .zl-total-label { color: #a89a7a; font-size: 11px; }
            #zl-panel .zl-total { color: #f1d58a; font-size: 18px; font-weight: bold; }
            #zl-panel .zl-note { padding: 4px 6px; background: #2a2212; border-radius: 3px; color: #e8c98a; }
            #zl-panel .zl-rows { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 2px; max-height: 300px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #7a6639 #0f0d0a; }
            #zl-panel .zl-row { flex: none; }
            #zl-panel .zl-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 3px 6px; background: #2a2212; border-radius: 3px; }
            #zl-panel .zl-depo { border: 1px solid #6b5a33; }
            #zl-panel .zl-current .zl-row-name { color: #9fe08a; }
            #zl-panel .zl-row-info { min-width: 0; }
            #zl-panel .zl-row-name { overflow-wrap: anywhere; }
            #zl-panel .zl-row-age { color: #a89a7a; font-size: 11px; }
            #zl-panel .zl-row-gold { flex: none; color: #f1d58a; font-weight: bold; }
            #zl-panel[hidden], #zl-panel [hidden] { display: none; }
        `;
        document.head.appendChild(style);

        panel = createElement('div');
        panel.id = 'zl-panel';
        panel.hidden = localStorage.getItem(PANEL_OPEN_KEY) !== '1';

        const head = createElement('div', 'zl-head');
        const close = createElement('span', 'zl-btn', '×');
        close.title = 'Zamknij';
        close.addEventListener('click', togglePanel);
        head.append(createElement('span', 'zl-title', ADDON_NAME), close);

        const deputy = createElement('div', 'zl-note');
        const total = createElement('div', 'zl-total');
        const totalBox = createElement('div');
        totalBox.append(createElement('div', 'zl-total-label', `Łącznie na serwerze ${world}`), total);
        const missing = createElement('div', 'zl-note');
        // Gra blokuje kółko myszy na całej stronie, z wyjątkiem elementów z klasą unblock-scroll.
        const rows = createElement('div', 'zl-rows unblock-scroll');
        const summary = createElement('div', 'zl-summary');
        summary.append(totalBox, missing, rows);
        const page = createElement('div', 'zl-page');
        page.append(deputy, summary);

        const resizeHandle = createElement('div', 'zl-resize');
        resizeHandle.title = 'Przeciągnij, aby zmienić rozmiar. Dwuklik przywraca domyślny.';

        panel.append(head, page, updateInfo.note(), resizeHandle);
        document.body.appendChild(panel);
        view = { deputy, summary, total, missing, rows };
        installDragging(head);
        installResizing(resizeHandle);
        render();
    }

    // Wysokość 0 oznacza domyślny rozmiar: panel dopasowuje się do listy, a ta ma limit wysokości z CSS.
    function setPanelSize(width, height) {
        panel.style.width = width + 'px';
        panel.style.height = height ? height + 'px' : '';
        view.rows.style.maxHeight = height ? 'none' : '';
    }

    function installResizing(handle) {
        const maxWidth = () => window.innerWidth - parseInt(panel.style.left, 10) - 4;
        const maxHeight = () => window.innerHeight - parseInt(panel.style.top, 10) - 4;
        const clampWidth = width => Math.max(PANEL_MIN_WIDTH, Math.min(maxWidth(), width));
        const clampHeight = height => Math.max(PANEL_MIN_HEIGHT, Math.min(maxHeight(), height));
        const saveSize = (width, height) => {
            try { localStorage.setItem(PANEL_SIZE_KEY, JSON.stringify({ width, height })); } catch (e) { /* tylko wygoda */ }
        };

        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(PANEL_SIZE_KEY)); } catch (e) { /* domyślny rozmiar */ }
        if (saved && saved.width) setPanelSize(clampWidth(saved.width), saved.height ? clampHeight(saved.height) : 0);

        let resize = null;
        handle.addEventListener('mousedown', event => {
            resize = { x: event.clientX, y: event.clientY, width: panel.offsetWidth, height: panel.offsetHeight };
            event.preventDefault();
        });
        document.addEventListener('mousemove', event => {
            if (!resize) return;
            setPanelSize(
                clampWidth(resize.width + event.clientX - resize.x),
                clampHeight(resize.height + event.clientY - resize.y)
            );
        });
        document.addEventListener('mouseup', () => {
            if (!resize) return;
            resize = null;
            saveSize(parseInt(panel.style.width, 10), parseInt(panel.style.height, 10));
        });
        handle.addEventListener('dblclick', () => {
            setPanelSize(PANEL_DEFAULT_WIDTH, 0);
            saveSize(PANEL_DEFAULT_WIDTH, 0);
        });
    }

    function installDragging(head) {
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(PANEL_POSITION_KEY)) || {}; } catch (e) { /* domyślna pozycja */ }
        const clampLeft = left => Math.max(0, Math.min(window.innerWidth - 60, left));
        const clampTop = top => Math.max(0, Math.min(window.innerHeight - 30, top));
        panel.style.left = clampLeft(saved.left ?? 520) + 'px';
        panel.style.top = clampTop(saved.top ?? 200) + 'px';

        let drag = null;
        head.addEventListener('mousedown', event => {
            if (event.target.classList.contains('zl-btn')) return;
            drag = { dx: event.clientX - panel.offsetLeft, dy: event.clientY - panel.offsetTop };
            event.preventDefault();
        });
        document.addEventListener('mousemove', event => {
            if (!drag) return;
            panel.style.left = clampLeft(event.clientX - drag.dx) + 'px';
            panel.style.top = clampTop(event.clientY - drag.dy) + 'px';
        });
        document.addEventListener('mouseup', () => {
            if (!drag) return;
            drag = null;
            localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify({ left: panel.offsetLeft, top: panel.offsetTop }));
        });
    }

    document.addEventListener('keydown', event => {
        if (!event.altKey || event.repeat || event.key.toLowerCase() !== 'z') return;
        event.preventDefault();
        togglePanel();
    });

    /* ================== ŚLEDZENIE ZŁOTA ================== */

    // Błąd dodatku nie może przerwać obsługi odpowiedzi serwera przez grę.
    function safely(action, value) {
        try { action(value); } catch (e) { console.warn('[Złoto na koncie]', e); }
    }

    function installGoldTracking() {
        const updates = hero().onUpdate;
        const onGold = updates.gold;
        updates.gold = function (value) {
            safely(recordHeroGold, value);
            return onGold.apply(this, arguments);
        };

        // Depo klanowe ma osobne on_clan_depo, więc nie trafia do sumy.
        const dispatcher = window.Engine.communication.dispatcher;
        const onDepo = dispatcher.on_depo;
        dispatcher.on_depo = function (data) {
            safely(recordDepoGold, data && data.gold);
            return onDepo.apply(this, arguments);
        };
    }

    /* ================== WIDGET ================== */
    // credit to https://github.com/nerthus-margonem/nerthusaddon

    function installWidget() {
        const Engine = window.Engine;

        const addToDefaultSet = () => Engine.widgetManager.addKeyToDefaultWidgetSet(
            WIDGET_KEY,
            DEFAULT_WIDGET_POSITION[0],
            DEFAULT_WIDGET_POSITION[1],
            ADDON_NAME,
            'green',
            togglePanel
        );

        const createButton = () => {
            if (Engine.interfaceStart && Object.keys(Engine.widgetManager.getDefaultWidgetSet()).includes(WIDGET_KEY)) {
                const saved = Engine.serverStorage.get(Engine.widgetManager.getPathToHotWidgetVersion());
                const position = (saved && saved[WIDGET_KEY]) || DEFAULT_WIDGET_POSITION;
                Engine.widgetManager.createOneWidget(WIDGET_KEY, { [WIDGET_KEY]: position }, true, []);
                Engine.widgetManager.setEnableDraggingButtonsWidget(false);
                safely(updateWidgetTip);
            } else setTimeout(createButton, 500);
        };

        const addWidgetButtons = Engine.widgetManager.addWidgetButtons;
        Engine.widgetManager.addWidgetButtons = function (additionalBarHide) {
            addWidgetButtons.call(Engine.widgetManager, additionalBarHide);
            addToDefaultSet();
            createButton();
            Engine.widgetManager.addWidgetButtons = addWidgetButtons;
        };

        if (Engine.interfaceStart) {
            addToDefaultSet();
            createButton();
        }
    }

    /* ================== START ================== */

    function start() {
        world = window.Engine.worldConfig.getWorldName();
        if (!isDeputy()) {
            try { localStorage.setItem(lastAccountKey(), hero().d.account); } catch (e) { /* tylko wygoda */ }
        }
        buildPanel();
        safely(recordHeroGold, hero().d.gold);
        installGoldTracking();
        // Zmiany z innych kart gry, wczytanie listy postaci oraz wiek danych.
        window.addEventListener('storage', event => {
            if (event.key && event.key.startsWith('zloto_')) refresh();
        });
        safely(updateWidgetTip);
        setInterval(refresh, REFRESH_MS);
    }

    function waitFor(isReady, callback) {
        if (isReady()) callback();
        else setTimeout(() => waitFor(isReady, callback), 50);
    }

    waitFor(() => window.Engine && window.Engine.widgetManager && window.Engine.widgetManager.addWidgetButtons, installWidget);
    waitFor(() => {
        const Engine = window.Engine;
        return document.head && document.body && Engine && Engine.hero && Engine.hero.d && Engine.hero.d.id && Engine.hero.d.account
            && Engine.hero.onUpdate && Engine.communication && Engine.communication.dispatcher
            && Engine.worldConfig && Engine.worldConfig.getWorldName();
    }, start);
})();
