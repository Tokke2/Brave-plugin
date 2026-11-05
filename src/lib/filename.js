/**
 * Filnamn för sparade PDF:er.
 * Ren funktion utan chrome-beroenden – testas med Node.
 */

const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const ILLEGAL_CHARS = /[\u0000-\u001f\u007f<>:"/\\|?*]/g;

/**
 * Gör om godtycklig text till en säker mappdel.
 * Otillåtna tecken ersätts med bindestreck.
 */
export function sanitizeSegment(input, maxLength = 80) {
  let value = String(input ?? '');
  value = value.normalize('NFC');
  value = value.replace(ILLEGAL_CHARS, '-');
  value = value.replace(/\s+/g, ' ');
  value = value.replace(/-{2,}/g, '-');
  value = value.replace(/^[.\s-]+/, '').replace(/[.\s-]+$/, '');
  if (!value) value = 'sida';
  if (RESERVED_WINDOWS_NAMES.test(value)) value = '_' + value;
  if (value.length > maxLength) {
    value = value.slice(0, maxLength).replace(/[.\s-]+$/, '');
  }
  return value || 'sida';
}

/**
 * Rensar en sidtitel för användning som filnamn.
 * Otillåtna tecken tas bort helt (inte ersatta), så att filnamnet blir
 * så nära titeln som möjligt – t.ex. "removing - refitting : multifunction
 * video camera" → "removing - refitting multifunction video camera".
 */
export function sanitizeTitle(input, maxLength = 90) {
  let value = String(input ?? '');
  value = value.normalize('NFC');
  value = value.replace(ILLEGAL_CHARS, '');
  value = value.replace(/\s+/g, ' ');
  value = value.replace(/^[.\s-]+/, '').replace(/[.\s-]+$/, '');
  if (!value) value = 'sida';
  if (RESERVED_WINDOWS_NAMES.test(value)) value = '_' + value;
  if (value.length > maxLength) {
    value = value.slice(0, maxLength).replace(/[.\s-]+$/, '');
  }
  return value || 'sida';
}

/** Tvåsiffrigt tal med inledande nolla. */
function pad(value) {
  return String(value).padStart(2, '0');
}

/** Datumdelar i lokal tid. */
export function dateParts(date = new Date()) {
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`,
    year: String(date.getFullYear()),
    month: pad(date.getMonth() + 1),
    day: pad(date.getDate())
  };
}

/**
 * Bygger ett relativt filnamn (utan inledande snedstreck) för chrome.downloads.
 *
 * @param {object} options
 * @param {string} options.template      t.ex. "{title}" eller "{date}_{title}"
 * @param {string} options.folder        underkatalog i Hämtade filer
 * @param {boolean} options.perSiteFolder egen undermapp per webbplats
 * @param {string} options.site          värdnamn
 * @param {string} options.title         sidtitel
 * @param {Date}   [options.date]        tidpunkt (default: nu)
 * @returns {string} t.ex. "Sidor/app.alldata.com/Removing - Refitting.pdf"
 */
export function buildFilename({ template, folder, perSiteFolder, site, title, date = new Date() } = {}) {
  const parts = dateParts(date);
  const tokens = {
    site: sanitizeSegment(site || 'webbplats', 60),
    title: sanitizeTitle(title || 'sida', 90),
    date: parts.date,
    time: parts.time,
    year: parts.year,
    month: parts.month,
    day: parts.day
  };

  const rawTemplate =
    typeof template === 'string' && template.trim() ? template : '{title}';
  // Kända taggar ersätts, okända plockas bort.
  let name = rawTemplate.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : ''
  );

  // Tomma parenteser som blev kvar efter borttagna taggar städas bort.
  name = name.replace(/\s*\(\s*\)/g, '').replace(/\s*\[\s*\]/g, '');

  // Mallen får inte skapa egna mappar – snedstreck blir bindestreck.
  name = sanitizeSegment(name, 120);
  name = name.replace(/\.pdf$/i, '');
  name = sanitizeSegment(name, 120);
  name = `${name}.pdf`;

  const segments = [];
  const folderName = sanitizeSegment(folder || '', 60);
  if (folderName && folderName !== 'sida') segments.push(folderName);
  if (perSiteFolder) segments.push(tokens.site);
  segments.push(name);

  return segments.join('/');
}
