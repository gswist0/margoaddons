// ==UserScript==
// @name         AutoHeal z potek i fullheal
// @version      1.3
// @match        *.margonem.pl/
// @match        *.margonem.com/
// @grant        none
// @author       Bancewald
// ==/UserScript==

//1.1 - dodane potki ktore lecza % hp
//1.2 - naprawiono zapętlenia
//1.3 - zuzywa teraz potki pelnego leczenia po kolei

function run() {

    // const updateHeroHp = (item) => {
    //     if(item._cachedStats.hasOwnProperty("leczy")){
    //         Engine.hero.d.hp = Engine.hero.d.hp + parseInt(item._cachedStats.leczy)
    //     }
    //     else if(item._cachedStats.hasOwnProperty("fullheal")){
    //         if(item._cachedStats.fullheal >= Engine.hero.d.maxhp - Engine.hero.d.hp){
    //             Engine.hero.d.hp = Engine.hero.d.maxhp
    //         } else {
    //             Engine.hero.d.hp = Engine.hero.d.hp + parseInt(item._cachedStats.fullheal)
    //         }
    //     }
    //     else if(item._cachedStats.hasOwnProperty("perheal")){
    //         Engine.hero.d.hp = Engine.hero.d.hp + parseInt((item._cachedStats.perheal/100)*Engine.hero.d.maxhp)
    // }
    // }

    const useItem = item => {
        const {
            name,
            id
        } = item;
        //updateHeroHp(item)
        window._g(`moveitem&st=1&id=${id}`, () => {
            setTimeout(autoHeal, 100);
        });
    }

    const getMaxHealVal = items => {
        if (items.length > 0) {
            return items.reduce((first, second) => first._cachedStats.leczy >= second._cachedStats.leczy ? first : second)
        }
    }

    const getMaxHealValFH = items => {
        if (items.length > 0) {
            return items.reduce((first, second) => first._cachedStats.fullheal >= second._cachedStats.fullheal ? first : second)
        }
    }

    const getMaxHealValperheal = items => {
        if (items.length > 0) {
            return items.reduce((first, second) => first._cachedStats.perheal >= second._cachedStats.perheal ? first : second)
        }
    }

    const autoHeal = () => {
        let {
            hp,
            maxhp,
            lvl
        } = Engine.hero.d;

        if (hp == undefined) {
            hp = Engine.hero.d.warrior_stats.hp
            Engine.hero.d.hp = hp
        }
        if (maxhp == undefined){
            maxhp = Engine.hero.d.warrior_stats.maxhp
            Engine.hero.d.maxhp = maxhp
        }

        if (hp < maxhp && !Engine.dead) {
            const items = Engine.items.fetchLocationItems("g")
                .filter(item => item._cachedStats.hasOwnProperty("leczy"))
                .filter(item => item._cachedStats.leczy <= maxhp - hp)
                .filter(item => item._cachedStats.leczy > 500)
                .filter(item => !item._cachedStats.hasOwnProperty("lvl") || (item._cachedStats.hasOwnProperty("lvl") && item._cachedStats.lvl <= lvl))
                .filter(item => !item._cachedStats.hasOwnProperty("timelimit") || (item._cachedStats.hasOwnProperty("timelimit") && !item._cachedStats.timelimit.includes(",")));

            const items_fh = Engine.items.fetchLocationItems("g")
                .filter(item => item._cachedStats.hasOwnProperty("fullheal"))
                .filter(item => !item._cachedStats.hasOwnProperty("lvl") || (item._cachedStats.hasOwnProperty("lvl") && item._cachedStats.lvl <= lvl))
                .filter(item => !item._cachedStats.hasOwnProperty("timelimit") || (item._cachedStats.hasOwnProperty("timelimit") && !item._cachedStats.timelimit.includes(",")))
                .sort((a, b) => {
                    let aHeal = parseInt(a._cachedStats.fullheal)
                    let bHeal = parseInt(b._cachedStats.fullheal)
                    if(aHeal == bHeal) return 0
                    else if(aHeal < bHeal) return -1
                    else return 1
                });

            const items_percent = Engine.items.fetchLocationItems("g")
                .filter(item => item._cachedStats.hasOwnProperty("perheal"))
                .filter(item => item._cachedStats.perheal <= (maxhp - hp) * 100 / maxhp)
                .filter(item => !item._cachedStats.hasOwnProperty("lvl") || (item._cachedStats.hasOwnProperty("lvl") && item._cachedStats.lvl <= lvl))
                .filter(item => !item._cachedStats.hasOwnProperty("timelimit") || (item._cachedStats.hasOwnProperty("timelimit") && !item._cachedStats.timelimit.includes(",")));

            let item;
            if (items.length > 0) item = getMaxHealVal(items);
            else if (items_percent.length > 0) item = getMaxHealValperheal(items_percent);
            else if (items_fh.length > 0 && maxhp > hp) item = getMaxHealValFH(items_fh);

            if (item !== undefined) {
                useItem(item);
            }
        }
    }

    window.API.addCallbackToEvent("close_battle", autoHeal);
}

run()
