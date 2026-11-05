# Sida till PDF

Webbläsartillägg för **Chrome** och **Brave** som sparar sidor från de webbplatser du själv väljer som PDF – med ett enda klick.

Inget skickas till någon server: PDF:en skapas lokalt av webbläsarens egen utskriftsmotor.

---

## Funktioner

| Funktion | Beskrivning |
| --- | --- |
| **Valda webbplatser** | PDF-funktionen är bara aktiv på de sajter du lägger till i listan. Övriga sajter lämnas ifred. |
| **Knapp på sidan** | En liten flytande PDF-knapp längst ner på valda sidor. Ett klick = en PDF. Placering och synlighet går att ställa in. |
| **Knapp i verktygsfältet** | Visar status för aktuell flik och sparar sidan. Om sajten inte är vald läggs den till direkt. |
| **Snabbtangenter** | `Alt+Shift+P` sparar aktuell sida med spar-dialog, `Alt+Shift+O` sparar tyst i Hämtade filer. **Alt-klick** på sidknappen sparar också utan dialog. |
| **Artikelläge** | Skriver bara ut artikelns innehåll – nav, banners, reklam och kommentarer rensas bort innan PDF:en skapas. |
| **Mörk utskrift** | Ljus text på mörk bakgrund, för kvällsläsning och skärm. |
| **Autoskala** | Sidor med breda tabeller krymps automatiskt så att inget klipps av. |
| **Källrad i sidfoten** | Sidans titel, webbadress och/eller datum längst ner på varje sida. |
| **Tema** | Automatiskt, ljust eller mörkt – oberoende av systemets inställning. |
| **Typografi** | Inbäddat Inter-typsnitt, gemensam textskala och jämna siffror i filnamn och tider. |
| **Högerklicksmeny** | ”Spara sidan som PDF” på valda sidor. |
| **Ren utskrift** | Vit bakgrund, A4, inga sidhuvuden/sidofot och anpassade marginaler. Allt går att ändra. |
| **Välj mapp** | Som standard öppnas webbläsarens spar-dialog, där du väljer mapp och kan ändra filnamnet. Stäng av det i panelen om du hellre vill spara tyst i Hämtade filer. |
| **Visa i mapp** | Efter sparning finns **Visa i mapp** och **Öppna PDF** i panelen, så du hamnar direkt i mappen du valde. |
| **Filnamn och mappar** | Filerna döps efter sidtiteln: `Sidor/<sajt>/<titel>.pdf`. Otillåtna tecken tas bort automatiskt. Mall och underkatalog går att ändra. |
| **Svenska / engelska** | Välj språk i inställningarna, eller låt webbläsarens språk styra. |
| **Enhetliga ikoner** | Egen appikon, samma linjeikoner i panelen, inställningarna, sidknappen och i toast-meddelandena. |
| **Import/export** | Hela inställningsfilen kan exporteras och importeras som JSON. |

---

## Installation

### Chrome

1. Ladda ner eller kopiera mappen `browser-extension` till datorn.
2. Öppna `chrome://extensions`.
3. Slå på **Utvecklarläge** uppe till höger.
4. Klicka på **Läs in opackat** och välj mappen `browser-extension` (mappen som innehåller `manifest.json`).
5. Tillägget dyker upp i verktygsfältet – gärna fäst det med nål-ikonen.

### Brave

Samma sak, men öppna `brave://extensions` i steg 2. Brave använder samma tilläggsmotor som Chrome.

Efter installationen öppnas inställningssidan automatiskt. Där lägger du till de webbplatser som ska få sparas.

> Tillägget laddas som ”opackat” och uppdateras inte automatiskt. Uppdatera genom att klicka på uppdateringsikonen för tillägget på `chrome://extensions`.

---

## Använda tillägget

1. **Lägg till en webbplats** – klicka på tilläggets ikon när du står på sidan och välj **Lägg till … och spara**. Du kan också skriva adressen direkt i inställningarna, t.ex. `aftonbladet.se`, `*.example.com` eller `example.com/nyheter`.
2. **Bevilja åtkomst** när webbläsaren frågar. Det behövs för att den flytande knappen ska kunna visas på just den sajten. Utan åtkomst fungerar fortfarande verktygsfältets knapp och snabbtangenten.
3. **Klicka på PDF-knappen** som dyker upp längst ner på sidan. Panelen visar innan du klickar vilket **filnamn** filen får, och därefter öppnas spar-dialogen där du väljer mapp (mappen `Sidor/<sajt>` och titelnamnet är förvalt).
4. Efter sparning visas **Visa i mapp** och **Öppna PDF** – ett klick och du står i rätt mapp, även om du valde en helt annan mapp i dialogen.
   Vill du slippa dialogen stänger du av **Fråga var filen ska sparas** i panelen – då hamnar filen direkt i Hämtade filer. Samma sak gör **Alt-klick** på sidknappen eller snabbtangenten `Alt+Shift+O`, utan att du ändrar inställningen.

### Mönster

| Mönster | Matchar |
| --- | --- |
| `example.com` | Endast `example.com` |
| `*.example.com` | `example.com` och alla subdomäner, t.ex. `www.example.com` |
| `example.com/nyheter` | Bara sidor under `/nyheter` |
| `localhost:3000` | Lokal utveckling |

Protokoll (`https://`) och avslutande snedstreck spelar ingen roll.

---

## Inställningar

Inställningssidan öppnas via kugghjulet i panelen eller via `chrome://extensions` → **Information** → **Tilläggsalternativ**.

- **Valda webbplatser** – lista, på/av, åtkomst och borttagning.
- **Knapp på sidan** – visa/dölj och placering (fyra hörn).
- **PDF** – pappersformat (A4/Letter/Legal/A3), marginal, skala, bakgrundsfärger, sidhuvud med sidnummer, CSS `@page` och väntetid före utskrift.
  - **Artikelläge** rensar bort nav, banners och reklam och skriver bara ut artikelns text. Hittas ingen artikel sparas hela sidan, och panelen säger till.
  - **Autoskala** (på som standard) mäter hur bred sidan blir mot pappersbredden och krymper den vid behov.
  - **Mörk utskrift** vänder sidans färger så att texten blir ljus på mörk bakgrund.
  - **Sidfot** med titel, webbadress och datum – välj delar med tre växlar. Marginalen utökas automatiskt så att raden får plats.
- **Filnamn** – underkatalog, mall med taggarna `{site} {title} {date} {time} {year} {month} {day}`, egen mapp per sajt och **Fråga var filen ska sparas** (på som standard). Standardmallen är `{title}`; vill du ha datum före titeln använder du `{date}_{title}`.

**Fråga var filen ska sparas** styr om webbläsarens spar-dialog öppnas:

| Inställning | Resultat |
| --- | --- |
| På (standard) | Du väljer mapp och kan ändra namnet varje gång. Underkatalogen och titelnamnet är förvalt, och webbläsaren minns senast använda mapp. |
| Av | Filen sparas direkt i Hämtade filer, i underkatalogen `Sidor/<sajt>/`. |
- **Allmänt** – tema (automatiskt/ljust/mörkt), språk, tillåt alla webbplatser, snabbtangenter, import/export och återställning.

Inställningarna sparas lokalt i webbläsaren. Använd **Exportera** om du vill säkerhetskopiera eller flytta dem till en annan dator.

---

## Behörigheter – och varför

| Behörighet | Används till |
| --- | --- |
| `debugger` | Anrop till webbläsarens DevTools-protokoll (`Page.printToPDF`) för att skapa PDF:en. Krävs för att kunna spara utan utskriftsdialog. |
| `downloads` | Sparar den färdiga PDF-filen i Hämtade filer. |
| `storage` | Inställningar och webbplatslista, sparas lokalt i webbläsaren. |
| `scripting` + valfri värdåtkomst | Registrerar den flytande knappen – bara på sajter du uttryckligen beviljat. |
| `activeTab` | Läser aktuell fliks adress när du klickar på tillägget. |
| `contextMenus` | Högerklicksvalet ”Spara sidan som PDF”. |
| `offscreen` | Gör om PDF:en till en blob så att filer över 2 MB sparas hela (data-URL:er klipps annars av). |

Ingen kod körs på sajter du inte har valt, och inga data lämnar datorn.

---

### Filnamn

Filnamnet byggs av flikens titel. Tecken som inte får finnas i filnamn
(`< > : " / \ | ? *`) tas bort, blanksteg städas och filen får ändelsen `.pdf`:

| Sidtitel | Filnamn |
| --- | --- |
| `removing - refitting : multifunction video camera` | `removing - refitting multifunction video camera.pdf` |
| `FAQ: Vanliga/Frågor?` | `FAQ VanligaFrågor.pdf` |

Reserverade namn som `CON` och `NUL` får ett understreck framför, och blir titeln
bara tecken som rensas bort används `sida.pdf`.

---

## Så skapas PDF:en

1. Bakgrundstjänsten kopplar upp sig mot fliken via DevTools-protokollet.
2. Den väntar på att teckensnitt och bilder ska bli klara (och på den väntetid du ställt in).
3. `Page.printToPDF` renderar sidan med dina inställningar – samma motor som Ctrl+P, men helt utan dialogruta.
4. PDF:en skickas till nedladdningshanteraren med automatiskt filnamn.

Medan tillägget skapar PDF:en visas en liten informationsrad i webbläsaren: *”Sida till PDF började felsöka den här webbläsaren”*. Den försvinner när utskriften är klar.

---

## Felsökning

| Problem | Lösning |
| --- | --- |
| ”Stäng DevTools för fliken och försök igen.” | DevTools får bara ha en felsökare per flik. Stäng DevTools-panelen och klicka igen. |
| Interna sidor kan inte sparas | `chrome://`, `brave://`, webbutiken och nya flikar kan inte skrivas ut. |
| Ingen PDF-knapp på sidan | Kontrollera att sajten är **aktiv** i listan och att **Åtkomst beviljad** står vid den. Ladda om sidan efteråt. |
| Ingen spar-dialog dyker upp | Slå på **Fråga var filen ska sparas** i panelen eller i inställningarna. |
| Filen sparas inte | Kontrollera webbläsarens nedladdningsinställningar och att mappen du valde är skrivbar. |
| Fel mapp föreslås i dialogen | Webbläsaren minns senast använda mapp – navigera till rätt mapp, den används nästa gång. |
| Ingenting händer vid klick | Ladda om tillägget på `chrome://extensions` efter en uppdatering av filerna. |
| Artikelläget sparar hela sidan | Sidan saknar en tydlig artikel (t.ex. en startsida eller ett formulär). Stäng av **Artikelläge** om du vill ha hela sidan utan att panelen säger till. |
| Mörk utskrift ser konstig ut | Sidor som redan är mörka inverteras också. Stäng av **Mörk utskrift** för sådana sajter. |
| Sidan blir mindre än väntat | **Autoskala** krymper breda sidor. Stäng av den och sätt skalan manuellt i stället. |
| Texten ser annorlunda ut än tidigare | Typsnittet Inter följer nu med tillägget. Det ger samma utseende på Windows, macOS och Linux. |

---

## Utveckling

```
browser-extension/
├── manifest.json
├── icons/                  # appikon: icon.svg (+ förenklad icon16.svg) och PNG 16/32/48/128
├── fonts/                  # Inter (variabel, latin) + OFL-licens
├── src/
│   ├── background.js       # service worker: PDF, behörigheter, meny, badge, artikelläge
│   ├── content.js          # flytande knapp + toast (klassiskt skript)
│   ├── theme-init.js       # sätter rätt tema före första målningen
│   ├── reader.html/.css/.js # tillfällig artikelsida som skrivs ut i artikelläget
│   ├── popup.html/.css/.js # panelen i verktygsfältet
│   ├── options.html/.css/.js
│   ├── ui.css              # delad design, typografisk skala och teman
│   └── lib/
│       ├── sites.js        # mönstermatchning (ren modul)
│       ├── filename.js     # filnamn (ren modul)
│       ├── print.js        # utskriftsparametrar, sidfot, autoskala (ren modul)
│       ├── theme.js        # auto/ljust/mörkt
│       ├── i18n.js         # svenska/engelska
│       └── settings.js     # storage + standardvärden
├── tests/                  # node:test
└── package.json
```

```bash
cd browser-extension
npm test        # 40 tester för mönster, filnamn, utskrift, tema och översättningar
npm run check   # syntaxkontroll av alla skript
```

Aktuell version: **1.4.0**.

Se **[FORBATTRINGAR.md](FORBATTRINGAR.md)** för 25 förslag på förbättringar inom
funktion, design, tema, typografi och kod – nio av dem är genomförda i 1.4.0.

Ändringar slår igenom efter **Ladda om** på `chrome://extensions`. Innehållsskriptet på redan öppna flikar uppdateras när du laddar om sidan.

### Kända begränsningar

- Endast `http`/`https` kan sparas.
- DevTools får inte vara öppet i fliken som sparas.
- Mycket stora sidor kan ta några sekunder extra; höj **Väntetid före utskrift** om lazy-laddat innehåll saknas.
- Artikelläget bygger på en enkel innehållsanalys. Sidor utan artikelstruktur (startsidor, appar, formulär) sparas som helhet.
- Mörk utskrift vänder färgerna med ett CSS-filter. På sidor som redan är mörka kan resultatet bli ljust i stället.
- Någon “fast sparmapp” utan dialog finns inte: Brave har File System Access-API:et bakom en flagga, så tillägget använder webbläsarens egen spar-dialog (som minns mappen) i stället.
- Tillägget är inte signerat – det installeras som opackat och kräver utvecklarläge.
