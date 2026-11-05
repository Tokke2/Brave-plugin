/**
 * Webbplatsmönster – normalisering, validering och matchning.
 *
 * Ett mönster kan se ut så här:
 *   example.com            – exakt värd
 *   *.example.com          – example.com och alla subdomäner (t.ex. www.)
 *   example.com/nyheter    – exakt värd, bara sidor under /nyheter
 *   https://example.com/   – protokoll och avslutande snedstreck ignoreras
 *
 * Modulen är avsiktligt fri från chrome-API:er så att den kan testas med Node.
 */

export const MAX_PATTERN_LENGTH = 300;

/** Delar upp ett normaliserat mönster i värd och sökväg. */
export function splitPattern(pattern) {
  const value = typeof pattern === 'string' ? pattern : '';
  const slash = value.indexOf('/');
  if (slash === -1) return { host: value, path: '' };
  return { host: value.slice(0, slash), path: value.slice(slash) };
}

/** Tar bort protokoll, fragment, blanksteg och avslutande snedstreck. */
export function normalizePattern(input) {
  if (typeof input !== 'string') return '';
  let pattern = input.trim().toLowerCase();
  pattern = pattern.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  pattern = pattern.split('#')[0];
  // Sökvägen får inte innehålla query – den ignoreras vid matchning.
  const slash = pattern.indexOf('/');
  if (slash !== -1) {
    const host = pattern.slice(0, slash);
    const pathPart = pattern.slice(slash).split('?')[0];
    pattern = host + pathPart;
  }
  while (pattern.endsWith('/')) pattern = pattern.slice(0, -1);
  return pattern;
}

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/** Kontrollerar om en värd (utan sökväg) är ett rimligt värdnamn, IP eller localhost. */
export function isValidHost(host) {
  if (typeof host !== 'string' || !host) return false;
  let value = host;
  if (value.startsWith('*.')) value = value.slice(2);
  if (!value) return false;

  // Tillåt port, t.ex. localhost:3000
  const portMatch = value.match(/:(\d{1,5})$/);
  if (portMatch) {
    const port = Number(portMatch[1]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return false;
    value = value.slice(0, -portMatch[0].length);
  }
  if (!value || value.length > 253) return false;
  if (value.startsWith('.') || value.endsWith('.') || value.includes('..')) return false;

  return value.split('.').every((label) => LABEL.test(label));
}

/** Sant om mönstret är giltigt och kan användas för matchning. */
export function isValidPattern(input) {
  const pattern = normalizePattern(input);
  if (!pattern || pattern.length > MAX_PATTERN_LENGTH) return false;

  if (/\s/.test(pattern)) return false;

  const { host, path } = splitPattern(pattern);
  if (!isValidHost(host)) return false;
  if (path) {
    if (!path.startsWith('/')) return false;
    if (path.length > 200) return false;
  }
  return true;
}

/** Matchar värddelen. *.example.com omfattar även example.com (som i Chromes matchmönster). */
export function hostMatches(host, hostPattern) {
  if (!host || !hostPattern) return false;
  const actual = host.toLowerCase();
  const wanted = hostPattern.toLowerCase();

  if (wanted.startsWith('*.')) {
    const base = wanted.slice(2);
    return actual === base || actual.endsWith('.' + base);
  }
  return actual === wanted;
}

/** Sant om URL:en faller inom mönstret. */
export function matchesUrl(rawUrl, pattern) {
  const normalized = normalizePattern(pattern);
  if (!normalized) return false;

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  const { host, path } = splitPattern(normalized);
  if (!hostMatches(url.host, host)) return false;
  if (!path) return true;

  const pathname = url.pathname.toLowerCase();
  if (pathname === path) return true;
  return pathname.startsWith(path.endsWith('/') ? path : path + '/');
}

/** Origin-mönster för chrome.permissions, t.ex. *://*.example.com/* */
export function originPatternFor(pattern) {
  const normalized = normalizePattern(pattern);
  if (!isValidPattern(normalized)) return '';
  const { host } = splitPattern(normalized);
  return `*://${host}/*`;
}

/** Föreslår ett mönster utifrån en URL (används av "lägg till aktuell sida"). */
export function suggestPatternFromUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return '';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
  const host = url.host.toLowerCase();
  // www. → täck hela domänen, så att både example.com och www.example.com fungerar.
  if (host.startsWith('www.')) {
    const base = host.slice(4);
    if (base.split('.').length >= 2) return `*.${base}`;
  }
  return host;
}

/** Sant om URL:en går att skriva ut (vanlig webbsida). */
export function isPrintableUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
