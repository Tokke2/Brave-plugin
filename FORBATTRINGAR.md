# 25 förslag – Sida till PDF

Idébank för app, design, tema, typografi och kod. Insats: **S** = under en timme,
**M** = en halv dag, **L** = en dag eller mer. Alla förslag utgår från den kod som
finns i `src/` i dag.

> **Klart i 1.4.0:** #1 artikelläge, #2 mörk PDF, #3 autoskala, #7 källrad i sidfoten,
> #9 två snabbkommandon, #16 tema, #19 inbäddad font, #20 typografisk skala och
> #22 språkmedveten textjustering. Övriga förslag är öppna.

## Översikt

| # | Förslag | Kategori | Insats |
| --- | --- | --- | --- |
| 1 | ✅ Artikelläge – rensa bort nav, banners och reklam före utskrift | App | L |
| 2 | ✅ Mörk PDF (nattutskrift) | App | M |
| 3 | ✅ Autoskala för breda sidor | App | S |
| 4 | Per-sajt-profiler (mall, marginaler, knappläge) | App | M |
| 5 | Spara flera flikar samtidigt | App | M |
| 6 | Schemalagd arkivering | App | L |
| 7 | ✅ Källrad i sidfoten: titel, URL och datum | App | S |
| 8 | Historiksida med miniatyrer och "spara igen" | App | M |
| 9 | ✅ Två snabbkommandon: med och utan spar-dialog | App | S |
| 10 | Onboarding i tre steg | Design | M |
| 11 | Stegvis progress med avbryt | Design | M |
| 12 | Åtgärdbara felkort | Design | S |
| 13 | Badge och utökad högerklicksmeny | Design | S |
| 14 | Sajtlistan: sök, sortering och bokmärkesimport | Design | M |
| 15 | Mikroanimationer med motion-säkerhet | Design | S |
| 16 | ✅ Tema: Auto / Ljust / Mörkt | Tema | S |
| 17 | Fyra accentpaletter med matchande appikon | Tema | M |
| 18 | Högkontrastläge | Tema | S |
| 19 | ✅ Bädda in variabel font lokalt | Font | M |
| 20 | ✅ Typografisk skala i rem | Font | S |
| 21 | Siffror, filnamn och monospace | Font | S |
| 22 | ✅ Språkmedveten textjustering | Font | S |
| 23 | Dela upp `background.js` i moduler med JSDoc | Kod | M |
| 24 | Tester och CI i repot (chrome-mock, Actions, zip) | Kod | M |
| 25 | Lint/format, säkrare meddelanden och färre behörigheter | Kod | M |

---

## A. App och funktion

### 1. Artikelläge – rensa sidan före utskrift
**Vad:** En inställning (och en knapp i panelen) som extraherar huvudinnehållet –
rubrik, brödtext, bilder – och skriver ut bara det. Nav, cookiebanners, "relaterat",
sticky-sidhuvuden och chatwidgetar försvinner.
**Varför:** Sidor som Alldata och nyhetssajter ger annars 5–8 sidor PDF där hälften är
menyer och reklam. Det här är den enskilt största kvalitetshöjningen för läsning.
**Hur:** Kör `Runtime.evaluate` som klonar artikelns rot (`article`, `main` eller
heuristik på texttäthet) till en ny DOM, applicerar enkel bas-CSS (maxbredd, typsnitt,
mörkt läge) och skriver ut den klonen i en tillfällig flik eller via `document.write`
i en `about:blank`-flik. Alternativt: injicera `@media print`-regler som döljer allt
utanför artikeln innan `Page.printToPDF`.
**Filer:** ny `src/lib/reader.js` + val i `popup.js`/`options.js`.

### 2. ✅ Mörk PDF (nattutskrift)
**Vad:** En kryssruta "Mörk utskrift" som ger ljus text på mörk bakgrund.
**Varför:** För kvällsläsning på skärm och för att spara bläck när man skriver ut
mörka sidor.
**Hur:** `Runtime.evaluate` som lägger in `html { filter: invert(1) hue-rotate(180deg); }`
plus `printBackground: true` och vit text; bilder kan undantas med
`img, video, canvas { filter: invert(1) hue-rotate(180deg); }`. Läggs som eget val i
`settings.pdf` och nollställs i `finally` efter utskrift.
**Filer:** `src/lib/settings.js`, `src/background.js`, `src/options.html`.

### 3. ✅ Autoskala för breda sidor
**Vad:** Om sidan är bredare än pappersformatet beräknas skalan automatiskt så att
ingen tabell eller kolumn klipps av.
**Varför:** Dashboards och tabeller (ekonomisystem, Alldata) skrivs ofta ut med
avklippt högerkant.
**Hur:** `Runtime.evaluate` som returnerar `documentElement.scrollWidth`; räkna ut
`scale = min(1, (paperWidth - 2 * margin) / (scrollWidth / 96))` och skicka in i
`Page.printToPDF`. Ett val "Autoskala" (på som standard) bredvid skalanuvarvet.
**Filer:** `src/background.js` (`printParams`, `waitForPageReady`).

### 4. Per-sajt-profiler
**Vad:** Varje webbplats kan få egna överstyrningar: filnamnsmall, marginaler,
bakgrund, knappläge och artikel-/mörkt läge.
**Varför:** Man vill ofta olika saker med olika sajter – rapporter i landskap utan
bakgrund, kvitton med datum först, artiklar i artikelläge.
**Hur:** Utöka sajtobjektet med `overrides: { pdf?, file?, button? }` och slå ihop
globala inställningar med sajtens i `runSave`. Redigera i en utfällbar rad i
inställningarna, visa en liten "anpassad"-markering i listan.
**Filer:** `src/lib/settings.js`, `src/options.js`, `src/background.js`.

### 5. Spara flera flikar samtidigt
**Vad:** "Spara alla valda sajter i det här fönstret" – en kö som skriver ut flik för
flik med progress och sammanfattning.
**Varför:** Många öppnar fem rapporter, markerar dem och vill ha fem PDF:er.
**Hur:** `chrome.tabs.query({ currentWindow: true })`, filtrera på `matchesUrl`,
kör `runSave` sekventiellt (debugger per flik), visa `n av m` i badge och en
sammanfattning i panelen. Avbrytbar mellan flikar.
**Filer:** `src/background.js` (ny `runBatch`), `src/popup.html`.

### 6. Schemalagd arkivering
**Vad:** "Spara den här sidan varje dag/vecka" med `chrome.alarms` till vald mapp.
**Varför:** Prenumerationer, fakturor och rapporter som måste sparas löpande.
**Hur:** `chrome.alarms.create` med period, öppna URL i en inaktiv flik, vänta på
`document.readyState`, skriv ut, stäng fliken, döp filen med `{date}`. Kräver att
sajten inte kräver interaktiv inloggning mitt i; hantera 401/redirect snyggt.
**Filer:** ny `src/lib/schedule.js`, `src/background.js`, `src/options.html`.

### 7. Källrad i sidfoten
**Vad:** Valfri sidfot med `{title}`, `{url}` och `{date}` – "Hämtad från … 2026-11-05".
**Varför:** En PDF utan källa åldras fort; med URL och datum går den att spåra.
**Hur:** `displayHeaderFooter: true` och en `footerTemplate` med flexbox (samma stil
som sidnumret i dag). Lägg till tre kryssrutor: titel, URL, datum. Höj marginalen
automatiskt till minst 15 mm när sidfoten är på.
**Filer:** `src/background.js` (`printParams`), `src/options.html`.

### 8. Historiksida med miniatyrer och "spara igen"
**Vad:** En egen sida (eller utfällbar sektion) med de senaste PDF:erna: namn, sajt,
tid, "öppna", "visa i mapp", "spara igen" och "ta bort".
**Varför:** Historiken finns redan i `chrome.storage.local` men syns bara som en rad i
panelen. En lista gör den användbar.
**Hur:** Ny `src/history.html` + `history.js` som läser `getHistory()`; "spara igen"
öppnar URL:en i en ny flik och anropar samma flöde. Miniatyrer kan tas med
`chrome.tabs.captureVisibleTab` eller hoppas över i första versionen.
**Filer:** ny sida, `src/lib/settings.js` (historik-API).

### 9. ✅ Två snabbkommandon: med och utan spar-dialog
**Vad:** `Alt+Shift+P` (fråga var filen ska sparas) och `Alt+Shift+O` (spara tyst i
Hämtade filer), plus `Alt`-klick på den flytande knappen för att hoppa över dialogen.
**Varför:** Dialogen är rätt som standard men i vägen när man sparar tio PDF:er i rad.
**Hur:** Två poster i `commands` och en parameter till `runSave` som tillfälligt
överstyr `file.saveAs`. Knappen på sidan skickar `{ forceSaveAs: false }` när
`event.altKey` är satt.
**Filer:** `manifest.json`, `src/background.js`, `src/content.js`.

---

## B. Design och UX

### 10. Onboarding i tre steg
**Vad:** Första gången öppnas en välkomstsida: (1) välj språk, (2) lägg till första
sajten med ett klick, (3) "testa spara" på en demosida med förklaring av knappen.
**Varför:** I dag öppnas en tom inställningssida efter installation – lätt att gå
vilse innan man förstått vitlistan.
**Hur:** `options.html` får ett `?welcome=1`-läge med en guide ovanför korten, och
`onInstalled` öppnar den. Spara `hasOnboarded` i inställningarna.
**Filer:** `src/background.js`, `src/options.html/js`, `src/lib/i18n.js`.

### 11. Stegvis progress med avbryt
**Vad:** Panelen visar "Förbereder → Skriver ut → Sparar" med stegprickar i stället
för en enda snurra, och en Avbryt-knapp.
**Varför:** En PDF kan ta 2–5 sekunder på tunga sidor; tydlig progress minskar
dubbelklick och undran om något hängt sig.
**Hur:** Bakgrunden skickar `TOAST`/`PROGRESS`-meddelanden per steg. Avbryt sätter en
flagga som `runSave` kontrollerar före utskrift och som river debugger-sessionen.
**Filer:** `src/background.js`, `src/popup.js`, `src/content.js`.

### 12. Åtgärdbara felkort
**Vad:** Fel visas som ett kort med relevanta knappar: "Stäng DevTools", "Ladda om
sidan", "Försök igen", "Öppna inställningar".
**Varför:** I dag står det bara en mening; användaren får själv lista ut åtgärden.
**Hur:** Felkoden finns redan (`devtools`, `restricted`, `attach`, `canceled`). Mappa
kod → åtgärdsknappar i `popup.js`; "Ladda om sidan" = `chrome.tabs.reload`.
**Filer:** `src/popup.js`, `src/lib/i18n.js`.

### 13. Badge och utökad högerklicksmeny
**Vad:** Badge med antal sparade i dag, samt menyval: "Spara utan dialog",
"Lägg till/ta bort den här sajten", "Inställningar".
**Varför:** Snabbare väg än panelen, och en synlig påminnelse om att tillägget finns.
**Hur:** `chrome.action.setBadgeText` per flik (finns), räknare i `storage.local` som
nollställs vid datumbyte. Menyn byggs om när sajtlistan ändras.
**Filer:** `src/background.js`.

### 14. Sajtlistan: sök, sortering och bokmärkesimport
**Vad:** Sökfält över listan, drag-and-drop-ordning, samt "Importera från bokmärken".
**Varför:** Med 30+ sajter blir listan oöverskådlig, och de flesta har redan sajterna
som bokmärken.
**Hur:** `chrome.bookmarks.getTree()` (kräver `bookmarks`-behörighet, begärs valfritt)
och en enkel mappväljare. Sortering sparas som `sites[].order` eller array-ordning.
**Filer:** `src/options.js`, `manifest.json` (`optional_permissions`).

### 15. Mikroanimationer med motion-säkerhet
**Vad:** Mjuk utfällning av felkort, progressrad och listrader; allt avstängt när
`prefers-reduced-motion` är satt.
**Varför:** Små rörelser gör gränssnittet lättare att följa – om de används sparsamt.
**Hur:** `@keyframes` + `transition` med 120–180 ms, `animation` endast för progress;
befintliga reduced-motion-regler byggs ut till alla nya komponenter.
**Filer:** `src/ui.css`, `src/popup.css`, `src/options.css`.

---

## C. Tema

### 16. ✅ Tema: Auto / Ljust / Mörkt
**Vad:** Egen temaväxlare i inställningarna i stället för att bara följa systemet.
**Varför:** Många kör mörkt system men vill ha ljust tillägg (eller tvärtom), och det
går inte att styra i dag.
**Hur:** Sätt `data-theme="light|dark"` på `<html>`; byt `@media (prefers-color-scheme)`
mot `:root[data-theme="light"]` / `:root[data-theme="dark"]` med `auto` som fallback
via `matchMedia`. Lägg valet i `settings.theme` och applicera i både panel, options
och innehållsskriptets knapp (via `PAGE_CONTEXT`).
**Filer:** `src/ui.css`, `src/popup.js`, `src/options.js`, `src/content.js`.

### 17. Fyra accentpaletter med matchande appikon
**Vad:** Välj accentfärg – PDF-röd (nuvarande), grafit, hav och skog – och få
knappar, ikonchip och den flytande knappen i samma färg. Appikonen kan få en variant
per palett.
**Varför:** Personlig touch, och röd konkurrerar med sajternas egna varningar.
**Hur:** `--accent`-variabler per `data-accent`; generera ikon-PNG:er med `sharp`
från fyra SVG-varianter (samma `icon.svg`, olika gradient) och välj i manifestet –
eller behåll en ikon och byt bara UI-accenten.
**Filer:** `src/ui.css`, `icons/`, `src/options.html`.

### 18. Högkontrastläge
**Vad:** Extra tydliga fokusmarkeringar, starkare kanter och 4,5:1-kontrast överallt,
styrt av `prefers-contrast: more` och en manuell växel.
**Varför:** Tillgänglighet, och det gör gränssnittet lättare även i starkt ljus.
**Hur:** Variablerna i `ui.css` får en högkontrast-uppsättning; fokusringar blir
2 px heldragna i stället för mjuka skuggor.
**Filer:** `src/ui.css`.

---

## D. Typografi (font)

### 19. ✅ Bädda in variabel font lokalt
**Vad:** Byt från `"Segoe UI", system-ui …` till en inbäddad variabel font:
**Source Sans 3** (neutral, bra på små storlekar), **Inter** (skärmoptimerad) eller
**Atkinson Hyperlegible** (läsbarhet). Tecknen ligger som `woff2` i `fonts/`.
**Varför:** Windows/Brave renderar i dag Segoe UI, macOS och Linux något annat – samma
skärmbild ser olika ut. Inbäddad font ger identisk typografi och bättre siffror.
**Hur:** `@font-face { font-family: "Source Sans 3"; src: url("../fonts/source-sans-3-vf.woff2") format("woff2-variations"); font-weight: 200 900; font-display: swap; }`
i `ui.css`, subset till latin via `fonttools`, licens SIL OFL (får bäddas in).
Externa fonter skulle dessutom innebära ett nätverksanrop vid varje start – bädda
därför in filen i paketet och undvik tredjepartsanrop helt.
**Filer:** ny `fonts/`, `src/ui.css`.

### 20. ✅ Typografisk skala i rem
**Vad:** Definiera en skala – `--text-xs: .6875rem`, `--text-sm: .8125rem`,
`--text-base: .875rem`, `--text-lg: 1rem`, `--text-xl: 1.375rem` – med radhöjd 1,45
och `letter-spacing: -0.01em` på rubriker. Ersätt alla lösa px-värden.
**Varför:** I dag blandas 11, 11.5, 12, 12.5, 13, 13.5 och 15 px; en skala ger lugn
och gör det enkelt att införa "kompakt/comfortable".
**Hur:** Mappa om i `ui.css`, `popup.css`, `options.css`; lägg en `--scale`-faktor som
en inställning om man vill kunna zooma gränssnittet.
**Filer:** `src/*.css`.

### 21. Siffror, filnamn och monospace
**Vad:** `font-variant-numeric: tabular-nums` på tider, filstorlekar och sidnummer,
monospace **endast** för webbplatsmönster och filnamnsmall, och `font-feature-settings: "ss01"` där det passar.
**Varför:** I dag används monospace i förhandsvisningen och vanliga siffror i tid/
datum – det hoppar när värden byts.
**Hur:** Klasserna `.filename-value`, `.site-pattern`, `.preview code` får egna
`font-family`-/`font-variant`-regler; byt ut `ui-monospace`-stacken mot en
konsekvent (`"JetBrains Mono"` om den bäddas in, annars systemets).
**Filer:** `src/*.css`.

### 22. ✅ Språkmedveten textjustering
**Vad:** `text-wrap: balance` på rubriker, `text-wrap: pretty` i brödtexter,
`hyphens: auto` med `:lang(sv)`-regler och korrekt citattecken/typografi per språk.
**Varför:** Korta svenska och engelska rubriker radbryts ofta fult ("PDF-
inställningar" på egen rad), och långa beskrivningar får ensamma ord på sista raden.
**Hur:** Nya CSS-regler i `ui.css`; `:lang(sv) { quotes: "”" "”" "’" "’"; }` och
`hyphens: auto` kräver `lang`-attribut, som redan sätts av `applyI18n`.
**Filer:** `src/ui.css`, `src/lib/i18n.js`.

---

## E. Kod och kvalitet

### 23. Dela upp `background.js` i moduler med JSDoc
**Vad:** Splitta de ~600 raderna i `printer.js` (debugger + printToPDF), `downloads.js`
(blob/offscreen/data-URL), `permissions.js` (värdåtkomst), `menu.js` och
`messaging.js`, med JSDoc-typer på alla publika funktioner.
**Varför:** Lättare att testa varje del, och `printParams`/`downloadPdf` blir
återanvändbara för batch, schemaläggning och historik.
**Hur:** Ren utflyttning utan beteendeändring; `background.js` blir en tunn
händelsemotor som registrerar lyssnare.
**Filer:** `src/background.js` + nya moduler.

### 24. Tester och CI i repot
**Vad:** Flytta in de simulerade flödestesterna som i dag körs manuellt: en liten
chrome-mock (`tests/helpers/chrome.js`), tester för sparaflödet, offscreen-hjälparen
och popup/options i jsdom, plus GitHub Actions som kör `npm test`, `npm run check`,
validerar manifestet och bygger en zip som artefakt.
**Varför:** Just nu skyddas bara rena funktioner av tester; hela sparflödet kan gå
sönder utan att något larmar.
**Hur:** `node:test` + `jsdom` som dev-beroende, `npm run test:dom`, workflow med
`actions/checkout`, `setup-node`, `npm ci`, `npm test`, `zip -r sida-till-pdf.zip`.
**Filer:** `tests/`, `.github/workflows/ci.yml`, `package.json`.

### 25. Lint/format, säkrare meddelanden och färre behörigheter
**Vad:** ESLint + Prettier med `npm run lint`, `sender.id`-kontroll i
meddelandehanteraren, validering av alla inkommande meddelanden och en genomgång av
behörigheterna (`tabs`/`bookmarks` endast som valfria, `debugger` dokumenterad).
**Varför:** Konsekvent stil, färre tysta fel, och en tydligare integritetsprofil –
viktigt eftersom tillägget ber om `debugger`.
**Hur:** `eslint.config.js` (flat config) med `no-restricted-globals` för `innerHTML`
där det inte behövs, `chrome.runtime.onMessage` som släpper igenom endast kända
`type`-värden från egen extension, och en permissions-tabell i README som hålls
uppdaterad.
**Filer:** `eslint.config.js`, `src/background.js`, `README.md`.

---

## Föreslaget startpaket (snabbvinster först)

1. **#16 Tema Auto/Ljust/Mörkt** – liten ändring, stor upplevd kontroll.
2. **#20 + #21 Typografisk skala och siffror** – städar hela gränssnittet.
3. **#19 Inbäddad font** – jämn rendering på Windows/Brave.
4. **#3 Autoskala** – löser konkreta avklippta tabeller.
5. **#7 Källrad i sidfoten** – PDF:er som går att spåra.
6. **#9 Två snabbkommandon** – snabbare upprepade sparningar.
7. **#12 Åtgärdbara felkort** – färre frågor vid fel.
8. **#24 Tester/CI** – skyddar allt ovanstående.

Därefter de tyngre men mest värdefulla: **#1 Artikelläge**, **#4 Per-sajt-profiler**
och **#8 Historiksida**.
