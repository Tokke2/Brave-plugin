/**
 * Inställningar och historik.
 * Allt sparas lokalt i webbläsaren (chrome.storage.local) så att listan inte
 * slår i sync-kvoten. Inställningarna kan exporteras/importeras som JSON.
 */

export const SETTINGS_KEY = 'settings';
export const HISTORY_KEY = 'history';
const HISTORY_LIMIT = 15;

export const DEFAULT_SETTINGS = Object.freeze({
  version: 4,
  language: 'auto', // 'auto' | 'sv' | 'en'
  theme: 'auto', // 'auto' | 'light' | 'dark'
  allowAll: false,
  sites: [], // { id, pattern, enabled }
  button: {
    show: true,
    position: 'br' // 'br' | 'bl' | 'tr' | 'tl'
  },
  pdf: {
    format: 'A4', // 'A4' | 'Letter' | 'Legal' | 'A3'
    marginMm: 10,
    scale: 1,
    printBackground: false,
    headerFooter: false,
    preferCssPageSize: false,
    autoScale: true,
    darkMode: false,
    reader: false,
    footerTitle: false,
    footerUrl: false,
    footerDate: false,
    waitMs: 400
  },
  file: {
    folder: 'Sidor',
    template: '{title}',
    perSiteFolder: true,
    saveAs: true
  }
});

const POSITIONS = ['br', 'bl', 'tr', 'tl'];
const FORMATS = ['A4', 'Letter', 'Legal', 'A3'];
const LANGUAGES = ['auto', 'sv', 'en'];
export const THEMES = ['auto', 'light', 'dark'];

/** Normaliserar temavärdet ('auto' när något annat skickas in). */
export function normalizeTheme(value) {
  return THEMES.includes(value) ? value : DEFAULT_SETTINGS.theme;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

/** Normaliserar en sajtpost från lagring eller import. */
export function normalizeSite(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const pattern = typeof raw.pattern === 'string' ? raw.pattern.trim() : '';
  if (!pattern) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : createId(),
    pattern,
    enabled: raw.enabled !== false
  };
}

/** Skapar ett unikt id utan beroenden till crypto-API:er. */
export function createId() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Slår ihop sparade inställningar med standardvärden och rensar bort skräp. */
export function mergeSettings(raw) {
  const source = isPlainObject(raw) ? raw : {};
  const button = isPlainObject(source.button) ? source.button : {};
  const pdf = isPlainObject(source.pdf) ? source.pdf : {};
  const file = isPlainObject(source.file) ? source.file : {};

  const sites = Array.isArray(source.sites)
    ? source.sites.map(normalizeSite).filter(Boolean).slice(0, 500)
    : [];

  const sourceVersion = Number(source.version);
  const version = Number.isFinite(sourceVersion) && sourceVersion > 0 ? sourceVersion : 1;

  let template =
    typeof file.template === 'string' && file.template.trim()
      ? file.template.slice(0, 120)
      : DEFAULT_SETTINGS.file.template;

  // Migrering: från och med version 2 döps filen efter sidtiteln. Har man
  // kvar den gamla standardmallen byts den ut, egna mallar lämnas orörda.
  if (version < 2 && template === '{date}_{title}') template = DEFAULT_SETTINGS.file.template;

  // Från och med version 3 frågar tillägget var filen ska sparas, så att man
  // själv väljer mapp. Tidigare versioner hade alltid tyst nedladdning.
  const saveAs = version < 3 ? true : file.saveAs === true;

  return {
    version: DEFAULT_SETTINGS.version,
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_SETTINGS.language,
    theme: normalizeTheme(source.theme),
    allowAll: source.allowAll === true,
    sites,
    button: {
      show: button.show !== false,
      position: POSITIONS.includes(button.position) ? button.position : DEFAULT_SETTINGS.button.position
    },
    pdf: {
      format: FORMATS.includes(pdf.format) ? pdf.format : DEFAULT_SETTINGS.pdf.format,
      marginMm: clampNumber(pdf.marginMm, 0, 50, DEFAULT_SETTINGS.pdf.marginMm),
      scale: clampNumber(pdf.scale, 0.5, 2, DEFAULT_SETTINGS.pdf.scale),
      printBackground: pdf.printBackground === true,
      headerFooter: pdf.headerFooter === true,
      preferCssPageSize: pdf.preferCssPageSize === true,
      // Från och med version 4: autoskala, mörk utskrift, artikelläge och källrad.
      autoScale: pdf.autoScale !== false,
      darkMode: pdf.darkMode === true,
      reader: pdf.reader === true,
      footerTitle: pdf.footerTitle === true,
      footerUrl: pdf.footerUrl === true,
      footerDate: pdf.footerDate === true,
      waitMs: Math.round(clampNumber(pdf.waitMs, 0, 5000, DEFAULT_SETTINGS.pdf.waitMs))
    },
    file: {
      folder: typeof file.folder === 'string' ? file.folder.slice(0, 80) : DEFAULT_SETTINGS.file.folder,
      template,
      perSiteFolder: file.perSiteFolder !== false,
      saveAs
    }
  };
}

/** Hämtar inställningar (alltid kompletta). */
export async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = mergeSettings(stored?.[SETTINGS_KEY]);
  if (!stored?.[SETTINGS_KEY]) await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}

/** Sparar ett komplett inställningsobjekt. */
export async function saveSettings(settings) {
  const clean = mergeSettings(settings);
  await chrome.storage.local.set({ [SETTINGS_KEY]: clean });
  return clean;
}

let writeQueue = Promise.resolve();

/** Uppdaterar inställningarna med en mutatorfunktion (seriekopplat för att undvika krockar). */
export function updateSettings(mutator) {
  writeQueue = writeQueue
    .then(async () => {
      const current = await getSettings();
      const draft = structuredClone(current);
      await mutator(draft);
      return saveSettings(draft);
    })
    .catch((error) => {
      console.error('Kunde inte spara inställningarna', error);
      return getSettings();
    });
  return writeQueue;
}

/** Låter lyssnare reagera på ändrade inställningar. */
export function onSettingsChanged(callback) {
  const listener = (changes, area) => {
    if (area !== 'local' || !changes[SETTINGS_KEY]) return;
    callback(mergeSettings(changes[SETTINGS_KEY].newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** Läser sparhistoriken (endast lokal, synkas inte). */
export async function getHistory() {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const list = stored?.[HISTORY_KEY];
  return Array.isArray(list) ? list.filter((item) => item && item.filename) : [];
}

/** Lägger till en post i historiken. */
export async function addHistory(entry) {
  const list = await getHistory();
  const next = [{ ...entry, savedAt: Date.now() }, ...list].slice(0, HISTORY_LIMIT);
  await chrome.storage.local.set({ [HISTORY_KEY]: next });
  return next;
}
