// ==UserScript==
// @name         Agresywność potworów
// @version      1.0
// @description  Widget włączający/wyłączający agresywność potworów w pojedynkę z konfiguracji gry
// @match        https://*.margonem.pl/
// @match        https://*.margonem.com/
// @author       Bancewald
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const WIDGET_KEY = 'agresywnoscpotworow';
    const WIDGET_ICON = 'https://raw.githubusercontent.com/gswist0/margoaddons/refs/heads/main/ag_clear.png';
    const DEFAULT_WIDGET_POSITION = [5, 'bottom-right-additional'];
    const STATE_REFRESH_MS = 500;
    // SettingsData.KEY.BERSERK z silnika gry (BERSERK_GROUP to osobna opcja dla grupy)
    const BERSERK_SETTING = 34;

    const isAggressive = () => !!window.Engine.settingsOptions.isBerserk();

    function toggleAggression() {
        const Engine = window.Engine;
        if (!Engine || !Engine.interfaceStart) return;
        Engine.settingsStorage.sendRequest(BERSERK_SETTING, 'v', isAggressive() ? 0 : 1);
    }

    /* ================== STAN WIDGETU ================== */

    // Odpytywanie zamiast jednorazowego ustawienia: opcję można zmienić też w konfiguracji gry,
    // a przebudowa widgetów (np. zmiana rozdzielczości) kasuje podświetlenie przycisku.
    function installStateSync() {
        const Engine = window.Engine;
        let lastState = null;

        setInterval(() => {
            // przed startem interfejsu ustawienia mogą nie być jeszcze wczytane
            if (!Engine.interfaceStart) return;
            const state = isAggressive();
            Engine.widgetManager.manageClassOfWidget(WIDGET_KEY, state);
            // gra odświeża ikonki agresji nad potworami tylko przy zmianie z okna konfiguracji
            if (lastState !== null && state !== lastState) Engine.npcs.refreshAggressiveEmo();
            lastState = state;
        }, STATE_REFRESH_MS);
    }

    /* ================== WIDGET ================== */
    // credit to https://github.com/nerthus-margonem/nerthusaddon

    function installWidget() {
        const Engine = window.Engine;

        const addToDefaultSet = () => Engine.widgetManager.addKeyToDefaultWidgetSet(
            WIDGET_KEY,
            DEFAULT_WIDGET_POSITION[0],
            DEFAULT_WIDGET_POSITION[1],
            'Agresywność potworów w pojedynkę',
            'green',
            toggleAggression
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

        installStateSync();
    }

    function installStyle() {
        const style = document.createElement('style');
        style.textContent = `.main-buttons-container .widget-button .icon.${WIDGET_KEY} { background-image: url("${WIDGET_ICON}"); background-position: 0; }`;
        document.head.appendChild(style);
    }

    document.addEventListener('keydown', event => {
        // repeat: przytrzymany klawisz wysyłałby do serwera kolejne przełączenia
        if (!event.altKey || event.repeat || event.key.toLowerCase() !== 'c') return;
        event.preventDefault();
        toggleAggression();
    });

    function waitFor(isReady, callback) {
        if (isReady()) callback();
        else setTimeout(() => waitFor(isReady, callback), 50);
    }

    waitFor(() => document.head, installStyle);
    waitFor(() => window.Engine && window.Engine.widgetManager && window.Engine.widgetManager.addWidgetButtons, installWidget);
})();
