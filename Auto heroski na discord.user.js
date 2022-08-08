// ==UserScript==
// @name         Auto heroski na discord
// @version      1.3
// @match        https://virtus.margonem.pl/
// @grant        none
// @author       Bancewald
// ==/UserScript==

//1.1 dodane tytany
//1.2 message na co wola
//1.3 naprawiony błąd powodujący że czasem wołacz nie działał

function run(Engine) {

    function sendDiscordAlert(nick, lvl, map, x, y, icon, istitan) {
        hero_nick = Engine.hero.nick;
        hero_level = Engine.hero.d.lvl;
        var text = istitan ? "tytanka" : "heroska";
        var webhookUrl = '[ZASTAP TEN NAWIAS LINKIEM DO WEBHOOKA]';
        let color = 8388608 //red
        const request = new XMLHttpRequest()
        request.open('POST', webhookUrl, true)
        request.setRequestHeader('Content-Type', 'application/json')
        request.send(JSON.stringify({
            content: `@here Znalazłem ${text}!`,
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
        if (npc.d.wt > 79) {
            var tip = npc.tip[0];
            if (tip.indexOf("tytan") != -1) {
                message("Wołam na " + npc.d.nick);
                sendDiscordAlert(npc.d.nick, npc.d.lvl, Engine.map.d.name, npc.d.x, npc.d.y, npc.d.icon, true);
            }
        }
        if ((npc.d.wt > 79 && npc.d.wt <= 99) || npc.d.nick == "Tropiciel Herosów" || npc.d.nick == "Wtajemniczony Tropiciel Herosów" || npc.d.nick == "Doświadczony Tropiciel Herosów") {
            message("Wołam na " + npc.d.nick);
            sendDiscordAlert(npc.d.nick, npc.d.lvl, Engine.map.d.name, npc.d.x, npc.d.y, npc.d.icon, false);

        }
    })
    else setTimeout(function() { run(window.Engine) }, 100)
}

run(window.Engine)