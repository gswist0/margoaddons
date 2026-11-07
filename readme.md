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

złoto na koncie - alt + Z

pseudonimy - alt + N


do poprawnego działania potrzebny jest dodatek do przeglądarki Tampermonkey
aby zainstalować dodatek należy kliknąć na niego, a następnie kliknąć "raw" (w pracym górnym rogu). jeśli mamy Tampermonkey, powinno automatycznie otworzyć się okno instalacji skryptu

dodatki same się nie aktualizują. gdy na githubie jest nowsza wersja, na dole okna dodatku (w lepszych aukcjach - w sekcji "Lepsze aukcje" w oknie aukcji, a w dodatkach bez okna - mały komunikat u góry ekranu, najwyżej raz dziennie) pojawia się informacja z linkiem "zaktualizuj z GitHuba". lista aktualnych wersji jest w pliku versions.json

w razie bledow/propozycji pisac

kontakt na discord: poteznydominator NIE TRZEBA DODAWAC MNIE DO ZNAJOMYCH MOZNA PO PROSTU NAPISAC

# lista aktualnych skryptów

-powiadomienia na discord - herosy/tytani, grzybki, wrogowie i legendy w jednym dodatku ze wspólnym menu (alt + H / G / J / L otwiera odpowiednią zakładkę). każdą sekcję można osobno wyłączyć, ustawienia ze starych dodatków przechodzą automatycznie. NIE UŻYWAĆ RAZEM ZE STARYMI 4 DODATKAMI, bo powiadomienia będą wysyłane podwójnie

-automatyczne wysylanie info o herosie na discord - szczegolowa instrukcja nizej

-automatyczne wysylanie info o dropnietej legendzie na discord - szczegolowa instrukcja nizej

-automatyczne wysylanie info o wrogach na discord - szczegolowa instrukcja nizej

-automatyczne wysyłanie info o grzybkach na discord - szczegolowa instrukcja nizej

-automatyczne oddawanie D w grupie osobie która napisze "oddaj d" na czacie grupowym

-respy herosów - pokazuje na mapie respy herosów (dane z gry) wraz z zasięgiem, z którego ich widać. w menu (ikonka RH lub alt + R) ustawia się intensywność i ukrywanie respu po wejściu w jego zasięg

-łatwiejszy pościg - ctrl + PPM na graczu działa jak "atakuj" z menu kontekstowego. nie jest to autodobijarka, korzysta z wbudowanego w NI pościgu

-auto barter - alt + B przy otwartym oknie barteru wykonuje po kolei wszystkie dostępne receptury. NIE UŻYWAĆ GDY Z TYCH SAMYCH ITEMÓW MOŻNA TWORZYĆ RÓŻNE RZECZY (np. barter z kopalni, wymiana herosowych skrzynek)

-agresywność potworów - ikonka AG (lub alt + C) włącza/wyłącza agresywność potworów w pojedynkę z konfiguracji gry. podświetlona ikonka oznacza że opcja jest włączona. nie zmienia opcji agresywności w grupie

-grafiki e2 na kcs - kamienie czerwonego smoka dostają grafikę e2 (lub tytana/kolosa) z mapy, na którą prowadzą. w menu (ikonka KC lub alt + V) można włączyć krótką nazwę potwora na kamieniu i ustawić własną grafikę/tekst (też przez PPM na kamień). działa tylko po stronie gracza

-ulepszanie przedmiotów - przeciągamy przedmiot na ikonkę UL (lub alt + U), a dodatek automatycznie ulepsza go łupami do ustawionej w menu jakości. legendy, artefakty, ulepszone przedmioty i rzeczy spoza łupów nigdy nie są zużywane. poziom ulepszenia podnosimy sami - dodatek wtedy czeka i informuje gracza

-złoto na koncie - ikonka ZŁ (lub alt + Z) pokazuje łączne złoto wszystkich postaci i depo na danym serwerze. żeby suma była pełna, trzeba raz wejść na każdą postać i otworzyć depo - dodatek pokazuje czego brakuje. dane są zapisane w przeglądarce

-pseudonimy - PPM na graczu (na mapie lub czacie) -> "Dodaj pseudonim", który wyświetla się zamiast nicku w całej grze, dla wszystkich postaci tego konta. lista pseudonimów i ustawienia w menu (ikonka PS lub alt + N). działa tylko po stronie gracza

-lepsze aukcje - grupowanie takich samych ofert w jeden wiersz z najniższą ceną (rozwijane przyciskiem pod nazwą) oraz panel "Ukrywanie i zestawy" w oknie aukcji: ukrywanie ofert po nazwie (też PPM -> "Ukryj na aukcjach"), cenie, poziomie, typie, rzadkości i profesji oraz zapisywanie zestawów filtrów. UWAGA: przy aktualizacji do wersji 2.0 ustawienia ukrywania są czyszczone, bo wcześniej działały odwrotnie

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
