import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { STRINGS, resolveLang, t } from '../src/lib/i18n.js';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');

test('svenska och engelska har samma nycklar', () => {
  const sv = Object.keys(STRINGS.sv).sort();
  const en = Object.keys(STRINGS.en).sort();
  assert.deepEqual(sv, en);
});

test('t() ersätter platshållare och faller tillbaka på engelska', () => {
  assert.equal(t('sv', 'appName'), 'Sida till PDF');
  assert.equal(t('en', 'options.sites.count', { n: 3 }), '3 websites');
  assert.equal(t('sv', 'okand.nyckel'), 'okand.nyckel');
  assert.equal(t('sv', 'toast.saved', { file: 'a.pdf' }), 'PDF sparad: a.pdf');
});

test('resolveLang följer inställning och webbläsarspråk', () => {
  assert.equal(resolveLang('sv', 'en-US'), 'sv');
  assert.equal(resolveLang('en', 'sv-SE'), 'en');
  assert.equal(resolveLang('auto', 'sv-SE'), 'sv');
  assert.equal(resolveLang('auto', 'de-DE'), 'en');
  assert.equal(resolveLang(undefined, 'en-GB'), 'en');
});

test('alla i18n-nycklar som används i gränssnittet finns i ordlistan', () => {
  const files = readdirSync(srcDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(js|html|css)$/.test(entry.name))
    .map((entry) => entry.name);

  const used = new Set();
  const attrPattern = /data-i18n(?:-[a-z-]+)?="([^"]+)"/g;
  const callPattern = /\bt\(\s*[^,]+,\s*'([^']+)'/g;

  for (const file of files) {
    const text = readFileSync(join(srcDir, file), 'utf8');
    for (const match of text.matchAll(attrPattern)) used.add(match[1]);
    for (const match of text.matchAll(callPattern)) used.add(match[1]);
  }

  const missing = [...used].filter((key) => !(key in STRINGS.sv) || !(key in STRINGS.en));
  assert.deepEqual(missing, [], `saknade nycklar: ${missing.join(', ')}`);
});
