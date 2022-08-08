// ==UserScript==
// @name         AutoHeal z potek i fullheal
// @version      1.1
// @match        *.margonem.pl/
// @grant        none
// @author       Bancewald
// ==/UserScript==

//1.1 - dodane potki ktore lecza % hp

(Engine => {
    const useItem = item => {
        const {
            name,
            id
        } = item;

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
        const {
            hp,
            maxhp,
            lvl
        } = Engine.hero.d;

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
                .filter(item => !item._cachedStats.hasOwnProperty("timelimit") || (item._cachedStats.hasOwnProperty("timelimit") && !item._cachedStats.timelimit.includes(",")));

            const items_percent = Engine.items.fetchLocationItems("g")
                .filter(item => item._cachedStats.hasOwnProperty("perheal"))
                .filter(item => item._cachedStats.perheal <= (maxhp - hp) * 100 / maxhp)
                .filter(item => !item._cachedStats.hasOwnProperty("lvl") || (item._cachedStats.hasOwnProperty("lvl") && item._cachedStats.lvl <= lvl))
                .filter(item => !item._cachedStats.hasOwnProperty("timelimit") || (item._cachedStats.hasOwnProperty("timelimit") && !item._cachedStats.timelimit.includes(",")));

            var item;
            if (items_fh.length > 0) item = getMaxHealValFH(items_fh);
            else if (items_percent.length > 0) item = getMaxHealValperheal(items_percent);
            else item = getMaxHealVal(items);

            if (item !== undefined) {
                useItem(item);
            }
        }
    }

    window.API.addCallbackToEvent("close_battle", autoHeal);
})(window.Engine)