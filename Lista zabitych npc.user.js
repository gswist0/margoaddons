// ==UserScript==
// @name         Log potworow
// @version      1.0
// @match        *.margonem.pl/
// @grant        none
// @author       Bancewald
// ==/UserScript==

function isLessThan3HoursAgo(entry) {
    if (Date.now() - 10800000 > entry[1]) {
        return false
    }
    return true
}

function readDataFromStorageAndRemoveOlderEntries() {
    var recordedKills = JSON.parse(localStorage.getItem("kills"))
    recordedKills = recordedKills.filter(isLessThan3HoursAgo)
    localStorage.setItem("kills", JSON.stringify(recordedKills))
    return recordedKills
}

function updateStorage(kills) {
    localStorage.setItem("kills", JSON.stringify(kills))
}

function isNpcKilled(npc, hero, map) {
    if (map.d.pvp != 2) return true
    if (Math.abs(npc.d.x - hero.d.x) == 17 || Math.abs(npc.d.y - hero.d.y) == 17 || Math.abs(npc.d.y - hero.d.y) == 18 || Math.abs(npc.d.x - hero.d.x) == 18) return false
    return true
}

function run(Engine) {

    //----ADDING WIDGET credit to https://github.com/nerthus-margonem/nerthusaddon
    const defaultPosition = [2, 'bottom-right-additional']

    const addWidgetToDefaultWidgetSet = function() {
        Engine.widgetManager.addKeyToDefaultWidgetSet(
            'lista',
            defaultPosition[0],
            defaultPosition[1],
            'lista',
            'green',
            changeListState
        )
    }

    $('head').append('<style>' +
        '.main-buttons-container .widget-button .icon.lista {' +
        'background-image: url("https://bancewald.000webhostapp.com/scripts/lista.png");' +
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
        if (Engine.interfaceStart && Object.keys(Engine.widgetManager.getDefaultWidgetSet()).includes('lista')) {
            let listaPos = defaultPosition

            const serverStoragePos = Engine.serverStorage.get(Engine.widgetManager.getPathToHotWidgetVersion())
            if (serverStoragePos && serverStoragePos.lista) listaPos = serverStoragePos.lista

            Engine.widgetManager.createOneWidget('lista', { lista: listaPos }, true, [])
            Engine.widgetManager.setEnableDraggingButtonsWidget(false)
        } else setTimeout(createButtonNI, 500)
    }

    //----


    var list = document.createElement("div")
    list.id = "kills_list"
    list.style.cssText = "position:absolute;top:200px;left:200px;width:80%;height:500px;background-color:white;z-index:999;display:none;overflow-y:scroll;text-align:center";
    document.querySelector(".game-window-positioner").appendChild(list);

    const changeListState = function() {
        list.style["display"] = list.style["display"] == "block" ? "none" : "block";
    }

    if (localStorage.getItem("kills") == null) localStorage.setItem("kills", JSON.stringify([]))

    var kills = readDataFromStorageAndRemoveOlderEntries()

    kills.slice().reverse().forEach((item) => list.innerHTML = list.innerHTML + item[0] + "   " + new Date(item[1]).toLocaleTimeString("pl-PL") + "   " + item[2] + "<br>")

    if (Engine && Engine.npcs && Engine.npcs.check) window.API.addCallbackToEvent("removeNpc", function(npc) {
        if (isNpcKilled(npc, Engine.hero, Engine.map)) {
            var othersHere = Engine.others.getDrawableList().filter(i => i.isPlayer == true).map(i => i.nick)
            kills.push([npc.d.nick, Date.now(), othersHere])
            updateStorage(kills)
            list.innerHTML = ""
            kills.slice().reverse().forEach((item) => list.innerHTML = list.innerHTML + item[0] + "   " + new Date(item[1]).toLocaleTimeString("pl-PL") + "   " + item[2] + "<br>")
        }
    })
    else setTimeout(function() { run(window.Engine) }, 100)

}

run(window.Engine)