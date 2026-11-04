# Zestaw dodatków do nowego interfejsu gry Margonem

wszystkie dodatki są przeznaczone na nowy interfejs i nie będą działać na starym

część dodatków korzysta z wbudowanej w nowy interfejs opcji widgetów, i ich ikonki powinny pojawiać się domyślnie w prawym dolnym rogu ekranu. po pojawieniu się ich tam, można przenieść je w dowolne miejsce w interfejsie i zmiana powinna zostać zapamiętana

gdyby jednak były z tym problemy, każdy dodatek ma też alternatywny sposób uruchomienia menu/funkcjonalności poprzez skrót klawiszowy:

herosy na discord - alt + H

grzybki na discord - alt + G

wrogowie na discord - alt + J

legi na discord - alt + L

auto barter - alt + B

respy herosów - alt + R

agresywność potworów - alt + C

grafiki na kcs - alt + V

ulepszanie przedmiotów - alt + U


do poprawnego działania potrzebny jest dodatek do przeglądarki Tampermonkey
aby zainstalować dodatek należy kliknąć na niego, a następnie kliknąć "raw" (w pracym górnym rogu). jeśli mamy Tampermonkey, powinno automatycznie otworzyć się okno instalacji skryptu

w razie bledow/propozycji pisac

kontakt na discord: poteznydominator NIE TRZEBA DODAWAC MNIE DO ZNAJOMYCH MOZNA PO PROSTU NAPISAC

# lista aktualnych skryptów

-powiadomienia na discord - herosy/tytani, grzybki, wrogowie i legendy w jednym dodatku ze wspólnym menu (jedna ikonka, zakładki). skróty alt + H / G / J / L otwierają odpowiednią zakładkę. każdą sekcję można osobno wyłączyć przyciskiem w jej zakładce. ustawienia ze starych dodatków przechodzą automatycznie. NIE UŻYWAĆ RAZEM ZE STARYMI 4 DODATKAMI, bo powiadomienia będą wysyłane podwójnie

-automatyczne wysylanie info o herosie na discord - szczegolowa instrukcja nizej

-automatyczne wysylanie info o dropnietej legendzie na discord - szczegolowa instrukcja nizej

-automatyczne wysylanie info o wrogach na discord - szczegolowa instrukcja nizej

-automatyczne wysyłanie info o grzybkach na discord - szczegolowa instrukcja nizej

-automatyczne oddawanie D w grupie osobie która napisze "oddaj d" na czacie grupowym

-pokazywanie respów herosów (dane brane bezpośrednio z gry) na mapie, wraz z dokładnym zasięgiem skąd ich widać. w menu (ikonka RH lub alt + R) można wyłączyć dodatek, ustawić intensywność respów i zasięgu oraz włączyć ukrywanie respu i obramówki po wejściu w jej zasięg - ukryte respy wracają po zmianie mapy

-łatwiejszy pościg. zamiast klikać na kogoś prawy i wybierać w okienku kontekstowym "atakuj" wystarczy trzymając crtl nacisnąć prawy i efekt będzie ten sam. nie jest to autodobijarka i  nie chodzi za nas - korzysta z funkcji pościgu dostępnej w grze na NI

-auto barter, po klinięciu alt+b z otwartym oknem barteru, wykonuje po kolei wszystkie dostępne możliwe receptury. użyteczne np. w wymianie itemków z agara, czy wakacyjnej wymianie uni/her na rebitki kolosów. NIE POLECAM UZYWAC W SYTUACJACH GDY Z TYCH SAMYCH ITEMÓW MOŻNA TWORZYĆ RÓŻNE RZECZY, NP BARTER Z KOPALNI, CZY WYMIANA HEROSOWYCH SKRZYNEK

-agresywność potworów - ikonka AG (lub alt + C) włącza/wyłącza agresywność potworów w pojedynkę z konfiguracji gry. podświetlona ikonka oznacza że opcja jest włączona. nie zmienia opcji agresywności w grupie

-grafiki e2 na kcs - kamienie czerwonego smoka ustawione na mapę z e2 (lub najbliższą jej dostępną) albo na przedsionek tytana/kolosa dostają w ekwipunku, depo itd. grafikę tego potwora, dzięki czemu od razu widać który kamień gdzie prowadzi. w menu (ikonka KC lub alt + V) można wyłączyć grafiki oraz włączyć tekst z krótką nazwą potwora w lewym górnym rogu kamienia. można też dodać własne ustawienia dla dowolnej lokacji (grafika z linku i/lub tekst) - w menu lub przez PPM na ustawiony kamień -> "Własna grafika i tekst". link musi prowadzić wprost do obrazka na serwerze zezwalającym na CORS (np. GitHub), a z animowanego gifa używana jest tylko pierwsza klatka. działa tylko po stronie gracza, przedmiot się nie zmienia. gdy na mapie jest kilka e2, używana jest grafika pierwszej z nich

-ulepszanie przedmiotów - przeciągamy przedmiot z ekwipunku na ikonkę UL (lub na pole w menu, alt + U) i od tej pory jest on automatycznie ulepszany przedmiotami z łupów. łup jest zużywany partiami: gdy zbierze się ustawiona liczba przedmiotów (domyślnie 10, można też wpisać własną) albo po 2 minutach, a w trybie zapełnienia toreb dopiero przy 0 wolnych miejsc, gdy bohater stoi i nie ma otwartego depo, sklepu itd. okno ulepszania się nie otwiera, a bohater jest zablokowany tylko przez ułamek sekundy. w menu ustawiamy maksymalną jakość zużywanych przedmiotów (domyślnie pospolite), widać tam też postęp ulepszania i dzienny limit. legendy, artefakty i przedmioty ulepszone nigdy nie są zużywane, tak samo jak rzeczy spoza łupów (np. wyjęte z depo albo kupione). gdy pasek się zapełni, dodatek zatrzymuje się i informuje gracza - poziom podnosimy sami w oknie ulepszania, bo kosztuje to złoto i składniki, a potem dodatek wraca do pracy. po osiągnięciu maksymalnej jakości dodatek kończy ulepszanie i informuje gracza

-klanowicze online - ładne okienko które pozwala ogarnąć kto i gdzie jest w grze bez otwierania klanu

-lepsze depo - dodatkowe funkcje depozytu takie jak:
    -zamiana miejscami przedmiotow w depo tak samo jak można to robić w eq (WYMAGA 1 WOLNEGO MIEJSCA W DEPO / EQ GRACZA)
    -automatyczne stackowanie itemów gdy wrzucamy je 1 klikiem (gdy przeciągamy to wpadnie tam gdzie chcemy)
    -wrzucanie całej torby (prawy klik na torbę - przy otwartym depo pojawia się nowa opcja w menu kontekstowym - Wrzuć zawartość do depozytu)
    -nowe opcje filtrowania

# skąd wziąć link do webhooka do discordowych dodatków

trzeba mieć odpowiednie uprawnienia na serwerze discord
1. ustawienia serwera
2. integracje
3. webhooki
4. dodajemy nowy webhook do interesującego nas kanału lub kopiujemy adres istniejącego już webhooka

# o co chodzi z specjalnymi pingami

jeśli w dodatku automatycznego wysyłania info o herosie/tytanie na discord ustawimy specjalne pingi, to zamiast pingować here/everyone, dodatek spinguje wybraną rangę z naszego serwera discord, do tego potrzebne jest specjalne id rangi które wpisujemy w pole w opcjach

id rangi można zdobyć tak
1. włączyć tryb developera
2. ustawienia serwera
3. role
4. PPM na interesującą nas rolę
5. kopiuj id
6. wklejamy id do pola w opcjach dodając do tego znaki <@ID>

ostatecznie powinno wyglądać to np tak. <@902234476555813172>

dodatek do herosów ma opcję wpisania drugiego webhooka dla tytanów - wtedy herosy będą lecieć na normalny link, a tytani na ten dla tytanów

# mniej lub bardziej ważne
z dodatków korzystacie na własną odpowiedzialność. raczej nie ma w nich nic co mogłoby być uznane za nielegalne, sa to głównie funkcje QoL, lub do komunikacji z discordem, ale wiadomo że z margonem nigdy nie wiadomo.
dodatki są i zawsze będą darmowe.
zezwalam na kopiowanie części / całości kodu dodatków na własne potrzeby / do własnych skryptów
