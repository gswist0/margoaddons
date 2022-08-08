// ==UserScript==
// @name         Auto heroski na discord
// @version      1.4
// @match        https://virtus.margonem.pl/
// @grant        none
// @author       Bancewald
// ==/UserScript==

//1.1 dodane tytany
//1.2 message na co wola
//1.3 naprawiony błąd powodujący że czasem wołacz nie działał
//1.4 dodane opcje wyboru webhooka i pingów

function run(Engine) {

    let alreadyCalled

    //----ADDING WIDGET credit to https://github.com/nerthus-margonem/nerthusaddon
    const defaultPosition = [6, 'bottom-right-additional']

    const addWidgetToDefaultWidgetSet = function() {
        Engine.widgetManager.addKeyToDefaultWidgetSet(
            'heroski',
            defaultPosition[0],
            defaultPosition[1],
            'heroski',
            'green',
            changeheroskiState
        )
    }

    $('head').append('<style>' +
        '.main-buttons-container .widget-button .icon.heroski {' +
        'background-image: url("https://bancewald.000webhostapp.com/scripts/heroski.png");' +
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
        if (Engine.interfaceStart && Object.keys(Engine.widgetManager.getDefaultWidgetSet()).includes('heroski')) {
            let heroskiPos = defaultPosition

            const serverStoragePos = Engine.serverStorage.get(Engine.widgetManager.getPathToHotWidgetVersion())
            if (serverStoragePos && serverStoragePos.heroski) heroskiPos = serverStoragePos.heroski

            Engine.widgetManager.createOneWidget('heroski', { heroski: heroskiPos }, true, [])
            Engine.widgetManager.setEnableDraggingButtonsWidget(false)
        } else setTimeout(createButtonNI, 500)
    }

    //----


    var heroski = document.createElement("div");

    const changeheroskiState = function() {
        heroski.style["display"] = heroski.style["display"] == "block" ? "none" : "block";
    }

    if (localStorage.getItem('webhook_heroski') == null) localStorage.setItem('webhook_heroski', '');
    var webhook = localStorage.getItem('webhook_heroski');
    if (localStorage.getItem('ping_here') == null) localStorage.setItem('ping_here', false);
    var ping_here = localStorage.getItem('ping_here');
    if (localStorage.getItem('ping_everyone') == null) localStorage.setItem('ping_everyone', false);
    var ping_everyone = localStorage.getItem('ping_everyone');
    if (localStorage.getItem('special_heros') == null) localStorage.setItem('special_heros', '');
    var special_heros = localStorage.getItem('special_heros');
    if (localStorage.getItem('special_tytan') == null) localStorage.setItem('special_tytan', '');
    var special_tytan = localStorage.getItem('special_tytan');


    heroski.id = "heroski";
    heroski.style.cssText = "position:absolute;top:200px;left:200px;width:200px;height:200px;background-color:white;z-index:999;display:none";
    document.querySelector(".game-window-positioner").appendChild(heroski);

    heroski.innerHTML = '<center>Link do webhooka:<br><br><input id="webhook_heroski" value="' + webhook + '">';
    heroski.innerHTML = heroski.innerHTML + '<br><br><input type="checkbox" id="ping_here_checkbox" name="ping_here_checkbox"><label for="ping_here_checkbox">Ping Here</label>'
    heroski.innerHTML = heroski.innerHTML + '<br><br><input type="checkbox" id="ping_everyone_checkbox" name="ping_everyone_checkbox"><label for="ping_everyone_checkbox">Ping Everyone</label>'
    heroski.innerHTML = heroski.innerHTML + '<br><br>Specjalny ping dla herosów<input id="special_heros_input" value="' + special_heros + '">'
    heroski.innerHTML = heroski.innerHTML + '<br><br>Specjalny ping dla tytanów<input id="special_tytan_input" value="' + special_tytan + '">'
    heroski.innerHTML = heroski.innerHTML + '<br><br><center><button id="zapisz_heroski">Zapisz</button>'

    function saveWebhook() {
        let newWebhook = document.getElementById("webhook_heroski").value
        let newHere = document.getElementById("ping_here_checkbox").checked
        let newEveryone = document.getElementById("ping_everyone_checkbox").checked
        let newSpecialHeros = document.getElementById("special_heros_input").value
        let newSpecialTytan = document.getElementById("special_tytan_input").value
        localStorage.setItem('webhook_heroski', newWebhook)
        localStorage.setItem('ping_here', newHere)
        localStorage.setItem('ping_everyone', newEveryone)
        localStorage.setItem('special_heros', newSpecialHeros)
        localStorage.setItem('special_tytan', newSpecialTytan)
    }

    document.getElementById("zapisz_heroski").addEventListener("click", saveWebhook)


    function sendDiscordAlert(nick, lvl, map, x, y, icon, istitan) {
        hero_nick = Engine.hero.nick;
        hero_level = Engine.hero.d.lvl;
        let text = istitan ? "tytanka" : "heroska";
        let content_start = ""
        if (special_heros != '' && !istitan) content_start = special_heros
        else if (special_tytan != '' && istitan) content_start = special_tytan
        else if (ping_here && !ping_everyone) content_start = "@here"
        else if (ping_everyone && !ping_here) content_start = "@everyone"
        else if (ping_everyone && ping_here) content_start = "@here @everyone"
        let color = 8388608
        const request = new XMLHttpRequest()
        request.open('POST', webhook, true)
        request.setRequestHeader('Content-Type', 'application/json')
        request.send(JSON.stringify({
            content: `${content_start} Znalazłem ${text}!`,
            username: 'Potężny wykrywacz',
            avatar_url: `https://micc.garmory-cdn.cloud/obrazki/npc/${icon}`,
            embeds: [{
                color: color,
                title: `${hero_nick} (${hero_level}lvl) znalazł ${text} ${nick} (${lvl}) na mapie ${map} (${x},${y})!`,
                timestamp: new Date().toISOString()
            }]
        }))
    }

    if (Engine && Engine.npcs && Engine.npcs.check) window.API.addCallbackToEvent("newNpc", function(npc) {
        if (npc.d.wt > 79 && !alreadyCalled.includes(npc.d.nick)) {
            var tip = npc.tip[0];
            if (tip.indexOf("tytan") != -1) {
                message("Wołam na " + npc.d.nick);
                sendDiscordAlert(npc.d.nick, npc.d.lvl, Engine.map.d.name, npc.d.x, npc.d.y, npc.d.icon, true);
                alreadyCalled.push(npc.d.nick)
            }
        }
        if (((npc.d.wt > 79 && npc.d.wt <= 99) || npc.d.nick == "Tropiciel Herosów" || npc.d.nick == "Wtajemniczony Tropiciel Herosów" || npc.d.nick == "Doświadczony Tropiciel Herosów") && !alreadyCalled.includes(npc.d.nick)) {
            message("Wołam na " + npc.d.nick);
            sendDiscordAlert(npc.d.nick, npc.d.lvl, Engine.map.d.name, npc.d.x, npc.d.y, npc.d.icon, false);
            alreadyCalled.push(npc.d.nick)
        }
    })
    else setTimeout(function() { run(window.Engine) }, 100)
}

run(window.Engine)