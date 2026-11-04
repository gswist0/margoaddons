// ==UserScript==
// @name         Ulepszanie przedmiotów
// @version      1.7
// @description  Ulepsza wybrany przedmiot wszystkimi zdobytymi łupami do ustawionej jakości, nigdy nie używa legend
// @match        https://*.margonem.pl/
// @match        https://*.margonem.com/
// @author       Bancewald
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    /* ================== USTAWIENIA ================== */

    const WIDGET_KEY = 'ulepszanieprzedmiotow';
    const WIDGET_ICON = 'https://raw.githubusercontent.com/gswist0/margoaddons/refs/heads/main/ul_clear.png';
    const DEFAULT_WIDGET_POSITION = [2, 'bottom-right-additional'];
    const PANEL_POSITION_KEY = 'ulepszanie_pozycja';

    const TICK_MS = 250;
    const SEND_GAP_MS = 300;
    const REQUEST_TIMEOUT_MS = 5000;
    const LOOT_MEMORY_MS = 10 * 60 * 1000;
    const SESSION_STEP_MS = 50;
    const SESSION_LOCK = 'ulepszanie-przedmiotow';
    // Próba: false przywraca czekanie, aż bohater stanie, i blokadę ruchu na czas sesji.
    const ALLOW_WALKING_DURING_SESSION = false;
    const MAX_BATCH = 25; // tyle składników mieści okno gry
    const BATCH_OPTIONS = [1, 5, 10, 25];
    const DEFAULT_BATCH = 10;
    const CUSTOM_BATCH = 'custom';
    const MAX_CUSTOM_BATCH = 999;
    const LOOT_MAX_WAIT_MS = 2 * 60 * 1000; // łup nie czeka dłużej na zebranie pełnej partii
    const MAX_UPGRADE_LEVEL = 5;
    const MIN_ITEM_LEVEL = 20;

    // Klasy przedmiotów, które gra pozwala ulepszać i zużywać (allAllowItemStats w silniku gry).
    const ENHANCE_CLASSES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29]);
    const ENHANCER_CLASS = 26;

    // Legendy, artefakty i ulepszone celowo nie mają tu rangi: czego nie ma w tabeli, tego dodatek nigdy nie zużyje.
    const RARITY_RANK = { common: 0, unique: 1, elite: 1, heroic: 2 };
    const RARITY_OPTIONS = [
        { rank: 0, text: 'Pospolite' },
        { rank: 1, text: 'Unikatowe' },
        { rank: 2, text: 'Heroiczne' },
    ];
    // Starsze przedmioty mają rzadkość jako osobną statystykę zamiast rarity=...
    const RARITY_FLAGS = ['artefact', 'legendary', 'upgraded', 'heroic', 'unique', 'elite'];

    // Przedmioty, które gra odrzuca, albo przed których zużyciem pyta o potwierdzenie.
    const PROTECTED_STATS = ['cursed', 'artisan_worthless', 'enhancement_upgrade_lvl', 'personal', 'lowreq'];

    /* ================== STAN ================== */

    let storageSuffix = '';
    let targetId = null;
    let targetName = '';
    let maxRank = 0;
    let enabled = true;
    let batchSize = DEFAULT_BATCH;

    // idle (trzeba otworzyć okno gry) | loading | progressing | upgradable | completed | missing | error
    let state = 'idle';
    let progress = null;
    let usages = null;
    let upgradeCost = null;

    const lootSeen = new Map();
    let queue = [];
    let busy = false;
    let nextSendAt = 0;
    let limitNotified = false;
    let craftingWasOpen = false;
    let viewEnabled = null;
    let flushRequested = false;
    // sesja ulepszania na serwerze, którą dodatek otwiera na czas zużywania łupu, bez okna w grze
    let session = null;
    let ownOpenPending = false;
    let nextStep = null;

    const save = (key, value) => localStorage.setItem(`ulepszanie_${key}_${storageSuffix}`, value);
    const load = key => localStorage.getItem(`ulepszanie_${key}_${storageSuffix}`);

    const getTarget = () => (targetId === null ? null : window.Engine.items.getItemById(targetId) || null);
    const isCraftingOpen = () => !!(window.Engine.crafting && window.Engine.crafting.enhancement);
    const isInBattle = () => !!(window.Engine.battle && window.Engine.battle.getShow && window.Engine.battle.getShow());
    const isLootOpen = () => {
        const loots = window.Engine.loots;
        return !!(loots && loots.wnd && loots.wnd.isShow && loots.wnd.isShow());
    };
    const isLimitReached = () => !!usages && usages.count >= usages.limit;
    const isWorking = () => targetId !== null && enabled && state === 'progressing' && !isLimitReached();

    function notify(text) {
        try { if (typeof window.message === 'function') window.message(text); } catch (e) { /* tylko komunikat */ }
    }

    function alertPlayer(text) {
        notify(text);
        try { if (typeof window.mAlert === 'function') window.mAlert(text); } catch (e) { /* zostaje komunikat i panel */ }
    }

    /* ================== WYBÓR PRZEDMIOTÓW ================== */

    function rarityNames(item, stats) {
        const names = [stats.rarity, item.itemTypeName, ...RARITY_FLAGS.filter(flag => flag in stats)].filter(Boolean);
        return names.length ? names : ['common'];
    }

    function canBeTarget(item) {
        if (item.loc !== 'g' || !ENHANCE_CLASSES.has(item.cl)) return false;
        const stats = item.parseStats();
        return !('cursed' in stats) && Number(stats.lvl) >= MIN_ITEM_LEVEL;
    }

    function canBeReagent(item, target, allowedRank) {
        if (Number(item.id) === Number(target.id) || item.loc !== 'g' || Number(item.st) !== 0) return false;

        const stats = item.parseStats();
        const withinQuality = rarityNames(item, stats).every(name => RARITY_RANK[name] <= allowedRank);
        if (!withinQuality) return false;
        if (PROTECTED_STATS.some(stat => stat in stats)) return false;
        if (Object.keys(stats).some(key => key.startsWith('socket_content') && Number(stats[key]) > 0)) return false;

        const targetStats = target.parseStats();
        const targetRarity = targetStats.rarity || target.itemTypeName;
        if ('target_rarity' in stats && stats.target_rarity !== targetRarity) return false;

        if (item.cl === ENHANCER_CLASS) return 'enhancement_add' in stats || 'enhancement_add_point' in stats;
        return ENHANCE_CLASSES.has(item.cl) && Number(stats.lvl) >= MIN_ITEM_LEVEL;
    }

    // Przedmioty, których nie wolno zużyć, nie mogą zapełniać partii ani otwierać okna na próżno.
    function dropUnusableLoot(target) {
        queue = queue.filter(entry => {
            const item = window.Engine.items.getItemById(entry.id);
            return item && canBeReagent(item, target, Math.min(entry.rankWhenLooted, maxRank));
        });
    }

    function takeBatch(target) {
        dropUnusableLoot(target);
        const size = usages ? Math.min(MAX_BATCH, usages.limit - usages.count) : MAX_BATCH;
        return queue.splice(0, size);
    }

    function chooseTarget(item) {
        if (!canBeTarget(item)) {
            notify('Tego przedmiotu nie można ulepszać');
            return;
        }
        targetId = Number(item.id);
        targetName = item.name;
        save('przedmiot', targetId);
        save('nazwa', targetName);
        resetProgress();
        readKnownUsages();
        notify(`Ulepszany przedmiot: ${targetName}`);
        render();
    }

    function clearTarget() {
        targetId = null;
        targetName = '';
        localStorage.removeItem(`ulepszanie_przedmiot_${storageSuffix}`);
        localStorage.removeItem(`ulepszanie_nazwa_${storageSuffix}`);
        resetProgress();
        render();
    }

    function resetProgress() {
        if (session) closeSession();
        state = 'idle';
        progress = null;
        upgradeCost = null;
        queue = [];
        flushRequested = false;
    }

    /* ================== ŚLEDZENIE ŁUPU ================== */

    // Id przedmiotu nie zmienia się przy przenoszeniu, więc łup rozpoznajemy po tym, że trafił do ekwipunku
    // z okna łupów. Dzięki temu rzeczy wyjęte z depo, kupione albo z wymiany nigdy nie zostaną zużyte.
    function trackLoot(loc, item) {
        const id = Number(item.id);
        if (loc === 'l' || loc === 'k') {
            lootSeen.set(id, Date.now());
        } else if (loc === 'g' && lootSeen.delete(id) && targetId !== null && enabled && (state === 'progressing' || state === 'upgradable')) {
            // Kolejka może stać godzinami (limit, pełny pasek), a podniesienie progu nie powinno
            // spalić łupu zdobytego przy niższym progu. Obniżenie progu działa od razu.
            queue.push({ id, rankWhenLooted: maxRank, lootedAt: Date.now() });
        }
    }

    function forgetOldLoot() {
        const oldest = Date.now() - LOOT_MEMORY_MS;
        for (const [id, seenAt] of lootSeen) {
            if (seenAt < oldest) lootSeen.delete(id);
        }
    }

    function installLootHook() {
        const items = window.Engine.items;
        const newItemInLocation = items.newItemInLocation;
        items.newItemInLocation = function (loc, item, fetchPackage) {
            trackLoot(loc, item);
            return newItemInLocation.call(this, loc, item, fetchPackage);
        };
    }

    /* ================== KOMUNIKACJA Z SERWEREM ================== */

    function setUsages({ count, limit }) {
        usages = { count: Number(count), limit: Number(limit), day: new Date().toDateString() };
    }

    // Gra zapamiętuje licznik po otwarciu okna ulepszania.
    function readKnownUsages() {
        const Engine = window.Engine;
        const known = Engine.enhanceUsages || (Engine.crafting && Engine.crafting.enhanceUsages);
        if (known) setUsages(known);
    }

    function applyEnhancement(data) {
        if (!data) return false;
        if (data.usages_preview) setUsages(data.usages_preview);

        const previous = state;
        if (data.completed !== undefined && data.completed !== null) {
            state = 'completed';
            progress = { ...data.completed, upgradeLevel: MAX_UPGRADE_LEVEL };
            upgradeCost = null;
            queue = [];
        } else if (data.upgradable) {
            state = 'upgradable';
            progress = data.upgradable;
            upgradeCost = data.upgradable.goldPrice;
        } else if (data.progressing) {
            state = 'progressing';
            progress = data.progressing;
            upgradeCost = null;
        } else {
            return false;
        }

        if (state === previous) return true;
        const wasRunning = previous === 'progressing' || previous === 'upgradable';
        if (state === 'completed') {
            const text = `${targetName}: osiągnięto maksymalną jakość. Ulepszanie zatrzymane.`;
            if (wasRunning) alertPlayer(text); else notify(text);
        } else if (state === 'upgradable') {
            const text = `${targetName}: pasek pełny. Podnieś poziom w oknie ulepszania, a dodatek będzie kontynuował.`;
            if (previous === 'progressing') alertPlayer(text); else notify(text);
        }
        return true;
    }

    // Błąd serwera potrafi zerwać połączenie, więc nigdy nie ponawiamy zapytania automatycznie.
    function stopAfterServerError() {
        enabled = false;
        save('wlaczone', false);
        if (viewEnabled) viewEnabled.checked = false;
        state = 'error';
        queue = [];
        nextStep = null;
        notify('Ulepszanie wyłączone: serwer odrzucił zapytanie');
    }

    function sendRequest(task, onDone) {
        busy = true;
        // Gdyby odpowiedź nie dotarła przez awarię strony, po starcie dodatek wie, że ma się nie uruchamiać.
        save('w_toku', 1);
        let finished = false;
        const finish = response => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            busy = false;
            localStorage.removeItem(`ulepszanie_w_toku_${storageSuffix}`);
            onDone(response);
            render();
            // bez czekania na tick, ale już poza obsługą odpowiedzi serwera
            if (session) setTimeout(runSession, SESSION_STEP_MS);
        };
        // po zerwaniu połączenia gra nigdy nie wywoła callbacku
        const timeout = setTimeout(() => finish(null), REQUEST_TIMEOUT_MS);
        window._g(task, finish);
    }

    // Ta sama kolejka zapytań co po kliknięciu w oknie gry: najpierw podgląd, potem właściwe ulepszenie.
    function sendBatch(batch) {
        const id = targetId;
        const params = `item=${id}&ingredients=${batch.map(entry => entry.id).join(',')}`;
        sendRequest(`enhancement&action=progress_preview&${params}`, response => {
            if (id !== targetId) return;
            const preview = response && response.enhancement && response.enhancement.progress_preview;
            if (!preview) {
                stopAfterServerError();
                return;
            }
            // Punkty ponad pełny pasek przepadają, więc nadmiar wraca do kolejki na następny poziom.
            const fits = progress.current + Number(preview.gained) <= progress.max;
            if (batch.length > 1 && !fits) {
                const half = Math.ceil(batch.length / 2);
                queue.unshift(...batch.slice(half));
                nextStep = () => sendBatch(batch.slice(0, half));
            } else {
                nextStep = () => sendProgress(id, params);
            }
        });
    }

    function sendProgress(id, params) {
        sendRequest(`enhancement&action=progress&${params}`, response => {
            if (id === targetId && !(response && applyEnhancement(response.enhancement))) stopAfterServerError();
        });
    }

    // Dla gracza: widoczne okno, tą samą drogą co "Ulepsz" w menu przedmiotu.
    function openGameWindow() {
        const Engine = window.Engine;
        const item = getTarget();
        if (!item) return;
        if (isInBattle()) {
            notify('Okno ulepszania można otworzyć po walce');
            return;
        }
        if (Engine.crafting.itemCraft && Engine.crafting.itemCraft.opened) {
            if (Engine.crafting.enhancement) Engine.crafting.enhancement.close();
            Engine.crafting.open('enhancement');
            Engine.crafting.enhancement.onClickInventoryItem(item);
        } else {
            Engine.crafting.tempEnhanceItemId = Number(item.id);
            window._g(`enhancement&action=open&item=${item.id}`);
        }
    }

    // Gra otwiera okno rzemiosła tylko przy zamkniętym depo, sklepie, poczcie, aukcjach i barterze, a bohater wtedy stoi.
    // Serwer ma widzieć te same warunki co przy zwykłym otwarciu, więc czekamy na taki moment.
    function canOpenWindowNow() {
        const Engine = window.Engine;
        if (busy || Date.now() < nextSendAt || Engine.crafting.isOpen() || isInBattle() || isLootOpen() || Engine.lock.check()) return false;
        if (Engine.shop || Engine.mails || Engine.barter || Engine.auctions || Engine.depo || Engine.trade) return false;
        if (ALLOW_WALKING_DURING_SESSION) return true;
        const { rx, ry, d } = Engine.hero;
        return rx === undefined || (Number(rx) === Number(d.x) && Number(ry) === Number(d.y));
    }

    const isBatchReady = () => queue.length > 0 && (flushRequested || queue.length >= batchSize || Date.now() - queue[0].lootedAt >= LOOT_MAX_WAIT_MS);

    // Serwer przyjmuje ulepszanie tylko zaraz po action=open: bez tego zrywa połączenie (die-response).
    // O oknie wie jednak tylko z tego zapytania, więc dodatek je wysyła, a gra nie dostaje polecenia otwarcia okna.
    function startSession() {
        const Engine = window.Engine;
        const id = targetId;
        session = {};
        flushRequested = false;
        if (state === 'idle') state = 'loading';
        // Ta sama blokada co przy otwartym oknie: krok bohatera w trakcie sesji mógłby ją zakończyć.
        if (!ALLOW_WALKING_DURING_SESSION) Engine.lock.add(SESSION_LOCK);
        ownOpenPending = true;
        sendRequest(`enhancement&action=open&item=${id}`, response => {
            ownOpenPending = false;
            if (id === targetId && !(response && applyEnhancement(response.enhancement))) {
                stopAfterServerError();
                closeSession();
            }
        });
    }

    function closeSession() {
        const Engine = window.Engine;
        session = null;
        nextStep = null;
        ownOpenPending = false;
        nextSendAt = Date.now() + SEND_GAP_MS;
        if (!ALLOW_WALKING_DURING_SESSION) Engine.lock.remove(SESSION_LOCK);
        // Podgląd przedmiotu po ulepszeniu. Prawdziwe okno rysuje tylko to, co dostanie po własnym otwarciu.
        if (Engine.crafting.isOpen()) return;
        Engine.items.deleteMessItemsByLoc('u');
        Engine.tpls.deleteMessItemsByLoc('u');
    }

    function runSession() {
        if (!session || busy) return;
        const target = getTarget();

        // gracz otworzył w tym czasie prawdziwe okno, a odpowiedzi nadpisałyby to, co w nim wybrał
        if (!target || window.Engine.crafting.isOpen() || !isWorking() || isInBattle()) {
            closeSession();
        } else if (nextStep) {
            const step = nextStep;
            nextStep = null;
            step();
        } else {
            const batch = takeBatch(target);
            if (batch.length) sendBatch(batch);
            else closeSession();
        }
    }

    // Stan przedmiotu czytamy z odpowiedzi, które gra i tak dostaje, gdy okno jest otwarte na tym przedmiocie.
    function installEnhancementListener() {
        const dispatcher = window.Engine.communication.dispatcher;
        const onEnhancement = dispatcher.on_enhancement;
        dispatcher.on_enhancement = function (data) {
            const crafting = window.Engine.crafting;
            // tuż po otwarciu okna gra trzyma wybrany przedmiot jeszcze w tempEnhanceItemId
            const shown = crafting ? [crafting.tempEnhanceItemId, crafting.enhancement && crafting.enhancement.selectedEnhanceItem] : [];
            if (data && data.usages_preview) setUsages(data.usages_preview);
            if (targetId !== null && shown.some(id => Number(id) === targetId)) applyEnhancement(data);
            return onEnhancement.apply(this, arguments);
        };

        const onArtisanship = dispatcher.on_artisanship;
        dispatcher.on_artisanship = function (data, response) {
            // odpowiedź na zapytanie dodatku: bez okna, ale licznik gry musi pozostać aktualny
            if (!ownOpenPending) return onArtisanship.apply(this, arguments);
            const usagesPreview = response && response.enhancement && response.enhancement.usages_preview;
            if (usagesPreview) window.Engine.crafting.enhanceUsages = usagesPreview;
            return undefined;
        };
    }

    /* ================== GŁÓWNA PĘTLA ================== */

    function watchLimit() {
        if (usages && usages.day !== new Date().toDateString()) usages = null;
        if (!isLimitReached()) {
            limitNotified = false;
            return;
        }
        if (!limitNotified) {
            limitNotified = true;
            notify('Osiągnięto dzienny limit ulepszania');
        }
    }

    function tick() {
        const Engine = window.Engine;
        if (!Engine.allInit) return;

        forgetOldLoot();
        watchLimit();

        // Odpowiedź serwera trafia też do otwartego okna gry i nadpisałaby to, co gracz tam wybrał.
        const craftingOpen = isCraftingOpen();
        if (craftingWasOpen && !craftingOpen) {
            readKnownUsages();
            // gracz zamknął okno, zanim gra podała stan przedmiotu
            if (state === 'loading') state = 'idle';
        }
        craftingWasOpen = craftingOpen;

        if (targetId !== null) {
            const target = getTarget();
            if (!target || target.loc !== 'g') {
                state = 'missing';
            } else if (state === 'missing') {
                state = 'idle';
            }

            if (target && queue.length) dropUnusableLoot(target);

            if (session) {
                if (state === 'missing') closeSession();
                else runSession();
            } else if (((state === 'idle' && enabled) || (isWorking() && isBatchReady())) && canOpenWindowNow()) {
                startSession();
            }
        }

        render();
    }

    /* ================== MENU ================== */

    let panel = null;
    let view = null;
    let lastRender = '';

    function togglePanel() {
        if (!panel) return;
        panel.hidden = !panel.hidden;
        if (!panel.hidden) render();
    }

    function statusText() {
        if (targetId === null) return 'Przeciągnij przedmiot z ekwipunku na ikonkę dodatku lub na pole obok.';
        if (state === 'missing') return 'Przedmiotu nie ma w ekwipunku. Ulepszanie wstrzymane.';
        if (state === 'idle') return enabled ? 'Czekam na chwilę, żeby wczytać stan przedmiotu...' : 'Ulepszanie wyłączone.';
        if (state === 'loading') return 'Sprawdzanie przedmiotu...';
        if (state === 'error') return 'Serwer odrzucił zapytanie, ulepszanie wyłączone. Możesz włączyć je ponownie poniżej.';
        if (state === 'completed') return 'Osiągnięto maksymalną jakość. Ulepszanie zatrzymane.';
        if (state === 'upgradable') {
            const cost = upgradeCost ? ` Koszt w złocie: ${Number(upgradeCost).toLocaleString('pl-PL')}.` : '';
            return `Pasek pełny. Podnieś poziom w oknie ulepszania.${cost}`;
        }
        if (!enabled) return 'Ulepszanie wyłączone.';
        if (isLimitReached()) return 'Osiągnięto dzienny limit. Ulepszanie wstrzymane.';
        if (session) return `Ulepszanie... (w kolejce: ${queue.length})`;
        if (isCraftingOpen()) return 'Wstrzymane, dopóki otwarte jest okno ulepszania.';
        if (isInBattle()) return 'Wstrzymane na czas walki.';
        return queue.length ? `Zebrane: ${queue.length}/${batchSize}` : 'Czekam na łup.';
    }

    const percent = (current, max) => (max > 0 ? Math.min(100, Math.floor(current / max * 100)) : 0);

    function render() {
        if (!panel) return;
        if (window.Engine.interfaceStart) window.Engine.widgetManager.manageClassOfWidget(WIDGET_KEY, isWorking());
        if (panel.hidden) return;

        const target = getTarget();
        const level = progress ? progress.upgradeLevel : null;
        const progressPercent = state === 'completed' ? 100 : progress ? percent(progress.current, progress.max) : 0;
        const progressText = state === 'completed'
            ? 'maksimum'
            : progress ? `${progress.current}/${progress.max} (${progressPercent}%)` : '—';
        const usagesText = usages ? `${usages.count}/${usages.limit}` : targetId === null ? '—' : 'sprawdzanie...';
        const icon = target && target.icon ? `${window.CFG.a_ipath}${target.icon}` : '';

        const snapshot = JSON.stringify([
            targetId, targetName, level, progressPercent, progressText, usagesText, icon, state, statusText(), enabled, maxRank, queue.length, !!session,
        ]);
        if (snapshot === lastRender) return;
        lastRender = snapshot;

        view.slot.classList.toggle('ul-slot-empty', !icon);
        view.slot.style.backgroundImage = icon ? `url("${icon}")` : '';
        view.slot.title = targetName;
        view.name.textContent = targetName || 'Brak wybranego przedmiotu';
        view.level.textContent = level === null ? '' : `Poziom ulepszenia: ${level}/${MAX_UPGRADE_LEVEL}`;
        view.clear.hidden = targetId === null;
        view.progressValue.textContent = progressText;
        view.progressBar.style.width = `${progressPercent}%`;
        view.usagesValue.textContent = usagesText;
        view.usagesBar.style.width = `${usages ? percent(usages.count, usages.limit) : 0}%`;
        view.status.textContent = statusText();
        view.status.className = `ul-status ul-status-${state}`;
        view.open.hidden = targetId === null || !['upgradable', 'error'].includes(state);
        view.flush.hidden = !isWorking() || !queue.length || !!session;
    }

    function createCheckbox(id, text, checked, onChange) {
        const row = document.createElement('div');
        row.className = 'ul-check';
        const input = document.createElement('input');
        input.id = id;
        input.type = 'checkbox';
        input.checked = checked;
        input.addEventListener('change', () => {
            onChange(input.checked);
            // bez fokusu spacja i strzałki znów sterują grą, a nie opcją
            input.blur();
        });
        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = text;
        row.append(input, label);
        return row;
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text) element.textContent = text;
        return element;
    }

    function createMeter(labelText) {
        const row = createElement('div', 'ul-meter');
        const head = createElement('div', 'ul-meter-head');
        const value = createElement('span', 'ul-meter-value');
        head.append(createElement('span', '', labelText), value);
        const track = createElement('div', 'ul-meter-track');
        const bar = createElement('div', 'ul-meter-bar');
        track.append(bar);
        row.append(head, track);
        return { row, value, bar };
    }

    function buildPanel() {
        const style = document.createElement('style');
        style.textContent = `
            .main-buttons-container .widget-button .icon.${WIDGET_KEY} { background-image: url("${WIDGET_ICON}"); background-position: 0; }
            #ul-panel { position: fixed; z-index: 9999; width: 280px; display: flex; flex-direction: column; background: #1b1712; color: #e8dcc0; border: 2px solid #6b5a33; border-radius: 6px; font: 12px/1.35 Arial, sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,.6); user-select: none; }
            #ul-panel, #ul-panel * { box-sizing: border-box; }
            #ul-panel[hidden], #ul-panel [hidden] { display: none; }
            #ul-panel .ul-head { display: flex; align-items: center; gap: 6px; padding: 5px 8px; cursor: move; background: linear-gradient(#3a2f1a, #2a2212); border-bottom: 1px solid #6b5a33; border-radius: 4px 4px 0 0; }
            #ul-panel .ul-title { flex: 1; font-weight: bold; color: #f1d58a; }
            #ul-panel .ul-btn { cursor: pointer; background: #4a3d22; border: 1px solid #7a6639; color: #f1d58a; border-radius: 3px; padding: 0 6px; line-height: 18px; font-size: 12px; text-align: center; }
            #ul-panel .ul-btn:hover { background: #5d4c2a; }
            #ul-panel .ul-page { padding: 8px; display: flex; flex-direction: column; gap: 8px; }
            #ul-panel .ul-item { display: flex; align-items: center; gap: 8px; }
            #ul-panel .ul-slot { flex: none; width: 36px; height: 36px; border: 1px solid #6b5a33; border-radius: 3px; background: #0f0d0a no-repeat 2px 2px; }
            #ul-panel .ul-slot-empty { border-style: dashed; }
            #ul-panel .ul-item-info { flex: 1; min-width: 0; }
            #ul-panel .ul-item-name { color: #f1d58a; font-weight: bold; overflow-wrap: anywhere; }
            #ul-panel .ul-meter-head { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 2px; }
            #ul-panel .ul-meter-track { height: 8px; background: #0f0d0a; border: 1px solid #6b5a33; border-radius: 3px; overflow: hidden; }
            #ul-panel .ul-meter-bar { height: 100%; width: 0; background: #b8923e; transition: width .2s; }
            #ul-panel .ul-field label { display: block; margin-bottom: 2px; }
            #ul-panel .ul-field select, #ul-panel .ul-field input { width: 100%; background: #2a2212; color: #e8dcc0; border: 1px solid #6b5a33; border-radius: 3px; padding: 2px; font: inherit; }
            #ul-panel .ul-hint { margin-top: 2px; color: #a89a7a; font-size: 11px; }
            #ul-panel .ul-check { display: flex; align-items: center; gap: 5px; }
            #ul-panel .ul-check label { margin: 0; color: #e8dcc0; cursor: pointer; }
            #ul-panel .ul-check input { margin: 0; accent-color: #7a6639; cursor: pointer; }
            #ul-panel .ul-status { padding: 4px 6px; background: #2a2212; border-radius: 3px; }
            #ul-panel .ul-status-completed { color: #9fe08a; }
            #ul-panel .ul-status-upgradable { color: #f1d58a; }
            #ul-panel .ul-status-missing, #ul-panel .ul-status-error { color: #e89a8a; }
        `;
        document.head.appendChild(style);

        panel = createElement('div');
        panel.id = 'ul-panel';
        panel.hidden = true;

        const head = createElement('div', 'ul-head');
        const close = createElement('span', 'ul-btn', '×');
        close.title = 'Zamknij';
        close.addEventListener('click', () => { panel.hidden = true; });
        head.append(createElement('span', 'ul-title', 'Ulepszanie przedmiotów'), close);

        const page = createElement('div', 'ul-page');

        const itemRow = createElement('div', 'ul-item');
        const slot = createElement('div', 'ul-slot ul-slot-empty');
        const info = createElement('div', 'ul-item-info');
        const name = createElement('div', 'ul-item-name');
        const level = createElement('div');
        info.append(name, level);
        const clear = createElement('span', 'ul-btn', '×');
        clear.title = 'Przestań ulepszać ten przedmiot';
        clear.addEventListener('click', clearTarget);
        itemRow.append(slot, info, clear);

        const progressMeter = createMeter('Postęp ulepszania');
        const usagesMeter = createMeter('Dzienny limit');

        const field = createElement('div', 'ul-field');
        const qualityLabel = createElement('label', '', 'Maks. jakość zużywanych przedmiotów');
        qualityLabel.htmlFor = 'ul-quality';
        const quality = document.createElement('select');
        quality.id = 'ul-quality';
        for (const { rank, text } of RARITY_OPTIONS) quality.add(new Option(text, rank));
        quality.value = maxRank;
        quality.addEventListener('change', () => {
            maxRank = Number(quality.value);
            save('jakosc', maxRank);
            quality.blur();
            render();
        });
        field.append(qualityLabel, quality, createElement('div', 'ul-hint', 'Legendy, artefakty i ulepszone nigdy nie są zużywane.'));

        const batchField = createElement('div', 'ul-field');
        const batchLabel = createElement('label', '', 'Zużywaj łup po zebraniu');
        batchLabel.htmlFor = 'ul-batch';
        const batchSelect = document.createElement('select');
        batchSelect.id = 'ul-batch';
        for (const size of BATCH_OPTIONS) batchSelect.add(new Option(size === 1 ? '1 przedmiotu' : `${size} przedmiotów`, size));
        batchSelect.add(new Option('Własna liczba', CUSTOM_BATCH));
        const isCustomBatch = !BATCH_OPTIONS.includes(batchSize);
        batchSelect.value = isCustomBatch ? CUSTOM_BATCH : batchSize;

        const batchInput = document.createElement('input');
        batchInput.id = 'ul-batch-custom';
        batchInput.type = 'text';
        batchInput.inputMode = 'numeric';
        batchInput.maxLength = String(MAX_CUSTOM_BATCH).length;
        batchInput.placeholder = 'Liczba przedmiotów';
        batchInput.title = `Od 1 do ${MAX_CUSTOM_BATCH}`;
        batchInput.value = batchSize;
        batchInput.hidden = !isCustomBatch;
        batchInput.style.marginTop = '4px';

        const setBatchSize = size => {
            batchSize = size;
            save('partia', batchSize);
            render();
        };
        batchSelect.addEventListener('change', () => {
            const custom = batchSelect.value === CUSTOM_BATCH;
            batchInput.hidden = !custom;
            if (custom) {
                batchInput.value = batchSize;
                batchInput.focus();
                batchInput.select();
            } else {
                setBatchSize(Number(batchSelect.value));
                batchSelect.blur();
            }
        });
        batchInput.addEventListener('input', () => {
            batchInput.value = batchInput.value.replace(/\D/g, '');
            const size = Number(batchInput.value);
            if (size >= 1) setBatchSize(size);
        });
        // puste pole lub 0 nie zmieniają ustawienia, więc pokazujemy to, co obowiązuje
        batchInput.addEventListener('blur', () => { batchInput.value = batchSize; });
        batchInput.addEventListener('keydown', event => {
            if (event.key === 'Enter') batchInput.blur();
        });
        batchField.append(batchLabel, batchSelect, batchInput);

        const enabledRow = createCheckbox('ul-enabled', 'Ulepszaj zdobytymi przedmiotami', enabled, checked => {
            enabled = checked;
            save('wlaczone', enabled);
            queue = [];
            if (enabled && state === 'error') state = 'idle';
            render();
        });

        viewEnabled = enabledRow.querySelector('input');

        const status = createElement('div', 'ul-status');
        const open = createElement('div', 'ul-btn', 'Otwórz okno ulepszania');
        open.hidden = true;
        open.addEventListener('click', openGameWindow);
        const flush = createElement('div', 'ul-btn', 'Zużyj zebrany łup teraz');
        flush.hidden = true;
        flush.addEventListener('click', () => {
            flushRequested = true;
            render();
        });

        page.append(itemRow, progressMeter.row, usagesMeter.row, field, batchField, enabledRow, status, flush, open);
        panel.append(head, page);
        document.body.appendChild(panel);
        installDragging(head);

        view = {
            slot, name, level, clear, status, open, flush,
            progressValue: progressMeter.value, progressBar: progressMeter.bar,
            usagesValue: usagesMeter.value, usagesBar: usagesMeter.bar,
        };
        render();
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
            if (event.target.classList.contains('ul-btn')) return;
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
        if (!event.altKey || event.repeat || event.key.toLowerCase() !== 'u') return;
        event.preventDefault();
        togglePanel();
    });

    /* ================== UPUSZCZANIE PRZEDMIOTU ================== */

    function isInside(element, x, y) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    function isOverDropTarget(x, y) {
        if (isInside(document.querySelector(`.widget-${WIDGET_KEY}`), x, y)) return true;
        return !!panel && !panel.hidden && isInside(view.slot, x, y);
    }

    // Gra wywołuje drop we wszystkich strefach pod kursorem, więc zwykła strefa nad mapą dałaby też pytanie
    // o wyrzucenie przedmiotu. Dlatego upuszczenie jest łapane przed grą, a jej przeciąganie anulowane.
    function installDropHandling() {
        let source = null;

        window.addEventListener('pointerdown', event => {
            const element = event.target.closest && event.target.closest('.inventory-item');
            source = element && event.button === 0 ? element : null;
        }, true);

        window.addEventListener('pointercancel', () => { source = null; }, true);

        window.addEventListener('pointerup', event => {
            const element = source;
            source = null;
            if (!element || !isOverDropTarget(event.clientX, event.clientY)) return;
            const item = window.$(element).data('item');
            if (!item) return;
            window.$(element).pointerDraggable('cancel');
            chooseTarget(item);
        }, true);
    }

    /* ================== WIDGET ================== */
    // credit to https://github.com/nerthus-margonem/nerthusaddon

    function installWidget() {
        const Engine = window.Engine;

        const addToDefaultSet = () => Engine.widgetManager.addKeyToDefaultWidgetSet(
            WIDGET_KEY,
            DEFAULT_WIDGET_POSITION[0],
            DEFAULT_WIDGET_POSITION[1],
            'Ulepszanie przedmiotów',
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

    function loadSettings() {
        storageSuffix = window.Engine.hero.d.id;
        const savedTarget = Number(load('przedmiot'));
        if (savedTarget) {
            targetId = savedTarget;
            targetName = load('nazwa') || '';
        }
        const savedRank = Number(load('jakosc'));
        if (RARITY_OPTIONS.some(({ rank }) => rank === savedRank)) maxRank = savedRank;
        enabled = load('wlaczone') !== 'false';
        const savedBatch = Number(load('partia'));
        if (Number.isInteger(savedBatch) && savedBatch >= 1 && savedBatch <= MAX_CUSTOM_BATCH) batchSize = savedBatch;
        if (load('w_toku')) {
            localStorage.removeItem(`ulepszanie_w_toku_${storageSuffix}`);
            stopAfterServerError();
        }
    }

    function waitFor(isReady, callback) {
        if (isReady()) callback();
        else setTimeout(() => waitFor(isReady, callback), 50);
    }

    waitFor(() => window.Engine && window.Engine.widgetManager && window.Engine.widgetManager.addWidgetButtons, installWidget);
    waitFor(
        () => document.head && document.body && window.Engine && window.Engine.items && window.Engine.items.newItemInLocation
            && window.Engine.hero && window.Engine.hero.d && window.Engine.hero.d.id
            && window.Engine.communication && window.Engine.communication.dispatcher,
        () => {
            loadSettings();
            installLootHook();
            installEnhancementListener();
            installDropHandling();
            buildPanel();
            setInterval(tick, TICK_MS);
        }
    );
})();
