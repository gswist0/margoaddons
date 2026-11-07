// ==UserScript==
// @name         Lepsze aukcje
// @version      2.3
// @description  Dodatkowe filtry aukcji. Takie same oferty (ten sam przedmiot) są zwijane w jeden wiersz z najniższą ceną, który można rozwinąć. Panel obok okna aukcji: ukrywanie ofert po nazwie, cenie, poziomie, typie aukcji, rzadkości i profesji oraz zapisane zestawy filtrów.
// @match        https://*.margonem.pl/
// @match        https://*.margonem.com/
// @author       Bancewald
// @grant        none
// @run-at       document-idle
// ==/UserScript==

// Dodatek nie wysyła żadnych własnych zapytań do serwera, poza wczytaniem kolejnej strony ofert, tak jak przy przewinięciu listy,
// i jednym wyszukiwaniem przy wczytaniu zapisanego zestawu (to samo co Enter w wyszukiwarce gry).
// Zmienia tylko kolejność i widoczność wierszy, które zbudowała gra. Wiersze, przyciski i licytacja działają tak jak bez dodatku.
//
// Wszystkie filtry dodatku UKRYWAJĄ: to, co wpiszemy lub zaznaczymy, znika z listy. Puste pole / nic nie zaznaczone = nic nie ukrywa.

(() => {
    'use strict';

    /* ================== INFORMACJA O NOWEJ WERSJI ================== */
    // Lista aktualnych wersji jest w pliku versions.json na GitHubie. Dodatek NIE aktualizuje się sam,
    // tylko pokazuje na dole swojego okna informację z linkiem do nowej wersji.
    const updateInfo = (() => {
        const ID = 'lepsze-aukcje';
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

    if (window.__lepszeAukcje) return;
    window.__lepszeAukcje = true;

    /* ================== USTAWIENIA ================== */

    const SETTINGS_KEY = 'lepsze_aukcje_ustawienia';
    const FILTER_MODE = 'hide'; // wersje do 1.8 pokazywały tylko zaznaczone - takie zapisy są czyszczone, żeby nie odwróciły znaczenia
    const DEFAULT_SETTINGS = {
        group: true, panelOpen: false, ignored: [], presets: [],
        priceMin: null, priceMax: null, lvlMin: null, lvlMax: null, types: [], rarities: [], profs: [],
    };

    // Przyciski ukrywania: [wartość, napis, podpowiedź].
    const CHIP_FILTERS = [
        { key: 'types', title: 'Typ aukcji', options: [['bo', 'kup teraz', 'Ukryj oferty, które mają tylko "kup teraz"'], ['bid', 'licytacja', 'Ukryj oferty, które można tylko licytować']] },
        { key: 'rarities', title: 'Rzadkość', options: [['common', 'zwykły'], ['unique', 'unikat'], ['heroic', 'heroik'], ['upgraded', 'ulepszony'], ['legendary', 'legenda'], ['artefact', 'artefakt']] },
        { key: 'profs', title: 'Profesja', options: [['w', 'wojownik'], ['p', 'paladyn'], ['b', 'tancerz ostrzy'], ['m', 'mag'], ['h', 'łowca'], ['t', 'tropiciel']] },
    ];
    const CHIP_KEYS = CHIP_FILTERS.map(f => f.key);
    const RANGE_KEYS = ['priceMin', 'priceMax', 'lvlMin', 'lvlMax'];

    // Pola wyszukiwarki gry: [klucz w zestawie, klasa pola]. Menu: [klucz, klasa kontenera menu].
    const GAME_INPUTS = [['name', 'name-item-input'], ['minPrice', 'min-price-input'], ['maxPrice', 'max-price-input'], ['minLvl', 'min-level-input'], ['maxLvl', 'max-level-input']];
    const GAME_MENUS = [['type', 'auction-type-wrapper'], ['rarity', 'item-rarity-wrapper'], ['prof', 'item-prof-wrapper']];
    const MY_AUCTION_OFF_TAB = 1; // zakładka "Moje" (convertKindToTab), tam każda aukcja zostaje osobno

    // Statystyki inne dla każdego egzemplarza (kto zdobył, kiedy utworzono, ile zostało czasu) nie odróżniają przedmiotów.
    const IGNORED_STATS = new Set(['loot', 'created', 'expires', 'ttl', 'owner']);

    let settings = loadSettings();

    function cleanHideFilters(source, keepValues) {
        const result = {};
        for (const key of RANGE_KEYS) {
            const value = Number(source[key]);
            result[key] = keepValues && source[key] !== null && source[key] !== undefined && source[key] !== '' && Number.isFinite(value) && value >= 0 ? value : null;
        }
        for (const filter of CHIP_FILTERS) {
            const allowed = new Set(filter.options.map(o => o[0]));
            result[filter.key] = keepValues && Array.isArray(source[filter.key]) ? source[filter.key].filter(v => allowed.has(v)) : [];
        }
        return result;
    }

    function loadSettings() {
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { /* uszkodzony zapis */ }
        const sameMode = saved.filterMode === FILTER_MODE;
        const result = { ...DEFAULT_SETTINGS, ...saved, ...cleanHideFilters(saved, sameMode), filterMode: FILTER_MODE };
        result.group = saved.group !== undefined ? !!saved.group : true;
        result.panelOpen = !!saved.panelOpen;
        result.ignored = Array.isArray(saved.ignored) ? saved.ignored.filter(name => typeof name === 'string') : [];
        result.presets = (Array.isArray(saved.presets) ? saved.presets : [])
            .filter(p => p && typeof p.name === 'string' && p.game && p.addon)
            .map(p => ({ ...p, addon: { group: p.addon.group !== false, ...cleanHideFilters(p.addon, sameMode) } }));
        return result;
    }

    function saveSettings() {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* tylko wygoda */ }
    }

    /* ================== WARTOŚCI PÓL ================== */

    // Cena jak w grze: "1.5m", "200k", "2g", "1 500 000". Puste pole = brak granicy, błędna wartość = undefined.
    function parsePriceInput(text) {
        const clean = String(text || '').replace(/\s+/g, '').replace(',', '.').toLowerCase();
        if (!clean) return null;
        const match = clean.match(/^(\d+(?:\.\d+)?)([kmg]?)$/);
        if (!match) return undefined;
        const mult = { '': 1, k: 1e3, m: 1e6, g: 1e9 }[match[2]];
        return Math.round(parseFloat(match[1]) * mult);
    }

    function parseLevelInput(text) {
        const clean = String(text || '').trim();
        if (!clean) return null;
        return /^\d+$/.test(clean) ? Number(clean) : undefined;
    }

    function formatPriceInput(value) {
        if (value === null || value === undefined) return '';
        for (const [suffix, mult] of [['g', 1e9], ['m', 1e6], ['k', 1e3]]) {
            if (value >= mult && value < mult * 1000 && value % (mult / 1000) === 0) return `${+(value / mult).toFixed(3)}${suffix}`;
        }
        return String(value);
    }

    const hideActive = () => RANGE_KEYS.some(key => settings[key] !== null) || CHIP_KEYS.some(key => settings[key].length);

    /* ================== UKRYWANIE ================== */

    function statValue(item, name) {
        const match = typeof item.stat === 'string' && item.stat.match(new RegExp(`(?:^|;)${name}=([^;]*)`));
        return match ? match[1] : null;
    }

    function itemLevel(item) {
        const lvl = parseInt(statValue(item, 'lvl'), 10);
        return Number.isFinite(lvl) ? lvl : 0;
    }

    // Wartość w przedziale od-do (pusta granica = bez ograniczenia z tej strony) jest ukrywana.
    function inHiddenRange(value, min, max) {
        if (min === null && max === null) return false;
        return (min === null || value >= min) && (max === null || value <= max);
    }

    // Oferta jest ukrywana, gdy wszystko, czym jest, zostało zaznaczone do ukrycia:
    // - typ: oferta z "kup teraz" i licytacją znika dopiero, gdy ukryte są oba typy,
    // - profesja: przedmiot znika, gdy żadna z jego profesji nie jest dozwolona (bez wymagań profesji - nigdy).
    function hiddenByFilters(offer, price, item) {
        const { priceMin, priceMax, lvlMin, lvlMax, types, rarities, profs } = settings;
        if (price && price.currency !== 'c' && inHiddenRange(price.value, priceMin, priceMax)) return true;
        if (inHiddenRange(itemLevel(item), lvlMin, lvlMax)) return true;
        if (types.length) {
            const kinds = [];
            if (Number(offer.bo_g) || Number(offer.bo_c)) kinds.push('bo');
            if (Number(offer.bid_g) || Number(offer.bid_c)) kinds.push('bid');
            if (kinds.length && kinds.every(kind => types.includes(kind))) return true;
        }
        if (rarities.length && rarities.includes(statValue(item, 'rarity') || 'common')) return true;
        if (profs.length) {
            const reqp = statValue(item, 'reqp');
            if (reqp && [...reqp].every(letter => profs.includes(letter))) return true;
        }
        return false;
    }

    // Nazwy porównujemy bez wielkości liter i nadmiarowych spacji.
    const normalizeName = name => String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
    let ignoredSet = new Set(settings.ignored.map(normalizeName));

    // Jak wyszukiwarka gry: wpis ignoruje każdy przedmiot, który ma go gdziekolwiek w nazwie ("skrzynia" -> wszystkie skrzynie).
    function isIgnoredName(name) {
        if (!ignoredSet.size) return false;
        const normalized = normalizeName(name);
        for (const fragment of ignoredSet) {
            if (fragment && normalized.includes(fragment)) return true;
        }
        return false;
    }

    function addIgnored(name) {
        const clean = String(name || '').replace(/\s+/g, ' ').trim();
        if (!clean || ignoredSet.has(normalizeName(clean))) return;
        setIgnored([...settings.ignored, clean]);
    }

    function setIgnored(list) {
        settings.ignored = list;
        ignoredSet = new Set(list.map(normalizeName));
        saveSettings();
        renderIgnoredList();
        refreshOpenButton();
        if (session) schedule(session);
    }

    function filtersChanged() {
        saveSettings();
        refreshHideControls();
        refreshOpenButton();
        if (session) schedule(session);
    }

    /* ================== STAN OKNA AUKCJI ================== */

    // Gra tworzy nowy AuctionManager przy każdym otwarciu okna, więc stan jest powiązany z jego instancją.
    let session = null;
    const counts = { ignored: 0, filtered: 0 };

    function newSession(manager) {
        return {
            manager,
            offers: new Map(),   // id oferty -> dane z serwera (ceny, item_id)
            seq: new Map(),      // id oferty -> kolejność, w jakiej gra ją pokazała
            nextSeq: 0,
            firstSeq: 0,
            expanded: new Set(), // klucze rozwiniętych grup
            table: null,
            observer: null,
            scheduled: false,
            requestedPage: null,
        };
    }

    function currentSession() {
        const manager = window.Engine.auctions;
        if (!manager) {
            if (session && session.observer) session.observer.disconnect();
            session = null;
            return null;
        }
        if (!session || session.manager !== manager) {
            if (session && session.observer) session.observer.disconnect();
            session = newSession(manager);
        }
        return session;
    }

    // Zawartość otwartego okna aukcji albo null.
    function auctionContent() {
        const manager = window.Engine.auctions;
        if (!manager || !manager.getAuctionWindow) return null;
        const content = manager.getAuctionWindow().getContent();
        return content && content[0] && content[0].isConnected ? content[0] : null;
    }

    function onAuctionsUpdate(data) {
        const s = currentSession();
        if (!s || !data) return;
        // Pierwsza strona to nowe wyszukiwanie (inna kategoria, sortowanie, zakładka) - kolejność liczymy od nowa.
        const page = data.show && data.show.page;
        if (page && Number(page.number) <= 1) {
            s.seq.clear();
            s.nextSeq = 0;
            s.firstSeq = 0;
            s.requestedPage = null;
        }
        const list = [];
        if (data.show && Array.isArray(data.show.offers)) list.push(...data.show.offers);
        else if (data.show && data.show.offers) list.push(...Object.values(data.show.offers));
        if (data.add) list.push(data.add);
        for (const offer of list) {
            if (offer && offer.id !== undefined) s.offers.set(String(offer.id), offer);
        }
        if (data.remove !== undefined) {
            s.offers.delete(String(data.remove));
            s.seq.delete(String(data.remove));
        }
        attach(s);
        schedule(s);
    }

    /* ================== OPIS OFERTY ================== */

    function itemKey(item) {
        if (!item) return null;
        const stat = typeof item.stat === 'string'
            ? item.stat.split(';')
                .filter(part => part && !IGNORED_STATS.has(part.split('=')[0]))
                .map(part => (part.startsWith('timelimit=') ? part.split(',')[0] : part)) // drugi człon to czas odnowienia
                .sort()
                .join(';')
            : '';
        return [item.name, item.icon, item.cl, stat].join('|');
    }

    // Tak samo jak gra: przy cudzej licytacji minimalna oferta to +10%.
    const bidValue = (value, bidder) => (bidder ? Math.ceil(value * 11 / 10) : value);

    function offerPrice(offer) {
        const bo_g = Number(offer.bo_g) || 0;
        const bo_c = Number(offer.bo_c) || 0;
        const bid_g = Number(offer.bid_g) || 0;
        const bid_c = Number(offer.bid_c) || 0;
        if (bo_g && bo_c) return { currency: 'gc', value: bo_g, extra: bo_c, buyNow: true };
        if (bo_g) return { currency: 'g', value: bo_g, extra: 0, buyNow: true };
        if (bo_c) return { currency: 'c', value: bo_c, extra: 0, buyNow: true };
        if (bid_g) return { currency: 'g', value: bidValue(bid_g, offer.bidder), extra: 0, buyNow: false };
        if (bid_c) return { currency: 'c', value: bidValue(bid_c, offer.bidder), extra: 0, buyNow: false };
        return null;
    }

    function formatPrice(price) {
        const fmt = value => (typeof window.round === 'function' ? window.round(value, 3) : String(value));
        if (price.currency === 'gc') return `${fmt(price.value)} + ${price.extra} SŁ`;
        if (price.currency === 'c') return `${price.value} SŁ`;
        return fmt(price.value);
    }

    const comparePrice = (a, b) => a.price.value - b.price.value || a.price.extra - b.price.extra || a.seq - b.seq;

    /* ================== GRUPOWANIE ================== */

    function attach(s) {
        const content = s.manager.getAuctionWindow && s.manager.getAuctionWindow().getContent();
        if (!content || !content[0]) return;
        const table = content[0].querySelector('.auction-table');
        if (table && table !== s.table) {
            if (s.observer) s.observer.disconnect();
            s.table = table;
            // Gra dopisuje nazwę przedmiotu do wiersza dopiero po wczytaniu przedmiotu, a przy zmianie oferty podmienia cały wiersz.
            s.observer = new MutationObserver(() => schedule(s));
            s.observer.observe(table, { childList: true, subtree: true });
        }
        addControls(content[0]);
        if (settings.panelOpen) showPanel();
    }

    function schedule(s) {
        if (s.scheduled) return;
        s.scheduled = true;
        setTimeout(() => {
            s.scheduled = false;
            if (session !== s) return;
            try { apply(s); } catch (e) { console.warn('[Lepsze aukcje] błąd grupowania', e); }
        }, 30);
    }

    // Wiersze w kolejności z gry. Nowe wiersze nad znanymi (dodane na górę) dostają kolejność przed nimi.
    function collectRows(s) {
        const rowToId = new Map();
        for (const id of s.offers.keys()) {
            const one = s.manager.getOneOffer(id);
            const row = one && one.get$Offer && one.get$Offer()[0];
            if (row && row.isConnected) rowToId.set(row, id);
            else if (!one) { s.offers.delete(id); s.seq.delete(id); }
        }
        const rows = [];
        let seenKnown = false;
        const fresh = [];
        for (const row of s.table.querySelectorAll('tr')) {
            const id = rowToId.get(row);
            if (id === undefined) continue;
            if (s.seq.has(id)) seenKnown = true;
            else if (seenKnown) s.seq.set(id, s.nextSeq++);
            else fresh.push(id);
            rows.push({ row, id });
        }
        for (let i = fresh.length - 1; i >= 0; i--) s.seq.set(fresh[i], --s.firstSeq);
        return rows.map(entry => ({ ...entry, seq: s.seq.get(entry.id) }));
    }

    function apply(s) {
        if (!s.table || !s.table.isConnected) return;
        const entries = collectRows(s);
        if (!entries.length) {
            updateCounts(0, 0);
            return;
        }
        const parent = entries[0].row.parentNode;
        entries.sort((a, b) => a.seq - b.seq);

        // We własnych aukcjach niczego nie ukrywamy ani nie grupujemy - każdą trzeba móc odnowić lub usunąć.
        const ownTab = s.manager.convertKindToTab(s.manager.getActualKindOfAuction()) === MY_AUCTION_OFF_TAB;
        const groupingOn = settings.group && !ownTab;
        const groups = new Map();
        let ignoredCount = 0;
        let filteredCount = 0;
        for (const entry of entries) {
            const offer = s.offers.get(entry.id);
            entry.price = offer && offerPrice(offer);
            const item = offer && window.Engine.items.getItemById(offer.item_id);
            const ignored = !ownTab && !!item && isIgnoredName(item.name);
            const filtered = !ignored && !ownTab && !!item && hiddenByFilters(offer, entry.price, item);
            entry.hidden = ignored || filtered;
            if (entry.hidden) {
                if (ignored) ignoredCount++;
                else filteredCount++;
                entry.key = null;
                continue;
            }
            const key = groupingOn && entry.price ? itemKey(item) : null;
            entry.key = key ? `${key}|${entry.price.currency}` : null;
            if (!entry.key) continue;
            if (!groups.has(entry.key)) groups.set(entry.key, []);
            groups.get(entry.key).push(entry);
        }

        // Grupa stoi w miejscu najtańszej oferty, a pozostałe oferty są pod nią, od najtańszej.
        const order = [];
        const leaders = new Map();
        for (const [key, list] of groups) {
            if (list.length < 2) continue;
            list.sort(comparePrice);
            leaders.set(list[0], { key, list });
        }
        for (const entry of entries) {
            const group = leaders.get(entry);
            if (group) {
                order.push({ entry, role: 'leader', group });
                for (const member of group.list.slice(1)) order.push({ entry: member, role: 'member', group });
            } else if (entry.hidden) {
                order.push({ entry, role: 'hidden' });
            } else if (!entry.key || !groups.get(entry.key) || groups.get(entry.key).length < 2) {
                order.push({ entry, role: 'single' });
            }
        }
        updateCounts(ignoredCount, filteredCount);

        const ownRows = new Set(entries.map(e => e.row));
        const current = Array.from(parent.children).filter(row => ownRows.has(row));
        const changed = current.length !== order.length || current.some((row, i) => row !== order[i].entry.row);
        if (changed) for (const { entry } of order) parent.appendChild(entry.row);

        for (const { entry, role, group } of order) decorate(s, entry, role, group);

        if (s.observer) s.observer.takeRecords(); // własne zmiany nie wywołują ponownego grupowania
        s.manager.getAuctionWindow().updateScroll();
        loadMoreIfShort(s);
    }

    function decorate(s, entry, role, group) {
        const row = entry.row;
        const expanded = group && s.expanded.has(group.key);
        row.classList.toggle('la-leader', role === 'leader');
        row.classList.toggle('la-expanded', role === 'leader' && expanded);
        row.classList.toggle('la-member', role === 'member');
        row.classList.toggle('la-last', role === 'member' && group.list[group.list.length - 1] === entry);
        row.style.display = role === 'hidden' || (role === 'member' && !expanded) ? 'none' : '';

        let badge = row.querySelector('.la-badge');
        if (role !== 'leader') {
            if (badge) badge.remove();
            return;
        }
        const nameCell = row.querySelector('.item-name-td') || row.children[1];
        if (!nameCell) return;
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'la-badge';
            badge.addEventListener('click', event => {
                event.stopPropagation();
                const key = badge.dataset.key;
                if (s.expanded.has(key)) s.expanded.delete(key);
                else s.expanded.add(key);
                apply(s);
            });
        }
        if (badge.parentNode !== nameCell) nameCell.appendChild(badge);
        const max = group.list[group.list.length - 1].price;
        badge.dataset.key = group.key;
        badge.textContent = `${expanded ? '▲' : '▼'} ${group.list.length} oferty`;
        badge.title = `${group.list.length} takich samych ofert\nnajtaniej: ${formatPrice(entry.price)}\nnajdrożej: ${formatPrice(max)}\n\nkliknij, aby ${expanded ? 'zwinąć' : 'rozwinąć'}`;
    }

    // Gdy po zwinięciu lista jest za krótka, żeby ją przewinąć, gra nie wczyta kolejnej strony - robimy to za nią, raz na stronę.
    function loadMoreIfShort(s) {
        const wrapper = s.table.closest('.scroll-wrapper');
        if (!wrapper) return;
        const pages = s.manager.getAuctionPages();
        const page = pages.getCurrentPage();
        const max = pages.getMaxPage();
        if (page === null || max === null || page >= max || s.requestedPage === page) return;
        if (s.table.offsetHeight > wrapper.clientHeight) return;
        s.requestedPage = page;
        pages.getNextPageAction();
    }

    /* ================== LEWA KOLUMNA OKNA AUKCJI ================== */

    // W oknie gry zostaje tylko grupowanie i przycisk panelu - reszta opcji jest w panelu obok okna.
    function addControls(content) {
        const column = content.querySelector('.all-categories-auction');
        if (!column || column.querySelector('.la-section')) return;
        const section = document.createElement('div');
        section.className = 'drop-down-menu-section la-section';
        section.innerHTML = `
            <div class="type-header"><div class="type-header-label">Lepsze aukcje</div></div>
            <div class="la-options"></div>`;
        const options = section.querySelector('.la-options');
        const checkbox = window.createCheckBox('Grupuj takie same', 'la-option', active => {
            settings.group = active;
            saveSettings();
            if (session) schedule(session);
        });
        if (settings.group) checkbox.find('.checkbox').addClass('active');
        checkbox.attr('title', 'Takie same oferty (ten sam przedmiot, ta sama waluta) są zwijane w jeden wiersz z najniższą ceną');
        options.appendChild(checkbox[0]);
        const open = document.createElement('div');
        open.className = 'la-open-btn';
        open.title = 'Ukrywanie ofert i zapisane zestawy filtrów - panel obok okna aukcji';
        open.addEventListener('click', togglePanel);
        options.appendChild(open);
        options.appendChild(updateInfo.note()); // informacja o nowej wersji, tylko gdy jest
        column.insertBefore(section, column.firstChild);
        refreshOpenButton();
    }

    function refreshOpenButton() {
        const total = counts.ignored + counts.filtered;
        const active = hideActive() || settings.ignored.length > 0;
        for (const btn of document.querySelectorAll('.la-open-btn')) {
            btn.textContent = `${settings.panelOpen ? '◂' : '▸'} Ukrywanie i zestawy${total ? ` (${total})` : ''}`;
            btn.classList.toggle('la-open-active', active);
        }
    }

    function updateCounts(ignored, filtered) {
        counts.ignored = ignored;
        counts.filtered = filtered;
        if (panel) {
            panel.querySelector('.la-ignore-count').textContent = ignored ? `ukryte na liście: ${ignored}` : '';
            panel.querySelector('.la-hide-count').textContent = filtered ? `ukryte: ${filtered}` : '';
        }
        refreshOpenButton();
    }

    /* ================== PANEL OBOK OKNA ================== */

    let panel = null;
    let panelTimer = null;

    // Klawisze w polach dodatku nie mogą trafiać do skrótów gry.
    function isolateKeys(input, onEnter) {
        for (const type of ['keydown', 'keyup', 'keypress']) {
            input.addEventListener(type, event => {
                event.stopPropagation();
                if (type === 'keydown' && event.key === 'Enter' && onEnter) onEnter();
            });
        }
    }

    function togglePanel() {
        settings.panelOpen = !settings.panelOpen;
        saveSettings();
        if (settings.panelOpen) showPanel();
        else hidePanel();
        refreshOpenButton();
    }

    function showPanel() {
        if (!auctionContent()) return;
        if (!panel) panel = buildPanel();
        panel.style.display = '';
        refreshHideControls();
        renderPresetList();
        renderIgnoredList();
        updateCounts(counts.ignored, counts.filtered);
        positionPanel();
        if (!panelTimer) panelTimer = setInterval(positionPanel, 250);
    }

    function hidePanel() {
        if (panel) panel.style.display = 'none';
        clearInterval(panelTimer);
        panelTimer = null;
    }

    // Panel stoi obok okna aukcji (po lewej, a gdy brak miejsca - po prawej) i podąża za nim przy przesuwaniu.
    function positionPanel() {
        const content = auctionContent();
        if (!content || !panel) {
            hidePanel(); // okno zamknięte - panel wróci przy następnym otwarciu, jeśli był otwarty
            return;
        }
        const rect = content.getBoundingClientRect();
        const gap = 14;
        const width = panel.offsetWidth;
        const height = panel.offsetHeight;
        let left;
        if (rect.left - gap - width >= 0) left = rect.left - gap - width;
        else if (rect.right + gap + width <= window.innerWidth) left = rect.right + gap;
        else left = 0;
        const top = Math.max(0, Math.min(rect.top, window.innerHeight - height));
        panel.style.left = `${Math.round(left)}px`;
        panel.style.top = `${Math.round(top)}px`;
        panel.style.maxHeight = `${window.innerHeight - 10}px`;
    }

    function buildPanel() {
        const el = document.createElement('div');
        el.className = 'la-panel';
        el.innerHTML = `
            <div class="la-panel-header">
                <span>Lepsze aukcje</span>
                <span class="la-panel-close" title="Zamknij panel">✕</span>
            </div>
            <div class="la-panel-hint">Wszystko, co tu wpiszesz lub zaznaczysz, jest <b>ukrywane</b> na liście aukcji.</div>
            <div class="la-panel-body">
                <div class="la-col">
                    <div class="la-block">
                        <div class="la-title">Zapisane zestawy</div>
                        <div class="la-add">
                            <input type="text" class="la-input la-preset-input" placeholder="nazwa zestawu" maxlength="40">
                            <div class="la-btn la-preset-save" title="Zapisz obecne filtry gry i dodatku (ta sama nazwa nadpisuje zestaw)">✓</div>
                        </div>
                        <div class="la-list la-preset-list"></div>
                    </div>
                    <div class="la-block">
                        <div class="la-title">Ukryj nazwy</div>
                        <div class="la-add">
                            <input type="text" class="la-input la-ignore-input" placeholder="nazwa lub jej część" maxlength="100" title="Ukrywa każdy przedmiot, który ma ten tekst w nazwie, np. &quot;skrzynia&quot; ukrywa wszystkie skrzynie">
                            <div class="la-btn la-ignore-add" title="Dodaj">+</div>
                        </div>
                        <div class="la-count la-ignore-count"></div>
                        <div class="la-list la-ignore-list"></div>
                    </div>
                </div>
                <div class="la-col la-hide-col">
                    <div class="la-block">
                        <div class="la-title">Ukryj cenę i poziom</div>
                        <div class="la-sublabel">cena (złoto)</div>
                        <div class="la-range-row">
                            <input type="text" class="la-input la-range-input" data-key="priceMin" placeholder="od" maxlength="15" title="np. 500k, 1.5m, 2g">
                            <span>–</span>
                            <input type="text" class="la-input la-range-input" data-key="priceMax" placeholder="do" maxlength="15" title="np. 500k, 1.5m, 2g">
                        </div>
                        <div class="la-sublabel">poziom</div>
                        <div class="la-range-row">
                            <input type="text" class="la-input la-range-input" data-key="lvlMin" placeholder="od" maxlength="4">
                            <span>–</span>
                            <input type="text" class="la-input la-range-input" data-key="lvlMax" placeholder="do" maxlength="4">
                        </div>
                    </div>
                </div>
            </div>
            <div class="la-panel-footer">
                <span class="la-count la-hide-count"></span>
                <span class="la-link la-hide-clear" title="Usuń ukrywanie ceny, poziomu, typu, rzadkości i profesji">wyczyść ukrywanie</span>
            </div>`;
        document.body.appendChild(el);

        el.querySelector('.la-panel-close').addEventListener('click', togglePanel);
        // Kliknięcia w panelu nie mogą trafiać do gry (np. ruch postaci po kliknięciu w mapę pod spodem).
        for (const type of ['mousedown', 'mouseup', 'click', 'contextmenu', 'wheel']) {
            el.addEventListener(type, event => event.stopPropagation());
        }

        // Zestawy
        const presetInput = el.querySelector('.la-preset-input');
        const save = () => {
            savePreset(presetInput.value);
            presetInput.value = '';
        };
        isolateKeys(presetInput, save);
        el.querySelector('.la-preset-save').addEventListener('click', save);

        // Ukryte nazwy
        const ignoreInput = el.querySelector('.la-ignore-input');
        const add = () => {
            addIgnored(ignoreInput.value);
            ignoreInput.value = '';
        };
        isolateKeys(ignoreInput, add);
        el.querySelector('.la-ignore-add').addEventListener('click', add);

        // Przedziały
        const commit = input => {
            const key = input.dataset.key;
            const value = key.startsWith('price') ? parsePriceInput(input.value) : parseLevelInput(input.value);
            input.classList.toggle('la-invalid', value === undefined);
            if (value === undefined || value === settings[key]) return;
            settings[key] = value;
            saveSettings();
            refreshOpenButton();
            el.querySelector('.la-hide-clear').style.visibility = hideActive() ? '' : 'hidden';
            if (session) schedule(session);
        };
        for (const input of el.querySelectorAll('.la-range-input')) {
            let timer = null;
            isolateKeys(input, () => { commit(input); showRangeInput(input); });
            input.addEventListener('input', () => {
                clearTimeout(timer);
                timer = setTimeout(() => commit(input), 500);
            });
            input.addEventListener('blur', () => {
                clearTimeout(timer);
                commit(input);
                if (!input.classList.contains('la-invalid')) showRangeInput(input);
            });
        }

        // Przyciski typu, rzadkości i profesji
        const hideCol = el.querySelector('.la-hide-col');
        for (const filter of CHIP_FILTERS) {
            const block = document.createElement('div');
            block.className = 'la-block';
            const title = document.createElement('div');
            title.className = 'la-title';
            title.textContent = `Ukryj ${filter.title.toLowerCase()}`;
            const row = document.createElement('div');
            row.className = 'la-chips';
            for (const [value, label, tip] of filter.options) {
                const chip = document.createElement('span');
                chip.className = 'la-chip';
                chip.dataset.key = filter.key;
                chip.dataset.value = value;
                chip.textContent = label;
                chip.title = tip ? (tip.startsWith('Ukryj') ? tip : `Ukryj przedmioty: ${tip}`) : `Ukryj: ${label}`;
                chip.addEventListener('click', () => {
                    const list = settings[filter.key];
                    settings[filter.key] = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
                    filtersChanged();
                });
                row.appendChild(chip);
            }
            block.append(title, row);
            hideCol.appendChild(block);
        }

        el.querySelector('.la-hide-clear').addEventListener('click', () => {
            for (const key of RANGE_KEYS) settings[key] = null;
            for (const key of CHIP_KEYS) settings[key] = [];
            filtersChanged();
        });
        return el;
    }

    function showRangeInput(input) {
        const value = settings[input.dataset.key];
        input.value = input.dataset.key.startsWith('price') ? formatPriceInput(value) : (value === null ? '' : String(value));
        input.classList.remove('la-invalid');
    }

    function refreshHideControls() {
        if (!panel) return;
        for (const input of panel.querySelectorAll('.la-range-input')) {
            if (document.activeElement !== input) showRangeInput(input);
        }
        for (const chip of panel.querySelectorAll('.la-chip')) {
            chip.classList.toggle('la-chip-on', settings[chip.dataset.key].includes(chip.dataset.value));
        }
        panel.querySelector('.la-hide-clear').style.visibility = hideActive() ? '' : 'hidden';
    }

    function renderIgnoredList() {
        if (!panel) return;
        const list = panel.querySelector('.la-ignore-list');
        list.textContent = '';
        if (!settings.ignored.length) {
            list.appendChild(emptyRow('brak - wpisz tekst i naciśnij Enter albo PPM na przedmiot na liście'));
            return;
        }
        settings.ignored.forEach((name, index) => {
            list.appendChild(listRow(name, name, null, 'Przestań ukrywać', () => {
                setIgnored(settings.ignored.filter((_, i) => i !== index));
            }));
        });
    }

    function emptyRow(text) {
        const empty = document.createElement('div');
        empty.className = 'la-empty';
        empty.textContent = text;
        return empty;
    }

    function listRow(text, tip, onClick, removeTip, onRemove) {
        const row = document.createElement('div');
        row.className = 'la-row';
        const label = document.createElement('span');
        label.className = onClick ? 'la-name la-clickable' : 'la-name';
        label.textContent = text;
        label.title = tip;
        if (onClick) label.addEventListener('click', onClick);
        const remove = document.createElement('span');
        remove.className = 'la-remove';
        remove.textContent = '✕';
        remove.title = removeTip;
        remove.addEventListener('click', onRemove);
        row.append(label, remove);
        return row;
    }

    /* ================== ZAPISANE ZESTAWY ================== */

    // Pole gry: createNiInput nadaje klasę opakowaniu, a samo pole jest w środku.
    function gameInput(content, cls) {
        const el = content.querySelector(`.auction-search-item .${cls}`);
        if (!el) return null;
        return el.matches('input') ? el : el.querySelector('input');
    }

    // Menu gry trzyma wybraną wartość w atrybucie value elementu .menu-option (stąd czyta ją wyszukiwanie).
    function gameMenu(content, cls) {
        const wrapper = content.querySelector(`.auction-search-item .${cls} .menu-wrapper`);
        return wrapper ? { wrapper, current: wrapper.querySelector('.menu-option') } : null;
    }

    function readGameFilters(content) {
        const game = {};
        for (const [key, cls] of GAME_INPUTS) {
            const input = gameInput(content, cls);
            game[key] = input ? input.value : '';
        }
        for (const [key, cls] of GAME_MENUS) {
            const menu = gameMenu(content, cls);
            game[key] = menu && menu.current ? (menu.current.getAttribute('value') ?? '') : '';
            game[`${key}Text`] = menu && menu.current ? menu.current.textContent.trim() : '';
        }
        return game;
    }

    // To samo co gra robi przy wyborze swojego zapisanego filtra: wpisuje pola, ustawia menu bez wywołania wyszukiwania.
    function writeGameFilters(content, game) {
        const $ = window.$;
        for (const [key, cls] of GAME_INPUTS) {
            const input = gameInput(content, cls);
            if (!input) continue;
            input.value = game[key] || '';
            if ($) $(input).trigger('change');
            else input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        for (const [key, cls] of GAME_MENUS) {
            const menu = gameMenu(content, cls);
            if (!menu || !menu.current) continue;
            const value = game[key] ?? '';
            const option = Array.from(menu.wrapper.querySelectorAll('.option')).find(o => (o.getAttribute('value') ?? '') === String(value));
            const text = option ? (option.getAttribute('selectedText') || (option.querySelector('.text') || option).innerHTML) : game[`${key}Text`];
            menu.current.setAttribute('value', value);
            if (text) menu.current.innerHTML = text;
        }
    }

    function describePreset(preset) {
        const g = preset.game;
        const a = preset.addon;
        const range = (from, to) => (from || to ? `${from || '…'} – ${to || '…'}` : null);
        const lines = [
            g.name && `wyszukiwarka - nazwa: ${g.name}`,
            range(g.minPrice, g.maxPrice) && `wyszukiwarka - cena: ${range(g.minPrice, g.maxPrice)}`,
            range(g.minLvl, g.maxLvl) && `wyszukiwarka - poziom: ${range(g.minLvl, g.maxLvl)}`,
            g.type && g.typeText && `wyszukiwarka - typ: ${g.typeText}`,
            g.rarity && g.rarityText && `wyszukiwarka - rzadkość: ${g.rarityText}`,
            g.prof && g.profText && `wyszukiwarka - profesja: ${g.profText}`,
            range(formatPriceInput(a.priceMin), formatPriceInput(a.priceMax)) && `ukryj cenę: ${range(formatPriceInput(a.priceMin), formatPriceInput(a.priceMax))}`,
            range(a.lvlMin ?? '', a.lvlMax ?? '') && `ukryj poziom: ${range(a.lvlMin ?? '', a.lvlMax ?? '')}`,
            ...CHIP_FILTERS.map(f => {
                const chosen = a[f.key] || [];
                if (!chosen.length) return null;
                const labels = f.options.filter(o => chosen.includes(o[0])).map(o => o[1]);
                return `ukryj ${f.title.toLowerCase()}: ${labels.join(', ')}`;
            }),
            `grupowanie: ${a.group ? 'tak' : 'nie'}`,
        ].filter(Boolean);
        return `${preset.name}\n\n${lines.join('\n')}\n\nkliknij, aby wczytać`;
    }

    function savePreset(name) {
        const content = auctionContent();
        const clean = String(name || '').replace(/\s+/g, ' ').trim();
        if (!clean || !content) return;
        const addon = { group: settings.group };
        for (const key of RANGE_KEYS) addon[key] = settings[key];
        for (const key of CHIP_KEYS) addon[key] = [...settings[key]];
        const preset = { name: clean, game: readGameFilters(content), addon };
        const index = settings.presets.findIndex(p => normalizeName(p.name) === normalizeName(clean));
        if (index >= 0) settings.presets[index] = preset; // ta sama nazwa nadpisuje zestaw
        else settings.presets.push(preset);
        saveSettings();
        renderPresetList();
    }

    function loadPreset(preset) {
        const content = auctionContent();
        if (!content) return;
        settings.group = !!preset.addon.group;
        for (const key of RANGE_KEYS) settings[key] = preset.addon[key] ?? null;
        for (const key of CHIP_KEYS) settings[key] = [...(preset.addon[key] || [])];
        for (const checkbox of document.querySelectorAll('.la-option .checkbox')) checkbox.classList.toggle('active', settings.group);
        filtersChanged();
        writeGameFilters(content, preset.game);
        // Jedno wyszukiwanie od pierwszej strony, tak jak po Enterze w polu wyszukiwarki.
        const manager = window.Engine.auctions;
        manager.getAuctionRequest().firstPageOfMainAuctionRequest();
        manager.getAuctionWindow().setVisibleAllAuctionsInfoWrapper(false);
        manager.getAuctionWindow().setVisibleAmountOfAuction(true);
    }

    function renderPresetList() {
        if (!panel) return;
        const list = panel.querySelector('.la-preset-list');
        list.textContent = '';
        if (!settings.presets.length) {
            list.appendChild(emptyRow('brak - ustaw filtry, wpisz nazwę i naciśnij Enter'));
            return;
        }
        settings.presets.forEach((preset, index) => {
            list.appendChild(listRow(preset.name, describePreset(preset), () => loadPreset(preset), 'Usuń zestaw', () => {
                settings.presets = settings.presets.filter((_, i) => i !== index);
                saveSettings();
                renderPresetList();
            }));
        });
    }

    /* ================== STYLE ================== */

    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Sekcje kategorii gry mają stałą wysokość - nasza musi rosnąć razem z zawartością. */
            .all-categories-auction .la-section { height: auto !important; max-height: none !important; overflow: visible !important; }
            .la-section .la-options { display: block; position: static; height: auto; padding: 4px 6px; box-sizing: border-box; }
            .la-section .la-option { cursor: pointer; }
            .la-open-btn {
                margin-top: 5px; padding: 3px 4px; text-align: center; cursor: pointer; user-select: none;
                border: 1px solid #6b5a2e; border-radius: 3px; background: rgba(0, 0, 0, 0.4); color: #f0dc9a; font-size: 11px;
            }
            .la-open-btn:hover { border-color: #c9a54a; background: rgba(201, 165, 74, 0.25); }
            .la-open-btn.la-open-active { border-color: #c9a54a; }
            .la-section .ma-update { margin-top: 6px; padding: 4px 0 0; }

            .auction-table tr.la-member td { background: rgba(255, 255, 255, 0.05); }
            .auction-table tr.la-member td:first-child { box-shadow: inset 3px 0 0 #c9a54a; }
            .auction-table tr.la-expanded td:first-child { box-shadow: inset 3px 0 0 #c9a54a; }
            .auction-table tr.la-last td { border-bottom: 1px solid rgba(201, 165, 74, 0.6); }
            .la-badge {
                display: block; width: fit-content; margin: 3px auto 0; padding: 1px 6px; border-radius: 3px;
                background: rgba(201, 165, 74, 0.25); border: 1px solid #c9a54a; color: #f0dc9a;
                font-size: 11px; cursor: pointer; user-select: none; white-space: nowrap;
            }
            .la-badge:hover { background: rgba(201, 165, 74, 0.45); }

            .la-panel {
                position: fixed; z-index: 1000; width: 420px; box-sizing: border-box; overflow-y: auto;
                background: rgba(24, 20, 14, 0.97); border: 1px solid #c9a54a; border-radius: 4px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7); color: #ddd; font: 11px Arial, sans-serif;
            }
            .la-panel-header {
                display: flex; justify-content: space-between; align-items: center; padding: 5px 8px;
                background: rgba(201, 165, 74, 0.2); border-bottom: 1px solid #6b5a2e; color: #f0dc9a; font-size: 12px; font-weight: bold;
            }
            .la-panel-close { cursor: pointer; color: #d66; padding: 0 3px; }
            .la-panel-close:hover { color: #f88; }
            .la-panel-hint { padding: 6px 10px; color: #aaa; line-height: 1.4; border-bottom: 1px solid rgba(107, 90, 46, 0.5); }
            .la-panel-hint b { color: #f0dc9a; }
            .la-panel-body { display: flex; align-items: flex-start; gap: 8px; padding: 8px; }
            .la-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
            .la-block {
                padding: 6px 7px 8px; border: 1px solid rgba(107, 90, 46, 0.7); border-radius: 3px;
                background: rgba(255, 255, 255, 0.035);
            }
            .la-title {
                margin: -1px 0 7px; padding-bottom: 4px; border-bottom: 1px solid rgba(201, 165, 74, 0.35);
                color: #f0dc9a; font-weight: bold;
            }
            .la-sublabel { margin: 6px 0 3px; color: #b9a46a; }
            .la-title + .la-sublabel { margin-top: 0; }
            .la-add, .la-range-row { display: flex; align-items: center; gap: 4px; }
            .la-panel-footer {
                display: flex; justify-content: space-between; align-items: center; min-height: 14px;
                padding: 6px 10px; border-top: 1px solid rgba(107, 90, 46, 0.5);
            }
            .la-input {
                flex: 1; min-width: 0; width: 0; box-sizing: border-box; height: 22px; padding: 0 5px;
                background: rgba(0, 0, 0, 0.5); border: 1px solid #6b5a2e; color: #eee; font-size: 11px;
            }
            .la-input:focus { outline: none; border-color: #c9a54a; }
            .la-input.la-invalid { border-color: #d66; }
            .la-btn {
                flex: none; width: 22px; height: 22px; line-height: 20px; text-align: center; box-sizing: border-box; cursor: pointer;
                border: 1px solid #c9a54a; border-radius: 3px; background: rgba(201, 165, 74, 0.25); color: #f0dc9a; user-select: none;
            }
            .la-btn:hover { background: rgba(201, 165, 74, 0.45); }
            .la-list { margin-top: 6px; max-height: 150px; overflow-y: auto; }
            .la-row { display: flex; align-items: center; gap: 4px; padding: 3px 2px; border-radius: 2px; }
            .la-row + .la-row { border-top: 1px solid rgba(255, 255, 255, 0.06); }
            .la-row:hover { background: rgba(255, 255, 255, 0.06); }
            .la-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .la-clickable { cursor: pointer; color: #f0dc9a; }
            .la-clickable:hover { color: #fff; text-decoration: underline; }
            .la-remove { color: #d66; cursor: pointer; padding: 0 3px; user-select: none; }
            .la-remove:hover { color: #f88; }
            .la-empty { color: #888; font-style: italic; line-height: 1.4; }
            .la-count { color: #b9a46a; }
            .la-ignore-count:not(:empty) { margin-top: 5px; }
            .la-chips { display: flex; flex-wrap: wrap; gap: 5px 4px; }
            .la-chip {
                padding: 2px 6px; border-radius: 3px; cursor: pointer; user-select: none; line-height: 14px;
                border: 1px solid #6b5a2e; background: rgba(0, 0, 0, 0.4); color: #bbb;
            }
            .la-chip:hover { border-color: #c9a54a; color: #eee; }
            .la-chip.la-chip-on { border-color: #d66; background: rgba(200, 70, 70, 0.35); color: #fff; text-decoration: line-through; }
            .la-link { color: #f0dc9a; cursor: pointer; text-decoration: underline; user-select: none; }
            .la-link:hover { color: #fff; }
        `;
        document.head.appendChild(style);
    }

    /* ================== MENU KONTEKSTOWE ================== */

    // Przedmiot z wiersza aukcji, w który kliknięto PPM (wiersz -> id oferty -> item_id).
    function auctionItemFromEvent(event) {
        const target = event && event.target;
        if (!session || !target || !target.closest || !target.closest('.auction-table')) return null;
        const row = target.closest('tr');
        if (!row) return null;
        if (session.manager.convertKindToTab(session.manager.getActualKindOfAuction()) === MY_AUCTION_OFF_TAB) return null;
        for (const [id, offer] of session.offers) {
            const one = session.manager.getOneOffer(id);
            if (one && one.get$Offer && one.get$Offer()[0] === row) return window.Engine.items.getItemById(offer.item_id) || null;
        }
        return null;
    }

    function installMenuHook() {
        const ui = window.Engine.interface;
        const showPopupMenu = ui.showPopupMenu;
        ui.showPopupMenu = function (items, event) {
            try {
                const item = Array.isArray(items) && auctionItemFromEvent(event);
                if (item && item.name) items.push(['Ukryj na aukcjach', () => addIgnored(item.name)]);
            } catch (e) { console.warn('[Lepsze aukcje] błąd menu', e); }
            return showPopupMenu.apply(this, arguments);
        };
    }

    /* ================== START ================== */

    function start() {
        saveSettings(); // zapis po ewentualnym przejściu na tryb ukrywania
        addStyles();
        installMenuHook();
        window.API.addCallbackToEvent(window.Engine.apiData.AUCTIONS_UPDATE, data => {
            try { onAuctionsUpdate(data); } catch (e) { console.warn('[Lepsze aukcje] błąd', e); }
        });
    }

    function waitFor(isReady, callback) {
        if (isReady()) callback();
        else setTimeout(() => waitFor(isReady, callback), 50);
    }

    waitFor(() => {
        const Engine = window.Engine;
        return document.head && document.body && window.API && window.API.addCallbackToEvent && Engine && Engine.apiData
            && Engine.apiData.AUCTIONS_UPDATE && Engine.items && Engine.items.getItemById && typeof window.createCheckBox === 'function'
            && Engine.interface && typeof Engine.interface.showPopupMenu === 'function';
    }, start);
})();
