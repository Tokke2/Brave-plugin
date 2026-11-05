const VERSION_PATTERN = /^v?(\d+(?:\.\d+){0,3})(?:[-+][0-9A-Za-z.-]+)?$/i;

// Files present in the manually installed repository snapshot. Keep this list
// complete so the checker can also notice files removed by a newer release.
export const TRACKED_FILES = [
  'FORBATTRINGAR.md',
  'LICENSE',
  'README.md',
  'fonts/OFL-Inter.txt',
  'fonts/inter-latin-wght-normal.woff2',
  'icons/icon.svg',
  'icons/icon128.png',
  'icons/icon16.png',
  'icons/icon16.svg',
  'icons/icon32.png',
  'icons/icon48.png',
  'manifest.json',
  'package.json',
  'src/background.js',
  'src/content.js',
  'src/lib/access.js',
  'src/lib/i18n.js',
  'src/lib/print.js',
  'src/lib/settings.js',
  'src/lib/sites.js',
  'src/lib/theme.js',
  'src/lib/updates.js',
  'src/offscreen.html',
  'src/offscreen.js',
  'src/options.css',
  'src/options.html',
  'src/options.js',
  'src/popup.css',
  'src/popup.html',
  'src/popup.js',
  'src/reader.css',
  'src/reader.html',
  'src/reader.js',
  'src/theme-init.js',
  'src/ui.css',
  'tests/filename.test.js',
  'tests/i18n.test.js',
  'tests/print.test.js',
  'tests/settings.test.js',
  'tests/sites.test.js',
  'tests/updates.test.js'
];

function versionParts(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(VERSION_PATTERN);
  if (!match) return null;
  return match[1].split('.').map(Number);
}

/** Compare Chrome-style numeric versions; returns null when either value is invalid. */
export function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  if (!a || !b) return null;

  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

/** Calculate the Git blob SHA-1 used by the GitHub tree API. */
export async function gitBlobSha(bytes, cryptoApi = globalThis.crypto) {
  const content = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const prefix = new TextEncoder().encode(`blob ${content.byteLength}\0`);
  const blob = new Uint8Array(prefix.length + content.length);
  blob.set(prefix);
  blob.set(content, prefix.length);
  const digest = await cryptoApi.subtle.digest('SHA-1', blob);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Return sorted paths whose local Git blob hashes differ from a release tree. */
export function diffFileHashes(localHashes, remoteEntries) {
  const remoteHashes = new Map(
    remoteEntries
      .filter((entry) => entry?.type === 'blob' && typeof entry.path === 'string' && /^[a-f0-9]{40}$/i.test(entry.sha || ''))
      .map((entry) => [entry.path, entry.sha.toLowerCase()])
  );
  const paths = new Set([...Object.keys(localHashes), ...remoteHashes.keys()]);
  return [...paths]
    .filter((path) => (localHashes[path] || null) !== (remoteHashes.get(path) || null))
    .sort();
}
