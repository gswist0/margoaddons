// ==UserScript==
// @name         Pseudonimy
// @version      2.0
// @description  Własne pseudonimy dla graczy, wyświetlane zamiast nicku w całej grze (mapa, czat, dymki, grupa, klan, znajomi, walka...). Pseudonim dotyczy całego konta gracza (wszystkich jego postaci).
// @match        https://*.margonem.pl/
// @match        https://*.margonem.com/
// @author       Bancewald
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

// Pseudonim jest przypisany do numeru konta (d.account graczy na mapie, acc w wizytówkach czatu),
// więc obejmuje wszystkie postacie gracza. Interfejs pokazuje tylko nick, dlatego dodatek zapamiętuje
// nicki postaci kont z pseudonimem (osobno dla każdego serwera) i podmienia je we wszystkich tekstach strony.
// Każdy serwer to osobna subdomena z osobnym localStorage, dlatego pseudonimy i ustawienia są trzymane
// w pamięci Tampermonkeya (GM_*), wspólnej dla wszystkich serwerów.
// Nick nad postacią na mapie jest rysowany na canvasie - tam podmieniany jest osobno.

(() => {
    'use strict';

    /* ================== INFORMACJA O NOWEJ WERSJI ================== */
    // Lista aktualnych wersji jest w pliku versions.json na GitHubie. Dodatek NIE aktualizuje się sam,
    // tylko pokazuje na dole swojego okna informację z linkiem do nowej wersji.
    const updateInfo = (() => {
        const ID = 'pseudonimy';
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

    // okno strony gry (dodatek z uprawnieniami GM działa w piaskownicy)
    const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    if (page.__pseudonimy) return;
    page.__pseudonimy = true;

    /* ================== USTAWIENIA ================== */

    const ADDON_NAME = 'Pseudonimy';
    const STORAGE_KEY = 'pseudonimy';
    const ENABLED_KEY = 'pseudonimy_wlaczone';
    const CHAT_LEVEL_KEY = 'pseudonimy_poziom_czat';
    const PANEL_POSITION_KEY = 'pseudonimy_pozycja';
    const WIDGET_KEY = 'pseudonimy';
    const WIDGET_ICON = 'https://raw.githubusercontent.com/gswist0/margoaddons/refs/heads/main/ps_clear.png';
    const DEFAULT_WIDGET_POSITION = [0, 'bottom-right-additional'];
    const MAX_ALIAS_LENGTH = 24;
    const MENU_ADD = 'Dodaj pseudonim';
    const MENU_EDIT = 'Zmień pseudonim';

    let world = '';
    let enabled = readEnabled();
    let chatLevel = readChatLevel();
    let store = {};                  // { [konto]: { alias, nicks: { [serwer]: [nick, ...] } } }
    const nickToAccount = new Map(); // nick -> konto, tylko aktualny serwer
    const nickInfo = new Map();      // nick -> { lvl, oplvl, prof }, tylko z bieżącej sesji

    /* ================== DANE ================== */

    const Engine = () => page.Engine;

    // Wspólna pamięć wszystkich serwerów. Wartości zapisane wcześniej w localStorage danego serwera
    // są używane, dopóki nie ma nic we wspólnej pamięci.
    function readShared(key) {
        try {
            const value = GM_getValue(key);
            if (value !== undefined) return value;
        } catch (e) { /* brak GM - zostaje localStorage */ }
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    function writeShared(key, value) {
        try { GM_setValue(key, value); return; } catch (e) { /* brak GM - zostaje localStorage */ }
        try { localStorage.setItem(key, value); } catch (e) { console.warn('[Pseudonimy] zapis nieudany', e); }
    }

    function readEnabled() {
        return readShared(ENABLED_KEY) !== '0';
    }

    // Wyłączenie przywraca wszędzie prawdziwe nicki; pseudonimy zostają zapisane.
    function setEnabled(value) {
        enabled = value;
        writeShared(ENABLED_KEY, enabled ? '1' : '0');
        refreshAll();
    }

    function readChatLevel() {
        return readShared(CHAT_LEVEL_KEY) !== '0';
    }

    // Poziom i profesja przy pseudonimie na czacie, np. "Pseudonim (100w): ".
    function setChatLevel(value) {
        chatLevel = value;
        writeShared(CHAT_LEVEL_KEY, chatLevel ? '1' : '0');
        refreshAll();
    }

    // Poziom i profesję podają wizytówki czatu i gracze na mapie; zmiana u gracza z pseudonimem odświeża czat.
    function learnInfo(nick, lvl, oplvl, prof) {
        if (!nick || !lvl) return;
        const previous = nickInfo.get(nick);
        const info = { lvl: Number(lvl), oplvl: Number(oplvl) || 0, prof: prof || '' };
        if (previous && previous.lvl === info.lvl && previous.oplvl === info.oplvl && previous.prof === info.prof) return;
        nickInfo.set(nick, info);
        if (chatLevel && aliasForNick(nick)) scheduleRefresh();
    }

    // Zawsze faktyczny poziom, bez poziomu operacyjnego (także powyżej 300 poziomu), np. "(350w)".
    function levelText(nick) {
        const info = nickInfo.get(nick);
        return info ? `(${info.lvl}${info.prof})` : '';
    }

    const parseStore = text => {
        let data = null;
        try { data = JSON.parse(text); } catch (e) { /* uszkodzony zapis */ }
        return data && typeof data === 'object' ? data : {};
    };

    function loadStore() {
        store = parseStore(readShared(STORAGE_KEY));
        nickToAccount.clear();
        for (const [account, entry] of Object.entries(store)) {
            for (const nick of (entry.nicks && entry.nicks[world]) || []) nickToAccount.set(nick, account);
        }
    }

    function saveStore() {
        writeShared(STORAGE_KEY, JSON.stringify(store));
    }

    // Pseudonimy z wersji przed 1.9 leżą w localStorage serwera, na którym je dodano - dołączamy je
    // do wspólnej pamięci (pseudonimy już tam zapisane mają pierwszeństwo, nicki są łączone).
    function migrateLocalStore() {
        let text = null;
        try { text = localStorage.getItem(STORAGE_KEY); } catch (e) { return; }
        if (!text) return;
        let shared;
        try { shared = GM_getValue(STORAGE_KEY); } catch (e) { return; }
        const target = parseStore(shared);
        for (const [account, entry] of Object.entries(parseStore(text))) {
            if (!entry || !entry.alias) continue;
            const merged = target[account] = target[account] || { alias: entry.alias, nicks: {} };
            merged.nicks = merged.nicks || {};
            for (const [server, nicks] of Object.entries(entry.nicks || {})) {
                const list = merged.nicks[server] = merged.nicks[server] || [];
                for (const nick of nicks || []) if (!list.includes(nick)) list.push(nick);
            }
        }
        for (const key of [ENABLED_KEY, CHAT_LEVEL_KEY]) {
            try {
                const value = localStorage.getItem(key);
                if (value !== null && GM_getValue(key) === undefined) GM_setValue(key, value);
            } catch (e) { /* zostaje domyślne */ }
        }
        try {
            GM_setValue(STORAGE_KEY, JSON.stringify(target));
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) { console.warn('[Pseudonimy] przeniesienie nieudane', e); }
    }

    const ownAccount = () => String(Engine().hero.d.account);
    const isOwnAccount = account => String(account) === ownAccount();

    function aliasForAccount(account) {
        const entry = account !== undefined && account !== null ? store[account] : null;
        return entry ? entry.alias : null;
    }

    function aliasForNick(nick) {
        if (!nick) return null;
        return aliasForAccount(nickToAccount.get(nick));
    }

    // Zapamiętuje, do którego konta należy postać. Nicki kont z pseudonimem są zapisywane na stałe,
    // żeby działały też dla wiadomości wczytanych zanim dodatek poznał konto (np. po odświeżeniu gry).
    function learn(nick, account) {
        if (!nick || account === undefined || account === null || account === '') return;
        account = String(account);
        const previous = nickToAccount.get(nick);
        if (previous === account) return;
        nickToAccount.set(nick, account);
        // nowa postać konta z pseudonimem (albo nick, który zmienił konto) - trzeba przeliczyć widoczne teksty
        if (store[account] || (previous && store[previous])) scheduleRefresh();
        let changed = false;
        if (previous && previous !== account && store[previous]) changed = removeNick(previous, nick);
        const entry = store[account];
        if (entry) {
            entry.nicks = entry.nicks || {};
            const list = entry.nicks[world] = entry.nicks[world] || [];
            if (!list.includes(nick)) {
                list.push(nick);
                changed = true;
            }
        }
        if (changed) saveStore();
    }

    function removeNick(account, nick) {
        const list = store[account].nicks && store[account].nicks[world];
        const index = list ? list.indexOf(nick) : -1;
        if (index < 0) return false;
        list.splice(index, 1);
        return true;
    }

    function setAlias(account, nick, alias) {
        account = String(account);
        if (isOwnAccount(account)) return;
        alias = alias.replace(/\s+/g, ' ').trim().slice(0, MAX_ALIAS_LENGTH);
        if (!alias) {
            delete store[account];
        } else {
            const entry = store[account] = store[account] || { nicks: {} };
            entry.alias = alias;
            entry.nicks = entry.nicks || {};
            const list = entry.nicks[world] = entry.nicks[world] || [];
            // wszystkie znane już postacie tego konta na serwerze
            for (const [knownNick, knownAccount] of nickToAccount) {
                if (knownAccount === account && !list.includes(knownNick)) list.push(knownNick);
            }
            if (nick && !list.includes(nick)) list.push(nick);
        }
        if (nick) nickToAccount.set(nick, account);
        saveStore();
        refreshAll();
    }

    function forEachOther(callback) {
        const others = Engine().others && Engine().others.check();
        for (const id in others || {}) if (others[id]) safely(callback, others[id]);
    }

    function findOtherByNick(nick) {
        const others = Engine().others && Engine().others.check();
        for (const id in others || {}) {
            const d = others[id] && others[id].d;
            if (d && d.nick === nick) return d;
        }
        return null;
    }

    /* ================== WYŚWIETLANIE ================== */

    const escapeHTML = text => String(text).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
    const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    function safely(action, ...args) {
        try { return action(...args); } catch (e) { console.warn('[Pseudonimy]', e); }
    }

    // Nicki są podmieniane w tekstach całego interfejsu (czat, dymki, grupa, klan, znajomi, walka itd.).
    // Nick musi stać jako osobne słowo - "Kot" nie zostanie podmieniony w "Kotlet".
    let nickPattern = null;
    let nickPatternDirty = true;

    function getNickPattern() {
        if (!enabled) return null;
        if (!nickPatternDirty) return nickPattern;
        nickPatternDirty = false;
        const nicks = [...nickToAccount.keys()].filter(nick => aliasForNick(nick));
        // dłuższe nicki najpierw, żeby "Jan Kowalski" wygrał z "Jan"
        nicks.sort((a, b) => b.length - a.length);
        nickPattern = nicks.length
            ? new RegExp(`(?<![\\p{L}\\p{N}_])(?:${nicks.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}_])`, 'gu')
            : null;
        return nickPattern;
    }

    // Oryginalny tekst węzła, żeby po zmianie lub usunięciu pseudonimu dało się go odtworzyć.
    const replacedTexts = new WeakMap();
    let anyReplaced = false;
    // Treść wiadomości od graczy zostaje nietknięta - podmieniany jest tylko nick autora/odbiorcy.
    // Wyjątek to komunikaty bez autora (ps-system), np. "X zalogował się" z klanu lub znajomych.
    // Odbiorca prywatnej wiadomości (nad polem czatu i w nagłówku czatu na telefonie) pokazuje prawdziwy nick,
    // bo wiadomość i tak idzie do prawdziwej postaci - pseudonim sugerowałby co innego.
    const SYSTEM_MESSAGE_CLASS = 'ps-system';
    const SKIPPED = `.ps-window, .ps-keep, .new-chat-message:not(.${SYSTEM_MESSAGE_CLASS}) .message-part, .chat-input-wrapper, .chat-header-mobile, `
        + 'script, style, textarea, input, [contenteditable=""], [contenteditable="true"]';

    function processTextNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest(SKIPPED)) return;
        const saved = replacedTexts.get(node);
        const original = saved && saved.shown === node.data ? saved.original : node.data;
        const pattern = getNickPattern();
        // poziom i profesja: przy autorze/odbiorcy wiadomości i w treści komunikatów systemowych
        const withLevel = chatLevel && parent.closest(
            `.new-chat-message .author-section, .new-chat-message .receiver-section, .new-chat-message.${SYSTEM_MESSAGE_CLASS} .message-part`
        );
        const replace = (nick, offset, text) => {
            const alias = aliasForNick(nick);
            if (!alias) return nick;
            // gra sama podała już poziom za nickiem, np. "Nick (100w)" - nie dublujemy
            const hasLevel = /^\s*\(\d/.test(text.slice(offset + nick.length));
            const level = withLevel && !hasLevel ? levelText(nick) : '';
            return level ? `${alias} ${level}` : alias;
        };
        const shown = pattern ? original.replace(pattern, replace) : original;
        if (shown === original) {
            if (saved) {
                replacedTexts.delete(node);
                if (node.data !== original) node.data = original;
            }
            return;
        }
        replacedTexts.set(node, { original, shown });
        anyReplaced = true;
        if (node.data !== shown) node.data = shown;
    }

    function processTree(root) {
        if (root.nodeType === Node.TEXT_NODE) return processTextNode(root);
        if (root.nodeType !== Node.ELEMENT_NODE || root.closest(SKIPPED)) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) processTextNode(node);
    }

    function installTextObserver() {
        const observer = new MutationObserver(mutations => {
            if (!getNickPattern() && !anyReplaced) return;
            for (const mutation of mutations) {
                if (mutation.type === 'characterData') safely(processTextNode, mutation.target);
                else mutation.addedNodes.forEach(node => safely(processTree, node));
            }
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        safely(processTree, document.body);
    }

    // Nick nad postacią na mapie jest rysowany na canvasie z getNick() gracza i trzymany w pamięci podręcznej,
    // więc podmieniamy getNick tylko na czas rysowania - reszta gry dalej widzi prawdziwy nick.
    function patchOther(other) {
        if (other.__pseudonymPatched || typeof other.getDataDrawer !== 'function') return;
        const drawer = other.getDataDrawer();
        if (!drawer || typeof drawer.draw !== 'function') return;
        other.__pseudonymPatched = true;
        const draw = drawer.draw;
        drawer.draw = function () {
            const alias = enabled && other.d && aliasForAccount(other.d.account);
            if (!alias) return draw.apply(this, arguments);
            const getNick = other.getNick;
            other.getNick = () => alias;
            try {
                return draw.apply(this, arguments);
            } finally {
                other.getNick = getNick;
            }
        };
        if (other.clearDataToDraw) other.clearDataToDraw();
    }

    function refreshAll() {
        nickPatternDirty = true;
        safely(processTree, document.body);
        forEachOther(other => { if (other.clearDataToDraw) other.clearDataToDraw(); });
        safely(() => Engine().others.otherTipRefresh());
        renderPanel();
    }

    let refreshTimer = null;
    function scheduleRefresh() {
        nickPatternDirty = true;
        if (refreshTimer || !document.body) return;
        refreshTimer = setTimeout(() => {
            refreshTimer = null;
            refreshAll();
        }, 100);
    }

    /* ================== HAKI GRY ================== */

    // Wizytówki z czatu zawierają konto autora - dzięki nim wiadomo, czyj jest nick na czacie.
    function installCardHook() {
        const manager = Engine().businessCardManager;
        const updateData = manager.updateData;
        manager.updateData = function (cards) {
            safely(() => {
                for (const key in cards || {}) {
                    const card = cards[key];
                    learn(card.nick, card.acc);
                    learnInfo(card.nick, card.lvl, card.oplvl, card.prof);
                }
            });
            return updateData.apply(this, arguments);
        };
    }

    // Gra dodaje każdą wiadomość czatu z nickiem autora - komunikaty systemowe i klanowe (logowanie itd.) nie mają autora.
    // Oznaczamy je przed dodaniem, bo gra kopiuje wiadomość jeszcze do kanału ogólnego.
    function installChatHook() {
        const chat = Engine().chatController;
        const wrapper = chat.getChatMessageWrapper();
        const append = wrapper.appendMessageToMessageWrapper;
        wrapper.appendMessageToMessageWrapper = function (channel, author, $message) {
            safely(() => {
                if (!author && $message && $message[0]) $message[0].classList.add(SYSTEM_MESSAGE_CLASS);
            });
            return append.apply(this, arguments);
        };
        // wiadomości wczytane przed startem dodatku nie mają oznaczenia - gra buduje je od nowa
        if (document.querySelector('.new-chat-message')) safely(() => chat.rebuiltMessage());
    }

    // Dymek gracza na mapie jest budowany przy każdej jego aktualizacji - dobry moment, żeby poznać konto postaci.
    function installTipHook() {
        const others = Engine().others;
        const createStrTip = others.createStrTip;
        others.createStrTip = function (data) {
            safely(() => {
                const other = data && data.object;
                if (!other || !other.d) return;
                learnOther(other.d);
                patchOther(other);
            });
            return createStrTip.apply(this, arguments);
        };
    }

    function learnOther(d) {
        learn(d.nick, d.account);
        learnInfo(d.nick, d.lvl, d.oplvl, d.prof);
    }

    function watchOthers() {
        const sweep = () => forEachOther(other => {
            if (other.d) learnOther(other.d);
            patchOther(other);
        });
        sweep();
        setInterval(sweep, 1000);
    }

    function translate(key) {
        try { return page._t(key, null, 'menu'); } catch (e) { return null; }
    }

    // Opcja jest dodawana do menu gracza na mapie i menu nicku na czacie - oba mają nagłówek z nickiem i "Pokaż profil".
    function installMenuHook() {
        const ui = Engine().interface;
        const showPopupMenu = ui.showPopupMenu;
        ui.showPopupMenu = function (items, event, options) {
            const patchedOptions = safely(() => {
                if (!Array.isArray(items) || !options || typeof options.header !== 'string') return null;
                const nick = options.header;
                if (nick === Engine().hero.d.nick) return null;
                const profile = translate('show_profile');
                if (!profile || !items.some(item => item && item[0] === profile)) return null;

                let account = null;
                if (options.onMap) {
                    const d = findOtherByNick(nick);
                    if (d) { learn(d.nick, d.account); account = d.account; }
                } else {
                    account = nickToAccount.get(nick);
                }
                if (account === undefined || account === null || isOwnAccount(account)) return null;

                const alias = aliasForAccount(account);
                items.push([alias ? MENU_EDIT : MENU_ADD, () => openDialog(account, nick)]);
                // prawdziwy nick w nagłówku zostaje widoczny (ps-keep wyłącza go z podmiany)
                return alias && enabled
                    ? Object.assign({}, options, { header: `${escapeHTML(alias)} (<span class="ps-keep">${nick}</span>)` })
                    : null;
            });
            return showPopupMenu.call(this, items, event, patchedOptions || options);
        };
    }

    /* ================== OKNA ================== */

    function createElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function createButton(text, onClick) {
        const button = createElement('span', 'ps-btn', text);
        button.addEventListener('click', onClick);
        return button;
    }

    // Gra nasłuchuje klawiszy na całej stronie - pisanie w polu nie może sterować postacią.
    function isolateKeys(element) {
        ['keydown', 'keyup', 'keypress'].forEach(type => element.addEventListener(type, event => event.stopPropagation()));
    }

    function installStyle() {
        const style = document.createElement('style');
        style.textContent = `
            .main-buttons-container .widget-button .icon.${WIDGET_KEY} { background-image: url("${WIDGET_ICON}"); background-position: 0; }
            .ps-window { position: fixed; z-index: 9999; width: 300px; background: #1b1712; color: #e8dcc0; border: 2px solid #6b5a33; border-radius: 6px; font: 12px/1.35 Arial, sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,.6); }
            .ps-window, .ps-window * { box-sizing: border-box; }
            .ps-window[hidden], .ps-window [hidden] { display: none; }
            .ps-window .ps-head { display: flex; align-items: center; gap: 6px; padding: 5px 8px; user-select: none; background: linear-gradient(#3a2f1a, #2a2212); border-bottom: 1px solid #6b5a33; border-radius: 4px 4px 0 0; }
            .ps-window .ps-title { flex: 1; font-weight: bold; color: #f1d58a; }
            .ps-window .ps-body { display: flex; flex-direction: column; gap: 8px; padding: 8px; }
            .ps-window .ps-info { color: #a89a7a; font-size: 11px; overflow-wrap: anywhere; }
            .ps-window input { width: 100%; padding: 3px 5px; background: #0f0d0a; color: #e8dcc0; border: 1px solid #6b5a33; border-radius: 3px; font: inherit; }
            .ps-window .ps-buttons { display: flex; gap: 6px; justify-content: flex-end; }
            .ps-window .ps-btn { cursor: pointer; background: #4a3d22; border: 1px solid #7a6639; color: #f1d58a; border-radius: 3px; padding: 0 8px; line-height: 20px; text-align: center; user-select: none; }
            .ps-window .ps-btn:hover { background: #5d4c2a; }
            .ps-window .ps-toggle { color: #d98a7a; }
            .ps-window .ps-toggle.on { color: #9fd18b; }
            .ps-window .ps-check { display: flex; align-items: center; gap: 5px; margin: 0; color: #e8dcc0; cursor: pointer; }
            .ps-window .ps-check input { width: auto; margin: 0; padding: 0; accent-color: #7a6639; cursor: pointer; }
            .ps-window .ps-section-title { color: #b9a56a; font-weight: bold; }
            .ps-window .ps-list { display: flex; flex-direction: column; gap: 2px; max-height: 300px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #7a6639 #0f0d0a; }
            .ps-window .ps-list.off { opacity: .5; }
            .ps-window .ps-row { display: flex; align-items: center; gap: 6px; padding: 3px 6px; background: #2a2212; border-radius: 3px; }
            .ps-window .ps-row-info { flex: 1; min-width: 0; }
            .ps-window .ps-row-alias { color: #f1d58a; font-weight: bold; overflow-wrap: anywhere; }
            .ps-window .ps-row-nicks { color: #a89a7a; font-size: 11px; overflow-wrap: anywhere; }
            #ps-panel .ps-head { cursor: move; }
            #ps-dialog { z-index: 10000; left: 50%; top: 30%; transform: translateX(-50%); width: 280px; }
        `;
        document.head.appendChild(style);
    }

    let dialog = null;

    function buildDialog() {
        const root = createElement('div', 'ps-window');
        root.id = 'ps-dialog';
        root.hidden = true;
        const head = createElement('div', 'ps-head');
        head.append(createElement('span', 'ps-title', 'Pseudonim gracza'), createButton('×', () => close(null)));
        const info = createElement('div', 'ps-info');
        const input = createElement('input');
        input.type = 'text';
        input.maxLength = MAX_ALIAS_LENGTH;
        input.placeholder = 'Pseudonim';
        const remove = createButton('Usuń', () => close(''));
        const buttons = createElement('div', 'ps-buttons');
        buttons.append(createButton('Zapisz', () => close(input.value)), remove, createButton('Anuluj', () => close(null)));
        const body = createElement('div', 'ps-body');
        body.append(info, input, buttons);
        root.append(head, body);
        isolateKeys(root);
        document.body.appendChild(root);

        let target = null;
        function close(value) {
            if (value !== null && target) setAlias(target.account, target.nick, value);
            target = null;
            root.hidden = true;
            input.blur();
        }
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') close(input.value);
            else if (event.key === 'Escape') close(null);
        });

        dialog = {
            open(account, nick) {
                target = { account: String(account), nick };
                const alias = aliasForAccount(account);
                info.textContent = `${nick || 'Gracz'} - pseudonim obejmie wszystkie postacie tego konta. Puste pole usuwa pseudonim.`;
                input.value = alias || '';
                remove.hidden = !alias;
                root.hidden = false;
                input.focus();
                input.select();
            },
        };
    }

    function openDialog(account, nick) {
        dialog.open(account, nick);
    }

    /* ================== MENU DODATKU ================== */

    let panel = null;
    let panelView = null;

    function buildPanel() {
        panel = createElement('div', 'ps-window');
        panel.id = 'ps-panel';
        panel.hidden = true;

        const head = createElement('div', 'ps-head');
        const close = createButton('×', () => { panel.hidden = true; });
        close.title = 'Zamknij';
        head.append(createElement('span', 'ps-title', ADDON_NAME), close);

        const toggle = createButton('', () => setEnabled(!enabled));
        toggle.classList.add('ps-toggle');
        toggle.title = 'Wyłączenie przywraca prawdziwe nicki, pseudonimy zostają zapisane';
        const levelRow = createElement('label', 'ps-check');
        const levelCheckbox = createElement('input');
        levelCheckbox.type = 'checkbox';
        levelCheckbox.addEventListener('change', () => {
            setChatLevel(levelCheckbox.checked);
            // bez fokusu spacja i strzałki znów sterują grą, a nie opcją
            levelCheckbox.blur();
        });
        levelRow.append(levelCheckbox, createElement('span', '', 'Poziom i profesja przy pseudonimie na czacie'));
        // Gra blokuje kółko myszy na całej stronie, z wyjątkiem elementów z klasą unblock-scroll.
        const list = createElement('div', 'ps-list unblock-scroll');
        const body = createElement('div', 'ps-body');
        body.append(
            toggle,
            levelRow,
            createElement('div', 'ps-section-title', 'Ustawione pseudonimy'),
            list,
            createElement('div', 'ps-info', 'Pseudonim dodasz przez PPM na graczu albo na jego nicku na czacie -> "Dodaj pseudonim".')
        );
        panel.append(head, body, updateInfo.note());
        isolateKeys(panel);
        document.body.appendChild(panel);
        panelView = { toggle, levelCheckbox, list };
        installDragging(head);
        renderPanel();
    }

    function renderPanel() {
        if (!panelView || panel.hidden) return;
        const { toggle, levelCheckbox, list } = panelView;
        toggle.textContent = enabled ? 'Włączone' : 'Wyłączone';
        toggle.classList.toggle('on', enabled);
        levelCheckbox.checked = chatLevel;
        list.classList.toggle('off', !enabled);

        list.textContent = '';
        const entries = Object.entries(store).sort(([, a], [, b]) => a.alias.localeCompare(b.alias));
        if (!entries.length) list.append(createElement('div', 'ps-info', 'Brak pseudonimów.'));
        for (const [account, entry] of entries) {
            const nicks = (entry.nicks && entry.nicks[world]) || [];
            // postacie z bieżącego serwera najpierw, potem z pozostałych
            const servers = Object.entries(entry.nicks || {})
                .filter(([, list]) => list && list.length)
                .sort(([a], [b]) => (b === world) - (a === world) || a.localeCompare(b));
            const row = createElement('div', 'ps-row');
            const info = createElement('div', 'ps-row-info');
            info.append(
                createElement('div', 'ps-row-alias', entry.alias),
                createElement('div', 'ps-row-nicks', servers.length
                    ? servers.map(([server, list]) => `${server}: ${list.join(', ')}`).join(' · ')
                    : 'brak znanych postaci')
            );
            row.append(
                info,
                createButton('Edytuj', () => openDialog(account, nicks[0] || '')),
                createButton('Usuń', () => setAlias(account, nicks[0] || '', ''))
            );
            list.append(row);
        }
    }

    function togglePanel() {
        if (!panel) return;
        panel.hidden = !panel.hidden;
        renderPanel();
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
            if (event.target.classList.contains('ps-btn')) return;
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
            try { localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify({ left: panel.offsetLeft, top: panel.offsetTop })); } catch (e) { /* tylko wygoda */ }
        });
    }

    /* ================== WIDGET ================== */
    // credit to https://github.com/nerthus-margonem/nerthusaddon

    function installWidget() {
        const Engine = page.Engine;

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

    function waitFor(isReady, callback) {
        if (safely(isReady)) callback();
        else setTimeout(() => waitFor(isReady, callback), 50);
    }

    function start() {
        world = Engine().worldConfig.getWorldName();
        migrateLocalStore();
        enabled = readEnabled();
        chatLevel = readChatLevel();
        loadStore();
        installStyle();
        buildDialog();
        buildPanel();
        // wizytówki z czatu przychodzą razem z wiadomościami - hak jak najwcześniej
        installCardHook();
        installTextObserver();
        // hak czatu jak najwcześniej, żeby pierwsze wiadomości po wczytaniu gry też zostały oznaczone
        waitFor(() => Engine().chatController && Engine().chatController.getChatMessageWrapper(), installChatHook);

        document.addEventListener('keydown', event => {
            if (!event.altKey || event.repeat || event.key.toLowerCase() !== 'n') return;
            event.preventDefault();
            togglePanel();
        });
        // zmiany z innych kart gry, także na innych serwerach
        const onSettingsChange = () => {
            enabled = readEnabled();
            chatLevel = readChatLevel();
            refreshAll();
        };
        const onStoreChange = () => {
            loadStore();
            forEachOther(other => { if (other.d) learnOther(other.d); });
            refreshAll();
        };
        const remoteOnly = callback => (name, oldValue, newValue, remote) => { if (remote) safely(callback); };
        try {
            GM_addValueChangeListener(ENABLED_KEY, remoteOnly(onSettingsChange));
            GM_addValueChangeListener(CHAT_LEVEL_KEY, remoteOnly(onSettingsChange));
            GM_addValueChangeListener(STORAGE_KEY, remoteOnly(onStoreChange));
        } catch (e) {
            window.addEventListener('storage', event => {
                if (event.key === ENABLED_KEY || event.key === CHAT_LEVEL_KEY) onSettingsChange();
                if (event.key === STORAGE_KEY) onStoreChange();
            });
        }

        waitFor(() => {
            const e = Engine();
            return e.allInit && e.interface && e.interface.showPopupMenu && e.others && e.others.createStrTip;
        }, () => {
            installMenuHook();
            installTipHook();
            watchOthers();
            refreshAll();
        });
    }

    waitFor(() => page.Engine && page.Engine.widgetManager && page.Engine.widgetManager.addWidgetButtons, installWidget);
    waitFor(() => {
        const e = Engine();
        return document.head && document.body && e && e.hero && e.hero.d && e.hero.d.account
            && e.worldConfig && e.worldConfig.getWorldName() && e.businessCardManager;
    }, start);
})();
