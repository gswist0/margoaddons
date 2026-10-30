// ==UserScript==
// @name         Łatwiejszy pościg
// @namespace    margonem-ctrl-rmb-attack
// @version      3.1
// @description  Ctrl + PPM na graczu włącza natywny pościg ("Atakuj"), a kolejny Ctrl + PPM na ściganym graczu go wyłącza
// @match        https://*.margonem.pl/*
// @match        https://*.margonem.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

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