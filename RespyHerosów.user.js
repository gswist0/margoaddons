// ==UserScript==
// @name         Margonem NI - Respy herosów (overlay)
// @namespace    margonem-heroes-resp
// @version      2.2
// @description  Pokazuje (tylko u Ciebie) herosa na jego respach, rysując na własnym canvasie nad grą
// @match        https://*.margonem.pl/
// @match        https://*.margonem.com/
// @author       Bancewald 
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
    // Jak mocno widoczne są zasięg i kafelek respa (0-1). Ustawiane paskiem w menu albo przez HeroesRespAddon.setIntensity(0.4)
    const INTENSITY_KEY = 'respy_herosow_intensywnosc';
    const clampIntensity = n => Math.max(0, Math.min(1, Number(n) || 0));
    const storedIntensity = localStorage.getItem(INTENSITY_KEY);
    let INTENSITY = storedIntensity === null ? 0.6 : clampIntensity(storedIntensity);
    const DEBUG = false; // ramka + linia diagnostyczna na overlayu; ustaw false gdy wszystko działa

    const WIDGET_KEY = 'respyherosow';
    const WIDGET_ICON = 'https://raw.githubusercontent.com/gswist0/margoaddons/refs/heads/main/rh_clear.png';
    const DEFAULT_WIDGET_POSITION = [4, 'bottom-right-additional'];
    const PANEL_POSITION_KEY = 'respy_herosow_pozycja';
    const ENABLED_KEY = 'respy_herosow_wlaczone';
    const HIDE_VISITED_KEY = 'respy_herosow_ukrywaj_odwiedzone';

    let enabled = localStorage.getItem(ENABLED_KEY) !== 'false';
    let hideVisited = localStorage.getItem(HIDE_VISITED_KEY) === 'true';

    /* ================== MENU ================== */

    let panel = null;
    let renderEnabled = () => {};
    let renderIntensity = () => {};

    function setEnabled(value) {
        enabled = value;
        localStorage.setItem(ENABLED_KEY, enabled);
        renderEnabled();
    }

    function applyIntensity(value) {
        INTENSITY = clampIntensity(value);
        localStorage.setItem(INTENSITY_KEY, INTENSITY);
        renderIntensity();
    }

    function togglePanel() {
        if (panel) panel.hidden = !panel.hidden;
    }

    function buildPanel() {
        const style = document.createElement('style');
        style.textContent = `
            .main-buttons-container .widget-button .icon.${WIDGET_KEY} { background-image: url("${WIDGET_ICON}"); background-position: 0; }
            #prh-panel { position: fixed; z-index: 9999; width: 300px; display: flex; flex-direction: column; background: #1b1712; color: #e8dcc0; border: 2px solid #6b5a33; border-radius: 6px; font: 12px/1.35 Arial, sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,.6); user-select: none; }
            #prh-panel, #prh-panel * { box-sizing: border-box; }
            #prh-panel[hidden] { display: none; }
            #prh-panel .prh-head { display: flex; align-items: center; gap: 6px; padding: 5px 8px; cursor: move; background: linear-gradient(#3a2f1a, #2a2212); border-bottom: 1px solid #6b5a33; border-radius: 4px 4px 0 0; }
            #prh-panel .prh-title { flex: 1; font-weight: bold; color: #f1d58a; }
            #prh-panel .prh-btn { cursor: pointer; background: #4a3d22; border: 1px solid #7a6639; color: #f1d58a; border-radius: 3px; padding: 0 6px; line-height: 18px; font-size: 12px; }
            #prh-panel .prh-btn:hover { background: #5d4c2a; }
            #prh-panel .prh-page { padding: 8px 8px 2px; }
            #prh-panel .prh-toggle { margin-bottom: 8px; text-align: center; color: #d98a7a; }
            #prh-panel .prh-toggle.on { color: #9fd18b; }
            #prh-panel .prh-fields { min-width: 0; margin: 0; padding: 0; border: 0; }
            #prh-panel .prh-fields:disabled { opacity: .4; filter: grayscale(1); }
            #prh-panel .prh-fields:disabled label, #prh-panel .prh-fields:disabled input { cursor: not-allowed; }
            #prh-panel .prh-check { display: flex; align-items: center; gap: 5px; margin-bottom: 8px; }
            #prh-panel .prh-check label { margin: 0; color: #e8dcc0; cursor: pointer; }
            #prh-panel .prh-check input { margin: 0; accent-color: #7a6639; cursor: pointer; }
            #prh-panel .prh-slider { margin-bottom: 8px; }
            #prh-panel .prh-slider label { display: flex; justify-content: space-between; margin-bottom: 2px; color: #b9a56a; }
            #prh-panel .prh-slider input { display: block; width: 100%; margin: 0; accent-color: #7a6639; cursor: pointer; }
        `;
        document.head.appendChild(style);

        panel = document.createElement('div');
        panel.id = 'prh-panel';
        panel.hidden = true;

        const head = document.createElement('div');
        head.className = 'prh-head';
        const title = document.createElement('span');
        title.className = 'prh-title';
        title.textContent = 'Respy herosów';
        const close = document.createElement('span');
        close.className = 'prh-btn';
        close.title = 'Zamknij';
        close.textContent = '×';
        close.addEventListener('click', () => { panel.hidden = true; });
        head.append(title, close);

        const page = document.createElement('div');
        page.className = 'prh-page';

        const toggle = document.createElement('div');
        toggle.className = 'prh-btn prh-toggle';
        toggle.addEventListener('click', () => setEnabled(!enabled));

        const fields = document.createElement('fieldset');
        fields.className = 'prh-fields';
        const row = document.createElement('div');
        row.className = 'prh-check';
        const input = document.createElement('input');
        input.id = 'prh-hide-visited';
        input.type = 'checkbox';
        input.checked = hideVisited;
        input.addEventListener('change', () => {
            hideVisited = input.checked;
            localStorage.setItem(HIDE_VISITED_KEY, hideVisited);
        });
        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.textContent = 'Ukrywaj resp i obramówkę po wejściu w zasięg';
        label.title = 'Resp wraca po zmianie lub ponownym wczytaniu mapy';
        row.append(input, label);

        const sliderRow = document.createElement('div');
        sliderRow.className = 'prh-slider';
        const slider = document.createElement('input');
        slider.id = 'prh-intensity';
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.step = '5';
        slider.addEventListener('input', () => applyIntensity(slider.value / 100));
        // bez fokusu strzałki znów sterują postacią, a nie paskiem
        slider.addEventListener('change', () => slider.blur());
        const sliderLabel = document.createElement('label');
        sliderLabel.htmlFor = slider.id;
        const sliderName = document.createElement('span');
        sliderName.textContent = 'Intensywność respów i zasięgu';
        const sliderValue = document.createElement('span');
        sliderLabel.append(sliderName, sliderValue);
        sliderRow.append(sliderLabel, slider);

        renderIntensity = () => {
            const percent = Math.round(INTENSITY * 100);
            slider.value = percent;
            sliderValue.textContent = percent + '%';
        };
        renderIntensity();

        fields.append(row, sliderRow);

        renderEnabled = () => {
            toggle.textContent = enabled ? 'Włączone' : 'Wyłączone';
            toggle.classList.toggle('on', enabled);
            fields.disabled = !enabled;
        };
        renderEnabled();

        page.append(toggle, fields);
        panel.append(head, page);
        document.body.appendChild(panel);
        installDragging(head);
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
            if (event.target.classList.contains('prh-btn')) return;
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
        if (!event.altKey || event.key.toLowerCase() !== 'r') return;
        event.preventDefault();
        togglePanel();
    });

    /* ================== WIDGET ================== */
    // credit to https://github.com/nerthus-margonem/nerthusaddon

    function installWidget() {
        const Engine = window.Engine;

        const addToDefaultSet = () => Engine.widgetManager.addKeyToDefaultWidgetSet(
            WIDGET_KEY,
            DEFAULT_WIDGET_POSITION[0],
            DEFAULT_WIDGET_POSITION[1],
            'Respy herosów',
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

    function waitFor(isReady, callback) {
        if (isReady()) callback();
        else setTimeout(() => waitFor(isReady, callback), 50);
    }

    waitFor(() => document.querySelector('.game-window-positioner') && document.head, buildPanel);
    waitFor(() => window.Engine && window.Engine.widgetManager && window.Engine.widgetManager.addWidgetButtons, installWidget);

    /* ================== OVERLAY ================== */

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
        const visited = new Set();   // respy (rx,ry), w których zasięgu gracz był na obecnej mapie

        const respKey = r => r.rx + ',' + r.ry;
        // ścisła nierówność: dokładnie VIEW_RANGE kratek w prostej już nie widać
        const inRange = (dx, dy) => dx * dx + dy * dy < VIEW_RANGE * VIEW_RANGE;

        function markVisited() {
            // getDrawable: przy wczytywaniu mapy dane gracza i respów mogą jeszcze nie być kompletne
            if (!safe(() => Engine.map.getDrawable())) return;
            const hx = safe(() => Engine.hero.d.x);
            const hy = safe(() => Engine.hero.d.y);
            if (!Number.isFinite(hx) || !Number.isFinite(hy)) return;
            for (const r of respList) {
                if (inRange(hx - r.rx, hy - r.ry)) visited.add(respKey(r));
            }
        }

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
            if (!enabled) {
                overlay.style.display = 'none';
                requestAnimationFrame(frame);
                return;
            }
            overlay.style.display = '';

            syncOverlay();
            ctx.clearRect(0, 0, overlay.width, overlay.height);

            const off = getOffset();
            const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 400);

            if (hideVisited) markVisited();
            const visibleResps = hideVisited ? respList.filter(r => !visited.has(respKey(r))) : respList;

            // zasięg widoczności: kratki, dla których dx^2 + dy^2 < R^2 (odległość od respa)
            if (SHOW_RANGE && VIEW_RANGE > 0) {
                const span = Math.floor(VIEW_RANGE);
                for (const r of visibleResps) {
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

            for (const r of visibleResps) {
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
            visited.clear();
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
        const clearNow = () => { stopFast(); respList = []; visited.clear(); };
        const refreshNow = () => { stopFast(); respList = collectResps(); };

        const okClear = hook('onClear', clearNow, null);
        const okUpd = hook('updateData', null, refreshNow);
        const okFull = hook('updateFullData', null, refreshNow);
        hooked = okClear && okUpd && okFull;

        requestAnimationFrame(frame);

        window.HeroesRespAddon = {
            toggle() { setEnabled(!enabled); },
            list: () => respList,
            setRange(n) { VIEW_RANGE = Number(n) || 0; return VIEW_RANGE; },
            setIntensity(n) { applyIntensity(n); return INTENSITY; },
            toggleRange() { SHOW_RANGE = !SHOW_RANGE; return SHOW_RANGE; },
            overlay,
        };
    }
})();