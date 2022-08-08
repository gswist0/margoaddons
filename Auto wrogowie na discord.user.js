// ==UserScript==
// @name         Info o wrogach na discord
// @version      1.0
// @author       Bancewald
// @match        *.margonem.pl/
// ==/UserScript==

function run() {

    //----ADDING WIDGET credit to https://github.com/nerthus-margonem/nerthusaddon
    const defaultPosition = [7, 'bottom-right-additional']

    const addWidgetToDefaultWidgetSet = function() {
        Engine.widgetManager.addKeyToDefaultWidgetSet(
            'wrogowie',
            defaultPosition[0],
            defaultPosition[1],
            'wrogowie',
            'green',
            changewrogowieState
        )
    }

    $('head').append('<style>' +
        '.main-buttons-container .widget-button .icon.wrogowie {' +
        'background-image: url("https://bancewald.000webhostapp.com/scripts/wrogowie.png");' +
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
        if (Engine.interfaceStart && Object.keys(Engine.widgetManager.getDefaultWidgetSet()).includes('wrogowie')) {
            let wrogowiePos = defaultPosition

            const serverStoragePos = Engine.serverStorage.get(Engine.widgetManager.getPathToHotWidgetVersion())
            if (serverStoragePos && serverStoragePos.wrogowie) wrogowiePos = serverStoragePos.wrogowie

            Engine.widgetManager.createOneWidget('wrogowie', { wrogowie: wrogowiePos }, true, [])
            Engine.widgetManager.setEnableDraggingButtonsWidget(false)
        } else setTimeout(createButtonNI, 500)
    }

    //----


    var wrogowie = document.createElement("div");

    const changewrogowieState = function() {
        wrogowie.style["display"] = wrogowie.style["display"] == "block" ? "none" : "block";
    }

    if (localStorage.getItem('webhook_wrogowie') == null) localStorage.setItem('webhook_wrogowie', '');
    var webhook = localStorage.getItem('webhook_wrogowie');
    if (localStorage.getItem('klany_wrogowie') == null) localStorage.setItem('klany_wrogowie', '');
    var klany_wrogowie = localStorage.getItem('klany_wrogowie');
    if (localStorage.getItem('nicki_wrogowie') == null) localStorage.setItem('nicki_wrogowie', '');
    var nicki_wrogowie = localStorage.getItem('nicki_wrogowie');

    klany_array = klany_wrogowie.split(",")
    klany_array.forEach(klan => klan.trim())
    nicki_array = nicki_wrogowie.split(",")
    nicki_array.forEach(nick => nick.trim())


    wrogowie.id = "wrogowie";
    wrogowie.style.cssText = "position:absolute;top:200px;left:200px;width:200px;height:400px;background-color:white;z-index:999;display:none";
    document.querySelector(".game-window-positioner").appendChild(wrogowie);

    wrogowie.innerHTML = '<center>Link do webhooka:<br><br><input id="webhook_wrogowie" value="' + webhook + '">';
    wrogowie.innerHTML = wrogowie.innerHTML + '<br><br>Nazwy klanów po przecinku:<br><br><input id="klany_wrogowie" value="' + klany_wrogowie + '">';
    wrogowie.innerHTML = wrogowie.innerHTML + '<br><br>Nicki po przecinki:<br><br><input id="nicki_wrogowie" value="' + nicki_wrogowie + '">';
    wrogowie.innerHTML = wrogowie.innerHTML + '<br><br><center><button id="zapisz_wrogowie">Zapisz</button>'

    function saveWebhook() {
        let newWebhook = document.getElementById("webhook_wrogowie").value
        let newKlany = document.getElementById("klany_wrogowie").value
        let newNicki = document.getElementById("nicki_wrogowie").value
        localStorage.setItem('webhook_wrogowie', newWebhook)
        localStorage.setItem('klany_wrogowie', newKlany)
        localStorage.setItem('nicki_wrogowie', newNicki)
        klany_array = klany_wrogowie.split(",")
        klany_array.forEach(klan => klan.trim())
        nicki_array = nicki_wrogowie.split(",")
        nicki_array.forEach(nick => nick.trim())
    }

    document.getElementById("zapisz_wrogowie").addEventListener("click", saveWebhook)


    function sendDiscordAlert(other) {
        let color = 8388608
        const request = new XMLHttpRequest()
        request.open('POST', webhook, true)
        request.setRequestHeader('Content-Type', 'application/json')
        request.send(JSON.stringify({
            content: `${Engine.hero.nick}(${Engine.hero.d.lvl}lvl) widzi SZMATE`,
            username: 'Potężny szmaciarz',
            avatar_url: `https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Achtung.svg/220px-Achtung.svg.png`,
            embeds: [{
                color: color,
                title: `${other.d.nick} (${other.d.lvl}lvl) na mapie ${Engine.map.d.name} (${other.d.x},${other.d.y})!`,
                timestamp: new Date().toISOString()
            }]
        }))
    }


    if (Engine && Engine.others && Engine.others.check) API.addCallbackToEvent("newOther", function(other) {
        if (!other.d.clan) {} else if (klany_wrogowie.includes(other.d.clan.name) || nicki_wrogowie.includes(other.d.nick)) {
            sendDiscordAlert(other)
        }
    })
    else setTimeout(function() { run(window.Engine) }, 100)

}

run()