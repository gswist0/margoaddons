// ==UserScript==
// @name         Auto barter
// @version      1.0
// @author       Bancewald
// @match        *.margonem.pl
// @match        *.margonem.com
// ==/UserScript==





function run() {


    //----ADDING WIDGET credit to https://github.com/nerthus-margonem/nerthusaddon
    const defaultPosition = [3, 'bottom-right-additional']

    const addWidgetToDefaultWidgetSet = function() {
        Engine.widgetManager.addKeyToDefaultWidgetSet(
            'ofudka',
            defaultPosition[0],
            defaultPosition[1],
            'ofudka',
            'green',
            useAllOffers
        )
    }

    $('head').append('<style>' +
        '.main-buttons-container .widget-button .icon.ofudka {' +
        'background-image: url("https://iili.io/pprFKF.png");' +
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
        if (Engine.interfaceStart && Object.keys(Engine.widgetManager.getDefaultWidgetSet()).includes('ofudka')) {
            let ofudkaPos = defaultPosition

            const serverStoragePos = Engine.serverStorage.get(Engine.widgetManager.getPathToHotWidgetVersion())
            if (serverStoragePos && serverStoragePos.ofudka) ofudkaPos = serverStoragePos.ofudka

            Engine.widgetManager.createOneWidget('ofudka', { ofudka: ofudkaPos }, true, [])
            Engine.widgetManager.setEnableDraggingButtonsWidget(false)
        } else setTimeout(createButtonNI, 500)
    }

    //----


 

    function useAllOffers() {
        
        let allOffers = []
        Engine.barter.allParseOffers.forEach(offer => {
            if(offer.required != undefined){
                let userItems = Engine.items.fetchLocationItems("g")
                let required = offer.required[0][0]
                let recieved = offer.recived[0][0]
                let id = offer.id
                userItems.forEach(item => {
                    if (item.tpl == required){
                        let singleOffer = []
                        singleOffer.push(id)
                        singleOffer.push(item.id)
                        singleOffer.push(recieved)
                        allOffers.push(singleOffer)

                    }
                })
            }
        })


        allOffers.forEach(offer => {
            _g("barter&id=" + Engine.barter.barterId + "&offerId=" + offer[0] + "&selectedItems=" + offer[1] + "&action=use&usesCount=1&available=0&desiredItem=" + offer[2])
        })
    }

}

run()
