/**
 * Tema: auto, ljust eller mörkt.
 * "auto" följer systemets inställning; valet sparas i inställningarna medan
 * det senast använda temat cachas i localStorage så att sidan kan målas rätt
 * redan innan inställningarna hunnit läsas in (se theme-init.js).
 */

import { normalizeTheme } from './settings.js';

const STORAGE_KEY = 'theme';

export function prefersDark() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** Räknar ut vilket tema som faktiskt ska visas. */
export function resolveTheme(preference) {
  const theme = normalizeTheme(preference);
  if (theme !== 'auto') return theme;
  return prefersDark() ? 'dark' : 'light';
}

/** Sätter data-theme på dokumentet och cachar resultatet. */
export function applyTheme(preference, doc = document) {
  const resolved = resolveTheme(preference);
  doc.documentElement.setAttribute('data-theme', resolved);
  doc.documentElement.setAttribute('data-theme-pref', normalizeTheme(preference));
  try {
    localStorage.setItem(STORAGE_KEY, resolved);
  } catch {
    /* localStorage kan vara blockerat – temat fungerar ändå */
  }
  return resolved;
}

/** Låter lyssnaren reagera när systemets tema ändras (endast relevant för auto). */
export function watchSystemTheme(callback) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => callback();
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }
  return () => {};
}
