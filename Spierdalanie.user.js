// ==UserScript==
// @name         spierdalanie
// @version      1.1
// @author       Bancewald
// @match        *.margonem.pl
// @grant        none
// ==/UserScript==

//1.1 added custom widget

((Engine) => {

    //----ADDING WIDGET credit to https://github.com/nerthus-margonem/nerthusaddon
    const defaultPosition = [0, 'bottom-right-additional']

    const addWidgetToDefaultWidgetSet = function() {
        Engine.widgetManager.addKeyToDefaultWidgetSet(
            'spierdalanie',
            defaultPosition[0],
            defaultPosition[1],
            'spierdalanie',
            'green',
            changeMenuState
        )
    }

    $('head').append('<style>' +
        '.main-buttons-container .widget-button .icon.spierdalanie {' +
        'background-image: url("https://iili.io/pprKcg.png");' +
        'background-position: 0;' +
        '}' +
        '</style>'
    )
    const addWidgetButtons = Engine.widgetManager.addWidgetButtons
    Engine.widgetManager.addWidgetButtons = function(additionalBarHide) {
        addWidgetButtons.call(Engine.widgetManager, additionalBarHide)
        addWidgetToDefaultWidgetSet()
        createButtonNI()

        Engine.widgetManager.addWidgetButtons = addWidgetButtons
    }

    if (Engine.interfaceStart) {
        addWidgetToDefaultWidgetSet()
        createButtonNI()
    }

    function createButtonNI() {
        if (Engine.interfaceStart && Object.keys(Engine.widgetManager.getDefaultWidgetSet()).includes('spierdalanie')) {
            let spierdalaniePos = defaultPosition

            const serverStoragePos = Engine.serverStorage.get(Engine.widgetManager.getPathToHotWidgetVersion())
            if (serverStoragePos && serverStoragePos.spierdalanie) spierdalaniePos = serverStoragePos.spierdalanie

            Engine.widgetManager.createOneWidget('spierdalanie', { spierdalanie: spierdalaniePos }, true, [])
            Engine.widgetManager.setEnableDraggingButtonsWidget(false)
        } else setTimeout(createButtonNI, 500)
    }

    //----

    const changeMenuState = function() {
        menu.style["display"] = menu.style["display"] == "block" ? "none" : "block";
    }

    var menu = document.createElement("div");

    menu.id = "uciekanko_menu";
    menu.style.cssText = "position:absolute;top:200px;left:200px;width:200px;height:200px;background-color:white;z-index:999;display:none";
    document.querySelector(".game-window-positioner").appendChild(menu);

    if (localStorage.getItem('dane_uciekanko') == null) localStorage.setItem('dane_uciekanko', 'Zwój teleportacji na Kwieciste Przejście');
    var dane_uciekanko = localStorage.getItem('dane_uciekanko');


    menu.innerHTML = '<center>Nazwa tp:<br><br><input id="nazwa_zwoju" value="' + dane_uciekanko + '">';
    menu.innerHTML = menu.innerHTML + '<br><br><center><button id="zapisz_uciekanko">Zapisz</button>'
    menu.innerHTML = menu.innerHTML + '<br><br><center><button id="spierdalaj_button">Spierdalaj</button></center>'

    function saveToUciekanko() {
        var itemsik = document.getElementById("nazwa_zwoju").value;
        localStorage.setItem('dane_uciekanko', itemsik);
    }

    function getTpItem() {
        var name = document.getElementById("nazwa_zwoju").value;
        const items = Engine.items.fetchLocationItems("g")
            .filter(item => item.name == name);
        return items[0].id;
    }

    var spierdalanie = false;


    var id;

    function uciekanie() {
        window._g(`moveitem&st=1&id=${id}`);
        spierdalanie = false;
        message("koncze spierdalac");
        window.API.removeCallbackFromEvent("close_battle", uciekanie);
    }


    function wypierdalam() {
        id = getTpItem();
        if (Engine.battle.show) {
            if (spierdalanie) {
                message("koncze spierdalac");
                window.API.removeCallbackFromEvent("close_battle", uciekanie);
                spierdalanie = false;
            } else {
                message("spierdalam")
                spierdalanie = true;
                window.API.addCallbackToEvent("close_battle", uciekanie);
            }
        }

    }


    document.getElementById("zapisz_uciekanko").addEventListener("click", saveToUciekanko);
    document.getElementById("spierdalaj_button").addEventListener("click", wypierdalam);

    function logKey(e) {
        if (e.which === 186) {
            menu.style["display"] = menu.style["display"] == "block" ? "none" : "block";
        }
        if (e.which === 222) {
            wypierdalam();
        }
    }

    document.addEventListener('keydown', logKey);

})(window.Engine)
