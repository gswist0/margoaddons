// ==UserScript==
// @name         Łatwiejszy pościg
// @namespace    margonem-ctrl-rmb-attack
// @version      3.2
// @description  Ctrl + PPM na graczu włącza natywny pościg ("Atakuj"), a kolejny Ctrl + PPM na ściganym graczu go wyłącza
// @match        https://*.margonem.pl/*
// @match        https://*.margonem.com/*
// @run-at       document-idle
// @author       Bancewald
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /* ================== INFORMACJA O NOWEJ WERSJI ================== */
    // Lista aktualnych wersji jest w pliku versions.json na GitHubie. Dodatek NIE aktualizuje się sam,
    // tylko pokazuje na dole swojego okna informację z linkiem do nowej wersji.
    const updateInfo = (() => {
        const ID = 'latwiejszy-poscig';
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

    updateInfo.toast('Łatwiejszy pościg');

    const DEBUG = false;
    const log = (...a) => DEBUG && console.log('[CtrlAtak]', ...a);

    // Śledzenie stanu Ctrl
    let ctrlDown = false;
    window.addEventListener('keydown', e => { if (e.key === 'Control') ctrlDown = true; }, true);
    window.addEventListener('keyup', e => { if (e.key === 'Control') ctrlDown = false; }, true);
    window.addEventListener('blur', () => { ctrlDown = false; });

    function isCtrl(ev) {
        return ctrlDown || !!(ev && (ev.ctrlKey || (ev.originalEvent && ev.originalEvent.ctrlKey)));
    }

    function translate(key) {
        try { return _t(key, null, 'menu'); } catch (_) { return null; }
    }

    function patch() {
        const ui = Engine.interface;
        const original = ui.showPopupMenu;
        if (typeof original !== 'function' || original.__ctrlAttackPatched) return;

        const wrapped = function (items, ev, opts) {
            try {
                if (isCtrl(ev) && opts && opts.onMap && Array.isArray(items) && items.length) {
                    const attackLabel = translate('attack');
                    const stopLabel = translate('stop_attack');
                    const first = items[0];
                    log('menu:', opts.header, 'pierwsza opcja:', first && first[0]);

                    // "Atakuj" -> start pościgu, "Przestań atakować" -> koniec pościgu
                    if (first && typeof first[1] === 'function' &&
                        (first[0] === attackLabel || first[0] === stopLabel)) {
                        first[1]();      // natywny callback
                        return true;     // menu nie jest pokazywane
                    }
                }
            } catch (err) {
                console.error('[CtrlAtak] błąd:', err);
            }
            return original.apply(this, arguments);
        };
        wrapped.__ctrlAttackPatched = true;
        ui.showPopupMenu = wrapped;
        console.log('[CtrlAtak] v3.1 załadowany: Ctrl + PPM = Atakuj / Przerwij pościg');
    }

    const t = setInterval(() => {
        if (window.Engine && Engine.allInit && Engine.interface && Engine.interface.showPopupMenu) {
            clearInterval(t);
            patch();
        }
    }, 500);
})();