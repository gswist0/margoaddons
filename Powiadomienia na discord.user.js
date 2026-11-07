// ==UserScript==
// @name         Powiadomienia na discord
// @version      1.2
// @description  Herosy/tytani, grzybki, wrogowie i legendy na discord - jeden dodatek ze wspólnym menu
// @author       Bancewald
// @match        *.margonem.pl/
// @grant        none
// ==/UserScript==

// Połączone stare dodatki: Auto heroski, Auto grzybki, Info o wrogach, Legi na discord.
// Klucze localStorage są te same co w starych dodatkach, więc ustawienia przechodzą automatycznie.

(() => {
    'use strict';

    /* ================== INFORMACJA O NOWEJ WERSJI ================== */
    // Lista aktualnych wersji jest w pliku versions.json na GitHubie. Dodatek NIE aktualizuje się sam,
    // tylko pokazuje na dole swojego okna informację z linkiem do nowej wersji.
    const updateInfo = (() => {
        const ID = 'powiadomienia-na-discord';
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

    if (window.__powiadomieniaDiscord) return;
    window.__powiadomieniaDiscord = true;

    const WIDGET_KEY = 'powiadomieniadc';
    const WIDGET_ICON = 'https://raw.githubusercontent.com/gswist0/margoaddons/refs/heads/main/dc_clear.png';
    const DEFAULT_WIDGET_POSITION = [3, 'bottom-right-additional'];
    const PANEL_POSITION_KEY = 'powiadomienia_dc_pozycja';
    const ENABLED_KEY_PREFIX = 'powiadomienia_dc_wlaczone_';

    const TABS = [
        {
            id: 'heroski', label: 'Herosy', hotkey: 'h', fields: [
                { key: 'webhook_heroski', label: 'Link do webhooka' },
                { key: 'ping_here', label: 'Ping Here', type: 'checkbox' },
                { key: 'ping_everyone', label: 'Ping Everyone', type: 'checkbox' },
                { key: 'special_heros', label: 'Specjalny ping dla herosów' },
                { key: 'special_tytan', label: 'Specjalny ping dla tytanów' },
                { key: 'tytan_webhook', label: 'Osobny webhook dla tytanów' },
            ],
        },
        {
            id: 'grzybki', label: 'Grzybki', hotkey: 'g', fields: [
                { key: 'webhook_grzybki', label: 'Link do webhooka' },
                { key: 'ping_hereg', label: 'Ping Here', type: 'checkbox' },
                { key: 'ping_everyoneg', label: 'Ping Everyone', type: 'checkbox' },
            ],
        },
        {
            id: 'wrogowie', label: 'Wrogowie', hotkey: 'j', fields: [
                { key: 'webhook_wrogowie', label: 'Link do webhooka' },
                { key: 'klany_wrogowie', label: 'Nazwy klanów po przecinku' },
                { key: 'nicki_wrogowie', label: 'Nicki po przecinku' },
                { key: 'wrogowie_postaci', label: 'Wysyłaj wrogów postaci', type: 'checkbox' },
                { key: 'wrogowie_klanu', label: 'Wysyłaj wrogów klanu', type: 'checkbox' },
            ],
        },
        {
            id: 'legi', label: 'Legi', hotkey: 'l', fields: [
                { key: 'webhook_legi', label: 'Link do webhooka' },
            ],
        },
    ];

    const HERO_TRACKERS = ['Tropiciel Herosów', 'Wtajemniczony Tropiciel Herosów', 'Doświadczony Tropiciel Herosów'];
    const MUSHROOMS = ['Ogromna płomiennica tląca', 'Ogromna dzwonkówka tarczowata', 'Ogromny bulwiak pospolity', 'Ogromny mroźlarz', 'Ogromny szpicak ponury'];
    const EMBED_COLOR = 8388608;
    // SocietyData.RELATION z silnika gry
    const RELATION_ENEMY = 3;
    const RELATION_CLAN_ENEMY = 6;
    const LOOT_LOCATIONS = ['l', 'k']; // zwykły i osobisty loot

    /* ================== USTAWIENIA ================== */

    const ALL_FIELDS = TABS.flatMap(tab => tab.fields);
    const cfg = {};
    for (const { key, type } of ALL_FIELDS) {
        const stored = localStorage.getItem(key);
        cfg[key] = type === 'checkbox' ? stored === 'true' : (stored ?? '');
    }

    // sekcje są domyślnie włączone; wyłączenie zapisuje się od razu, bez przycisku "Zapisz"
    const enabled = {};
    for (const { id } of TABS) enabled[id] = localStorage.getItem(ENABLED_KEY_PREFIX + id) !== 'false';

    const parseList = text => text.split(',').map(entry => entry.trim()).filter(Boolean);

    const pingContent = (here, everyone) => [here && '@here', everyone && '@everyone'].filter(Boolean).join(' ');

    /* ================== MENU ================== */

    let panel = null;
    let activeTab = TABS[0].id;

    function selectTab(id) {
        activeTab = id;
        for (const el of panel.querySelectorAll('[data-tab]')) {
            el.classList.toggle('active', el.dataset.tab === id);
        }
    }

    function togglePanel() {
        if (panel) panel.hidden = !panel.hidden;
    }

    function openTabOrClose(id) {
        if (!panel) return;
        if (!panel.hidden && activeTab === id) {
            panel.hidden = true;
            return;
        }
        selectTab(id);
        panel.hidden = false;
    }

    function buildField(field) {
        const row = document.createElement('div');
        row.className = field.type === 'checkbox' ? 'pdc-field pdc-check' : 'pdc-field';

        const input = document.createElement('input');
        input.id = `pdc-${field.key}`;
        input.type = field.type || 'text';
        if (field.type === 'checkbox') input.checked = cfg[field.key];
        else input.value = cfg[field.key];

        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.textContent = field.label;

        row.append(...(field.type === 'checkbox' ? [input, label] : [label, input]));
        return row;
    }

    function buildToggle(tabId, tabButton, fields) {
        const toggle = document.createElement('div');
        toggle.className = 'pdc-btn pdc-toggle';

        const render = () => {
            toggle.textContent = enabled[tabId] ? 'Włączone' : 'Wyłączone';
            toggle.classList.toggle('on', enabled[tabId]);
            tabButton.classList.toggle('off', !enabled[tabId]);
            fields.disabled = !enabled[tabId];
        };

        toggle.addEventListener('click', () => {
            enabled[tabId] = !enabled[tabId];
            localStorage.setItem(ENABLED_KEY_PREFIX + tabId, enabled[tabId]);
            render();
        });

        render();
        return toggle;
    }

    function saveSettings(status) {
        for (const { key, type } of ALL_FIELDS) {
            const input = document.getElementById(`pdc-${key}`);
            cfg[key] = type === 'checkbox' ? input.checked : input.value.trim();
            localStorage.setItem(key, cfg[key]);
        }
        status.textContent = 'Zapisano';
        setTimeout(() => { status.textContent = ''; }, 2000);
    }

    function buildPanel() {
        const style = document.createElement('style');
        style.textContent = `
            .main-buttons-container .widget-button .icon.${WIDGET_KEY} { background-image: url("${WIDGET_ICON}"); background-position: 0; }
            #pdc-panel { position: fixed; z-index: 9999; width: 300px; display: flex; flex-direction: column; background: #1b1712; color: #e8dcc0; border: 2px solid #6b5a33; border-radius: 6px; font: 12px/1.35 Arial, sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,.6); user-select: none; }
            #pdc-panel, #pdc-panel * { box-sizing: border-box; }
            #pdc-panel[hidden] { display: none; }
            #pdc-panel .pdc-head { display: flex; align-items: center; gap: 6px; padding: 5px 8px; cursor: move; background: linear-gradient(#3a2f1a, #2a2212); border-bottom: 1px solid #6b5a33; border-radius: 4px 4px 0 0; }
            #pdc-panel .pdc-title { flex: 1; font-weight: bold; color: #f1d58a; }
            #pdc-panel .pdc-btn { cursor: pointer; background: #4a3d22; border: 1px solid #7a6639; color: #f1d58a; border-radius: 3px; padding: 0 6px; line-height: 18px; font-size: 12px; }
            #pdc-panel .pdc-btn:hover { background: #5d4c2a; }
            #pdc-panel .pdc-tabs { display: flex; gap: 4px; padding: 6px 8px; background: #2a2212; border-bottom: 1px solid #4a3d22; }
            #pdc-panel .pdc-tabs .pdc-btn { flex: 1; text-align: center; }
            #pdc-panel .pdc-tabs .pdc-btn.active { background: #7a6639; color: #fff; }
            #pdc-panel .pdc-page { display: none; padding: 8px 8px 2px; }
            #pdc-panel .pdc-page.active { display: block; }
            #pdc-panel .pdc-field { margin-bottom: 8px; }
            #pdc-panel .pdc-field label { display: block; margin-bottom: 2px; color: #b9a56a; }
            #pdc-panel .pdc-field input[type="text"] { display: block; width: 100%; height: 22px; margin: 0; padding: 2px 5px; color: #e8dcc0; background: #2a2212; border: 1px solid #4a3d22; border-radius: 3px; font: 12px/1.35 Arial, sans-serif; outline: none; user-select: text; }
            #pdc-panel .pdc-field input[type="text"]:focus { border-color: #8a7340; }
            #pdc-panel .pdc-field.pdc-check { display: flex; align-items: center; gap: 5px; }
            #pdc-panel .pdc-field.pdc-check label { margin: 0; color: #e8dcc0; cursor: pointer; }
            #pdc-panel .pdc-field input[type="checkbox"] { margin: 0; accent-color: #7a6639; cursor: pointer; }
            #pdc-panel .pdc-foot { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-top: 1px solid #2c2618; }
            #pdc-panel .pdc-status { color: #9fd18b; }
            #pdc-panel .pdc-tabs .pdc-btn.off { opacity: .55; text-decoration: line-through; }
            #pdc-panel .pdc-toggle { margin-bottom: 8px; text-align: center; color: #d98a7a; }
            #pdc-panel .pdc-toggle.on { color: #9fd18b; }
            #pdc-panel .pdc-fields { min-width: 0; margin: 0; padding: 0; border: 0; }
            #pdc-panel .pdc-fields:disabled { opacity: .4; filter: grayscale(1); }
            #pdc-panel .pdc-fields:disabled label, #pdc-panel .pdc-fields:disabled input { cursor: not-allowed; }
        `;
        document.head.appendChild(style);

        panel = document.createElement('div');
        panel.id = 'pdc-panel';
        panel.hidden = true;

        const head = document.createElement('div');
        head.className = 'pdc-head';
        const title = document.createElement('span');
        title.className = 'pdc-title';
        title.textContent = 'Powiadomienia na discord';
        const close = document.createElement('span');
        close.className = 'pdc-btn';
        close.title = 'Zamknij';
        close.textContent = '×';
        close.addEventListener('click', () => { panel.hidden = true; });
        head.append(title, close);

        const tabBar = document.createElement('div');
        tabBar.className = 'pdc-tabs';
        panel.append(head, tabBar);

        for (const tab of TABS) {
            const button = document.createElement('span');
            button.className = 'pdc-btn';
            button.dataset.tab = tab.id;
            button.textContent = tab.label;
            button.title = `Alt + ${tab.hotkey.toUpperCase()}`;
            button.addEventListener('click', () => selectTab(tab.id));
            tabBar.appendChild(button);

            const page = document.createElement('div');
            page.className = 'pdc-page';
            page.dataset.tab = tab.id;
            const fields = document.createElement('fieldset');
            fields.className = 'pdc-fields';
            fields.append(...tab.fields.map(buildField));
            page.append(buildToggle(tab.id, button, fields), fields);
            panel.appendChild(page);
        }

        const foot = document.createElement('div');
        foot.className = 'pdc-foot';
        const save = document.createElement('span');
        save.className = 'pdc-btn pdc-save';
        save.textContent = 'Zapisz';
        const status = document.createElement('span');
        status.className = 'pdc-status';
        save.addEventListener('click', () => saveSettings(status));
        foot.append(save, status);
        panel.appendChild(foot);
        panel.appendChild(updateInfo.note());

        document.body.appendChild(panel);
        selectTab(activeTab);
        installDragging(head);
    }

    function installDragging(head) {
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(PANEL_POSITION_KEY)) || {}; } catch (e) { /* domyślna pozycja */ }
        const clampLeft = left => Math.max(0, Math.min(window.innerWidth - 60, left));
        const clampTop = top => Math.max(0, Math.min(window.innerHeight - 30, top));
        panel.style.left = clampLeft(saved.left ?? 200) + 'px';
        panel.style.top = clampTop(saved.top ?? 200) + 'px';

        let drag = null;
        head.addEventListener('mousedown', event => {
            if (event.target.classList.contains('pdc-btn')) return;
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
        if (!event.altKey) return;
        const tab = TABS.find(t => t.hotkey === event.key.toLowerCase());
        if (!tab) return;
        event.preventDefault();
        openTabOrClose(tab.id);
    });

    /* ================== WIDGET ================== */
    // credit to https://github.com/nerthus-margonem/nerthusaddon

    function installWidget() {
        const Engine = window.Engine;

        const addToDefaultSet = () => Engine.widgetManager.addKeyToDefaultWidgetSet(
            WIDGET_KEY,
            DEFAULT_WIDGET_POSITION[0],
            DEFAULT_WIDGET_POSITION[1],
            'Powiadomienia na discord',
            'green',
            togglePanel
        );

        const createButton = () => {
            if (Engine.interfaceStart && Object.keys(Engine.widgetManager.getDefaultWidgetSet()).includes(WIDGET_KEY)) {
                const saved = Engine.serverStorage.get(Engine.widgetManager.getPathToHotWidgetVersion());
                const position = (saved && saved[WIDGET_KEY]) || DEFAULT_WIDGET_POSITION;
                Engine.widgetManager.createOneWidget(WIDGET_KEY, { [WIDGET_KEY]: position }, true, []);
                Engine.widgetManager.setEnableDraggingButtonsWidget(false);
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

    /* ================== DISCORD ================== */

    // Zwraca false, gdy nie ma ustawionego webhooka (pusty adres wysłałby POST na stronę gry).
    function sendToDiscord(url, payload) {
        if (!url) return false;
        const request = new XMLHttpRequest();
        request.open('POST', url, true);
        request.setRequestHeader('Content-Type', 'application/json');
        request.onload = () => {
            if (request.status >= 300) console.warn(`[Powiadomienia] discord odrzucił wiadomość (${request.status})`, request.responseText);
        };
        request.onerror = () => console.warn('[Powiadomienia] nie udało się połączyć z discordem');
        request.send(JSON.stringify(payload));
        return true;
    }

    function embed(title) {
        return [{ color: EMBED_COLOR, title, timestamp: new Date().toISOString() }];
    }

    function alertHero(npc) {
        const { hero, map } = window.Engine;
        const isTitan = npc.getKind() === 'tytan';
        const text = isTitan ? 'tytanka' : 'heroska';
        const special = isTitan ? cfg.special_tytan : cfg.special_heros;
        const ping = special || pingContent(cfg.ping_here, cfg.ping_everyone);
        return sendToDiscord((isTitan && cfg.tytan_webhook) || cfg.webhook_heroski, {
            content: `${ping} Znalazłem ${text}!`,
            username: 'Potężny wykrywacz',
            avatar_url: `https://micc.garmory-cdn.cloud/obrazki/npc/${npc.d.icon}`,
            embeds: embed(`${hero.nick} (${hero.d.lvl}lvl) znalazł ${text} ${npc.d.nick} (${npc.d.lvl}) na mapie ${map.d.name} (${npc.d.x},${npc.d.y})!`),
        });
    }

    function alertMushroom(npc) {
        const { hero, map } = window.Engine;
        const time = npc.d.killSeconds;
        const ping = pingContent(cfg.ping_hereg, cfg.ping_everyoneg);
        return sendToDiscord(cfg.webhook_grzybki, {
            content: `${ping} Znalazłem grzyba!`,
            username: 'Potężny wykrywacz',
            avatar_url: `https://micc.garmory-cdn.cloud/obrazki/npc/${npc.d.icon}`,
            embeds: embed(`${hero.nick} (${hero.d.lvl}lvl) znalazł grzyba ${npc.d.nick} (${npc.d.lvl}) na mapie ${map.d.name} (${npc.d.x},${npc.d.y}), pozostało ${Math.floor(time / 60)} minut ${time % 60} sekund!`),
        });
    }

    function alertEnemy(other) {
        const { hero, map } = window.Engine;
        return sendToDiscord(cfg.webhook_wrogowie, {
            content: `${hero.nick}(${hero.d.lvl}lvl) widzi wroga`,
            username: 'Potężny informator',
            avatar_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Achtung.svg/220px-Achtung.svg.png',
            embeds: embed(`${other.d.nick} (${other.d.lvl}lvl) na mapie ${map.d.name} (${other.d.x},${other.d.y})!`),
        });
    }

    function alertLegendary(item) {
        return sendToDiscord(cfg.webhook_legi, {
            content: `Spadla lega o taka ${item.name}!`,
            username: 'Potężny legendziarz',
            avatar_url: `https://micc.garmory-cdn.cloud/obrazki/itemy/${item.icon}`,
            embeds: embed(`${window.Engine.hero.nick} lotł lege o taką ${item.name}!`),
        });
    }

    /* ================== NASŁUCHIWANIE ================== */

    function installListeners() {
        const Engine = window.Engine;
        const calledHeroes = new Set();
        const calledMushrooms = new Set();
        const sentItems = new Set();

        window.API.addCallbackToEvent('newNpc', npc => {
            const kind = npc.getKind();
            const { nick, id } = npc.d;

            if (enabled.heroski && (kind === 'tytan' || kind === 'heros' || HERO_TRACKERS.includes(nick)) && !calledHeroes.has(nick)) {
                calledHeroes.add(nick);
                if (alertHero(npc)) message(`Wołam na ${nick}`);
            }

            if (enabled.grzybki && MUSHROOMS.includes(nick) && !calledMushrooms.has(id)) {
                calledMushrooms.add(id);
                if (alertMushroom(npc)) message(`Wołam na ${nick}`);
            }
        });

        window.API.addCallbackToEvent('newOther', other => {
            if (!enabled.wrogowie || Engine.map.d.pvp == 0) return;
            const clan = other.d.clan && other.d.clan.name;
            const relation = other.d.relation;
            if (parseList(cfg.nicki_wrogowie).includes(other.d.nick)
                || (clan && parseList(cfg.klany_wrogowie).includes(clan))
                || (cfg.wrogowie_postaci && relation === RELATION_ENEMY)
                || (cfg.wrogowie_klanu && relation === RELATION_CLAN_ENEMY)) {
                alertEnemy(other);
            }
        });

        const onItem = item => {
            if (item.itemTypeName !== 'legendary') return;
            // hid to stały identyfikator przedmiotu; id lootu gra może używać ponownie w kolejnych walkach
            const key = item.hid || item;
            if (sentItems.has(key)) return;
            sentItems.add(key);
            // przedmioty są oznaczane jako wysłane także przy wyłączonej sekcji, żeby po włączeniu nie poleciały stare legi
            console.log(`[Powiadomienia] legenda: ${item.name} (id ${item.id}, hid ${item.hid}, lokacja ${item.loc}, sekcja ${enabled.legi ? 'włączona' : 'wyłączona'}, webhook ${cfg.webhook_legi ? 'ustawiony' : 'pusty'})`);
            if (enabled.legi) alertLegendary(item);
        };

        // Podpięcie przed callbackami gry: błąd w którymś z nich (np. w jej powiadomieniu o legendzie)
        // przerwałby pętlę i nasz callback by się nie wykonał. Łapie też przedmioty, które znikają między odczytami niżej.
        const newItemInLocation = Engine.items.newItemInLocation;
        Engine.items.newItemInLocation = function (location, item, ...rest) {
            if (LOOT_LOCATIONS.includes(location)) {
                try { onItem(item); } catch (error) { console.error('[Powiadomienia] błąd obsługi przedmiotu', error); }
            }
            return newItemInLocation.call(this, location, item, ...rest);
        };

        // przedmioty, które były już w lootcie przed startem dodatku lub nie przeszły przez newItemInLocation
        setInterval(() => LOOT_LOCATIONS.forEach(location => Engine.items.fetchLocationItems(location).forEach(onItem)), 100);
    }

    /* ================== START ================== */

    function waitFor(isReady, callback) {
        if (isReady()) callback();
        else setTimeout(() => waitFor(isReady, callback), 50);
    }

    waitFor(() => document.querySelector('.game-window-positioner') && document.head, buildPanel);

    waitFor(() => window.Engine && window.Engine.widgetManager && window.Engine.widgetManager.addWidgetButtons, installWidget);

    waitFor(() => {
        const Engine = window.Engine;
        return Engine && Engine.npcs && Engine.npcs.check
            && Engine.others && Engine.others.check
            && Engine.items && Engine.items.newItemInLocation
            && window.API;
    }, installListeners);
})();
