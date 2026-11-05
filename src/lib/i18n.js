/**
 * Tvåspråkigt gränssnitt (svenska/engelska).
 * Ingen chrome-beroende kod – kan testas med Node.
 */

export const STRINGS = {
  sv: {
    appName: 'Sida till PDF',
    appTagline: 'Spara valda sidor som PDF',

    'menu.savePdf': 'Spara sidan som PDF',

    'popup.subtitle': 'Valda webbplatser, ett klick',
    'popup.status.selected': 'Vald webbplats',
    'popup.status.allSites': 'Tillåten (alla sajter)',
    'popup.status.notSelected': 'Inte vald',
    'popup.status.internal': 'Kan inte sparas',
    'popup.hint.selected': 'Klicka för att spara sidan som PDF.',
    'popup.hint.notSelected': 'Lägg till webbplatsen för att kunna spara den som PDF.',
    'popup.hint.addNoAccess': 'PDF:en sparas, men knappen på sidan kräver åtkomst till webbplatsen.',
    'popup.hint.internal': 'Interna sidor som chrome:// och brave:// kan inte sparas.',
    'popup.save': 'Spara som PDF',
    'popup.saving': 'Skapar PDF …',
    'popup.saved': 'PDF sparad',
    'popup.addAndSave': 'Lägg till {site} och spara',
    'popup.enableSite': 'Aktivera {site}',
    'popup.removeSite': 'Ta bort {site} från listan',
    'popup.saveAs': 'Fråga var filen ska sparas',
    'popup.saveAsHint': 'Du väljer mapp i webbläsarens dialog.',
    'popup.saveAsHintOn': 'Du väljer mapp i dialogen – webbläsaren minns senaste mappen.',
    'popup.saveAsHintOff': 'Sparas direkt i Hämtade filer.',
    'popup.filename': 'Filnamn',
    'popup.openPdf': 'Öppna PDF',
    'popup.showInFolder': 'Visa i mapp',
    'popup.savedTo': 'Sparad i {folder}',
    'popup.lastSaved': 'Senast sparad',
    'popup.neverSaved': 'Ingen PDF sparad än',
    'popup.settings': 'Inställningar',
    'popup.shortcut': 'Snabbtangent: {shortcut}',
    'popup.noShortcut': 'Ingen snabbtangent angiven',
    'popup.openPage': 'Öppna en vanlig webbsida först.',
    'popup.readerFallback': 'Artikelläget hittade ingen artikel – hela sidan sparades.',

    'options.title': 'Inställningar',
    'options.subtitle': 'Välj vilka webbplatser som får sparas som PDF.',
    'options.sites.title': 'Valda webbplatser',
    'options.sites.desc':
      'PDF-knappen fungerar bara på de webbplatser du lägger till här. Använd *.example.com för att täcka alla subdomäner.',
    'options.sites.placeholder': 't.ex. aftonbladet.se eller *.example.com/nyheter',
    'options.sites.add': 'Lägg till',
    'options.sites.empty': 'Inga webbplatser tillagda än. Lägg till en adress ovan.',
    'options.sites.noAccess': 'Åtkomst saknas',
    'options.sites.hasAccess': 'Åtkomst beviljad',
    'options.sites.grant': 'Ge åtkomst',
    'options.sites.off': 'Avstängd',
    'options.sites.remove': 'Ta bort',
    'options.sites.enable': 'Aktiv',
    'options.sites.invalid': 'Ange en giltig adress, t.ex. aftonbladet.se.',
    'options.sites.duplicate': 'Webbplatsen finns redan i listan.',
    'options.sites.added': '{site} tillagd.',
    'options.sites.removed': '{site} borttagen.',
    'options.sites.count': '{n} webbplatser',
    'options.sites.countOne': '1 webbplats',
    'options.sites.countNone': 'Inga webbplatser',
    'options.sites.granted': 'Åtkomst beviljad för {site}.',
    'options.sites.denied': 'Åtkomst nekades för {site}. PDF-knappen på sidan fungerar då inte.',

    'options.button.title': 'Knapp på sidan',
    'options.button.show': 'Visa PDF-knapp på valda sidor',
    'options.button.desc': 'En liten flytande knapp längst ner på sidan – ett klick sparar PDF:en.',
    'options.button.position': 'Placering',
    'options.button.br': 'Nere till höger',
    'options.button.bl': 'Nere till vänster',
    'options.button.tr': 'Uppe till höger',
    'options.button.tl': 'Uppe till vänster',

    'options.pdf.title': 'PDF-inställningar',
    'options.pdf.desc': 'Standard är en ren utskrift: vit bakgrund, A4 och inga sidhuvuden.',
    'options.pdf.format': 'Pappersformat',
    'options.pdf.margin': 'Marginal (mm)',
    'options.pdf.scale': 'Skala (%)',
    'options.pdf.background': 'Skriv ut bakgrundsfärger och bilder',
    'options.pdf.header': 'Sidhuvud och sidofot med sidnummer',
    'options.pdf.cssPage': 'Följ sidans egen utskriftsstorlek (CSS @page)',
    'options.pdf.wait': 'Väntetid före utskrift (ms)',
    'options.pdf.waitHint': 'Högre värde ger lazy-laddat innehåll tid att dyka upp.',
    'options.pdf.reader': 'Artikelläge – spara bara artikelns text',
    'options.pdf.readerHint':
      'Nav, banners och reklam tas bort. Hittas ingen artikel sparas hela sidan.',
    'options.pdf.dark': 'Mörk utskrift (ljus text på mörk bakgrund)',
    'options.pdf.autoScale': 'Autoskala breda sidor',
    'options.pdf.autoScaleHint': 'Krymper sidan så att breda tabeller inte klipps av.',
    'options.pdf.footerTitle': 'Sidfot: sidans titel',
    'options.pdf.footerUrl': 'Sidfot: webbadress',
    'options.pdf.footerDate': 'Sidfot: datum',
    'options.pdf.footerHint': 'Källraden hamnar längst ner på varje sida.',
    'options.pdf.reset': 'Återställ PDF-inställningar',

    'options.file.title': 'Filnamn och sparplats',
    'options.file.desc': 'Filerna hamnar i webbläsarens mapp för hämtade filer.',
    'options.file.folder': 'Underkatalog',
    'options.file.template': 'Filnamnsmall',
    'options.file.templateHint':
      'Taggar: {site} {title} {date} {time} {year} {month} {day}. Standard är sidtiteln.',
    'options.file.perSiteFolder': 'Egen undermapp per webbplats',
    'options.file.saveAs': 'Fråga var filen ska sparas varje gång',
    'options.file.saveAsHint': 'Av: filen hamnar direkt i Hämtade filer (med underkatalogerna ovan).',
    'options.file.saveAsHintOn':
      'På: du väljer mapp och kan ändra namnet i webbläsarens dialog. Webbläsaren minns senast använda mapp.',
    'options.file.preview': 'Exempel',
    'options.file.sampleTitle': 'Exempel på sidtitel',

    'options.general.title': 'Allmänt',
    'options.general.language': 'Språk',
    'options.general.languageAuto': 'Automatisk',
    'options.general.languageSv': 'Svenska',
    'options.general.languageEn': 'English',
    'options.general.theme': 'Theme',
    'options.general.themeAuto': 'Automatic (follow system)',
    'options.general.themeLight': 'Light',
    'options.general.themeDark': 'Dark',
    'options.general.theme': 'Tema',
    'options.general.themeAuto': 'Automatiskt (följ systemet)',
    'options.general.themeLight': 'Ljust',
    'options.general.themeDark': 'Mörkt',
    'options.general.allowAll': 'Tillåt alla webbplatser',
    'options.general.allowAllHint': 'När det är av fungerar PDF-knappen bara på listan ovan.',
    'options.general.shortcut': 'Snabbtangent',
    'options.general.shortcutValue': 'Aktuell: {shortcut}',
    'options.general.shortcutValueBoth': 'Med dialog: {main} · Tyst: {quiet}',
    'options.general.shortcutChange': 'Ändra snabbtangent',
    'options.general.shortcutHint': 'Öppnas i webbläsarens egen sida för tangentbordsgenvägar.',
    'options.general.data': 'Inställningsfil',
    'options.general.export': 'Exportera',
    'options.general.import': 'Importera',
    'options.general.imported': 'Inställningarna importerades.',
    'options.general.importFailed': 'Filen kunde inte läsas som en giltig inställningsfil.',
    'options.general.reset': 'Återställ allt',
    'options.general.resetConfirm': 'Återställ alla inställningar och töm webbplatslistan?',
    'options.general.resetDone': 'Allt är återställt.',
    'options.general.saved': 'Sparat',

    'options.footer.note': 'PDF:er skapas lokalt i webbläsaren. Inga sidor skickas någonstans.',

    'errors.restricted': 'Interna sidor och webbläsarsidor kan inte sparas som PDF.',
    'errors.canceled': 'Sparandet avbröts – ingen fil skapades.',
    'errors.devtools': 'Stäng DevTools för fliken och försök igen.',
    'errors.attach': 'Kunde inte ansluta till fliken. Ladda om sidan och försök igen.',
    'errors.print': 'Kunde inte skapa PDF:en.',
    'errors.download': 'PDF:en skapades men kunde inte sparas.',
    'errors.notAllowed': 'Webbplatsen är inte vald. Lägg till den först.',
    'errors.noTab': 'Hittade ingen aktiv flik.',
    'errors.busy': 'En PDF skapas redan för den här fliken.',
    'errors.unexpected': 'Något gick fel. Försök igen.',

    'content.button': 'Spara som PDF',
    'content.buttonShort': 'PDF',
    'content.altHint': 'Alt+click: save without dialog',
    'content.altHint': 'Alt+klick: spara utan dialog',
    'toast.saving': 'Skapar PDF …',
    'toast.saved': 'PDF sparad: {file}'
  },

  en: {
    appName: 'Page to PDF',
    appTagline: 'Save selected pages as PDF',

    'menu.savePdf': 'Save page as PDF',

    'popup.subtitle': 'Selected sites, one click',
    'popup.status.selected': 'Selected site',
    'popup.status.allSites': 'Allowed (all sites)',
    'popup.status.notSelected': 'Not selected',
    'popup.status.internal': 'Cannot be saved',
    'popup.hint.selected': 'Click to save this page as PDF.',
    'popup.hint.notSelected': 'Add this website to save it as PDF.',
    'popup.hint.addNoAccess': 'The PDF is saved, but the on-page button needs access to the site.',
    'popup.hint.internal': 'Internal pages like chrome:// and brave:// cannot be saved.',
    'popup.save': 'Save as PDF',
    'popup.saving': 'Creating PDF …',
    'popup.saved': 'PDF saved',
    'popup.addAndSave': 'Add {site} and save',
    'popup.enableSite': 'Enable {site}',
    'popup.removeSite': 'Remove {site} from list',
    'popup.saveAs': 'Ask where to save the file',
    'popup.saveAsHint': 'Pick a folder in the browser dialog.',
    'popup.saveAsHintOn': 'Pick a folder in the dialog – the browser remembers the last one.',
    'popup.saveAsHintOff': 'Goes straight to Downloads.',
    'popup.filename': 'File name',
    'popup.openPdf': 'Open PDF',
    'popup.showInFolder': 'Show in folder',
    'popup.savedTo': 'Saved in {folder}',
    'popup.lastSaved': 'Last saved',
    'popup.neverSaved': 'No PDF saved yet',
    'popup.settings': 'Settings',
    'popup.shortcut': 'Shortcut: {shortcut}',
    'popup.noShortcut': 'No shortcut set',
    'popup.openPage': 'Open a regular web page first.',
    'popup.readerFallback': 'The article mode found no article – the whole page was saved.',

    'options.title': 'Settings',
    'options.subtitle': 'Choose which websites may be saved as PDF.',
    'options.sites.title': 'Selected websites',
    'options.sites.desc':
      'The PDF button only works on the websites you add here. Use *.example.com to cover all subdomains.',
    'options.sites.placeholder': 'e.g. example.com or *.example.com/news',
    'options.sites.add': 'Add',
    'options.sites.empty': 'No websites added yet. Add an address above.',
    'options.sites.noAccess': 'No access',
    'options.sites.hasAccess': 'Access granted',
    'options.sites.grant': 'Grant access',
    'options.sites.off': 'Disabled',
    'options.sites.remove': 'Remove',
    'options.sites.enable': 'Enabled',
    'options.sites.invalid': 'Enter a valid address, e.g. example.com.',
    'options.sites.duplicate': 'That website is already in the list.',
    'options.sites.added': '{site} added.',
    'options.sites.removed': '{site} removed.',
    'options.sites.count': '{n} websites',
    'options.sites.countOne': '1 website',
    'options.sites.countNone': 'No websites',
    'options.sites.granted': 'Access granted for {site}.',
    'options.sites.denied': 'Access denied for {site}. The on-page button will not work.',

    'options.button.title': 'On-page button',
    'options.button.show': 'Show the PDF button on selected pages',
    'options.button.desc': 'A small floating button in the corner of the page – one click saves the PDF.',
    'options.button.position': 'Position',
    'options.button.br': 'Bottom right',
    'options.button.bl': 'Bottom left',
    'options.button.tr': 'Top right',
    'options.button.tl': 'Top left',

    'options.pdf.title': 'PDF settings',
    'options.pdf.desc': 'The default is a clean print: white background, A4 and no headers.',
    'options.pdf.format': 'Paper size',
    'options.pdf.margin': 'Margin (mm)',
    'options.pdf.scale': 'Scale (%)',
    'options.pdf.background': 'Print background colours and images',
    'options.pdf.header': 'Header and footer with page numbers',
    'options.pdf.cssPage': "Follow the page's own print size (CSS @page)",
    'options.pdf.wait': 'Wait before printing (ms)',
    'options.pdf.waitHint': 'A higher value gives lazy-loaded content time to appear.',
    'options.pdf.reader': 'Article mode – save only the article text',
    'options.pdf.readerHint':
      'Nav, banners and ads are removed. If no article is found the whole page is saved.',
    'options.pdf.dark': 'Dark print (light text on dark background)',
    'options.pdf.autoScale': 'Auto-scale wide pages',
    'options.pdf.autoScaleHint': 'Shrinks the page so wide tables are not cut off.',
    'options.pdf.footerTitle': 'Footer: page title',
    'options.pdf.footerUrl': 'Footer: web address',
    'options.pdf.footerDate': 'Footer: date',
    'options.pdf.footerHint': 'The source line is printed at the bottom of every page.',
    'options.pdf.reset': 'Reset PDF settings',

    'options.file.title': 'File name and location',
    'options.file.desc': 'Files are saved to the browser downloads folder.',
    'options.file.folder': 'Subfolder',
    'options.file.template': 'File name template',
    'options.file.templateHint':
      'Tags: {site} {title} {date} {time} {year} {month} {day}. The default is the page title.',
    'options.file.perSiteFolder': 'Separate subfolder per website',
    'options.file.saveAs': 'Ask where to save the file every time',
    'options.file.saveAsHint': 'Off: the file goes straight to Downloads (with the subfolders above).',
    'options.file.saveAsHintOn':
      'On: you pick a folder and can edit the name in the browser dialog. The browser remembers the last folder.',
    'options.file.preview': 'Example',
    'options.file.sampleTitle': 'Example page title',

    'options.general.title': 'General',
    'options.general.language': 'Language',
    'options.general.languageAuto': 'Automatic',
    'options.general.languageSv': 'Svenska',
    'options.general.languageEn': 'English',
    'options.general.theme': 'Theme',
    'options.general.themeAuto': 'Automatic (follow system)',
    'options.general.themeLight': 'Light',
    'options.general.themeDark': 'Dark',
    'options.general.allowAll': 'Allow all websites',
    'options.general.allowAllHint': 'When off, the PDF button only works on the list above.',
    'options.general.shortcut': 'Keyboard shortcut',
    'options.general.shortcutValue': 'Current: {shortcut}',
    'options.general.shortcutValueBoth': 'With dialog: {main} · Quiet: {quiet}',
    'options.general.shortcutChange': 'Change shortcut',
    'options.general.shortcutHint': "Opens the browser's own keyboard shortcut page.",
    'options.general.data': 'Settings file',
    'options.general.export': 'Export',
    'options.general.import': 'Import',
    'options.general.imported': 'Settings imported.',
    'options.general.importFailed': 'The file could not be read as a valid settings file.',
    'options.general.reset': 'Reset everything',
    'options.general.resetConfirm': 'Reset all settings and clear the website list?',
    'options.general.resetDone': 'Everything has been reset.',
    'options.general.saved': 'Saved',

    'options.footer.note': 'PDFs are created locally in the browser. No pages are sent anywhere.',

    'errors.restricted': 'Internal and browser pages cannot be saved as PDF.',
    'errors.canceled': 'Saving was cancelled – no file was created.',
    'errors.devtools': 'Close DevTools for this tab and try again.',
    'errors.attach': 'Could not attach to the tab. Reload the page and try again.',
    'errors.print': 'The PDF could not be created.',
    'errors.download': 'The PDF was created but could not be saved.',
    'errors.notAllowed': 'This website is not selected. Add it first.',
    'errors.noTab': 'No active tab was found.',
    'errors.busy': 'A PDF is already being created for this tab.',
    'errors.unexpected': 'Something went wrong. Please try again.',

    'content.button': 'Save as PDF',
    'content.buttonShort': 'PDF',
    'content.altHint': 'Alt+click: save without dialog',
    'toast.saving': 'Creating PDF …',
    'toast.saved': 'PDF saved: {file}'
  }
};

export const SUPPORTED_LANGUAGES = ['sv', 'en'];

/** Avgör vilket språk som ska användas utifrån inställning och webbläsarens språk. */
export function resolveLang(setting, uiLanguage = 'en') {
  if (SUPPORTED_LANGUAGES.includes(setting)) return setting;
  const base = String(uiLanguage || '').slice(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.includes(base) ? base : 'en';
}

/** Slår upp en text och ersätter {platshållare}. */
export function t(lang, key, vars) {
  const dict = STRINGS[lang] || STRINGS.en;
  let text = dict[key];
  if (text === undefined) text = STRINGS.en[key];
  if (text === undefined) return key;
  if (vars) {
    text = text.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
    );
  }
  return text;
}

/** Översätter alla element med data-i18n-attribut i en rotnod. */
export function applyI18n(root, lang) {
  if (!root) return;
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(lang, element.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    element.setAttribute('placeholder', t(lang, element.dataset.i18nPlaceholder));
  });
  root.querySelectorAll('[data-i18n-title]').forEach((element) => {
    element.setAttribute('title', t(lang, element.dataset.i18nTitle));
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    element.setAttribute('aria-label', t(lang, element.dataset.i18nAriaLabel));
  });
  document.documentElement.lang = lang;
}
