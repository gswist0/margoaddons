# Zestaw dodatków do nowego interfejsu gry Margonem

POD KONIEC 2022 DODATKI PRZESTAŁY BYC WSPIERANE I NIE BĘDĄ DOSTAWAC AKTUALIZACJI DO ODWOŁANIA 

wszystkie dodatki są przeznaczone na nowy interfejs i nie będą działać na starym

kontakt na discord: Potężny Dominator#2137

do poprawnego działania potrzebny jest dodatek do przeglądarki Tampermonkey
aby zainstalować dodatek należy kliknąć na niego, a następnie kliknąć Zainstaluj

w razie bledow/propozycji pisac
najlepiej kontaktować się poprzez pocztę w margonem na nerthus postać Banc, lub discord Potężny Dominator#2137


# lista aktualnych skryptów

-automatyczne wysylanie info o herosie na discord - szczegolowa instrukcja nizej

-automatyczne wysylanie info o dropnietej legendzie na discord - szczegolowa instrukcja nizej

-automatyczne wysylanie info o wrogach na discord - szczegolowa instrukcja nizej

-dodawanie wszystkich osob z mapki do grupy pod K - przycisk mozna zmienic na dowolny z klawiatury w menu pod widgetem "K"

-autoleczenie z potek z priorytetem pelny lek < leczace %maxhp < normalne potki (nie marnują hp)

-uciekanie po walce - ustawienia pod przyciskiem ";" , wlaczamy/wylaczamy uciekanie pod przyciskiem "'" (na prawo) - menu dostepne tez pod widgetem "S"

-wykrywacz sakiwek (tych z smoczej alchemii)

-palenie wszystkiego - po kliknieciu przycisku pali wszystkie itemy z tytanow wakacje 2022 na ofudy - dostepne pod przyciskiem [ albo pod widgetem "O" (aktualne usunięty przez brak przydatności po evencie)

-dobijanie wersja beta - poscig za wybranym graczem i dobijanie po walce - moga pojawiac sie bledy

-antyduszek - obecnie wylaczony przez konflikty z antybotem

-auto ulepszanie - wpisujesz nazwe itemku i ci go ulepsza samo, domyslnie tylko zwyklakami ale w opcjach mozna zaznaczyc tez unikaty i hera

-lootfilter - moje ustawienia - łapie wszystkie itemy którymi da sie ulepszac, wszystkie teleporty, runy, potki z pelnym leczeniem, serce z marloth i pazur mlodego smoka, odrzuca resztę konsumpcyjnych, strzaly, neutralne, talizmany ; jak ktoś w miarę ogarnia to można sobie pozmieniać funkcję USERLOGIC

-oddaj d, po napisaniu przez kogos "oddaj d" na czacie grupowym, oddaje mu d

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
