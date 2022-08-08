// ==UserScript==
// @name         Wykrywacz sakiewek
// @version      1.1
// @match        *.margonem.pl/
// @grant        none
// @author       Bancewald
// ==/UserScript==

//1.1 small bugfix

function run(Engine) {

    var names = [
        "Czarna torba alchemika",
        "Brązowa torba alchemika",
        "Pomarańczowa torba alchemika",
        "Zielona torba alchemika",
        "Turkusowa torba alchemika",
        "Niebieska torba alchemika"
    ]


    if (Engine && Engine.npcs && Engine.npcs.check) window.API.addCallbackToEvent("newNpc", function(npc) {
        if (names.includes(npc.d.nick)) {
            message(npc.d.nick + " (" + npc.d.x + "," + npc.d.y + ")")
        }
    })
    else setTimeout(function() { run(window.Engine) }, 100)
}

run(window.Engine)