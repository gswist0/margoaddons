// ==UserScript==
// @name         legi na discord
// @version      1.4
// @author       Bancewald
// @match        *.margonem.pl/
// @grant        none
// ==/UserScript==

//1.1 nick postaci
//1.2 naprawiony błąd powodujący braki w działaniu
//1.3 teraz dziala tez na kolosach
//1.4 dodane okienko do ustawiania webhooka

var items_sent = []

function run(Engine) {

    //----ADDING WIDGET credit to https://github.com/nerthus-margonem/nerthusaddon
    const defaultPosition = [5, 'bottom-right-additional']

    const addWidgetToDefaultWidgetSet = function() {
        Engine.widgetManager.addKeyToDefaultWidgetSet(
            'legi',
            defaultPosition[0],
            defaultPosition[1],
            'legi',
            'green',
            changeLegiState
        )
    }

    $('head').append('<style>' +
        '.main-buttons-container .widget-button .icon.legi {' +
        'background-image: url("https://iili.io/pprdMP.png");' +
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
        if (Engine.interfaceStart && Object.keys(Engine.widgetManager.getDefaultWidgetSet()).includes('legi')) {
            let legiPos = defaultPosition

            const serverStoragePos = Engine.serverStorage.get(Engine.widgetManager.getPathToHotWidgetVersion())
            if (serverStoragePos && serverStoragePos.legi) legiPos = serverStoragePos.legi

            Engine.widgetManager.createOneWidget('legi', { legi: legiPos }, true, [])
            Engine.widgetManager.setEnableDraggingButtonsWidget(false)
        } else setTimeout(createButtonNI, 500)
    }

    //----


    var legi = document.createElement("div");

    const changeLegiState = function() {
        legi.style["display"] = legi.style["display"] == "block" ? "none" : "block";
    }

    if (localStorage.getItem('webhook_legi') == null) localStorage.setItem('webhook_legi', '');
    var webhook = localStorage.getItem('webhook_legi');


    legi.id = "legi";
    legi.style.cssText = "position:absolute;top:200px;left:200px;width:200px;height:200px;background-color:white;z-index:999;display:none";
    document.querySelector(".game-window-positioner").appendChild(legi);

    legi.innerHTML = '<center>Link do webhooka:<br><br><input id="webhook_legi" value="' + webhook + '">';
    legi.innerHTML = legi.innerHTML + '<br><br><center><button id="zapisz_legi">Zapisz</button>'

    function saveWebhook() {
        let newWebhook = document.getElementById("webhook_legi").value
        localStorage.setItem('webhook_legi', newWebhook)
    }

    document.getElementById("zapisz_legi").addEventListener("click", saveWebhook)


    function sendDiscordAlert(nazwa, ikonka) {
        var name = Engine.hero.nick;
        let color = 8388608
        const request = new XMLHttpRequest()
        request.open('POST', webhook, true)
        request.setRequestHeader('Content-Type', 'application/json')
        request.send(JSON.stringify({
            content: `Spadla lega o taka ${nazwa}!`,
            username: 'Potężny legendziarz',
            avatar_url: `https://micc.garmory-cdn.cloud/obrazki/itemy/${ikonka}`,
            embeds: [{
                color: color,
                title: `${name} lotł lege o taką ${nazwa}!`,
                timestamp: new Date().toISOString()
            }]
        }))
    }

    function newItemLooted(e) {
        if (e.itemTypeName == "legendary") {
            sendDiscordAlert(e.name, e.icon);
        }
    }

    if (Engine && Engine.items) {
        Engine.items.fetch(Engine.itemsFetchData.FETCH_NEW_LOOT_ITEM, newItemLooted)
        setInterval(() => {
            const items = Engine.items.fetchLocationItems("k")
            for (const item of items) {
                if (item.itemTypeName == "legendary" && !items_sent.includes(item.id)) {
                    items_sent.push(item.id)
                    sendDiscordAlert(item.name, item.icon)
                }
            }
        }, 100)
    } else setTimeout(function() { run(window.Engine) }, 100)


}

run(window.Engine)
