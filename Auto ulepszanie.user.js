// ==UserScript==
// @name         Auto ulepszanie
// @version      1.0
// @match        *.margonem.pl/
// @grant        none
// @author       Bancewald
// ==/UserScript==


function run(){
    if(!Engine.hero.d.id){
        setTimeout(run, 100);
        return;
    }


    //----ADDING WIDGET credit to https://github.com/nerthus-margonem/nerthusaddon
    const defaultPosition = [7, 'bottom-right']

    const addWidgetToDefaultWidgetSet = function() {
        Engine.widgetManager.addKeyToDefaultWidgetSet(
            'ulepszanie',
            defaultPosition[0],
            defaultPosition[1],
            'ulepszanie',
            'green',
            changeulepszanieState
        )
    }

    $('head').append('<style>' +
        '.main-buttons-container .widget-button .icon.ulepszanie {' +
        'background-image: url("https://bancewald.000webhostapp.com/scripts/ulepszanie.png");' +
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
        if (Engine.interfaceStart && Object.keys(Engine.widgetManager.getDefaultWidgetSet()).includes('ulepszanie')) {
            let ulepszaniePos = defaultPosition

            const serverStoragePos = Engine.serverStorage.get(Engine.widgetManager.getPathToHotWidgetVersion())
            if (serverStoragePos && serverStoragePos.ulepszanie) ulepszaniePos = serverStoragePos.ulepszanie

            Engine.widgetManager.createOneWidget('ulepszanie', { ulepszanie: ulepszaniePos }, true, [])
            Engine.widgetManager.setEnableDraggingButtonsWidget(false)
        } else setTimeout(createButtonNI, 500)
    }

    //----

    var ulepszanie = document.createElement("div");

    const changeulepszanieState = function() {
        ulepszanie.style["display"] = ulepszanie.style["display"] == "block" ? "none" : "block";
    }



    if (localStorage.getItem('item_ulepszanie_' + Engine.hero.d.id) == null) localStorage.setItem('item_ulepszanie_' + Engine.hero.d.id, '');
    var itemToUpgrade = localStorage.getItem('item_ulepszanie_' + Engine.hero.d.id);
    if (localStorage.getItem('unikaty_' + Engine.hero.d.id) == null) localStorage.setItem('unikaty_' + Engine.hero.d.id, false);
    var unikaty = localStorage.getItem('unikaty_' + Engine.hero.d.id) == "true" ? true : false;
    if (localStorage.getItem('herka_' + Engine.hero.d.id) == null) localStorage.setItem('herka_' + Engine.hero.d.id, false);
    var herka = localStorage.getItem('herka_' + Engine.hero.d.id) == "true" ? true : false;

    ulepszanie.id = "ulepszanie";
    ulepszanie.style.cssText = "position:absolute;top:200px;left:200px;width:200px;height:400px;background-color:white;z-index:999;display:none";
    document.querySelector(".game-window-positioner").appendChild(ulepszanie);


    ulepszanie.innerHTML = '<center>Nazwa itemu do ulepszania:<br><br><input id="item_ulepszanie" value="' + itemToUpgrade + '">';
    ulepszanie.innerHTML = ulepszanie.innerHTML + '<br><br><input type="checkbox" id="unikaty" name="unikaty"><label for="unikaty">Ulepszac unikatami</label>'
    ulepszanie.innerHTML = ulepszanie.innerHTML + '<br><br><input type="checkbox" id="herka" name="herka"><label for="herka">Ulepszac herkami</label>'
    ulepszanie.innerHTML = ulepszanie.innerHTML + '<br><br><center><button id="zapisz_ulepszanie">Zapisz</button>'

    document.getElementById("unikaty").checked = unikaty
    document.getElementById("herka").checked = herka

    function saveUlepszanie() {
        let newItem = document.getElementById("item_ulepszanie").value
        let newUnikaty = document.getElementById("unikaty").checked
        let newHerka = document.getElementById("herka").checked
        localStorage.setItem('item_ulepszanie_' + Engine.hero.d.id, newItem)
        localStorage.setItem('unikaty_' + Engine.hero.d.id, newUnikaty)
        localStorage.setItem('herka_' + Engine.hero.d.id, newHerka)
        itemToUpgrade = newItem
        unikaty = newUnikaty
        herka = newHerka
    }

    document.getElementById("zapisz_ulepszanie").addEventListener("click", saveUlepszanie)


    let lootCache = [];

    function startLoop(){
        setInterval(()=>{
            for (const item of Engine.items.fetchLocationItems("g")){
                if(lootCache.includes(item.id)){
                    let itemToUpgradeObject = Engine.items.fetchLocationItems("g").filter(item => item.name === itemToUpgrade && !item._cachedStats.hasOwnProperty("binds"))[0]
                    if(itemToUpgradeObject.cl > 14){
                        message("wrong item")
                        return
                    }
                    let itemToUpgradeId = itemToUpgradeObject.id;
                    _g(`enhancement&action=progress&item=${itemToUpgradeId}&ingredients=${item.id}`);
                    lootCache = lootCache.filter(id => id !== item.id);
                }
            }
        }, 100)

        if (Engine && Engine.items) {
            setInterval(() => {
                let items = Engine.items.fetchLocationItems("k")
                items = items.concat(Engine.items.fetchLocationItems("l"))
                for (const item of items) {
                    if (!lootCache.includes(item.id) && item._cachedStats.rarity !== "legendary" && !(item._cachedStats.rarity === "unique" && unikaty === false) && !(item._cachedStats.rarity === "heroic" && herka === false) && item.cl < 15) {
                        lootCache.push(item.id);
                    }
                }
            }, 100)
        } else setTimeout(run, 100);
    }

    if(Engine){
        startLoop();
    } else{
        setTimeout(run, 1000)
    }


}


run()
