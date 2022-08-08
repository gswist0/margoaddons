// ==UserScript==
// @name         legi na discord
// @version      1.3
// @author       Bancewald
// @match        *.margonem.pl/
// @grant        none
// ==/UserScript==

//1.1 nick postaci
//1.2 naprawiony błąd powodujący braki w działaniu
//1.3 teraz dziala tez na kolosach

var items_sent = []

function run(Engine) {
    function sendDiscordAlert(nazwa, ikonka) {
        var name = Engine.hero.nick;
        var webhookUrl = '[link do webhooka]';
        let color = 8388608 //red
        const request = new XMLHttpRequest()
        request.open('POST', webhookUrl, true)
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