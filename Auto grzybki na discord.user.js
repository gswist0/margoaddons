// ==UserScript==
// @name         Auto grzybki na discord
// @version      1.0
// @match        *.margonem.pl/
// @grant        none
// @author       Bancewald
// ==/UserScript==

function run(Engine) {

    let alreadyCalled = []

    //----ADDING WIDGET credit to https://github.com/nerthus-margonem/nerthusaddon
    const defaultPosition = [3, 'bottom-right-additional']

    const addWidgetToDefaultWidgetSet = function() {
        Engine.widgetManager.addKeyToDefaultWidgetSet(
            'grzybki',
            defaultPosition[0],
            defaultPosition[1],
            'grzybki',
            'green',
            changegrzybkiState
        )
    }

    $('head').append('<style>' +
        '.main-buttons-container .widget-button .icon.grzybki {' +
        'background-image: url("https://bancewald.000webhostapp.com/scripts/grzybki.png");' +
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
        if (Engine.interfaceStart && Object.keys(Engine.widgetManager.getDefaultWidgetSet()).includes('grzybki')) {
            let grzybkiPos = defaultPosition

            const serverStoragePos = Engine.serverStorage.get(Engine.widgetManager.getPathToHotWidgetVersion())
            if (serverStoragePos && serverStoragePos.grzybki) grzybkiPos = serverStoragePos.grzybki

            Engine.widgetManager.createOneWidget('grzybki', { grzybki: grzybkiPos }, true, [])
            Engine.widgetManager.setEnableDraggingButtonsWidget(false)
        } else setTimeout(createButtonNI, 500)
    }

    //----


    var grzybki = document.createElement("div");

    const changegrzybkiState = function() {
        grzybki.style["display"] = grzybki.style["display"] == "block" ? "none" : "block";
    }

    if (localStorage.getItem('webhook_grzybki') == null) localStorage.setItem('webhook_grzybki', '');
    var webhook = localStorage.getItem('webhook_grzybki');
    if (localStorage.getItem('ping_here') == null) localStorage.setItem('ping_here', false);
    var ping_here = localStorage.getItem('ping_here') == "true" ? true : false;
    if (localStorage.getItem('ping_everyone') == null) localStorage.setItem('ping_everyone', false);
    var ping_everyone = localStorage.getItem('ping_everyone') == "true" ? true : false;
    if (localStorage.getItem('special_heros') == null) localStorage.setItem('special_heros', '');

    grzybki.id = "grzybki";
    grzybki.style.cssText = "position:absolute;top:200px;left:200px;width:200px;height:400px;background-color:white;z-index:999;display:none";
    document.querySelector(".game-window-positioner").appendChild(grzybki);

    grzybki.innerHTML = '<center>Link do webhooka:<br><br><input id="webhook_grzybki" value="' + webhook + '">';
    grzybki.innerHTML = grzybki.innerHTML + '<br><br><input type="checkbox" id="ping_here_checkbox" name="ping_here_checkbox"><label for="ping_here_checkbox">Ping Here</label>'
    grzybki.innerHTML = grzybki.innerHTML + '<br><br><input type="checkbox" id="ping_everyone_checkbox" name="ping_everyone_checkbox"><label for="ping_everyone_checkbox">Ping Everyone</label>'
    grzybki.innerHTML = grzybki.innerHTML + '<br><br><center><button id="zapisz_grzybki">Zapisz</button>'

    document.getElementById("ping_here_checkbox").checked = ping_here
    document.getElementById("ping_everyone_checkbox").checked = ping_everyone

    function saveWebhook() {
        let newWebhook = document.getElementById("webhook_grzybki").value
        let newHere = document.getElementById("ping_here_checkbox").checked
        let newEveryone = document.getElementById("ping_everyone_checkbox").checked
        localStorage.setItem('webhook_grzybki', newWebhook)
        localStorage.setItem('ping_here', newHere)
        localStorage.setItem('ping_everyone', newEveryone)
        webhook = newWebhook
        ping_here = newHere
        ping_everyone = newEveryone
    }

    document.getElementById("zapisz_grzybki").addEventListener("click", saveWebhook)


    function sendDiscordAlert(nick, lvl, map, x, y, icon, time) {
        hero_nick = Engine.hero.nick;
        hero_level = Engine.hero.d.lvl;
        let content_start = ""
        if (ping_here && !ping_everyone) content_start = "@here"
        else if (ping_everyone && !ping_here) content_start = "@everyone"
        else if (ping_everyone && ping_here) content_start = "@here @everyone"
        let color = 8388608
        const request = new XMLHttpRequest()
        request.open('POST', webhook, true)
        request.setRequestHeader('Content-Type', 'application/json')
        request.send(JSON.stringify({
            content: `${content_start} Znalazłem grzyba!`,
            username: 'Potężny wykrywacz',
            avatar_url: `https://micc.garmory-cdn.cloud/obrazki/npc/${icon}`,
            embeds: [{
                color: color,
                title: `${hero_nick} (${hero_level}lvl) znalazł grzyba ${nick} (${lvl}) na mapie ${map} (${x},${y}), pozostało ${Math.floor(time/60)} minut ${time - (Math.floor(time/60)*60)} sekund!`,
                timestamp: new Date().toISOString()
            }]
        }))
    }

    let grzybki_nazwy = ["Ogromna płomiennica tląca", "Ogromna dzwonkówka tarczowata", "Ogromny bulwiak pospolity", "Ogromny mroźlarz", "Ogromny szpicak ponury"]

    if (Engine && Engine.npcs && Engine.npcs.check) window.API.addCallbackToEvent("newNpc", function(npc) {
        if(grzybki_nazwy.includes(npc.d.nick) && !alreadyCalled.includes(npc.d.id)){
            sendDiscordAlert(npc.d.nick, npc.d.lvl, Engine.map.d.name, npc.d.x, npc.d.y, npc.d.icon, npc.d.killSeconds)
            alreadyCalled.push(npc.d.id)
            message(`Wołam na ${npc.d.nick}`)
        }
    })
    else setTimeout(function() { run(window.Engine) }, 100)
}

run(window.Engine)
