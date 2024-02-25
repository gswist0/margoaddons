// ==UserScript==
// @name         Dobijanie
// @version      0.5
// @author       Bancewald
// @match        *.margonem.pl/
// ==/UserScript==

//0.2 - fixed a bug when only last button on the list was interactable
//0.3 - addon no longers attacks pvp protected players
//0.4 - no longer passes through when waiting for protected enemy
//0.5 - bugfix
function run() {

    function isCloseEnough(playerX, playerY, heroX, heroY){
        let distance = Math.sqrt(Math.pow(heroX - playerX, 2) + Math.pow(heroY - playerY, 2))
        if(distance < 2)
            return true
        return false
    }

    var gonitwa = document.createElement("div")
    gonitwa.id = "gonitwa"
    gonitwa.style.cssText = "position:absolute;bottom:110px;right:10px;width:150px;height:250px;background-color:white;z-index:999;display:none;overflow-y:scroll;text-align:center";
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
        'background-image: url("https://i.imgur.com/d5XtVNv.png");' +
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

    function getGoodPosition(x, y, emotions){
        let gateways = Engine.map.gateways.getList()
        let badSpot = false
        gateways.forEach(gateway => {
            if(x == gateway.d.x && y == gateway.d.y) {
                badSpot = true
            }
        })
        let inBattleOrPvpProtected = false
        emotions.forEach(emo => {
            if (emo.name == "battle" || emo.name == "pvpprotected")
                inBattleOrPvpProtected = true
        })
        if(!badSpot || !inBattleOrPvpProtected){
            return [x,y]
        }
        let places = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(place => (Engine.map.col.check(place[0],place[1]) == 0 && Engine.map.gateways.getGtwAtPosition(place[0],place[1]) == undefined)).sort((a,b) => {
            return Math.hypot(Engine.hero.d.x - a[0], Engine.hero.d.y - a[1]) - Math.hypot(Engine.hero.d.x - b[0], Engine.hero.d.y - b[1])
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
            if (failures < 200) {
                setTimeout(() => chase(id), 100)
                return
            } else {
                message("przestaje gonic")
                state = 0
                return
            }
        }
        let goodPosition = getGoodPosition(player.d.x, player.d.y, player.onSelfEmoList)
        let playerX = goodPosition[0]
        let playerY = goodPosition[1]

        if (!Engine.battle.show && state == 1) {
            let inBattleOrPvpProtected = false
            player.onSelfEmoList.forEach(emo => {
                if (emo.name == "battle" || emo.name == "pvpprotected")
                    inBattleOrPvpProtected = true
            })
            if (!inBattleOrPvpProtected && isCloseEnough(playerX, playerY, Engine.hero.d.x, Engine.hero.d.y)){
                console.log("sending attack request")
                _g("fight&a=attack&id=" + player.d.id)
            }
            Engine.hero.autoGoTo({
                x: playerX,
                y: playerY
            })
            setTimeout(() => chase(id), 50)
        } else {
            message("dogonilem")
            failures = 0
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

    document.addEventListener('keyup', (e) => {
        if(e.which == 27){
            state = 0
        }
    }
    )

	


    function refeshOthersList() {
        gonitwa.innerHTML = ""

        Engine.others.getDrawableList().filter(other => other.isPlayer).forEach(other => {
            let button = document.createElement("button")
            let color = "grey"
	        let cancel = false
            switch(other.d.relation){
                case 2:  
		            color = "green"
		            cancel = true
                    break;
                case 4 : 
                    color = "green"
	                cancel = true
                    break;
                case 5 :  
                    color = "yellow"
                    cancel = true
                    break;
                case 3 : color = "red" 
                    break;
                case 6 : color = "orange"
                    break;
            }
	    if (!cancel){
            button.style = `border:1px solid black;background:${color};width:133px;padding:5px 0 5px 0;cursor:pointer;`
            button.innerHTML = other.d.nick + "(" + other.d.lvl + other.d.prof + ")"
            button.classList.add(other.d.id)
            gonitwa.appendChild(button)
            gonitwa.innerHTML += "<br>"
            }

        })
    }


    setInterval(refeshOthersList, 1000)


}

run()
