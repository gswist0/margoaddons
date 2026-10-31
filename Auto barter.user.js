// ==UserScript==
// @name         Margonem NI - Barter All (Alt+B)
// @match        *://*.margonem.pl/*
// @match        *://*.margonem.com/*
// @version      1.0
// @description  Wymienia wszystkie oferty w oknie barteru (Alt+B)
// @author       Bancewald
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

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