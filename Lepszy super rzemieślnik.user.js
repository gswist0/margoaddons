// ==UserScript==
// @name         Lepszy super rzemieślnik
// @version      1.0
// @description  Poprawki super rzemieślnika w ulepszaniu (przyciski 1/2/3): dodawanie unikatów i heroików, wybór związanych/niezwiązanych, lista nazw przedmiotów, których nigdy nie używa (też PPM na przedmiocie), pomijanie przedmiotów ulepszonych i z licytacji oraz opcja "tylko ta sama grupa przedmiotów" (+25% punktów).
// @match        https://*.margonem.pl/
// @match        https://*.margonem.com/
// @author       Bancewald
// @grant        none
// @run-at       document-idle
// ==/UserScript==

// Dodatek nie wysyła żadnych zapytań do serwera gry - zmienia tylko to, które przedmioty gra wybiera przy 1/2/3.

(() => {
    'use strict';

    /* ================== INFORMACJA O NOWEJ WERSJI ================== */
    // Lista aktualnych wersji jest w pliku versions.json na GitHubie. Dodatek NIE aktualizuje się sam,
    // tylko pokazuje na dole swojego okna informację z linkiem do nowej wersji.
    const updateInfo = (() => {
        const ID = 'lepszy-super-rzemieslnik';
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

    updateInfo.toast('Lepszy super rzemieślnik');

    /* ================== USTAWIENIA ================== */

    // Lista i opcje są wspólne dla wszystkich postaci w tej przeglądarce.
    const SETTINGS_KEY = 'margoaddons_super_rzemieslnik';
    const LOG = '[Lepszy super rzemieślnik]';
    const MENU_ADD = 'Ignoruj w super rzemieślniku';
    const MENU_REMOVE = 'Przestań ignorować w super rzemieślniku';
    const BOUND_STATS = ['soulbound', 'permbound'];
    const RARITIES = [
        ['common', 'Pospolite'],
        ['unique', 'Unikatowe'],
        ['heroic', 'Heroiczne'],
    ];
    const BOUND_MODES = [
        ['unbound', 'Tylko niezwiązane (jak w grze)'],
        ['bound', 'Tylko związane'],
        ['all', 'Związane i niezwiązane'],
    ];
    // kłódka (przedmioty chronione przed zużyciem) w kolorze ikonek gry
    const LOCK_ICON = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">'
        + '<path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="#f3ead2" stroke-width="1.8"/>'
        + '<rect x="2.5" y="7" width="11" height="8" rx="1.5" fill="#f3ead2" stroke="#2b2416" stroke-width=".8"/>'
        + '<rect x="7.2" y="9.3" width="1.6" height="3.4" rx=".8" fill="#2b2416"/></svg>');

    const DEFAULT_SETTINGS = {
        ignored: [],          // nazwy przedmiotów (wielkość liter bez znaczenia, * = dowolny ciąg znaków)
        rarity: { common: true, unique: false, heroic: false },
        bound: 'unbound',     // unbound | bound | all
        skipEnhanced: true,   // pomijaj przedmioty z jakimkolwiek ulepszeniem (+1 ... +5)
        skipReforge: true,    // pomijaj przedmioty z licytacji (mają przekuwanie)
        sameClass: false,     // tylko przedmioty tego samego typu co ulepszany (premia +25%)
        report: false,        // komunikat ile przedmiotów pominięto
        panel: { left: null, top: null },
    };

    let settings = loadSettings();

    function loadSettings() {
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { /* uszkodzony zapis */ }
        const flag = key => (saved[key] !== undefined ? !!saved[key] : DEFAULT_SETTINGS[key]);
        const rarity = {};
        RARITIES.forEach(([key]) => {
            const value = saved.rarity && saved.rarity[key];
            rarity[key] = value !== undefined ? !!value : DEFAULT_SETTINGS.rarity[key];
        });
        return {
            ...DEFAULT_SETTINGS,
            ...saved,
            ignored: Array.isArray(saved.ignored) ? saved.ignored.filter(n => typeof n === 'string' && n.trim()) : [],
            rarity,
            bound: BOUND_MODES.some(([key]) => key === saved.bound) ? saved.bound : DEFAULT_SETTINGS.bound,
            skipEnhanced: flag('skipEnhanced'),
            skipReforge: flag('skipReforge'),
            sameClass: flag('sameClass'),
            report: flag('report'),
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
        notify(`Super rzemieślnik pomija teraz: ${name}`);
    };

    const removeIgnored = name => {
        const index = exactEntryIndex(name);
        if (index < 0) return;
        setIgnored(settings.ignored.filter((_, i) => i !== index));
        notify(`Super rzemieślnik znowu może zużyć: ${name}`);
    };

    function notify(text) {
        try { if (typeof window.message === 'function') window.message(text); } catch (e) { /* tylko komunikat */ }
    }

    /* ================== FILTR SUPER RZEMIEŚLNIKA ================== */

    // Przedmiot, który właśnie ulepszamy (null, gdy żaden nie jest wybrany).
    function enhancedTarget() {
        const Engine = window.Engine;
        const enhancement = Engine.crafting && Engine.crafting.enhancement;
        const id = enhancement && enhancement.selectedEnhanceItem;
        if (!id || !Engine.items || typeof Engine.items.getItemById !== 'function') return null;
        try { return Engine.items.getItemById(id) || null; } catch (e) { return null; }
    }

    // Grupy typów jak w grze (ItemData.CL_GROUPS) - składnik z tej samej grupy co ulepszany daje +25% punktów.
    const CL_GROUPS = [
        [1, 2, 3, 4, 5, 6, 7, 29], // bronie (jednoręczne, dwuręczne, półtoraręczne, dystansowe, pomocnicze, różdżki, orby, kołczany)
        [8, 9, 10, 11, 14],        // zbroje, hełmy, buty, rękawice, tarcze
        [12, 13],                  // pierścienie, naszyjniki
    ];
    const clGroup = cl => CL_GROUPS.findIndex(group => group.includes(Number(cl)));
    const sameClGroup = (item, target) => {
        const group = clGroup(target.cl);
        return group < 0 || clGroup(item.cl) === group;
    };

    // Czy przedmiot ma w sobie cokolwiek z ulepszania: poziom +X, ale też same punkty bez poziomu
    // (gra pokazuje wtedy w opisie gwiazdkę z 0). Sprawdzamy wszystkie surowe statystyki przedmiotu.
    function hasEnhancement(item) {
        let stats = null;
        try { stats = item.parseStats(); } catch (e) { /* brak statystyk */ }
        if (stats && Object.keys(stats).some(key => key.includes('enhancement'))) return true;
        try { return typeof item.issetEnhancement_upgrade_lvlStat === 'function' && !!item.issetEnhancement_upgrade_lvlStat(); } catch (e) { return false; }
    }

    // Przedmioty z licytacji można przekuwać - mają koszt przekucia, ilość przekuć i poziom po przekuciu.
    const REFORGE_STATS = ['lvlupgcost', 'lvlupgs', 'upglvl'];
    function isReforgeable(item) {
        let stats = null;
        try { stats = item.parseStats(); } catch (e) { return false; }
        return !!stats && REFORGE_STATS.some(key => key in stats);
    }

    // Dlaczego przedmiot nie powinien trafić do ulepszania (null = gra może go użyć).
    function skipReason(item, target) {
        if (!item) return null;
        if (item.name && isNameIgnored(item.name)) return 'name';
        if (settings.skipReforge && isReforgeable(item)) return 'reforge';
        if (settings.skipEnhanced && hasEnhancement(item)) return 'enhanced';
        if (settings.sameClass && target && !sameClGroup(item, target)) return 'otherClass';
        return null;
    }

    // Warunki gry (filtry ItemGrabbera) z naszymi zmianami: rzadkość i związanie.
    function buildGrabberOptions(original) {
        const allow = { ...(original.allow || {}) };
        const deny = { ...(original.deny || {}) };
        const rarities = RARITIES.map(([key]) => key).filter(key => settings.rarity[key]);
        const rarityFilter = { name: 'rarity', op: '===', value: rarities };

        let hasRarity = false;
        allow.stats = (allow.stats || []).map(filter => {
            if (filter && filter.name === 'rarity') {
                hasRarity = true;
                return rarityFilter;
            }
            return filter;
        });
        if (!hasRarity) allow.stats.push(rarityFilter);

        if (settings.bound !== 'unbound') {
            deny.stats = (deny.stats || []).filter(filter => !BOUND_STATS.includes(filter));
            if (settings.bound === 'bound') allow.stats.push({ stats: BOUND_STATS, mode: 'any' });
        }
        return { ...original, allow, deny };
    }

    // Przyciski 1/2/3 (i klawisze) wołają autofiller.autofillFrom -> itemGrabber.grab -> lista przedmiotów,
    // którą gra wrzuca do okna ulepszania (max 25). Podmieniamy tylko grab tego jednego ItemGrabbera, więc
    // limit, wybrana torba, typy przedmiotów z ustawień gry i jej potwierdzenia działają bez zmian.
    function patchAutofiller(autofiller) {
        const grabber = autofiller && autofiller.itemGrabber;
        if (!grabber || autofiller.__lsrPatched || typeof grabber.grab !== 'function') return;
        autofiller.__lsrPatched = true;
        const grab = grabber.grab;
        grabber.grab = function () {
            const original = this.options;
            let patched = original;
            try { patched = buildGrabberOptions(original || {}); } catch (e) { console.warn(LOG, 'błąd ustawień filtra', e); }
            let items;
            this.options = patched;
            try {
                items = grab.apply(this, arguments);
            } finally {
                this.options = original;
            }
            if (!Array.isArray(items)) return items;

            const target = enhancedTarget();
            const skipped = { name: 0, reforge: 0, enhanced: 0, otherClass: 0 };
            const result = items.filter(item => {
                let reason = null;
                try { reason = skipReason(item, target); } catch (e) { console.warn(LOG, 'błąd filtra', e); }
                if (reason) skipped[reason]++;
                return !reason;
            });
            const parts = [];
            if (skipped.name) parts.push(`${skipped.name} z listy ignorowanych`);
            if (skipped.reforge) parts.push(`${skipped.reforge} z licytacji`);
            if (skipped.enhanced) parts.push(`${skipped.enhanced} ulepszonych`);
            if (skipped.otherClass) parts.push(`${skipped.otherClass} z innej grupy`);
            if (settings.report && parts.length) notify(`Super rzemieślnik pominął: ${parts.join(', ')}`);
            return result;
        };
        addCraftButton(autofiller);
    }

    // Przycisk obok 1/2/3 w oknie ulepszania.
    function addCraftButton(autofiller, tries = 0) {
        const box = autofiller.el;
        if (!box || !box.querySelector('.grab-bag-1')) {
            if (tries < 40) setTimeout(() => addCraftButton(autofiller, tries + 1), 100);
            return;
        }
        if (box.querySelector('.lsr-craft-btn')) return;
        // Taki sam przycisk jak zębatka gry: ukryta etykieta trzyma rozmiar, w środku ikonka.
        const btn = document.createElement('div');
        btn.className = 'button green small lsr-craft-btn';
        btn.innerHTML = '<div class="background"></div><div class="label">0</div><div class="lsr-lock"></div>';
        const tip = 'Lepszy super rzemieślnik - co trafia do ulepszania przy 1/2/3 <b>[Alt + K]</b>';
        if (window.$ && window.$.fn && typeof window.$.fn.tip === 'function') window.$(btn).tip(tip);
        else btn.title = 'Lepszy super rzemieślnik (Alt + K)';
        btn.addEventListener('click', event => {
            event.stopPropagation();
            togglePanel();
        });
        // przed przyciskiem konfiguracji gry (ostatni w rzędzie)
        const configBtn = box.querySelector('.autofiller-config-btn');
        const configNode = configBtn && (configBtn.parentNode === box ? configBtn : configBtn.closest('.button'));
        if (configNode && configNode.parentNode === box) box.insertBefore(btn, configNode);
        else box.appendChild(btn);
        fitRow(box);
    }

    // Rząd przycisków jest dopasowany do 4 przycisków. Jeśli piąty przenosi zębatkę do nowej linii,
    // zmniejszamy odstępy (a w ostateczności szerokość) przycisków w tym rzędzie.
    function fitRow(box, tries = 0) {
        const buttons = Array.from(box.children).filter(node => node.classList.contains('button'));
        if (buttons.length < 2) return;
        if (!box.offsetWidth) {
            if (tries < 600) setTimeout(() => fitRow(box, tries + 1), 100);
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

    function watchCrafting() {
        setInterval(() => {
            const Engine = window.Engine;
            const enchant = Engine.crafting && Engine.crafting.enhancement && Engine.crafting.enhancement.enchant;
            if (enchant && enchant.autofiller) {
                try { patchAutofiller(enchant.autofiller); } catch (e) { console.warn(LOG, 'nie udało się podpiąć rzemiosła', e); }
            }
        }, 300);
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
    let rarityWarnEl = null;

    const el = (tag, cls, text) => {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    const button = (text, onClick, cls = '') => {
        const node = el('div', `lsr-btn ${cls}`.trim(), text);
        node.addEventListener('click', onClick);
        return node;
    };

    const checkbox = (label, get, set, tip) => {
        const wrap = el('label', 'lsr-check');
        const input = el('input');
        input.type = 'checkbox';
        input.checked = !!get();
        input.addEventListener('change', () => {
            set(input.checked);
            saveSettings();
            updateRarityWarn();
        });
        wrap.append(input, label);
        if (tip) wrap.title = tip;
        return wrap;
    };

    const flagCheckbox = (label, key, tip) => checkbox(label, () => settings[key], value => { settings[key] = value; }, tip);

    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .autofiller .lsr-craft-btn { position: relative; }
            .autofiller .lsr-craft-btn .label { visibility: hidden; }
            .autofiller .lsr-craft-btn .lsr-lock { position: absolute; inset: 0; pointer-events: none; background: url("${LOCK_ICON}") center / 14px 14px no-repeat; }
            .autofiller .lsr-craft-btn:hover .lsr-lock { filter: brightness(1.25); }
            #lsr-panel { position: fixed; z-index: 9999; width: 300px; background: #1b1712; color: #e8dcc0; border: 2px solid #6b5a33; border-radius: 6px; font: 12px/1.35 Arial, sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,.6); display: flex; flex-direction: column; }
            #lsr-panel, #lsr-panel * { box-sizing: border-box; }
            #lsr-panel[hidden] { display: none; }
            #lsr-panel .lsr-head { display: flex; align-items: center; gap: 6px; padding: 5px 8px; cursor: move; user-select: none; background: linear-gradient(#3a2f1a, #2a2212); border-bottom: 1px solid #6b5a33; border-radius: 4px 4px 0 0; }
            #lsr-panel .lsr-title { flex: 1; font-weight: bold; color: #f1d58a; }
            #lsr-panel .lsr-body { display: flex; flex-direction: column; gap: 8px; padding: 8px; max-height: calc(100vh - 60px); overflow-y: auto; scrollbar-width: thin; scrollbar-color: #7a6639 #0f0d0a; }
            #lsr-panel .lsr-info { color: #a89a7a; font-size: 11px; }
            #lsr-panel .lsr-warn { color: #e0866b; font-size: 11px; }
            #lsr-panel .lsr-add { display: flex; gap: 6px; }
            #lsr-panel input[type=text], #lsr-panel select { flex: 1; min-width: 0; padding: 3px 5px; background: #0f0d0a; color: #e8dcc0; border: 1px solid #6b5a33; border-radius: 3px; font: inherit; }
            #lsr-panel .lsr-btn { cursor: pointer; background: #4a3d22; border: 1px solid #7a6639; color: #f1d58a; border-radius: 3px; padding: 0 8px; line-height: 20px; text-align: center; user-select: none; white-space: nowrap; }
            #lsr-panel .lsr-btn:hover { background: #5d4c2a; }
            #lsr-panel .lsr-close { padding: 0 6px; color: #d66; }
            #lsr-panel .lsr-list { display: flex; flex-direction: column; gap: 2px; max-height: 200px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #7a6639 #0f0d0a; }
            #lsr-panel .lsr-row { display: flex; align-items: center; gap: 6px; padding: 3px 6px; background: #2a2212; border-radius: 3px; }
            #lsr-panel .lsr-row-name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
            #lsr-panel .lsr-row-name.wild { color: #9fc7e0; }
            #lsr-panel .lsr-row-del { cursor: pointer; color: #d66; padding: 0 4px; }
            #lsr-panel .lsr-row-del:hover { color: #f88; }
            #lsr-panel .lsr-empty { color: #a89a7a; font-style: italic; padding: 4px 2px; }
            #lsr-panel .lsr-section { color: #b9a56a; font-weight: bold; }
            #lsr-panel .lsr-inline { display: flex; flex-wrap: wrap; gap: 4px 12px; }
            #lsr-panel .lsr-check { display: flex; align-items: center; gap: 5px; cursor: pointer; }
            #lsr-panel .lsr-check input { margin: 0; accent-color: #7a6639; cursor: pointer; }
            #lsr-panel .lsr-foot { display: flex; gap: 6px; justify-content: flex-end; }
        `;
        document.head.appendChild(style);
    }

    function buildPanel() {
        panel = el('div');
        panel.id = 'lsr-panel';
        panel.hidden = true;

        const head = el('div', 'lsr-head');
        head.append(el('span', 'lsr-title', 'Lepszy super rzemieślnik'), button('✕', () => { panel.hidden = true; }, 'lsr-close'));

        const body = el('div', 'lsr-body');

        // --- co gra może wrzucać ---
        const raritySection = el('div', 'lsr-section', 'Rzadkość dodawanych przedmiotów');
        const rarityRow = el('div', 'lsr-inline');
        RARITIES.forEach(([key, label]) => rarityRow.appendChild(
            checkbox(label, () => settings.rarity[key], value => { settings.rarity[key] = value; })));
        rarityWarnEl = el('div', 'lsr-warn', 'Nie zaznaczono żadnej rzadkości - przyciski 1/2/3 nic nie dodadzą.');

        const boundSection = el('div', 'lsr-section', 'Związanie');
        const boundSelect = el('select');
        BOUND_MODES.forEach(([key, label]) => {
            const option = el('option', '', label);
            option.value = key;
            boundSelect.appendChild(option);
        });
        boundSelect.value = settings.bound;
        boundSelect.addEventListener('change', () => {
            settings.bound = boundSelect.value;
            saveSettings();
        });
        boundSelect.addEventListener('keydown', event => event.stopPropagation());

        const optionsSection = el('div', 'lsr-section', 'Opcje');
        const enhanced = flagCheckbox('Pomijaj przedmioty z jakimkolwiek ulepszeniem (też częściowym, bez poziomu)', 'skipEnhanced',
            'Gra przy przyciskach 1/2/3 bierze też przedmioty, które ktoś już ulepszał - ich punkty przepadają');
        const reforge = flagCheckbox('Pomijaj przedmioty z licytacji (z przekuwaniem)', 'skipReforge',
            'Przedmioty z licytacji poznaje się po tym, że mają koszt przekucia, ilość przekuć i poziom po przekuciu');
        const sameClass = flagCheckbox('Tylko ta sama grupa co ulepszany przedmiot (+25% punktów)', 'sameClass',
            'Grupy jak w grze: bronie (z kołczanami), zbroje (zbroje, hełmy, buty, rękawice, tarcze), biżuteria (pierścienie, naszyjniki)');
        const report = flagCheckbox('Pokazuj ile przedmiotów pominięto', 'report');

        // --- lista ignorowanych ---
        const listSection = el('div', 'lsr-section', 'Nigdy nie używaj');
        const info = el('div', 'lsr-info',
            'Przedmioty o tych nazwach nie trafią do ulepszania przy przyciskach 1/2/3, nawet jeśli spełniają warunki. '
            + 'Wielkość liter nie ma znaczenia, * oznacza dowolny ciąg znaków (np. "*smoka*"). '
            + 'Szybciej: PPM na przedmiocie w torbie -> "' + MENU_ADD + '".');

        const add = el('div', 'lsr-add');
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

        listEl = el('div', 'lsr-list');

        const foot = el('div', 'lsr-foot');
        foot.append(
            button('Kopiuj listę', copyList),
            button('Wklej listę', pasteList),
            button('Wyczyść', () => {
                if (settings.ignored.length && window.confirm('Usunąć całą listę ignorowanych przedmiotów?')) setIgnored([]);
            }),
        );

        const gameInfo = el('div', 'lsr-info',
            'Typy przedmiotów (bronie, zbroje...) i poziom od 20 nadal ustawia gra (zębatka obok 1/2/3). '
            + 'Gra wciąż pyta o potwierdzenie przy przedmiotach lepszej rzadkości, ulepszonych i osobistych.');

        body.append(raritySection, rarityRow, rarityWarnEl, boundSection, boundSelect, optionsSection, reforge, enhanced, sameClass, report,
            listSection, info, add, listEl, foot, gameInfo, updateInfo.note());
        panel.append(head, body);
        document.body.appendChild(panel);
        makeDraggable(head);
        renderList();
        updateRarityWarn();
    }

    function updateRarityWarn() {
        if (rarityWarnEl) rarityWarnEl.hidden = RARITIES.some(([key]) => settings.rarity[key]);
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
            listEl.appendChild(el('div', 'lsr-empty', 'Lista jest pusta'));
            return;
        }
        settings.ignored.forEach((name, index) => {
            const row = el('div', 'lsr-row');
            const label = el('span', name.includes('*') ? 'lsr-row-name wild' : 'lsr-row-name', name);
            const del = el('span', 'lsr-row-del', '✕');
            del.title = 'Usuń z listy';
            del.addEventListener('click', () => setIgnored(settings.ignored.filter((_, i) => i !== index)));
            row.append(label, del);
            listEl.appendChild(row);
        });
    }

    function placePanel() {
        const { left, top } = settings.panel;
        const width = panel.offsetWidth || 300;
        const height = panel.offsetHeight || 200;
        const x = left === null ? (window.innerWidth - width) / 2 : left;
        const y = top === null ? window.innerHeight * 0.15 : top;
        panel.style.left = `${Math.max(0, Math.min(x, window.innerWidth - width))}px`;
        panel.style.top = `${Math.max(0, Math.min(y, window.innerHeight - Math.min(height, 60)))}px`;
    }

    function makeDraggable(handle) {
        handle.addEventListener('mousedown', event => {
            if (event.button !== 0 || event.target.closest('.lsr-btn')) return;
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
        watchCrafting();
        document.addEventListener('keydown', event => {
            if (!event.altKey || event.ctrlKey || event.repeat || event.key.toLowerCase() !== 'k') return;
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
