/**
 * Hjälpfunktioner för värdåtkomst (optional_host_permissions).
 */

import { originPatternFor } from './sites.js';

/**
 * Tar bort värdåtkomsten för ett mönster om ingen annan sajt i listan
 * använder samma värd. Anropas när användaren tar bort en webbplats.
 */
export async function releaseUnusedOrigin(settings, pattern) {
  const origin = originPatternFor(pattern);
  if (!origin || !chrome.permissions?.remove) return;

  const stillUsed = settings.sites.some((site) => originPatternFor(site.pattern) === origin);
  if (stillUsed) return;

  try {
    await chrome.permissions.remove({ origins: [origin] });
  } catch {
    /* åtkomsten kan redan vara borttagen */
  }
}
