// ==UserScript==
// @name         Antyduszek
// @version      1.0
// @author       Bancewald
// @match        *.margonem.pl/
// ==/UserScript==


function run(){
    setInterval(() => {
        let isAfk = false
        Engine.hero.onSelfEmoList.forEach(emo => {
            if(emo.name == "stasis") isAfk = true
        })
        if(isAfk){
            Engine.hero.autoGoTo({
                x: Engine.hero.d.x,
                y: Engine.hero.d.y + 1
            })
            return
        }
        if(isAfk){
            Engine.hero.autoGoTo({
                x: Engine.hero.d.x,
                y: Engine.hero.d.y - 1
            })
            return
        }
        if(isAfk){
            Engine.hero.autoGoTo({
                x: Engine.hero.d.x + 1,
                y: Engine.hero.d.y
            })
            return
        }
        if(isAfk){
            Engine.hero.autoGoTo({
                x: Engine.hero.d.x - 1,
                y: Engine.hero.d.y
            })
            return
        }
    },1000)
}

run()
