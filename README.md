<p align="center">
  <img src="icons/brand-logo.svg" width="420" alt="Sida till PDF — save web pages simply and locally">
</p>

<p align="center"><a href="#svenska">Svenska</a> · <a href="#english">English</a></p>

---

## Svenska

**Sida till PDF** sparar webbsidor som PDF i Brave och Chrome. PDF-filer skapas lokalt i webbläsaren; sidinnehåll skickas inte till någon server.

### Installera

1. Öppna den senaste GitHub-releasen och packa upp dess **Source code (zip)**. Den innehåller både tillägget och trycklogotypen.
2. Öppna `brave://extensions` i Brave eller `chrome://extensions` i Chrome.
3. Slå på **Utvecklarläge**.
4. Klicka på **Läs in opackat** och välj projektmappen som innehåller `manifest.json`.
5. Fäst tillägget i verktygsfältet om du vill.

### Plattformar

Tillägget är OS-oberoende och avsett för Windows, macOS och Linux i Chromium-baserade Brave/Chrome-versioner som uppfyller manifestets Chromium 116-krav. Filväljare och minne av sparmappar beror på webbläsarens API-stöd; webbläsarens egen sparruta används som reserv. Ett webbläsartillägg kan inte minimera eller stänga sig till operativsystemets systemfält (systray). Riktig testning på alla operativsystem återstår.

### Använda tillägget

- Vänsterklicka på tilläggsikonen för att spara aktuell sida som PDF. Du behöver inte lägga till webbplatsen först; tillägget frågar om platsen där filen ska sparas.
- Högerklicka på tilläggsikonen och välj **Inställningar** för att ändra inställningar.
- Lägg till en webbplats endast om du vill visa den flytande PDF-knappen på sidan.
- Högerklicka på markerad text för att spara bara texten, eller välj **Välj område att spara som PDF** och klicka på ett område.
- I panelen kan du välja sidintervall, till exempel `1-3, 5`. Lämna tomt för alla sidor.

### Funktioner

- A4 med stående sidor och egna liggande sidor för breda tabeller; långa sidor fortsätter över flera ark.
- PDF-bokmärken, valbar innehållsförteckning från rubriker och förbättrade sidbrytningar.
- Valbar lokal analys tar bort nästan tomma PDF-sidor.
- Valbart artikelläge, mörk utskrift, vattenstämpel och optimering av stora bilder.
- PDF-profiler per webbplats, val för filnamnskrockar och diagnostik av sparstödet.
- Välj en sparmapp i inställningarna för att använda den som startmapp. Dialogen minns även senast valda mapp; stäng av dialogen om du vill spara direkt i den inställda mappen. Inga undermappar skapas.
- Förhandsgranska artikelurvalet före sparning; PDF-inställningarna har också en ungefärlig live-skiss.
- Valbar rullning genom sidan försöker ladda innehåll som annars visas först när man scrollar.
- Välj kompakt eller rymlig layout. Snabbtangenter visas i en dialog och ändras via webbläsarens genvägsinställningar.
- Ny sid- och nedladdningsikon samt tryckfärdig SVG-logotyp med text omvandlad till vektorbanor. Logotypen ingår i releasens käll-ZIP och laddas inte ner separat.
- Svenska och engelska, ljust/mörkt tema och snabbtangenter.

### Integritet och uppdateringar

Utskrift och inställningar hanteras lokalt. Tillägget begär webbplatsåtkomst när det behövs för sidknappen eller innehållsväljaren. Uppdatera manuellt genom att söka efter GitHub-uppdateringar i tillägget, hämta release-ZIP-filen och läsa in de uppdaterade filerna från samma mapp.

---

## English

**Sida till PDF** saves web pages as PDFs in Brave and Chrome. PDFs are created locally in your browser; page content is not sent to a server.

### Install

1. Open the latest GitHub release and extract its **Source code (zip)**. It includes both the extension and the print-ready logo.
2. Open `brave://extensions` in Brave or `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the project folder containing `manifest.json`.
5. Pin the extension to the toolbar if you like.

### Platforms

The extension is OS-independent and intended for Windows, macOS, and Linux in Chromium-based Brave/Chrome versions that meet the manifest's Chromium 116 baseline. File pickers and remembered folders depend on browser API support; the browser's own save dialog is the fallback. A browser extension cannot minimize or close itself to the operating system's system tray. Real testing on every operating system is still outstanding.

### Use

- Left-click the extension icon to save the current page as a PDF. You do not need to add the site first; the extension asks where to save the file.
- Right-click the extension icon and choose **Settings** to change settings.
- Add a website only if you want the floating PDF button to appear on that site.
- Right-click selected text to save just that text, or choose **Choose an area to save as PDF** and click an area on the page.
- Enter a page range in the panel, for example `1-3, 5`. Leave it blank to include every page.

### Features

- A4 portrait pages with separate landscape pages for wide tables; long pages continue across multiple sheets.
- PDF bookmarks, an optional table of contents from headings, and improved page breaks.
- Optional local analysis removes nearly empty PDF pages.
- Optional article mode, dark printing, watermark, and large-image optimization.
- Per-site PDF profiles, filename-collision choices, and save-support diagnostics.
- Choose a folder in Settings to use it as the starting folder. The dialog also remembers the most recently selected folder; turn the dialog off to save directly in the configured folder. No subfolders are created.
- Preview the extracted article before saving; PDF settings also include an approximate live sketch.
- Optional page scrolling attempts to load content that appears only after scrolling.
- Choose a compact or spacious layout. Keyboard shortcuts are listed in a dialog and changed through the browser's shortcut settings.
- A redesigned page-and-download icon and a print-ready SVG logo with the wordmark converted to vector paths. The logo is included in the release source ZIP; there is no separate download.
- Swedish and English, light/dark themes, and keyboard shortcuts.

### Privacy and updates

Printing and settings are handled locally. The extension requests website access when needed for the on-page button or content picker. To update manually, check for GitHub updates in the extension, download the release ZIP, and reload the updated files from the same folder.
