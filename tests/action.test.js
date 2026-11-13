import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const background = readFileSync(new URL('../src/background.js', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('toolbar left-click saves without requiring the site to be added', () => {
  assert.equal(manifest.action.default_popup, undefined, 'a popup would prevent action.onClicked from firing');
  assert.match(background, /chrome\.action\.onClicked\.addListener\(\(tab\)\s*=>\s*\{[\s\S]*?handleSaveRequest\(tab,\s*\{\s*allowUnselected:\s*true\s*\}\)/);
  assert.match(readme, /Vänsterklicka på tilläggsikonen[\s\S]*?Du behöver inte lägga till webbplatsen först/);
});

test('right-click action menu opens settings, not the save panel', () => {
  assert.match(background, /id:\s*ACTION_SETTINGS_MENU_ID,[\s\S]*?title:\s*t\(lang,\s*'menu\.settings'\),[\s\S]*?contexts:\s*\['action'\]/);
  assert.match(background, /info\.menuItemId === ACTION_SETTINGS_MENU_ID[\s\S]*?chrome\.runtime\.openOptionsPage\(\)/);
  assert.match(readme, /Högerklicka på tilläggsikonen och välj \*\*Inställningar\*\*/);
});

test('print-ready logo is part of the release archive instead of a separate download', () => {
  assert.match(readme, /Logotypen ingår i releasens käll-ZIP och laddas inte ner separat/);
});
