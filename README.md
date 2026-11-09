# BBQ Thermometer

Eigen app voor een Inkbird BBQ-thermometer met Bluetooth (het "iBBQ"-protocol:
IBT-2X, IBT-4XS, IBT-6XS en vergelijkbare). Het is een website die je in
**Chrome op Android** opent en als app op je beginscherm zet.

## Wat kan hij

- **Live**: alle voelers groot in beeld, batterij, °C/°F.
- **Alarm** per voeler: "alarm bij" (doeltemperatuur) en "alarm onder" (voor de
  BBQ-temperatuur). Geluid, trillen en een melding. Snelkeuzes voor vlees
  (rund rare/medium, pulled pork, brisket, kip …) en low & slow / hot & fast.
- **Klaar om**: rekent uit hoe snel het vlees stijgt en wanneer het op temperatuur is.
- **Grafiek** van de hele sessie (15 min / 1 uur / 4 uur / alles), tik voor de waarden.
- **Historie**: elke sessie wordt automatisch bewaard (één meting per 5 seconden),
  met naam, notitie, max/gemiddeld/eind per voeler en download naar Excel (CSV).
- Verbinding weg? Hij verbindt vanzelf opnieuw en meldt het na 1 minuut.
- Het scherm blijft aan zolang de thermometer verbonden is.
- Demo zonder thermometer: knop op het startscherm, of `?demo` achter het adres.

Alle gegevens blijven op je eigen telefoon (in de browser), niets gaat online.
Let op: "Sitegegevens wissen" in Chrome wist ook de historie.

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

- `public/app.js`: alles (Bluetooth, opslag in IndexedDB, grafiek, alarmen).
- `native/native.js` → `public/native.js` (`npm run bouw`): alleen in de Android-app
  (Capacitor). Geeft app.js de Android-Bluetooth (`@capacitor-community/bluetooth-le`)
  in de vorm van Web Bluetooth, plus meldingen en scherm-aan. In de browser doet het niets.
- `android/`: Capacitor-project. Vaste handtekening `android/app/bbq-thermometer.keystore`
  (nodig om updates over de oude versie heen te installeren; niet weggooien).
- iBBQ: service `FFF0`; inloggen = vaste 15 bytes naar `FFF2`; daarna naar `FFF5`:
  `02 00…` (Celsius), `0B 01…` (live aan), `08 24…` (batterij, antwoord op `FFF1`).
  Live temperaturen op `FFF4`: per voeler 2 bytes (little-endian, tienden van een
  graad); `FFF6` = geen voeler.
- `public/sw.js`: app werkt ook zonder internet. Bij een nieuwe versie `VERSIE` ophogen.
