# Zestaw dodatków do nowego interfejsu gry Margonem

wszystkie dodatki są przeznaczone na nowy interfejs i nie będą działać na starym

część dodatków korzysta z wbudowanej w nowy interfejs opcji widgetów, i ich ikonki powinny pojawiać się domyślnie w prawym dolnym rogu ekranu. po pojawieniu się ich tam, można przenieść je w dowolne miejsce w interfejsie i zmiana powinna zostać zapamiętana

gdyby jednak były z tym problemy, każdy dodatek ma też alternatywny sposób uruchomienia menu/funkcjonalności poprzez skrót klawiszowy:
herosy na discord - alt + H
grzybki na discord - alt + G
wrogowie na discord - alt + J
legi na discord - alt + L

do poprawnego działania potrzebny jest dodatek do przeglądarki Tampermonkey
aby zainstalować dodatek należy kliknąć na niego, a następnie kliknąć Zainstaluj

w razie bledow/propozycji pisac

kontakt na discord: poteznydominator NIE TRZEBA DODAWAC MNIE DO ZNAJOMYCH MOZNA PO PROSTU NAPISAC

# lista aktualnych skryptów

-automatyczne wysylanie info o herosie na discord - szczegolowa instrukcja nizej

-automatyczne wysylanie info o dropnietej legendzie na discord - szczegolowa instrukcja nizej

-automatyczne wysylanie info o wrogach na discord - szczegolowa instrukcja nizej

-automatyczne wysyłanie info o grzybkach na discord - szczegolowa instrukcja nizej

-automatyczne oddawanie D w grupie osobie która napisze "oddaj d" na czacie grupowym

-pokazywanie respów herosów (dane brane bezpośrednio z gry) na mapie, wraz z dokładnym zasięgiem skąd ich widać.

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
