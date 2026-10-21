// ==UserScript==
// @name         Margonem NI - Respy herosów (overlay)
// @namespace    margonem-heroes-resp
// @version      2.0
// @description  Pokazuje (tylko u Ciebie) herosa na jego respach, rysując na własnym canvasie nad grą
// @match        https://*.margonem.pl/
// @match        https://*.margonem.com/
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const TILE = 32;
    const REFRESH_MS = 1500;
    // Zasięg widoczności herosa w kratkach (koło: dx^2 + dy^2 < R^2).
    // USTAW wartość zgodną z grą! Zmienisz też w locie: HeroesRespAddon.setRange(n)
    let VIEW_RANGE = 12; // heros widoczny, gdy odległość < 12 (dx^2 + dy^2 < 144); dopasowane do pomiarów z gry
    let SHOW_RANGE = true;
    // Jak mocno widoczne są zasięg i kafelek respa (0-1). Zmiana w locie: HeroesRespAddon.setIntensity(0.4)
    let INTENSITY = 0.6;
    const DEBUG = false; // ramka + linia diagnostyczna na overlayu; ustaw false gdy wszystko działa

    const waitForEngine = setInterval(() => {
        try {
            if (window.Engine && Engine.allInit && Engine.heroesRespManager && Engine.map &&
                document.querySelector('#GAME_CANVAS')) {
                clearInterval(waitForEngine);
                init();
            }
        } catch (e) { /* jeszcze się ładuje */ }
    }, 500);

    function safe(fn) { try { return fn(); } catch (e) { return undefined; } }

    function init() {
        const game = document.querySelector('#GAME_CANVAS');
        const overlay = document.createElement('canvas');
        overlay.id = 'HEROES_RESP_OVERLAY';
        overlay.style.position = 'absolute';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '9999';
        game.parentNode.appendChild(overlay);
        const ctx = overlay.getContext('2d');

        let respList = [];
        const imgCache = {};

        function collectResps() {
            const raw = safe(() => Engine.heroesRespManager.test());
            return Object.values(raw || {})
                .map((r, i) => ({
                    hue: Math.round((i * 137.508) % 360),   // złoty kąt: sąsiednie respy mają odległe kolory
                    rx: r.rx, ry: r.ry,
                    nick: safe(() => r.getNick()),
                    lvl: safe(() => r.getLvl()),
                    icon: safe(() => r.getIcon()),
                    frames: safe(() => r.getFrameAmount()) || 1,
                    kind: safe(() => r.getKind())
                }))
                .filter(r => Number.isFinite(r.rx) && Number.isFinite(r.ry) && r.kind == 0);
        }

        function getImage(icon) {
            if (!icon) return null;
            if (imgCache[icon]) return imgCache[icon];
            const img = new Image();
            let src = String(icon);
            if (!/^(https?:)?\/\//.test(src) && src[0] !== '/') {
                src = (window.CFG && CFG.npath ? CFG.npath : '/obrazki/npc/') + src;
            }
            img.onload = () => { img.loaded = true; };
            img.src = src;
            imgCache[icon] = img;
            return img;
        }

        // Dopasowanie overlaya do canvasa gry (rozmiar wewnętrzny, rozmiar CSS i pozycja)
        function syncOverlay() {
            if (overlay.width !== game.width) overlay.width = game.width;
            if (overlay.height !== game.height) overlay.height = game.height;
            overlay.style.left = game.offsetLeft + 'px';
            overlay.style.top = game.offsetTop + 'px';
            overlay.style.width = game.offsetWidth + 'px';
            overlay.style.height = game.offsetHeight + 'px';
        }

        function getOffset() {
            const o = safe(() => Engine.map.offset);
            if (Array.isArray(o) && o.length >= 2) return [o[0], o[1]];
            if (o && Number.isFinite(o.x)) return [o.x, o.y];
            return [0, 0];
        }

        function frame() {
            syncOverlay();
            ctx.clearRect(0, 0, overlay.width, overlay.height);

            const off = getOffset();
            const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 400);

            // zasięg widoczności: kratki, dla których dx^2 + dy^2 < R^2 (odległość od respa)
            if (SHOW_RANGE && VIEW_RANGE > 0) {
                const R2 = VIEW_RANGE * VIEW_RANGE;
                const span = Math.floor(VIEW_RANGE);
                const inRange = (dx, dy) => dx * dx + dy * dy < R2;   // ścisła nierówność: dokładnie 12 kratek w prostej już nie widać
                for (const r of respList) {
                    const cx = r.rx * TILE - off[0];
                    const cy = r.ry * TILE - off[1];
                    ctx.save();
                    ctx.fillStyle = `hsla(${r.hue},70%,50%,${0.10 * INTENSITY})`;
                    ctx.strokeStyle = `hsla(${r.hue},70%,55%,${0.9 * INTENSITY})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    for (let dy = -span; dy <= span; dy++) {
                        for (let dx = -span; dx <= span; dx++) {
                            if (!inRange(dx, dy)) continue;
                            const tx = cx + dx * TILE;
                            const ty = cy + dy * TILE;
                            ctx.fillRect(tx, ty, TILE, TILE);
                            // obrys tylko po krawędziach graniczących z kratką poza zasięgiem
                            if (!inRange(dx, dy - 1)) { ctx.moveTo(tx, ty);              ctx.lineTo(tx + TILE, ty); }
                            if (!inRange(dx, dy + 1)) { ctx.moveTo(tx, ty + TILE);       ctx.lineTo(tx + TILE, ty + TILE); }
                            if (!inRange(dx - 1, dy)) { ctx.moveTo(tx, ty);              ctx.lineTo(tx, ty + TILE); }
                            if (!inRange(dx + 1, dy)) { ctx.moveTo(tx + TILE, ty);       ctx.lineTo(tx + TILE, ty + TILE); }
                        }
                    }
                    ctx.stroke();
                    ctx.restore();
                }
            }

            for (const r of respList) {
                const x = r.rx * TILE - off[0];
                const y = r.ry * TILE - off[1];

                ctx.save();
                ctx.globalAlpha = 0.35 * pulse * INTENSITY;
                ctx.fillStyle = `hsl(${r.hue},70%,50%)`;
                ctx.fillRect(x, y, TILE, TILE);
                ctx.globalAlpha = 1;
                ctx.strokeStyle = `hsla(${r.hue},70%,55%,${0.9 * INTENSITY})`;
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);

                const img = getImage(r.icon);
                if (img && img.loaded) {
                    const fw = img.width / r.frames;
                    const fh = img.height;
                    ctx.globalAlpha = 0.9;
                    ctx.drawImage(img, 0, 0, fw, fh, x + TILE / 2 - fw / 2, y + TILE - fh, fw, fh);
                    ctx.globalAlpha = 1;
                }

                const label = (r.nick || 'Heros') + (r.lvl ? ` (${r.lvl}lvl)` : '');
                ctx.font = 'bold 11px Arial';
                ctx.textAlign = 'center';
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#000';
                ctx.fillStyle = `hsl(${r.hue},80%,72%)`;
                ctx.strokeText(label, x + TILE / 2, y - 4);
                ctx.fillText(label, x + TILE / 2, y - 4);
                ctx.restore();
            }

            if (DEBUG) {
                ctx.save();
                ctx.strokeStyle = 'lime';
                ctx.lineWidth = 2;
                ctx.strokeRect(1, 1, overlay.width - 2, overlay.height - 2);
                ctx.font = '12px monospace';
                ctx.fillStyle = 'lime';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                const t = `overlay ${overlay.width}x${overlay.height} | offset ${off.join(',')} | respy: ${respList.length}` +
                    (respList[0] ? ` | 1.: ${respList[0].rx},${respList[0].ry}` : '');
                ctx.strokeText(t, 8, 16);
                ctx.fillText(t, 8, 16);
                ctx.restore();
            }

            requestAnimationFrame(frame);
        }

        const signature = list => list.map(r => r.rx + ',' + r.ry + ',' + r.nick).join('|');

        let fastActive = false;
        let hooked = false;   // true, gdy udało się podpiąć pod metody managera
        const refresh = () => { if (!fastActive) respList = collectResps(); };
        refresh();
        setInterval(refresh, REFRESH_MS);

        // Wykrywanie zmiany mapy: natychmiastowe wyczyszczenie i szybkie odpytywanie,
        // aż manager zwróci dane inne niż z poprzedniej mapy
        let lastMapId = safe(() => Engine.map.d.id);
        let fastTimer = null;

        function onMapChange() {
            const staleSig = signature(respList);
            respList = [];                      // stare markery znikają od razu
            clearInterval(fastTimer);
            fastActive = true;
            const started = Date.now();
            fastTimer = setInterval(() => {
                const fresh = collectResps();
                const timedOut = Date.now() - started > 3000;
                if (fresh.length && (signature(fresh) !== staleSig || timedOut)) {
                    respList = fresh;
                    fastActive = false;
                    clearInterval(fastTimer);
                } else if (timedOut) {
                    respList = fresh;           // mapa naprawdę bez respów lub identyczne dane
                    fastActive = false;
                    clearInterval(fastTimer);
                }
            }, 100);
        }

        setInterval(() => {
            const id = safe(() => Engine.map.d.id);
            if (id !== undefined && id !== lastMapId) {
                lastMapId = id;
                if (!hooked) onMapChange();   // zapas, gdy nie ma hooków na manager
            }
        }, 50);

        // Podpięcie pod metody managera: reagujemy dokładnie wtedy, gdy robi to gra
        function hook(name, before, after) {
            const mgr = Engine.heroesRespManager;
            const orig = mgr[name];
            if (typeof orig !== 'function' || orig.__hrHooked) return typeof orig === 'function';
            const wrapped = function (...args) {
                if (before) safe(before);
                const res = orig.apply(this, args);
                if (after) safe(after);
                return res;
            };
            wrapped.__hrHooked = true;
            mgr[name] = wrapped;
            return true;
        }

        const stopFast = () => { fastActive = false; clearInterval(fastTimer); };
        const clearNow = () => { stopFast(); respList = []; };
        const refreshNow = () => { stopFast(); respList = collectResps(); };

        const okClear = hook('onClear', clearNow, null);
        const okUpd = hook('updateData', null, refreshNow);
        const okFull = hook('updateFullData', null, refreshNow);
        hooked = okClear && okUpd && okFull;

        requestAnimationFrame(frame);

        window.HeroesRespAddon = {
            toggle() {
                overlay.style.display = overlay.style.display === 'none' ? '' : 'none';
            },
            list: () => respList,
            setRange(n) { VIEW_RANGE = Number(n) || 0; return VIEW_RANGE; },
            setIntensity(n) { INTENSITY = Math.max(0, Math.min(1, Number(n) || 0)); return INTENSITY; },
            toggleRange() { SHOW_RANGE = !SHOW_RANGE; return SHOW_RANGE; },
            overlay,
        };
    }
})();