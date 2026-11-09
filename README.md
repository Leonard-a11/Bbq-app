# BBQ Thermometer

Eigen app voor een Inkbird BBQ-thermometer met Bluetooth (het "iBBQ"-protocol:
IBT-2X, IBT-4XS, IBT-6XS en vergelijkbare). Het is een website die je in
**Chrome op Android** opent en als app op je beginscherm zet.

## Wat kan hij

- **Live**: per voeler een ronde meter (vult richting het doel), tempo in °/uur en
  **verwachte klaar-tijd**. Die houdt rekening met afremmen: vlees warmt langzamer op
  naarmate het de BBQ-temperatuur nadert (berekend met de BBQ-voeler).
- **Rol per voeler**: *vlees* (doel + rusttijd, snelkeuze brisket, pulled pork, ribs,
  picanha, kip …) of *BBQ-temperatuur* (min–max, opstellingen voor de Weber-ketel:
  low & slow met diffuser, snake, 2-zone, hot & fast, reverse sear).
- **Slimme meldingen**: stall herkennen, deksel open (plotselinge daling), BBQ te
  heet/koud met ventieladvies, "kolen raken op?" (15 min te koud en geen herstel),
  bijna klaar, klaar → rusttimer.
- **Kookplan**: geef een eettijd op; de app zegt of je op schema ligt (incl. rusten).
- **Gebeurtenissen** (kolen, rookhout, ingepakt, spritzen, deksel …) als icoontjes in
  de grafiek en in de tijdlijn. **Timers**, ook herhalend (spritzen elke 45 min).
- **Doormeten met scherm uit** (Android-app): vaste melding met live temperaturen,
  CPU blijft wakker; alarmen en timers als melding op de telefoon.
- **Verbinding weg?** Eindeloos opnieuw verbinden (meteen als Bluetooth weer aan gaat),
  alarm na 2 min. De sessie blijft open tot je hem afrondt; ook na het afsluiten van
  de app gaat hij verder (de app verbindt dan vanzelf). In de historie kun je elke
  sessie weer openen met "Verder met deze sessie".
- **Historie**: overzicht (aantal sessies, uren, langste cook), mini-grafiekjes,
  sterren, foto van het resultaat, notities, statistiek (gemiddelde BBQ-temp, % binnen
  bereik, stallduur), export naar Excel (CSV, met gebeurtenissen).
- **Back-up** van alles in één bestand, en terugzetten (nieuwe telefoon).
- **Recepten** (tab): brisket, pulled pork, spareribs 3-2-1, beef ribs, picanha, côte de
  bœuf, kip, burnt ends, zalm op cederplank, lam, rubs, BBQ-saus, bijgerechten. Omrekenen
  naar aantal personen, boodschappenlijst delen, favorieten, eigen recepten
  (stappen met `[70°]` = melding bij kerntemp, `[45m]` = timer, `[60m↻]` = herhalend).
  **Start deze cook** zet sessie, opstelling en voelers klaar en toont de stappen op Live,
  met meldingen op het juiste moment.
- **Planner**: vanaf de eettijd terugrekenen (aansteken, vlees erop, klaar, rusten) +
  herinneringen. **Gidsen**: kolen-calculator (Weber 57 cm), pekel-calculator, rookhout,
  ventielen, stall, rusten, kerntemperaturen, veiligheid.
- **Voorspellingslijn** in de grafiek (stippellijn naar het doel), **keukenmodus**
  (grote cijfers, ⛶), **gesproken meldingen**, **deelkaart** (afbeelding van de cook),
  **prestaties** (badges).
- Demo zonder thermometer.

Alle gegevens blijven op je eigen telefoon.

## Android-app installeren (aanbevolen)

Chrome op de telefoon kon de IBT-4XS niet zelf vinden (alleen als BBQ Go al
verbonden was). De Android-app zoekt zelf, net als BBQ Go.

1. Open op je telefoon **github.com/Leonard-a11/Bbq-app/releases/latest**
   (ingelogd bij GitHub) en tik op **BBQ-Thermometer.apk**.
2. Open het gedownloade bestand. Android vraagt eenmalig of Chrome "onbekende apps"
   mag installeren → toestaan → **Installeren**.
3. Open **BBQ Thermometer**, sta **Apparaten in de buurt** en **Meldingen** toe.
4. Zet BBQ Go uit (Instellingen → Apps → BBQ Go → Geforceerd stoppen) en tik op
   **Verbind thermometer** → kies **iBBQ**.

Een nieuwere versie installeer je op dezelfde manier; de historie blijft bewaard.
Elke push naar `main` bouwt automatisch een nieuwe apk (GitHub Actions,
`.github/workflows/apk.yml`). Zelf bouwen: `npm ci && npm run android`, dan
`cd android && ./gradlew assembleRelease` (Android SDK nodig).

Let op: de app en de webversie hebben elk hun eigen historie.

## Webversie gebruiken

1. Open het adres in **Chrome** op je Android-telefoon.
2. Menu (⋮) → **App installeren** / **Toevoegen aan startscherm**.
3. Bluetooth aan, thermometer aan, de **Inkbird-app sluiten** (de thermometer
   kan maar met één app tegelijk verbonden zijn), dan **Verbind thermometer**.

iPhone/iPad werkt niet: Apple staat Bluetooth in de browser niet toe.

## Online zetten (Cloudflare, gratis)

Zelfde manier als de Hevotec-offertesite: Cloudflare dashboard → Workers & Pages →
Create → Import a repository → deze repo kiezen. `wrangler.jsonc` publiceert de map
`public/` (geen build-stap). Elke push naar `main` gaat vanzelf online.
Bluetooth werkt alleen via **https**, dus niet als los bestand op de telefoon.

## Techniek

- Broncode in `app/` (ES-modules), gebundeld met `npm run bouw` → `public/app.js`
  (dat bestand staat in git, want Cloudflare bouwt niets):
  `main.js` (opstart, dialogen, instellingen), `ble.js` (iBBQ-protocol, opnieuw verbinden,
  demo), `sessie.js` (sessies, opslaan, samenvoegen, heropenen), `live.js` (analyse,
  kaarten, adviezen, kookplan, alarmen), `analyse.js` (tempo, klaar-tijd, stall, deksel),
  `grafiek.js`, `historie.js`, `timers.js`, `recepten.js` (receptenboek), `receptui.js`
  (recepten-tab, planner, rekenhulpen, gidsen), `prestaties.js`, `deelkaart.js`, `alarmen.js` (geluid, meldingen,
  achtergrondservice), `opslag.js` (IndexedDB + back-up), `kookboek.js` (vlees,
  opstellingen, gebeurtenissen), `native.js` (alleen in de app: Android-Bluetooth in de
  vorm van Web Bluetooth).
- Android: `MeetService.java` (voorgrondservice + wake lock) en `AchtergrondPlugin.java`
  (start/stop/melding bijwerken, accubesparing).
- `android/`: Capacitor-project. Vaste handtekening `android/app/bbq-thermometer.keystore`
  (nodig om updates over de oude versie heen te installeren; niet weggooien).
- iBBQ: service `FFF0`; inloggen = vaste 15 bytes naar `FFF2`; daarna naar `FFF5`:
  `02 00…` (Celsius), `0B 01…` (live aan), `08 24…` (batterij, antwoord op `FFF1`).
  Live temperaturen op `FFF4`: per voeler 2 bytes (little-endian, tienden van een
  graad); `FFF6` = geen voeler.
- `public/sw.js`: app werkt ook zonder internet. Bij een nieuwe versie `VERSIE` ophogen.
