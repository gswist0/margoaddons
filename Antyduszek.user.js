// ==UserScript==
// @name         Antyduszek
// @version      1.1
// @author       Bancewald
// @match        *.margonem.pl/
// ==/UserScript==

//1.1 nie probuje ruszac sie gdy aktywna jest captcha

function run(){
    setInterval(() => {
        if(Engine.captcha.wnd != undefined)
            return
        let isAfk = false
        Engine.hero.onSelfEmoList.forEach(emo => {
            if(emo.name == "stasis") isAfk = true
        })
        if(isAfk){
            Engine.hero.autoGoTo({
                x: Engine.hero.d.x,
                y: Engine.hero.d.y + 1
            })
        } else return
        Engine.hero.onSelfEmoList.forEach(emo => {
            if(emo.name == "stasis") isAfk = true
        })
        if(isAfk){
            Engine.hero.autoGoTo({
                x: Engine.hero.d.x,
                y: Engine.hero.d.y - 1
            })
        } else return
        Engine.hero.onSelfEmoList.forEach(emo => {
            if(emo.name == "stasis") isAfk = true
        })
        if(isAfk){
            Engine.hero.autoGoTo({
                x: Engine.hero.d.x + 1,
                y: Engine.hero.d.y
            })
        } else return
        Engine.hero.onSelfEmoList.forEach(emo => {
            if(emo.name == "stasis") isAfk = true
        })
        if(isAfk){
            Engine.hero.autoGoTo({
                x: Engine.hero.d.x - 1,
                y: Engine.hero.d.y
            })
        } else return
    },1000)
}

run()
