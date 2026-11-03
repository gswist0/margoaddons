// ==UserScript==
// @name         Grafiki kcsów
// @version      1.6
// @description  Zamienia grafikę kamieni czerwonego smoka ustawionych na mapę z e2 lub przedsionek tytana/kolosa na grafikę tego potwora
// @match        https://*.margonem.pl/
// @author       Bancewald
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const ICON_SIZE = 32;
    const LABEL_OUTLINE = 2;
    // połowa obwódki wychodzi poza litery, a pomiar liter ma do pół piksela błędu
    const LABEL_MARGIN = LABEL_OUTLINE / 2 + 0.5;
    const LABEL_WIDTH = ICON_SIZE - 2 * LABEL_MARGIN;
    const LABEL_FONT = 'bold 100px Arial';

    // mapa -> potwór
    // label: tekst na kamieniu; zawsze wypełnia szerokość ikony, więc im krótszy, tym większe litery
    // file: grafika względem /obrazki/npc/
    // e2: https://forum.margonem.pl/?task=forum&show=posts&id=514805
    // gdy na jednej mapie jest kilka e2, używana jest pierwsza z nich
    const BOSSES_BY_MAP = {
        "Grota Dzikiego Kota": { label: "MUSHI", file: "e2/st-puma.gif" }, // Mushita
        "Las Tropicieli": { label: "KOT", file: "e1/kotolak_lowca.gif" }, // Kotołak Tropiciel
        "Przeklęta Strażnica - podziemia p.2 s.1": { label: "SHAE", file: "e2/demonszef.gif" }, // Shae Phu
        "Przeklęta Strażnica - podziemia p.2 s.3": { label: "SHAE", file: "e2/demonszef.gif" }, // Shae Phu
        "Schowek na łupy": { label: "ZORG", file: "e2/zbir-e2-zorg.gif" }, // Zorg Jednooki Baron
        "Podmokła Dolina": { label: "WRZEK", file: "e2/gobmag2.gif" }, // Władca rzek
        "Jaskinia Pogardy": { label: "GOBBO", file: "e2/gobsamurai.gif" }, // Gobbos
        "Pieczara Kwiku - sala 2": { label: "DZIK", file: "e2/dzik.gif" }, // Tyrtajos
        "Stary Kupiecki Trakt": { label: "ALIAS", file: "e2/zbir-szczet.gif" }, // Szczęt alias Gładki
        "Skalne Turnie": { label: "TOL47", file: "e2/tollok_shimger.gif" }, // Tollok Shimger
        "Stare Wyrobisko p.3": { label: "RAZUG", file: "e2/razuglag.gif" }, // Razuglag Oklash
        "Mokra Grota p.2": { label: "AGAR", file: "e2/glut_agar.gif" }, // Agar
        "Lazurytowa Grota p.4": { label: "KOBOLD", file: "e2/kobold07.gif" }, // Foverk Turrim
        "Kopalnia Kapiącego Miodu p.2 - sala Owadziej Matki": { label: "OWAD", file: "e2/zadlak-e2-owadzia-matka.gif" }, // Owadzia Matka
        "Namiot Vari Krugera": { label: "VARI", file: "e2/gnoll11.gif" }, // Vari Kruger
        "Jaskinia Gnollich Szamanów - Komnata Kozuga": { label: "FURRUK", file: "e2/gnoll12.gif" }, // Furruk Kozug
        "Kamienna Jaskinia - sala 3": { label: "JOTUN", file: "e2/kam_olbrzym-b.gif" }, // Jotun
        "Głębokie Skałki p.3": { label: "TOLP3", file: "e2/tollok_jask_atamatu.gif" }, // Tollok Atamatu
        "Głębokie Skałki p.4": { label: "TOLP4", file: "e2/tollok_jask_utumatu.gif" }, // Tollok Utumutu
        "Krypty Dusz Śniegu p.3 - komnata Lisza": { label: "LISZ", file: "e2/lisz_demilisze.gif" }, // Lisz
        "Erem Czarnego Słońca p.5": { label: "GRAB", file: "e2/nieu_mnich_grabarz.gif" }, // Grabarz świątynny
        "Świątynia Andarum - zbrojownia": { label: "ZBROJEK", file: "e2/magaz_zbrojmistrz.gif" }, // Podły zbrojmistrz
        "Firnowa Grota p.2 s.1": { label: "STOPA", file: "e2/wlochacze_wielka_stopa.gif" }, // Wielka Stopa
        "Wylęgarnia Choukkerów p.1": { label: "CHOKP1", file: "e2/dlawiciel5.gif" }, // Choukker
        "Wylęgarnia Choukkerów p.3": { label: "CHOKP3", file: "e2/dlawiciel5.gif" }, // Choukker
        "Kopalnia Margorii": { label: "KRASNO", file: "e2/nadzorczyni_krasnoludow.gif" }, // Nadzorczyni krasnoludów
        "Margoria - Sala Królewska": { label: "MORTH", file: "e2/krasnolud_boss.gif" }, // Morthen
        "Grota Samotnych Dusz p.6": { label: "OHYD", file: "e2/ugrape2.gif" }, // Żelazoręki Ohydziarz
        "Zapomniany Święty Gaj p.3": { label: "WIDMO", file: "e2/lesne_widmo.gif" }, // Leśne Widmo
        "Kamienna Strażnica - Sanktuarium": { label: "GOPLA", file: "e2/goplana.gif" }, // Goplana
        "Zagrzybiałe Ścieżki p.3": { label: "GNOM", file: "e2/gnom_figlid.gif" }, // Gnom Figlid
        "Dolina Centaurów": { label: "ZYFRYD", file: "e2/cent-zyfryd.gif" }, // Centaur Zyfryd
        "Namiot Kambiona": { label: "KAMBI", file: "e2/kambion.gif" }, // Kambion
        "Podziemia Zniszczonej Wieży p.5": { label: "JERT", file: "e2/moloch-jertek.gif" }, // Jertek Moxos
        "Zabłocona Jama p.2 - Sala Duszącej Stęchlizny": { label: "MŁOW", file: "e2/blotniaki_milosnik_lowcow.gif" }, // Miłośnik łowców
        "Zabłocona Jama p.2 - Sala Błotnistych Odmętów": { label: "MRYC", file: "e2/blotniaki_milosnik_rycerzy.gif" }, // Miłośnik rycerzy
        "Zabłocona Jama p.2 - Sala Magicznego Błota": { label: "MMAG", file: "e2/blotniaki_milosnik_magii.gif" }, // Miłośnik magii
        "Skalne Cmentarzysko p.4": { label: "ŁC", file: "e2/alghul-czaszka-1a.gif" }, // Łowca Czaszek
        "Piramida Pustynnego Władcy p.3": { label: "OZIR", file: "e2/mumia-ozirus.gif" }, // Ozirus Władca Hieroglifów
        "Jama Morskiej Macki p.1 - sala 3": { label: "MORSKI", file: "e2/osmiornica-1b.gif" }, // Morski potwór
        "Wyspa Rem": { label: "KRABW", file: "e2/krab_big3.gif" }, // Krab pustelnik
        "Opuszczony statek - pokład pod rufą": { label: "KRABS", file: "e2/krab_big3.gif" }, // Krab pustelnik
        "Twierdza Rogogłowych - Sala Byka": { label: "BYK", file: "e2/ingotia_minotaur-7a.gif" }, // Borgoros Garamir III
        "Piaskowa Pułapka - Grota Piaskowej Śmierci": { label: "STWOR", file: "e2/stworzyciel.gif" }, // Stworzyciel
        "Wulkan Politraki p.1 - sala 3": { label: "IFRYT", file: "e2/magradit_ifryt.gif" }, // Ifryt
        "Ukryta Grota Morskich Diabłów - skarbiec": { label: "HENRY", file: "e1/pirat5b.gif" }, // Henry Kaprawe Oko
        "Ukryta Grota Morskich Diabłów - siedziba": { label: "HELGA", file: "e2/pirat-2b.gif" }, // Helga Opiekunka Rumu
        "Ukryta Grota Morskich Diabłów - Magazyn": { label: "JACK", file: "e2/pirat01.gif" }, // Młody Jack Truciciel
        "Piaszczysta Grota p.1 - sala 2": { label: "EOL", file: "e2/piaskowy_potwor-6a.gif" }, // Eol
        "Kopalnia Żółtego Kruszcu p.2 - sala 2": { label: "GRUBB", file: "e2/grubber-ochlaj.gif" }, // Grubber Ochlaj
        "Kuźnia Worundriela - Komnata Żaru": { label: "KOWAL", file: "e2/worundriel02.gif" }, // Mistrz Worundriel
        "Chata wójta Fistuły p.1": { label: "WÓJT", file: "e2/goral-e2-wojt-fistula.gif" }, // Wójt Fistuła
        "Chata Teściowej": { label: "TEŚĆ", file: "e2/goral-e2-tesciowa-rumcajsa.gif" }, // Teściowa Rumcajsa
        "Cenotaf Berserkerów p.1 - sala 2": { label: "AMUNO", file: "e2/amuno.gif" }, // Berserker Amuno
        "Mała Twierdza - sala główna": { label: "FODUG", file: "e2/fodug_zolash.gif" }, // Fodug Zolash
        "Lokum Złych Goblinów - warsztat": { label: "GOONS", file: "e2/goons_asterus-1a.gif" }, // Goons Asterus
        "Laboratorium Adariel": { label: "ADA", file: "e2/tri_adariel.gif" }, // Adariel
        "Grota Orczych Szamanów p.3 s.1": { label: "SHEBA", file: "e2/r_orc_sheba.gif" }, // Sheba Orcza Szamanka
        "Grota Orczej Hordy p.2 s.3": { label: "BUREK", file: "e2/orkczd.gif" }, // Burkog Lorulk
        "Nawiedzone Kazamaty p.4": { label: "DWK", file: "e2/duch_wladcy_kl.gif" }, // Duch Władcy Klanów
        "Sala Rady Orków": { label: "SK", file: "e2/praork_low_elita.gif" }, // Bragarth Myśliwy Dusz, też: Fursharag Pożeracz Umysłów, Ziuggrael Strażnik Królowej
        "Kryształowa Grota - Sala Smutku": { label: "KRÓLO", file: "e2/krolowa-sniegu.gif" }, // Królowa Śniegu
        "Sala Królewska": { label: "SK", file: "e2/prakrolowa.gif" }, // Lusgrathera Królowa Pramatka
        "Drzewo Dusz p.2": { label: "DUSZP2", file: "e2/wrzosera-1b.gif" }, // Wrzosera, też: Chryzoprenia, Cantedewia
        "Ogrza Kawerna p.4": { label: "OGR", file: "e2/ogr_stalowy_pazur-1a.gif" }, // Ogr Stalowy Pazur
        "Krypty Bezsennych p.3": { label: "TORU", file: "e2/thuz-patr1.gif" }, // Torunia Ankelwald
        "Skarpa Trzech Słów": { label: "KWIAT", file: "e2/zmutowana-roslinka.gif" }, // Pięknotka Mięsożerna
        "Przysiółek Valmirów": { label: "BREHT", file: "e2/draki-breheret-1b.gif" }, // Breheret Żelazny Łeb
        "Starodrzew Przedwiecznych p.2": { label: "CERAS", file: "e2/cerasus-1a.gif" }, // Cerasus
        "Szlamowe Kanały p.2 - sala 3": { label: "SZCZUR", file: "e2/mysiur_myswiorowy_krol-1a.gif" }, // Mysiur Myświórowy Król
        "Przerażające Sypialnie": { label: "SADOL", file: "e2/sekta-sadolia.gif" }, // Sadolia Nadzorczyni Hurys
        "Sale Rozdzierania": { label: "BERGA", file: "e2/sekta-bergermona.gif" }, // Bergermona Krwawa Hrabina
        "Sala Skaryfikacji Grzeszników": { label: "SATAN", file: "e2/sekta-sataniel.gif" }, // Sataniel Skrytobójca
        "Tajemnicza Siedziba": { label: "TS", file: "e2/sekta-annaniel.gif" }, // Annaniel Wysysacz Marzeń, też: Gothardus Kolekcjoner Głów
        "Sala Tysiąca Świec": { label: "ZUF", file: "e2/sekta-zufulus.gif" }, // Zufulus Smakosz Serc
        "Zalana Grota": { label: "CZEMP", file: "e2/forbol03.gif" }, // Czempion Furboli
        "Arachnitopia p.6": { label: "PAJĄK", file: "e2/regina-e2.gif" }, // Arachniregina Colosseus
        "Erem Aldiphrina": { label: "AL'DI", file: "e2/drow-aldiphrin-wladca.gif" }, // Al'diphrin Ilythirahel
        "Ołtarz Pajęczej Bogini": { label: "MM", file: "e2/drider-marlloth.gif" }, // Marlloth Malignitas
        "Gnijące Topielisko": { label: "ARYTO", file: "e2/arytodam_olbrzymi-1b.gif" }, // Arytodam olbrzymi
        "Jaszczurze Korytarze p.2 - sala 5": { label: "MADDO", file: "e2/mocny_maddoks-1a.gif" }, // Mocny Maddoks
        "Gardziel Podgnitych Mchów p.3": { label: "FANGAJ", file: "e2/grzyb-humanoid-1b.gif" }, // Fangaj
        "Nocna Pustelnia p.2": { label: "LUNA", file: "e2/elgary_luna-1b.gif" }, // Luna, też: Noumenia
        "Źródło Zakorzenionego Ludu": { label: "DENDRO", file: "e2/dendroculus.gif" }, // Dendroculus
        "Krzaczasta Grota - sala główna": { label: "SILVA", file: "e2/silvanasus.gif" }, // Silvanasus
        "Złota Góra p.3 - sala 2": { label: "BOLITA", file: "e2/bolita.gif" }, // Tolypeutes
        "Chantli Cuaitla Citlalina": { label: "CUAIT", file: "e2/maho-cuaitl.gif" }, // Cuaitl Citlalin
        "Zachodni Mictlan p.9": { label: "YAOTL", file: "e2/mahoplowca.gif" }, // Yaotl
        "Wschodni Mictlan p.9": { label: "P9", file: "e2/quetzalcoatl-1a.gif" }, // Quetzalcoatl
        "Siedlisko Przyjemnej Woni - źródło": { label: "WABI", file: "e2/trist2_wabicielka-1a.gif" }, // Wabicielka
        "Potępione Zamczysko - pracownia": { label: "SYBA", file: "e2/tri2_witch_e2.gif" }, // Pogardliwa Sybilla
        "Krater Uwięzienia": { label: "TELLAR", file: "e2/wyslannik_tellarow-1a.gif" }, // Wysłannik Tellarów
        "Szepczące Wyrwy p.3": { label: "FOVOS", file: "e2/fovos-1.gif" }, // Fovos
        "Pustynne Katakumby - Komnata Gwałtownej Śmierci": { label: "CHOP", file: "e2/chopesh2.gif" }, // Chopesz
        "Pustynne Katakumby - Grobowiec Seta": { label: "SET", file: "e2/neferkar_set-1a.gif" }, // Neferkar Set
        "Świątynia Hebrehotha - sala czciciela": { label: "CHAEGD", file: "e2/bar_smokoszef.gif" }, // Chaegd Agnrakh
        "Świątynia Hebrehotha - sala ofiary": { label: "VAENRA", file: "e2/bar_smoczyca.gif" }, // Vaenra Charkhaam
        "Urwisko Vapora": { label: "TERRO", file: "e2/terrorzaur_pus.gif" }, // Terrozaur
        "Źródło Narumi": { label: "MAZUR", file: "e2/mazurnik_przybrzezny-1a.gif" }, // Mazurnik Przybrzeżny
        "Drzewo życia p.3": { label: "NYMPH", file: "e2/nymphemonia.gif" }, // Nymphemonia
        "Sala Mroźnych Szeptów": { label: "ZORIN", file: "e2/wl-mrozu01.gif" }, // Zorin
        "Sala Mroźnych Strzał": { label: "FURION", file: "e2/wl-mrozu02.gif" }, // Furion
        "Sala Lodowej Magii": { label: "ART", file: "e2/wl-mrozu03.gif" }, // Artenius

        // tytani i kolosowie: na ich mapy nie da się ustawić kamienia, więc liczy się przedsionek, czyli mapa tuż przed nimi
        // https://forum.margonem.pl/?task=forum&show=posts&id=514733
        "Mroczna Pieczara p.0": { label: "ORLA", file: "tyt/dziewicza_orlica.gif" }, // Dziewicza Orlica
        "Grota Caerbannoga": { label: "KRÓLIK", file: "tyt/zabojczy_krolik.gif" }, // Zabójczy Królik
        "Bandyckie Chowisko": { label: "RENE", file: "tyt/renegat_baulus.gif" }, // Renegat Baulus
        "Wulkan Politraki - przedsionek": { label: "ARCY", file: "tyt/archdemon.gif" }, // Piekielny Arcymag
        "Lokum Złych Goblinów - pracownia": { label: "ZOONS", file: "tyt/versus-zoons.gif" }, // Versus Zoons
        "Lokum Złych Goblinów p.4": { label: "ZOONS", file: "tyt/versus-zoons.gif" }, // Versus Zoons: forum nie rozstrzyga, która z tych dwóch map to przedsionek
        "Jaskinia Ulotnych Wspomnień": { label: "ŁOWKA", file: "tyt/lowcz-wspo-driady.gif" }, // Łowczyni Wspomnień
        "Więzienie Demonów": { label: "PRZYZ", file: "tyt/przyz_demon_sekta.gif" }, // Przyzywacz Demonów
        "Nora Jaszczurzych Koszmarów p.1 - sala 2": { label: "MAGUA", file: "tyt/maddok_magua-1a.gif" }, // Maddok Magua
        "Teotihuacan - przedsionek": { label: "TEZCA", file: "tyt/tezcatlipoca.gif" }, // Tezcatlipoca
        "Topan p.13": { label: "TEZCA", file: "tyt/tezcatlipoca.gif" }, // Tezcatlipoca
        "Sekretne Przejście Kapłanów": { label: "BARBA", file: "tyt/hebrehoth_smokoludzie.gif" }, // Barbatos Smoczy Strażnik
        "Przejście Władców Mrozu": { label: "TANRO", file: "tyt/ice_king.gif" }, // Tanroth
        // https://forum.margonem.pl/?task=forum&show=posts&id=514732
        "Pradawne Wzgórze Przodków": { label: "LAMBO", file: "kol/mamlambo_final2.gif" }, // Mamlambo
        "Pieczara Szaleńców - przedsionek": { label: "63", file: "kol/bazyliszek.gif" }, // Regulus Mętnooki
        "Zmarzlina Amaimona Soplorękiego - przedsionek": { label: "83", file: "kol/soploreki.gif" }, // Amaimon Soploręki
        "Głębia Przeklętych Fal - przedsionek": { label: "114", file: "kol/kolos-wodnik.gif" }, // Umibozu
        "Przepaść Zadumy - przedsionek": { label: "144", file: "kol/kolos-wazka.gif" }, // Vashkar
        "Czeluść Chimerycznej Natury - przedsionek": { label: "167", file: "kol/hydrokora.gif" }, // Hydrokora Chimeryczna
        "Grobowiec Przeklętego Krakania - przedsionek": { label: "190", file: "kol/kolkrucz.gif" }, // Lulukav
        "Grota Przebiegłego Tkacza - przedsionek": { label: "213", file: "kol/kolos-pajak.gif" }, // Arachin Podstępny
        "Grota Martwodrzewów - przedsionek": { label: "244", file: "kol/kolos-dendro.gif" }, // Reuzen
        "Katakumby Antycznego Gniewu - przedsionek": { label: "279", file: "kol/kolos-drakolisz.gif" }, // Wernoradzki Drakolisz
    };

    /* ================== USTAWIENIA ================== */

    const WIDGET_KEY = 'grafikikcs';
    const WIDGET_ICON = 'https://raw.githubusercontent.com/gswist0/margoaddons/refs/heads/main/kcs_clear.png';
    const DEFAULT_WIDGET_POSITION = [6, 'bottom-right-additional'];
    const PANEL_POSITION_KEY = 'grafiki_kcs_pozycja';
    const GRAPHICS_KEY = 'grafiki_kcs_grafiki';
    const LABELS_KEY = 'grafiki_kcs_tekst';

    let showGraphics = localStorage.getItem(GRAPHICS_KEY) !== 'false';
    let showLabels = localStorage.getItem(LABELS_KEY) === 'true';

    /* ================== ROZPOZNAWANIE MAPY ================== */

    const normalize = name => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

    const BOSS_BY_NORMALIZED_MAP = new Map(
        Object.entries(BOSSES_BY_MAP).map(([map, boss]) => [normalize(map), boss])
    );

    // Dłuższe nazwy najpierw, a lookahead odrzuca "Mokra Grota p.2 - sala 3" przy szukaniu "Mokra Grota p.2",
    // bo to inna mapa niż ta z potworem.
    const MAP_PATTERNS = Object.entries(BOSSES_BY_MAP)
        .sort(([a], [b]) => b.length - a.length)
        .map(([map, boss]) => {
            const words = map.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
                .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const source = `(?<![\\p{L}\\p{N}])${words.join('[^\\p{L}\\p{N}]*')}(?![\\p{L}\\p{N}]|\\s*-\\s|\\s*[ps]\\.\\s*\\d)`;
            return { pattern: new RegExp(source, 'iu'), boss };
        });

    // teleport=632,7,79,Las Tropicieli
    const TARGET_STAT = /^\d+,\d+,\d+,(.+)$/;

    const isStone = (item, stats) => 'custom_teleport' in stats || /czerwonego smoka/i.test(item.name || '');

    function findBoss(item) {
        const stats = item.parseStats();
        if (!isStone(item, stats)) return null;

        for (const stat of [stats.custom_teleport, stats.teleport]) {
            const target = TARGET_STAT.exec(stat || '');
            if (target) return BOSS_BY_NORMALIZED_MAP.get(normalize(target[1])) || null;
        }

        // brak celu w znanym formacie: nazwa mapy może być w dowolnej innej części statystyk (np. w opisie)
        const found = MAP_PATTERNS.find(({ pattern }) => pattern.test(item.stat || ''));
        return found ? found.boss : null;
    }

    /* ================== GRAFIKA ================== */

    // Obszar wspólny dla wszystkich klatek, bez przezroczystych marginesów, żeby potwór był czytelny na 32x32.
    function findContentBox(image, frameWidth, frameHeight) {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0);
        const { data } = ctx.getImageData(0, 0, image.width, image.height);

        let left = frameWidth, top = frameHeight, right = -1, bottom = -1;
        for (let y = 0; y < image.height; y++) {
            for (let x = 0; x < image.width; x++) {
                if (!data[(y * image.width + x) * 4 + 3]) continue;
                const frameY = y % frameHeight;
                if (x < left) left = x;
                if (x > right) right = x;
                if (frameY < top) top = frameY;
                if (frameY > bottom) bottom = frameY;
            }
        }
        if (right < 0) return { x: 0, y: 0, width: frameWidth, height: frameHeight };
        return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
    }

    // Dobiera skalę tak, by litery wypełniły szerokość ikony, i przypina je do lewego górnego rogu.
    // Mierzy i skaluje duży napis, bo przy małej czcionce przeglądarka zaokrągla kształt liter i napis wystawałby poza ikonę.
    function fitLabel(ctx, label) {
        ctx.font = LABEL_FONT;
        const size = ctx.measureText(label);
        const scale = LABEL_WIDTH / (size.actualBoundingBoxLeft + size.actualBoundingBoxRight);
        return {
            scale,
            x: LABEL_MARGIN + size.actualBoundingBoxLeft * scale,
            y: LABEL_MARGIN + size.actualBoundingBoxAscent * scale,
        };
    }

    function drawLabel(ctx, label, fit, frameTop) {
        ctx.save();
        ctx.translate(fit.x, frameTop + fit.y);
        ctx.scale(fit.scale, fit.scale);
        ctx.lineWidth = LABEL_OUTLINE / fit.scale;
        ctx.strokeText(label, 0, 0);
        ctx.fillText(label, 0, 0);
        ctx.restore();
    }

    // Gra rysuje ikonę przedmiotu jako pionowy pasek klatek 32x32, a grafiki npc mają dowolny rozmiar.
    // Tekst jest częścią paska, bo gra kopiuje ikonę do wielu widoków (ekwipunek, depo, dolny pasek, tooltip).
    function buildIconSprite(image, info, { crop, label }) {
        const frameWidth = info.hdr.width;
        const frameHeight = info.hdr.height;
        const frameCount = Math.max(info.frames.length, 1);
        const box = crop
            ? findContentBox(image, frameWidth, frameHeight)
            : { x: 0, y: 0, width: frameWidth, height: frameHeight };
        const scale = ICON_SIZE / Math.max(box.width, box.height);
        const width = box.width * scale;
        const height = box.height * scale;

        const sprite = document.createElement('canvas');
        sprite.width = ICON_SIZE;
        sprite.height = ICON_SIZE * frameCount;
        const ctx = sprite.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#000';
        ctx.fillStyle = '#fff';
        const labelFit = label && fitLabel(ctx, label);
        for (let frame = 0; frame < frameCount; frame++) {
            const frameTop = frame * ICON_SIZE;
            ctx.drawImage(
                image,
                box.x, box.y + frame * frameHeight, box.width, box.height,
                (ICON_SIZE - width) / 2, frameTop + (ICON_SIZE - height) / 2, width, height
            );
            if (label) drawLabel(ctx, label, labelFit, frameTop);
        }
        return { sprite, info: { hdr: { width: ICON_SIZE, height: ICON_SIZE }, frames: info.frames } };
    }

    const loadImage = path => new Promise((resolve, reject) => {
        window.Engine.imgLoader.onload(
            path,
            { speed: false, externalSource: window.cdnUrl },
            false,
            (image, info) => resolve({ image, info }),
            reject
        );
    });

    // Co pokazać na kamieniu. null oznacza zwykłą ikonę z gry.
    function chooseIcon(item) {
        const boss = findBoss(item);
        if (!boss) return null;
        const label = showLabels ? boss.label : '';
        if (showGraphics) return { path: window.CFG.r_npath + boss.file, crop: true, label };
        if (label) return { path: window.CFG.r_ipath + item.icon, crop: false, label };
        return null;
    }

    const iconKey = icon => icon && `${icon.path}|${icon.label}`;

    const iconCache = new Map();

    function loadIcon(icon) {
        const key = iconKey(icon);
        if (!iconCache.has(key)) {
            const sprite = loadImage(icon.path).then(({ image, info }) => buildIconSprite(image, info, icon));
            // po błędzie sieci kolejna próba ma szansę się udać
            sprite.catch(() => iconCache.delete(key));
            iconCache.set(key, sprite);
        }
        return iconCache.get(key);
    }

    /* ================== PODMIANA NA PRZEDMIOTACH ================== */

    const hookedItems = new WeakSet();
    const itemSyncs = new Set();

    function hookItem(item) {
        if (hookedItems.has(item) || !isStone(item, item.parseStats())) return;
        hookedItems.add(item);

        const showIcon = item.afterOnloadItem;
        let currentKey = null;

        // Gra wczytuje własną ikonę asynchronicznie, więc może ona dotrzeć już po podmianie.
        item.afterOnloadItem = (info, sprite) => {
            if (!currentKey) showIcon(info, sprite);
        };

        const showOriginalIcon = () => loadImage(window.CFG.r_ipath + item.icon).then(({ image, info }) => {
            if (!currentKey) showIcon(info, image);
        }, () => {});

        const sync = () => {
            const icon = chooseIcon(item);
            const key = iconKey(icon);
            if (key === currentKey) return;
            const hadCustomIcon = currentKey !== null;
            currentKey = key;

            if (!icon) {
                if (hadCustomIcon) showOriginalIcon();
                return;
            }
            loadIcon(icon).then(({ info, sprite }) => {
                if (currentKey === key) showIcon(info, sprite);
            }, () => {
                if (currentKey !== key) return;
                currentKey = null;
                showOriginalIcon();
            });
        };

        itemSyncs.add(sync);
        item.on('delete', () => itemSyncs.delete(sync));
        // przestawienie kamienia na inną mapę aktualizuje ten sam obiekt przedmiotu
        item.on('afterUpdate', sync);
        sync();
    }

    function installItemHook() {
        const items = window.Engine.items;

        const newItemInLocation = items.newItemInLocation;
        items.newItemInLocation = function (loc, item, fetchPackage) {
            hookItem(item);
            return newItemInLocation.call(this, loc, item, fetchPackage);
        };

        // przedmioty, które gra zdążyła wczytać przed startem dodatku
        const locations = new Set(Object.values(window.Engine.itemsFetchData).map(({ loc }) => loc));
        for (const loc of locations) items.fetchLocationItems(loc).forEach(hookItem);
    }

    const refreshItems = () => itemSyncs.forEach(sync => sync());

    /* ================== MENU ================== */

    let panel = null;

    function togglePanel() {
        if (panel) panel.hidden = !panel.hidden;
    }

    function createCheckbox(id, text, checked, onChange) {
        const row = document.createElement('div');
        row.className = 'kcs-check';
        const input = document.createElement('input');
        input.id = id;
        input.type = 'checkbox';
        input.checked = checked;
        input.addEventListener('change', () => {
            onChange(input.checked);
            // bez fokusu spacja i strzałki znów sterują grą, a nie opcją
            input.blur();
        });
        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = text;
        row.append(input, label);
        return row;
    }

    function buildPanel() {
        const style = document.createElement('style');
        style.textContent = `
            .main-buttons-container .widget-button .icon.${WIDGET_KEY} { background-image: url("${WIDGET_ICON}"); background-position: 0; }
            #kcs-panel { position: fixed; z-index: 9999; width: 260px; display: flex; flex-direction: column; background: #1b1712; color: #e8dcc0; border: 2px solid #6b5a33; border-radius: 6px; font: 12px/1.35 Arial, sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,.6); user-select: none; }
            #kcs-panel, #kcs-panel * { box-sizing: border-box; }
            #kcs-panel[hidden] { display: none; }
            #kcs-panel .kcs-head { display: flex; align-items: center; gap: 6px; padding: 5px 8px; cursor: move; background: linear-gradient(#3a2f1a, #2a2212); border-bottom: 1px solid #6b5a33; border-radius: 4px 4px 0 0; }
            #kcs-panel .kcs-title { flex: 1; font-weight: bold; color: #f1d58a; }
            #kcs-panel .kcs-btn { cursor: pointer; background: #4a3d22; border: 1px solid #7a6639; color: #f1d58a; border-radius: 3px; padding: 0 6px; line-height: 18px; font-size: 12px; }
            #kcs-panel .kcs-btn:hover { background: #5d4c2a; }
            #kcs-panel .kcs-page { padding: 8px 8px 2px; }
            #kcs-panel .kcs-check { display: flex; align-items: center; gap: 5px; margin-bottom: 8px; }
            #kcs-panel .kcs-check label { margin: 0; color: #e8dcc0; cursor: pointer; }
            #kcs-panel .kcs-check input { margin: 0; accent-color: #7a6639; cursor: pointer; }
        `;
        document.head.appendChild(style);

        panel = document.createElement('div');
        panel.id = 'kcs-panel';
        panel.hidden = true;

        const head = document.createElement('div');
        head.className = 'kcs-head';
        const title = document.createElement('span');
        title.className = 'kcs-title';
        title.textContent = 'Grafiki na KCS';
        const close = document.createElement('span');
        close.className = 'kcs-btn';
        close.title = 'Zamknij';
        close.textContent = '×';
        close.addEventListener('click', () => { panel.hidden = true; });
        head.append(title, close);

        const page = document.createElement('div');
        page.className = 'kcs-page';

        const graphicsRow = createCheckbox('kcs-graphics', 'Pokazuj grafiki potworów', showGraphics, checked => {
            showGraphics = checked;
            localStorage.setItem(GRAPHICS_KEY, showGraphics);
            refreshItems();
        });
        const labelsRow = createCheckbox('kcs-labels', 'Pokazuj tekst na kamieniu', showLabels, checked => {
            showLabels = checked;
            localStorage.setItem(LABELS_KEY, showLabels);
            refreshItems();
        });

        page.append(graphicsRow, labelsRow);
        panel.append(head, page);
        document.body.appendChild(panel);
        installDragging(head);
    }

    function installDragging(head) {
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(PANEL_POSITION_KEY)) || {}; } catch (e) { /* domyślna pozycja */ }
        const clampLeft = left => Math.max(0, Math.min(window.innerWidth - 60, left));
        const clampTop = top => Math.max(0, Math.min(window.innerHeight - 30, top));
        panel.style.left = clampLeft(saved.left ?? 520) + 'px';
        panel.style.top = clampTop(saved.top ?? 200) + 'px';

        let drag = null;
        head.addEventListener('mousedown', event => {
            if (event.target.classList.contains('kcs-btn')) return;
            drag = { dx: event.clientX - panel.offsetLeft, dy: event.clientY - panel.offsetTop };
            event.preventDefault();
        });
        document.addEventListener('mousemove', event => {
            if (!drag) return;
            panel.style.left = clampLeft(event.clientX - drag.dx) + 'px';
            panel.style.top = clampTop(event.clientY - drag.dy) + 'px';
        });
        document.addEventListener('mouseup', () => {
            if (!drag) return;
            drag = null;
            localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify({ left: panel.offsetLeft, top: panel.offsetTop }));
        });
    }

    document.addEventListener('keydown', event => {
        if (!event.altKey || event.repeat || event.key.toLowerCase() !== 'v') return;
        event.preventDefault();
        togglePanel();
    });

    /* ================== WIDGET ================== */
    // credit to https://github.com/nerthus-margonem/nerthusaddon

    function installWidget() {
        const Engine = window.Engine;

        const addToDefaultSet = () => Engine.widgetManager.addKeyToDefaultWidgetSet(
            WIDGET_KEY,
            DEFAULT_WIDGET_POSITION[0],
            DEFAULT_WIDGET_POSITION[1],
            'Grafiki na KCS',
            'green',
            togglePanel
        );

        const createButton = () => {
            if (Engine.interfaceStart && Object.keys(Engine.widgetManager.getDefaultWidgetSet()).includes(WIDGET_KEY)) {
                const saved = Engine.serverStorage.get(Engine.widgetManager.getPathToHotWidgetVersion());
                const position = (saved && saved[WIDGET_KEY]) || DEFAULT_WIDGET_POSITION;
                Engine.widgetManager.createOneWidget(WIDGET_KEY, { [WIDGET_KEY]: position }, true, []);
                Engine.widgetManager.setEnableDraggingButtonsWidget(false);
            } else setTimeout(createButton, 500);
        };

        const addWidgetButtons = Engine.widgetManager.addWidgetButtons;
        Engine.widgetManager.addWidgetButtons = function (additionalBarHide) {
            addWidgetButtons.call(Engine.widgetManager, additionalBarHide);
            addToDefaultSet();
            createButton();
            Engine.widgetManager.addWidgetButtons = addWidgetButtons;
        };

        if (Engine.interfaceStart) {
            addToDefaultSet();
            createButton();
        }
    }

    function waitFor(isReady, callback) {
        if (isReady()) callback();
        else setTimeout(() => waitFor(isReady, callback), 50);
    }

    waitFor(() => document.querySelector('.game-window-positioner') && document.head, buildPanel);
    waitFor(() => window.Engine && window.Engine.widgetManager && window.Engine.widgetManager.addWidgetButtons, installWidget);
    waitFor(
        () => window.Engine && window.Engine.items && window.Engine.items.newItemInLocation
            && window.Engine.imgLoader && window.Engine.itemsFetchData,
        installItemHook
    );
})();
