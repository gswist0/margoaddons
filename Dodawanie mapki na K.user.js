// ==UserScript==
// @name         dodawanie mapki na K
// @version      1.3
// @author       Bancewald
// @match        *.margonem.pl/
// @match        *.margonem.com/
// @grant        none
// ==/UserScript==

//1.1 nie zaprasza już przypadkiem podczas pisania na czacie
//1.2 lekka optymalizacja
//1.3 dodane menu wyboru przycisku

(Engine => {


    //----ADDING WIDGET credit to https://github.com/nerthus-margonem/nerthusaddon
    const defaultPosition = [1, 'bottom-right-additional']

    const addWidgetToDefaultWidgetSet = function() {
        Engine.widgetManager.addKeyToDefaultWidgetSet(
            'dodawanie',
            defaultPosition[0],
            defaultPosition[1],
            'dodawanie',
            'green',
            changeMenuState
        )
    }

    $('head').append('<style>' +
        '.main-buttons-container .widget-button .icon.dodawanie {' +
        'background-image: url("https://iili.io/pprJoB.png");' +
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
        if (Engine.interfaceStart && Object.keys(Engine.widgetManager.getDefaultWidgetSet()).includes('dodawanie')) {
            let dodawaniePos = defaultPosition

            const serverStoragePos = Engine.serverStorage.get(Engine.widgetManager.getPathToHotWidgetVersion())
            if (serverStoragePos && serverStoragePos.dodawanie) dodawaniePos = serverStoragePos.dodawanie

            Engine.widgetManager.createOneWidget('dodawanie', { dodawanie: dodawaniePos }, true, [])
            Engine.widgetManager.setEnableDraggingButtonsWidget(false)
        } else setTimeout(createButtonNI, 500)
    }

    //----


    var menu = document.createElement("div");

    const changeMenuState = function() {
        menu.style["display"] = menu.style["display"] == "block" ? "none" : "block";
    }


    menu.id = "dodawanie_menu";
    menu.style.cssText = "position:absolute;top:200px;left:200px;width:200px;height:200px;background-color:white;z-index:999;display:none";
    document.querySelector(".game-window-positioner").appendChild(menu);

    if (localStorage.getItem('dodawanie_code') == null) localStorage.setItem('dodawanie_code', 75);
    if (localStorage.getItem('dodawanie_key') == null) localStorage.setItem('dodawanie_key', "k");
    var dodawanie_code = localStorage.getItem('dodawanie_code');
    var dodawanie_key = localStorage.getItem('dodawanie_key');


    menu.innerHTML = '<center>Aktualny przycisk:<br><br>' + dodawanie_key;
    menu.innerHTML = menu.innerHTML + '<br><br><center><button id="zmianka">Zmień</button>'

    function add_listener_to_button() {
        document.getElementById("zmianka").addEventListener("click", () => { document.removeEventListener('keydown', add_to_group);
            document.addEventListener('keydown', change_key) });
    }

    add_listener_to_button()


    function change_key(e) {
        console.log(e.key)
        dodawanie_code = e.which
        dodawanie_key = e.key
        localStorage.setItem('dodawanie_code', dodawanie_code)
        localStorage.setItem('dodawanie_key', dodawanie_key)
        document.removeEventListener('keydown', change_key)
        document.addEventListener('keydown', add_to_group)
        menu.innerHTML = '<center>Aktualny przycisk:<br><br>' + dodawanie_key;
        menu.innerHTML = menu.innerHTML + '<br><br><center><button id="zmianka">Zmień</button>'
        add_listener_to_button()
    }

    function is_chat_focused() {
        if (document.activeElement.tagName == "INPUT" || document.activeElement.tagname == "TEXTAREA") {
            return true
        }
        return false
    }

    function applicable_distance(otherX, otherY) {
        if (Math.abs(otherX - Engine.hero.d.x) > 1) return false;
        if (Math.abs(otherY - Engine.hero.d.y) > 1) return false;
        return true;
    }

    function is_he_in_party(id) {
        if (!Engine.party)
            return false
        if (Engine.party.getLeaderId() != Engine.hero.d.id)
            return true
        for (let i = 0; i < Object.keys(Engine.party.getMembers()).length; i++) {
            if (Object.keys(Engine.party.getMembers())[i] == id) return true
        }
        return false
    }

    function add_to_group(e) {
        if (e.which == dodawanie_code) {
            var list = Engine.others.getDrawableList()
            for (let i = 0; i < list.length; i++) {
                if (list[i].isPlayer) {
                    if ((list[i].d.relation == 2 || list[i].d.relation == 4 || list[i].d.relation == 5 || applicable_distance(list[i].d.x, list[i].d.y)) && !is_he_in_party(list[i].d.id) && !is_chat_focused())
                        _g("party&a=inv&id=" + list[i].d.id)
                }
            }
        }
    }

    document.addEventListener('keydown', add_to_group)
})(window.Engine)
