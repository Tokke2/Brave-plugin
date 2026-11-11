import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { existsSync } from 'node:fs';

import { TRACKED_FILES, compareVersions, diffFileHashes, gitBlobSha } from '../src/lib/updates.js';

test('alla levererade filer och PDF-hjälpbibliotek finns i uppdateringslistan', () => {
  for (const file of [
    'src/lib/pdf-analysis.js',
    'src/preview.html',
    'src/preview.js',
    'src/preview.css',
    'src/lib/directory-storage.js',
    'src/vendor/pdfjs/pdf.min.mjs',
    'src/vendor/pdfjs/pdf.worker.min.mjs',
    'src/vendor/pdf-lib/pdf-lib.min.js',
    'third_party/licenses/PDFJS-LICENSE.txt',
    'third_party/licenses/PDF-LIB-LICENSE.md'
  ]) {
    assert.ok(TRACKED_FILES.includes(file), `${file} saknas i TRACKED_FILES`);
  }
  for (const file of TRACKED_FILES) assert.ok(existsSync(file), `${file} saknas i repot`);
});

test('compareVersions orders numeric release versions', () => {
  assert.equal(compareVersions('1.4.0', '1.3.9'), 1);
  assert.equal(compareVersions('v1.4.0', '1.4.1'), -1);
  assert.equal(compareVersions('1.4.0', '1.4'), 0);
});

test('compareVersions rejects malformed values', () => {
  assert.equal(compareVersions('latest', '1.4.0'), null);
  assert.equal(compareVersions('1.x', '1.4.0'), null);
});

test('gitBlobSha matches Git’s SHA-1 for an empty blob', async () => {
  assert.equal(
    await gitBlobSha(new Uint8Array(), webcrypto),
    'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391'
  );
});

test('diffFileHashes reports changed, added and removed files', () => {
  const localHashes = {
    same: 'a'.repeat(40),
    changed: 'b'.repeat(40),
    localOnly: 'c'.repeat(40)
  };
  const remoteFiles = [
    { type: 'blob', path: 'same', sha: 'a'.repeat(40) },
    { type: 'blob', path: 'changed', sha: 'd'.repeat(40) },
    { type: 'blob', path: 'releaseOnly', sha: 'e'.repeat(40) }
  ];

  assert.deepEqual(diffFileHashes(localHashes, remoteFiles), ['changed', 'localOnly', 'releaseOnly']);
});
