// ==UserScript==
// @name         Lepszy super sprzedawca
// @version      1.0
// @description  Poprawki super sprzedawcy w sklepie (przyciski 1/2/3): lista nazw przedmiotów, których nigdy nie wrzuca do koszyka (też PPM na przedmiocie), pomijanie ulepszonych przedmiotów i informacja ile pominięto.
// @match        https://*.margonem.pl/
// @match        https://*.margonem.com/
// @author       Bancewald
// @grant        none
// @run-at       document-idle
// ==/UserScript==

// Dodatek nie wysyła żadnych zapytań do serwera gry - tylko nie pozwala grze wrzucić wybranych przedmiotów do koszyka.

(() => {
    'use strict';

    /* ================== INFORMACJA O NOWEJ WERSJI ================== */
    // Lista aktualnych wersji jest w pliku versions.json na GitHubie. Dodatek NIE aktualizuje się sam,
    // tylko pokazuje na dole swojego okna informację z linkiem do nowej wersji.
    const updateInfo = (() => {
        const ID = 'lepszy-super-sprzedawca';
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

    updateInfo.toast('Lepszy super sprzedawca');

    /* ================== USTAWIENIA ================== */

    // Lista jest wspólna dla wszystkich postaci w tej przeglądarce.
    const SETTINGS_KEY = 'margoaddons_super_sprzedawca';
    const LOG = '[Lepszy super sprzedawca]';
    const MENU_ADD = 'Ignoruj w super sprzedawcy';
    const MENU_REMOVE = 'Przestań ignorować w super sprzedawcy';
    // kłódka (przedmioty chronione przed sprzedażą) w kolorze ikonek gry
    const LOCK_ICON = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">'
        + '<path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="#f3ead2" stroke-width="1.8"/>'
        + '<rect x="2.5" y="7" width="11" height="8" rx="1.5" fill="#f3ead2" stroke="#2b2416" stroke-width=".8"/>'
        + '<rect x="7.2" y="9.3" width="1.6" height="3.4" rx=".8" fill="#2b2416"/></svg>');

    const DEFAULT_SETTINGS = {
        ignored: [],          // nazwy przedmiotów (wielkość liter bez znaczenia, * = dowolny ciąg znaków)
        skipEnhanced: true,   // pomijaj przedmioty ulepszone w rzemiośle (+1 ... +5)
        report: false,         // komunikat ile przedmiotów pominięto
        panel: { left: null, top: null },
    };

    let settings = loadSettings();

    function loadSettings() {
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { /* uszkodzony zapis */ }
        return {
            ...DEFAULT_SETTINGS,
            ...saved,
            ignored: Array.isArray(saved.ignored) ? saved.ignored.filter(n => typeof n === 'string' && n.trim()) : [],
            skipEnhanced: saved.skipEnhanced !== undefined ? !!saved.skipEnhanced : DEFAULT_SETTINGS.skipEnhanced,
            report: saved.report !== undefined ? !!saved.report : DEFAULT_SETTINGS.report,
            panel: { ...DEFAULT_SETTINGS.panel, ...(saved.panel || {}) },
        };
    }

    function saveSettings() {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* tylko w tej sesji */ }
    }

    /* ================== DOPASOWANIE NAZW ================== */

    const normalize = text => String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();

    let matchers = null;
    function getMatchers() {
        if (matchers) return matchers;
        matchers = settings.ignored.map(entry => {
            const clean = normalize(entry);
            if (!clean.includes('*')) return name => name === clean;
            const escaped = clean.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
            const re = new RegExp(`^${escaped}$`);
            return name => re.test(name);
        });
        return matchers;
    }

    const isNameIgnored = name => {
        const clean = normalize(name);
        return getMatchers().some(match => match(clean));
    };

    // Wpis dokładnie odpowiadający nazwie (bez gwiazdek) - tylko taki można zdjąć z menu PPM.
    const exactEntryIndex = name => settings.ignored.findIndex(entry => normalize(entry) === normalize(name));

    function setIgnored(list) {
        const seen = new Set();
        settings.ignored = list.map(n => n.replace(/\s+/g, ' ').trim()).filter(n => {
            const key = normalize(n);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        matchers = null;
        saveSettings();
        renderList();
    }

    const addIgnored = name => {
        if (exactEntryIndex(name) < 0) setIgnored([...settings.ignored, name]);
        notify(`Super sprzedawca pomija teraz: ${name}`);
    };

    const removeIgnored = name => {
        const index = exactEntryIndex(name);
        if (index < 0) return;
        setIgnored(settings.ignored.filter((_, i) => i !== index));
        notify(`Super sprzedawca znowu może sprzedać: ${name}`);
    };

    function notify(text) {
        try { if (typeof window.message === 'function') window.message(text); } catch (e) { /* tylko komunikat */ }
    }

    /* ================== FILTR SUPER SPRZEDAWCY ================== */

    // Dlaczego przedmiot nie powinien trafić do koszyka (null = gra może go sprzedać).
    function skipReason(item) {
        if (!item) return null;
        if (item.name && isNameIgnored(item.name)) return 'name';
        if (settings.skipEnhanced) {
            let stats = null;
            try { stats = item.parseStats(); } catch (e) { /* brak statystyk */ }
            if (stats && 'enhancement_upgrade_lvl' in stats) return 'enhanced';
        }
        return null;
    }

    // Gra wybiera przedmioty w Shop.greatMerchant i każdy wrzuca przez shop.basket.sellItem(item, true).
    // Na czas tego wywołania podmieniamy sellItem, więc reszta warunków gry (zaznaczone opcje,
    // wybrana torba, przedmioty nie do sprzedania) działa bez zmian. Ręczne wrzucanie nie jest filtrowane.
    function patchShop(shop) {
        if (!shop || shop.__ssPatched || typeof shop.greatMerchant !== 'function') return;
        shop.__ssPatched = true;
        const greatMerchant = shop.greatMerchant;
        shop.greatMerchant = function () {
            const basket = shop.basket;
            if (!basket || typeof basket.sellItem !== 'function') return greatMerchant.apply(this, arguments);
            const sellItem = basket.sellItem;
            const skipped = { name: 0, enhanced: 0 };
            basket.sellItem = function (item, auto) {
                let reason = null;
                try { reason = auto ? skipReason(item) : null; } catch (e) { console.warn(LOG, 'błąd filtra', e); }
                if (reason) {
                    skipped[reason]++;
                    return undefined;
                }
                return sellItem.apply(this, arguments);
            };
            try {
                return greatMerchant.apply(this, arguments);
            } finally {
                basket.sellItem = sellItem;
                const parts = [];
                if (skipped.name) parts.push(`${skipped.name} z listy ignorowanych`);
                if (skipped.enhanced) parts.push(`${skipped.enhanced} ulepszonych (+X)`);
                if (settings.report && parts.length) notify(`Super sprzedawca pominął: ${parts.join(', ')}`);
            }
        };
        addShopButton(shop);
    }

    // Przycisk obok 1/2/3 w oknie sklepu.
    function addShopButton(shop, tries = 0) {
        const box = shop.wnd && shop.wnd.$ && shop.wnd.$.find('.great-merchamp')[0];
        if (!box || !box.querySelector('.grab-bag-1')) {
            if (tries < 40 && window.Engine.shop === shop) setTimeout(() => addShopButton(shop, tries + 1), 100);
            return;
        }
        if (box.querySelector('.ss-shop-btn')) return;
        // Taki sam przycisk jak zębatka gry: ukryta etykieta trzyma rozmiar, w środku ikonka.
        const btn = document.createElement('div');
        btn.className = 'button green small btn-num ss-shop-btn';
        btn.innerHTML = '<div class="background"></div><div class="label">0</div><div class="ss-lock"></div>';
        const tip = 'Lepszy super sprzedawca - przedmioty pomijane przy 1/2/3 <b>[Alt + S]</b>';
        if (window.$ && window.$.fn && typeof window.$.fn.tip === 'function') window.$(btn).tip(tip);
        else btn.title = 'Lepszy super sprzedawca (Alt + S)';
        btn.addEventListener('click', event => {
            event.stopPropagation();
            togglePanel();
        });
        // przed przyciskiem konfiguracji gry (ostatni w rzędzie)
        const config = box.querySelector('.config');
        const configBtn = config && config.closest('.button');
        if (configBtn && configBtn.parentNode === box) box.insertBefore(btn, configBtn);
        else box.appendChild(btn);
        fitRow(box);
    }

    // Rząd w oknie sklepu jest dopasowany do 4 przycisków. Jeśli piąty przenosi zębatkę do nowej linii,
    // zmniejszamy odstępy (a w ostateczności szerokość) przycisków w tym rzędzie.
    function fitRow(box, tries = 0) {
        const buttons = Array.from(box.children).filter(node => node.classList.contains('button'));
        if (buttons.length < 2) return;
        if (!box.offsetWidth) {
            if (tries < 50) setTimeout(() => fitRow(box, tries + 1), 100);
            return;
        }
        const oneLine = () => buttons.every(node => node.offsetTop === buttons[0].offsetTop);
        if (oneLine()) return;

        const css = getComputedStyle(box);
        const avail = box.clientWidth - (parseFloat(css.paddingLeft) || 0) - (parseFloat(css.paddingRight) || 0);
        const count = buttons.length;
        const width = buttons[0].offsetWidth;
        const apply = (gap, w) => buttons.forEach((node, i) => {
            node.style.marginLeft = i ? `${gap}px` : '0';
            node.style.marginRight = '0';
            if (w) {
                node.style.width = `${w}px`;
                node.style.minWidth = `${w}px`;
            }
        });

        const gap = Math.floor((avail - count * width) / (count - 1));
        if (gap >= 2) apply(Math.min(gap, 6), null);
        else apply(2, Math.floor((avail - 2 * (count - 1)) / count));
        if (!oneLine()) console.warn(LOG, 'przyciski 1/2/3 nie mieszczą się w jednym rzędzie', { avail, width, count });
    }

    function watchShop() {
        setInterval(() => {
            const shop = window.Engine.shop;
            if (shop) {
                try { patchShop(shop); } catch (e) { console.warn(LOG, 'nie udało się podpiąć sklepu', e); }
            }
        }, 200);
    }

    /* ================== MENU PPM ================== */

    // Przedmiot z plecaka, w który kliknięto PPM (gra pokazuje menu przedmiotu z nagłówkiem = nazwą).
    function bagItemFromEvent(event) {
        const target = event && (event.target || (event.originalEvent && event.originalEvent.target));
        if (!target || !target.closest) return null;
        const Engine = window.Engine;
        const items = Engine.heroEquipment && Engine.heroEquipment.getHItems ? Engine.heroEquipment.getHItems() : null;
        if (!items || !Engine.items || typeof Engine.items.getAllViewsById !== 'function') return null;
        // W torbie leży kopia ikonki (widok BAG_VIEW), nie item.$ - szukamy wśród wszystkich widoków przedmiotu.
        for (const id in items) {
            const item = items[id];
            if (!item) continue;
            let views = [];
            try { views = Engine.items.getAllViewsById(id) || []; } catch (e) { /* brak widoków */ }
            for (const view of views) {
                const node = view && (view.jquery ? view[0] : view);
                if (node && node.contains && node.contains(target)) return item;
            }
        }
        return null;
    }

    function installMenuHook() {
        const ui = window.Engine.interface;
        const showPopupMenu = ui.showPopupMenu;
        ui.showPopupMenu = function (items, event, options) {
            try {
                if (Array.isArray(items) && options && options.header) {
                    const item = bagItemFromEvent(event);
                    if (item && item.name) {
                        const name = item.name;
                        if (exactEntryIndex(name) >= 0) items.push([MENU_REMOVE, () => removeIgnored(name)]);
                        else items.push([MENU_ADD, () => addIgnored(name)]);
                    }
                }
            } catch (e) { console.warn(LOG, 'błąd menu', e); }
            return showPopupMenu.apply(this, arguments);
        };
    }

    /* ================== OKNO ================== */

    let panel = null;
    let listEl = null;
    let inputEl = null;

    const el = (tag, cls, text) => {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    const button = (text, onClick, cls = '') => {
        const node = el('div', `ss-btn ${cls}`.trim(), text);
        node.addEventListener('click', onClick);
        return node;
    };

    const checkbox = (label, key, tip) => {
        const wrap = el('label', 'ss-check');
        const input = el('input');
        input.type = 'checkbox';
        input.checked = !!settings[key];
        input.addEventListener('change', () => {
            settings[key] = input.checked;
            saveSettings();
        });
        wrap.append(input, label);
        if (tip) wrap.title = tip;
        return wrap;
    };

    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .great-merchamp .ss-shop-btn { position: relative; }
            .great-merchamp .ss-shop-btn .label { visibility: hidden; }
            .great-merchamp .ss-shop-btn .ss-lock { position: absolute; inset: 0; pointer-events: none; background: url("${LOCK_ICON}") center / 14px 14px no-repeat; }
            .great-merchamp .ss-shop-btn:hover .ss-lock { filter: brightness(1.25); }
            #ss-panel { position: fixed; z-index: 9999; width: 290px; background: #1b1712; color: #e8dcc0; border: 2px solid #6b5a33; border-radius: 6px; font: 12px/1.35 Arial, sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,.6); display: flex; flex-direction: column; }
            #ss-panel, #ss-panel * { box-sizing: border-box; }
            #ss-panel[hidden] { display: none; }
            #ss-panel .ss-head { display: flex; align-items: center; gap: 6px; padding: 5px 8px; cursor: move; user-select: none; background: linear-gradient(#3a2f1a, #2a2212); border-bottom: 1px solid #6b5a33; border-radius: 4px 4px 0 0; }
            #ss-panel .ss-title { flex: 1; font-weight: bold; color: #f1d58a; }
            #ss-panel .ss-body { display: flex; flex-direction: column; gap: 8px; padding: 8px; }
            #ss-panel .ss-info { color: #a89a7a; font-size: 11px; }
            #ss-panel .ss-add { display: flex; gap: 6px; }
            #ss-panel input[type=text] { flex: 1; min-width: 0; padding: 3px 5px; background: #0f0d0a; color: #e8dcc0; border: 1px solid #6b5a33; border-radius: 3px; font: inherit; }
            #ss-panel .ss-btn { cursor: pointer; background: #4a3d22; border: 1px solid #7a6639; color: #f1d58a; border-radius: 3px; padding: 0 8px; line-height: 20px; text-align: center; user-select: none; white-space: nowrap; }
            #ss-panel .ss-btn:hover { background: #5d4c2a; }
            #ss-panel .ss-close { padding: 0 6px; color: #d66; }
            #ss-panel .ss-list { display: flex; flex-direction: column; gap: 2px; max-height: 260px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #7a6639 #0f0d0a; }
            #ss-panel .ss-row { display: flex; align-items: center; gap: 6px; padding: 3px 6px; background: #2a2212; border-radius: 3px; }
            #ss-panel .ss-row-name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
            #ss-panel .ss-row-name.wild { color: #9fc7e0; }
            #ss-panel .ss-row-del { cursor: pointer; color: #d66; padding: 0 4px; }
            #ss-panel .ss-row-del:hover { color: #f88; }
            #ss-panel .ss-empty { color: #a89a7a; font-style: italic; padding: 4px 2px; }
            #ss-panel .ss-section { color: #b9a56a; font-weight: bold; }
            #ss-panel .ss-check { display: flex; align-items: center; gap: 5px; cursor: pointer; }
            #ss-panel .ss-check input { margin: 0; accent-color: #7a6639; cursor: pointer; }
            #ss-panel .ss-foot { display: flex; gap: 6px; justify-content: flex-end; }
        `;
        document.head.appendChild(style);
    }

    function buildPanel() {
        panel = el('div');
        panel.id = 'ss-panel';
        panel.hidden = true;

        const head = el('div', 'ss-head');
        head.append(el('span', 'ss-title', 'Lepszy super sprzedawca'), button('✕', () => { panel.hidden = true; }, 'ss-close'));

        const body = el('div', 'ss-body');
        const info = el('div', 'ss-info',
            'Przedmioty o tych nazwach nie trafią do koszyka przy przyciskach 1/2/3 w sklepie, nawet jeśli spełniają warunki. '
            + 'Wielkość liter nie ma znaczenia, * oznacza dowolny ciąg znaków (np. "*smoka*"). '
            + 'Szybciej: PPM na przedmiocie w torbie -> "' + MENU_ADD + '".');

        const add = el('div', 'ss-add');
        inputEl = el('input');
        inputEl.type = 'text';
        inputEl.placeholder = 'Nazwa przedmiotu';
        inputEl.addEventListener('keydown', event => {
            event.stopPropagation(); // klawisze 1/2/3 itp. nie mogą trafić do gry
            if (event.key === 'Enter') addFromInput();
            if (event.key === 'Escape') inputEl.blur();
        });
        inputEl.addEventListener('keyup', event => event.stopPropagation());
        inputEl.addEventListener('keypress', event => event.stopPropagation());
        add.append(inputEl, button('Dodaj', addFromInput));

        listEl = el('div', 'ss-list');

        const options = el('div', 'ss-section', 'Opcje');
        const enhanced = checkbox('Pomijaj przedmioty ulepszone w rzemiośle (+1 do +5)', 'skipEnhanced',
            'Gra przy opcji "pospolite" sprzedaje też pospolite przedmioty, które ktoś ulepszył');
        const report = checkbox('Pokazuj ile przedmiotów pominięto', 'report');

        const foot = el('div', 'ss-foot');
        foot.append(
            button('Kopiuj listę', copyList),
            button('Wklej listę', pasteList),
            button('Wyczyść', () => {
                if (settings.ignored.length && window.confirm('Usunąć całą listę ignorowanych przedmiotów?')) setIgnored([]);
            }),
        );

        body.append(info, add, listEl, options, enhanced, report, foot, updateInfo.note());
        panel.append(head, body);
        document.body.appendChild(panel);
        makeDraggable(head);
        renderList();
    }

    function addFromInput() {
        const value = inputEl.value.replace(/\s+/g, ' ').trim();
        if (!value) return;
        setIgnored([...settings.ignored, value]);
        inputEl.value = '';
        inputEl.focus();
    }

    function copyList() {
        const text = settings.ignored.join('\n');
        const done = () => notify(`Skopiowano ${settings.ignored.length} nazw`);
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => window.prompt('Skopiuj listę:', settings.ignored.join(';')));
        else window.prompt('Skopiuj listę:', settings.ignored.join(';'));
    }

    function pasteList() {
        const text = window.prompt('Wklej nazwy (każda w osobnej linii albo rozdzielone średnikiem). Zostaną dodane do obecnej listy:', '');
        if (!text) return;
        setIgnored([...settings.ignored, ...text.split(/[\n;]/)]);
    }

    function renderList() {
        if (!listEl) return;
        listEl.textContent = '';
        if (!settings.ignored.length) {
            listEl.appendChild(el('div', 'ss-empty', 'Lista jest pusta'));
            return;
        }
        settings.ignored.forEach((name, index) => {
            const row = el('div', 'ss-row');
            const label = el('span', name.includes('*') ? 'ss-row-name wild' : 'ss-row-name', name);
            const del = el('span', 'ss-row-del', '✕');
            del.title = 'Usuń z listy';
            del.addEventListener('click', () => setIgnored(settings.ignored.filter((_, i) => i !== index)));
            row.append(label, del);
            listEl.appendChild(row);
        });
    }

    function placePanel() {
        const { left, top } = settings.panel;
        const width = panel.offsetWidth || 290;
        const height = panel.offsetHeight || 200;
        const x = left === null ? (window.innerWidth - width) / 2 : left;
        const y = top === null ? window.innerHeight * 0.2 : top;
        panel.style.left = `${Math.max(0, Math.min(x, window.innerWidth - width))}px`;
        panel.style.top = `${Math.max(0, Math.min(y, window.innerHeight - Math.min(height, 60)))}px`;
    }

    function makeDraggable(handle) {
        handle.addEventListener('mousedown', event => {
            if (event.button !== 0 || event.target.closest('.ss-btn')) return;
            event.preventDefault();
            const startX = event.clientX - panel.offsetLeft;
            const startY = event.clientY - panel.offsetTop;
            const move = e => {
                panel.style.left = `${Math.max(0, Math.min(e.clientX - startX, window.innerWidth - panel.offsetWidth))}px`;
                panel.style.top = `${Math.max(0, Math.min(e.clientY - startY, window.innerHeight - 30))}px`;
            };
            const up = () => {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
                settings.panel = { left: panel.offsetLeft, top: panel.offsetTop };
                saveSettings();
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });
    }

    function togglePanel() {
        if (!panel) buildPanel();
        panel.hidden = !panel.hidden;
        if (!panel.hidden) {
            renderList();
            placePanel();
        }
    }

    /* ================== START ================== */

    function start() {
        addStyles();
        installMenuHook();
        watchShop();
        document.addEventListener('keydown', event => {
            if (!event.altKey || event.ctrlKey || event.repeat || event.key.toLowerCase() !== 's') return;
            event.preventDefault();
            togglePanel();
        });
    }

    function waitFor(isReady, callback) {
        if (isReady()) callback();
        else setTimeout(() => waitFor(isReady, callback), 50);
    }

    waitFor(() => {
        const Engine = window.Engine;
        return document.head && document.body && Engine && Engine.heroEquipment
            && Engine.interface && typeof Engine.interface.showPopupMenu === 'function';
    }, start);
})();
