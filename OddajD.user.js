// ==UserScript==
// @name         Oddaj D
// @version      1.0
// @author       Bancewald
// @match        *.margonem.pl/
// @grant        none
// ==/UserScript==

((Engine) => {
    let loadtime = Date.now()

    function check_party(nick) { //zmienic na nick?
        if (!Engine.party)
            return -1
        if (Engine.party.getLeaderId() != Engine.hero.d.id)
            return -1
        for (let i = 0; i < Object.keys(Engine.party.getMembers()).length; i++) {
            let player = Object.values(Engine.party.getMembers())[i]
            if (player.nick == nick) 
                return player.id
        }
        return -1
    }

    function parsowanko(msg){
        let msg_obj = msg[1]
        let sender = msg_obj.n
        let text = msg_obj.t
        if(Math.ceil(msg_obj.ts * 1000) < loadtime || msg_obj.k != 2)
            return
        let id = check_party(sender)
        if(id != -1 && text == "oddaj d"){
            _g("party&a=give&id=" + id)
        }
    }

    window.API.addCallbackToEvent("newMsg", parsowanko)
})(window.Engine)
