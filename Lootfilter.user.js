// ==UserScript==
// @name         Lootfilter
// @version      1.0
// @author       Bancewald
// @match        *.margonem.pl/
// @grant        none
// ==/UserScript==

function run(){
    if(!Engine){
        setTimeout(run, 100);
        return;
    }

    function newItemLooted(item){
        if(!Engine.loots){
            return;
        }
        var itemId = item.id
        var logicResult = USERLOGIC(item)
        if(logicResult == 'want'){
            Engine.loots.itemsDecision[itemId] = Engine.party ? "must" : "want"
        }
        else if(logicResult == 'not'){
            Engine.loots.itemsDecision[itemId] = "not"
        }
        else{
            Engine.loots.itemsDecision[itemId] = Engine.party ? "must" : "want"
        }
        Engine.loots.setLootItems()
    }

    Engine.items.fetch(Engine.itemsFetchData.FETCH_NEW_LOOT, newItemLooted)

}

run()


function USERLOGIC(item){
    if(item._cachedStats.hasOwnProperty("teleport") || item._cachedStats.hasOwnProperty("runes") || item._cachedStats.hasOwnProperty("fullheal") || item._cachedStats.hasOwnProperty("canpreview") || item.name == "Serce pajęczego ołtarza" || item.name == "Pazur młodego smoka") return 'want'
    else if(item.cl===16 || item.cl===21 || item.cl===22 || item.cl===15 || (item.cl == 26 && (item._cachedStats.target_rarity == "common" || item._cachedStats.target_rarity == "unique"))) return 'not'
    else return null
}
