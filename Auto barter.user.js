// ==UserScript==
// @name         Margonem NI - Barter All (Alt+B)
// @match        *://*.margonem.pl/*
// @match        *://*.margonem.com/*
// @version      1.1
// @description  Wymienia wszystkie oferty w oknie barteru (Alt+B)
// @author       Bancewald
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    /* ================== INFORMACJA O NOWEJ WERSJI ================== */
    // Lista aktualnych wersji jest w pliku versions.json na GitHubie. Dodatek NIE aktualizuje się sam,
    // tylko pokazuje na dole swojego okna informację z linkiem do nowej wersji.
    const updateInfo = (() => {
        const ID = 'auto-barter';
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

    updateInfo.toast('Auto barter');

    const DELAY = 400;        // przerwa między ofertami (ms)
    const TIMEOUT = 4000;     // maks. czas oczekiwania na odpowiedź serwera (ms)
    const MAX_PER_REQ = 10;   // ile użyć oferty w jednym żądaniu (suwak w grze ma max 10); ustaw 1, jeśli wolisz ostrożnie

    let running = false;
    let stopFlag = false;

    const msg = t => (typeof message === 'function' ? message(t) : console.log('[BarterAll]', t));
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    // oferta trybu 2 jest rozbijana na kilka pozycji po wymaganym przedmiocie
    const key = o => o.id + ':' + (o.mode === 2 ? o.required[0][0] : 0);

    // Podpinamy się pod update() - serwer odsyła nowe dane po każdej wymianie
    function hook(b) {
        if (b.__baHooked) return;
        b.__baHooked = true;
        const orig = b.update;
        b.update = function (...args) {
            const res = orig.apply(this, args);
            if (b.__baResolve) b.__baResolve();
            return res;
        };
    }

    function waitForUpdate(b) {
        return new Promise(resolve => {
            const t = setTimeout(() => { b.__baResolve = null; resolve(false); }, TIMEOUT);
            b.__baResolve = () => { clearTimeout(t); b.__baResolve = null; resolve(true); };
        });
    }

    function sendOffer(b, offer, count) {
        const desiredItem = offer.recived[0][0];
        const requiredId = offer.mode === 2 ? `&requiredId=${offer.required[0][0]}` : '';
        _g(`barter&id=${b.barterId}&offerId=${offer.id}&action=use&usesCount=${count}&available=0&desiredItem=${desiredItem}${requiredId}`);
    }

    async function run() {
        const b = Engine.barter;
        if (!b || !b.allParseOffers) return;

        hook(b);
        running = true;
        stopFlag = false;
        const skip = new Set();
        let done = 0;
        msg('Barter: start (Alt+B ponownie, aby zatrzymać)');

        while (!stopFlag && Engine.barter === b) {
            const offer = b.allParseOffers.find(o => o.maxAmount > 0 && !skip.has(key(o)));
            if (!offer) break;

            const k = key(offer);
            const before = offer.maxAmount;
            const waiter = waitForUpdate(b);   // najpierw nasłuch, potem wysyłka
            sendOffer(b, offer, Math.min(MAX_PER_REQ, before));

            const ok = await waiter;
            if (!ok) { skip.add(k); continue; }

            const after = b.allParseOffers.find(o => key(o) === k);
            if (!after || after.maxAmount >= before) skip.add(k);   // nic się nie zmieniło -> pomijamy
            else done += before - after.maxAmount;

            await sleep(DELAY);
        }

        running = false;
        msg(`Barter: koniec (wykonano wymian: ${done})`);
    }

    document.addEventListener('keydown', e => {
        if (!(e.altKey && !e.ctrlKey && !e.shiftKey && e.code === 'KeyB')) return;
        if (typeof Engine === 'undefined' || !Engine.barter) return; // tylko gdy okno barteru otwarte
        e.preventDefault();
        if (running) { stopFlag = true; return; }
        run();
    });
})();