// ==UserScript==
// @name         Dobijanie
// @version      0.4
// @author       Bancewald
// @match        *.margonem.pl/
// ==/UserScript==

//0.2 - fixed a bug when only last button on the list was interactable
//0.3 - addon no longers attacks pvp protected players
//0.4 - no longer passes through when waiting for protected enemy

function run() {

    var gonitwa = document.createElement("div")
    gonitwa.id = "gonitwa"
    gonitwa.style.cssText = "position:absolute;top:500px;left:50px;width:300px;height:500px;background-color:white;z-index:999;display:none;overflow-y:scroll;text-align:center";
    document.querySelector(".game-window-positioner").appendChild(gonitwa);

    const changeGonitwaState = function() {
        gonitwa.style["display"] = gonitwa.style["display"] == "block" ? "none" : "block";
    }


    //----ADDING WIDGET credit to https://github.com/nerthus-margonem/nerthusaddon
    const defaultPosition = [4, 'bottom-right-additional']

    const addWidgetToDefaultWidgetSet = function() {
        Engine.widgetManager.addKeyToDefaultWidgetSet(
            'gonitwa',
            defaultPosition[0],
            defaultPosition[1],
            'gonitwa',
            'green',
            changeGonitwaState
        )
    }

    $('head').append('<style>' +
        '.main-buttons-container .widget-button .icon.gonitwa {' +
        'background-image: url("https://bancewald.000webhostapp.com/scripts/dobijanie.png");' +
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
        if (Engine.interfaceStart && Object.keys(Engine.widgetManager.getDefaultWidgetSet()).includes('gonitwa')) {
            let gonitwaPos = defaultPosition

            const serverStoragePos = Engine.serverStorage.get(Engine.widgetManager.getPathToHotWidgetVersion())
            if (serverStoragePos && serverStoragePos.gonitwa) gonitwaPos = serverStoragePos.gonitwa

            Engine.widgetManager.createOneWidget('gonitwa', { gonitwa: gonitwaPos }, true, [])
            Engine.widgetManager.setEnableDraggingButtonsWidget(false)
        } else setTimeout(createButtonNI, 500)
    }

    //----

    function getGoodPosition(x, y){
        let gateways = Engine.map.gateways.getList()
        let badSpot = false
        gateways.forEach(gateway => {
            if(x == gateway.d.x && y == gateway.d.y) {
                badSpot = true
            }
        })
        if(!badSpot){
            return [x,y]
        }
        let places = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(place => Engine.map.col.check(place[0],place[1]) == 0).sort((a,b) => {
            return Math.hypot(Engine.hero.d.x - b[0], Engine.hero.d.y - b[1]) - Math.hypot(Engine.hero.d.x - a[0], Engine.hero.d.y - a[1])
        })
        return places[0]

    }

    let state = 0
    let failures = 0

    function chase(id) {
        if (!Engine.others)
            setTimeout(() => chase(id), 100)
        let player = Engine.others.getById(id)
        if (player == undefined) {
            failures += 1
            if (failures < 100) {
                setTimeout(() => chase(id), 100)
                return
            } else {
                message("przestaje gonic")
                state = 0
                return
            }
        }
        let goodPosition = getGoodPosition(player.d.x, player.d.y)
        let playerX = goodPosition[0]
        let playerY = goodPosition[1]

        if (!Engine.battle.show && state == 1) {
            Engine.hero.autoGoTo({
                x: playerX,
                y: playerY
            })
            let inBattleOrPvpProtected = false
            player.onSelfEmoList.forEach(emo => {
                if (emo.name == "battle" || emo.name == "pvpprotected")
                    inBattleOrPvpProtected = true
            })
            if (!inBattleOrPvpProtected)
                _g("fight&a=attack&id=" + player.d.id)
            setTimeout(() => chase(id), 50)
        } else {
            message("dogonilem")
            state = 0
        }
    }

    gonitwa.addEventListener("click", (e) => {
        console.log(e.target.classList)
        if (e.target.tagName != "BUTTON") return
        let id = e.target.classList[0]
        if (state == 0) {
            message("gonię " + e.target.innerHTML)
            state = 1
            chase(id)
        } else {
            state = 0
            message("przestaje gonic")
        }
    })


    function refeshOthersList() {
        gonitwa.innerHTML = ""

        Engine.others.getDrawableList().filter(other => other.isPlayer).forEach(other => {
            let button = document.createElement("button")
            button.innerHTML = other.d.nick
            button.classList.add(other.d.id)
                /*button.addEventListener("click", () => {
                    if(state == 0){
                        message("gonię " + other.d.nick)
                        state = 1
                        chase(other.d.id)
                    }else{
                        state = 0
                        message("przestaje gonic")
                    }
                })*/
            gonitwa.appendChild(button)
            gonitwa.innerHTML += "<br>"

        })
    }


    setInterval(refeshOthersList, 1000)


}

run()
