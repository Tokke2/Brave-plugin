import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SETTINGS,
  mergeSettings,
  applySitePdfProfile,
  normalizeSite,
  normalizeTheme,
  createId
} from '../src/lib/settings.js';

test('standardmallen döper filen efter sidtiteln', () => {
  assert.equal(DEFAULT_SETTINGS.file.template, '{title}');
  assert.equal(DEFAULT_SETTINGS.version, 9);
  assert.equal(mergeSettings({}).file.template, '{title}');
  assert.equal(mergeSettings({}).version, 9);
});

test('migrering till version 9 tar bort mappar från filinställningarna', () => {
  const settings = mergeSettings({
    version: 4,
    file: { folder: 'Sidor', perSiteFolder: true, template: '{title}' }
  });
  assert.equal(settings.version, 9);
  assert.equal('folder' in settings.file, false);
  assert.equal('perSiteFolder' in settings.file, false);
});

test('PDF-inställningar tvingar A4 och automatisk breddsanpassning', () => {
  const settings = mergeSettings({
    version: 5,
    pdf: { format: 'A3', autoScale: false, preferCssPageSize: true }
  });
  assert.equal(settings.pdf.format, 'A4');
  assert.equal(settings.pdf.autoScale, true);
  assert.equal(settings.pdf.preferCssPageSize, false);
});

test('spara-dialogen är på som standard och slås på vid migrering', () => {
  assert.equal(DEFAULT_SETTINGS.file.saveAs, true);
  assert.equal(DEFAULT_SETTINGS.file.rememberLocation, false);
  assert.equal(mergeSettings({}).file.saveAs, true);
  assert.equal(mergeSettings({}).file.rememberLocation, false);
  assert.equal(mergeSettings({ file: { rememberLocation: true } }).file.rememberLocation, true);
  assert.equal(mergeSettings({}).file.conflictAction, 'uniquify');
  assert.equal(mergeSettings({ file: { conflictAction: 'overwrite' } }).file.conflictAction, 'overwrite');
  assert.equal(mergeSettings({ file: { conflictAction: 'unexpected' } }).file.conflictAction, 'uniquify');
  // Gamla installationer hade tyst nedladdning – nu frågar vi i stället.
  assert.equal(mergeSettings({ version: 2, file: { saveAs: false } }).file.saveAs, true);
  // Har man aktivt stängt av den i version 3 respekteras det.
  assert.equal(mergeSettings({ version: 3, file: { saveAs: false } }).file.saveAs, false);
});

test('gamla standardmallen migreras men egna mallar lämnas orörda', () => {
  assert.equal(
    mergeSettings({ version: 1, file: { template: '{date}_{title}' } }).file.template,
    '{title}'
  );
  assert.equal(
    mergeSettings({ version: 1, file: { template: 'mina-pdf/{title}' } }).file.template,
    'mina-pdf/{title}'
  );
  assert.equal(
    mergeSettings({ version: 2, file: { template: '{date}_{title}' } }).file.template,
    '{date}_{title}'
  );
});

test('mergeSettings klämmer värden och fyller i standardvärden', () => {
  const settings = mergeSettings({
    pdf: { format: 'A9', marginMm: 99, scale: 4, waitMs: 99999, printBackground: 'ja' },
    button: { show: 'nej', position: 'xx' },
    language: 'de',
    allowAll: 'true'
  });

  assert.equal(settings.pdf.format, 'A4');
  assert.equal(settings.pdf.marginMm, 50);
  assert.equal(settings.pdf.scale, 2);
  assert.equal(settings.pdf.waitMs, 5000);
  assert.equal(settings.pdf.printBackground, false);
  assert.equal(settings.button.show, true);
  assert.equal(settings.button.position, 'br');
  assert.equal(settings.language, 'auto');
  assert.equal(settings.allowAll, false);
});

test('sajtlistan städas och begränsas', () => {
  const settings = mergeSettings({
    sites: [
      { pattern: 'example.com', enabled: false },
      { pattern: '' },
      null,
      { id: 'fast', pattern: '*.example.se' }
    ]
  });

  assert.equal(settings.sites.length, 2);
  assert.equal(settings.sites[0].pattern, 'example.com');
  assert.equal(settings.sites[0].enabled, false);
  assert.ok(settings.sites[0].id);
  assert.equal(settings.sites[1].id, 'fast');
  assert.equal(settings.sites[1].enabled, true);
  assert.equal(settings.sites[0].pdfProfile, 'default');
});

test('profiler ger per-site PDF-val utan att ändra globala A4-regler', () => {
  const globalSettings = mergeSettings({ pdf: { format: 'A3', autoScale: false } });
  const dark = applySitePdfProfile(globalSettings, 'dark');
  assert.equal(dark.pdf.darkMode, true);
  assert.equal(dark.pdf.printBackground, true);
  assert.equal(dark.pdf.format, 'A4');
  assert.equal(dark.pdf.autoScale, true);
  assert.equal(globalSettings.pdf.darkMode, false);

  const article = applySitePdfProfile(globalSettings, 'article');
  assert.equal(article.pdf.reader, true);
  const archive = applySitePdfProfile(globalSettings, 'archive');
  assert.equal(archive.pdf.footerTitle, true);
  assert.equal(archive.pdf.footerUrl, true);
  assert.equal(archive.pdf.footerDate, true);
  assert.equal(applySitePdfProfile(globalSettings, 'default'), globalSettings);
});

test('normalizeSite och createId ger användbara objekt', () => {
  assert.equal(normalizeSite(null), null);
  assert.equal(normalizeSite({ pattern: '   ' }), null);
  const site = normalizeSite({ pattern: ' example.com ' });
  assert.equal(site.pattern, 'example.com');
  assert.equal(site.enabled, true);
  assert.equal(site.pdfProfile, 'default');
  assert.equal(normalizeSite({ pattern: 'example.com', pdfProfile: 'dark' }).pdfProfile, 'dark');
  assert.equal(normalizeSite({ pattern: 'example.com', pdfProfile: 'invalid' }).pdfProfile, 'default');
  assert.match(createId(), /^s_[a-z0-9]+_[a-z0-9]+$/);
});

test('nya PDF-val har sansade standardvärden', () => {
  const settings = mergeSettings({});
  assert.equal(settings.pdf.autoScale, true);
  assert.equal(settings.pdf.darkMode, false);
  assert.equal(settings.pdf.reader, false);
  assert.equal(settings.pdf.footerTitle, false);
  assert.equal(settings.pdf.footerUrl, false);
  assert.equal(settings.pdf.footerDate, false);
  assert.equal(settings.pdf.watermark, '');
  assert.equal(settings.pdf.optimizeImages, false);
  assert.equal(settings.pdf.openAfterSave, false);
  assert.equal(settings.pdf.tableOfContents, false);
  assert.equal(settings.pdf.removeBlankPages, false);

  const extras = mergeSettings({
    pdf: {
      watermark: '  CONFIDENTIAL  ',
      optimizeImages: true,
      openAfterSave: true,
      tableOfContents: true,
      removeBlankPages: true
    }
  });
  assert.equal(extras.pdf.watermark, 'CONFIDENTIAL');
  assert.equal(extras.pdf.optimizeImages, true);
  assert.equal(extras.pdf.openAfterSave, true);
  assert.equal(extras.pdf.tableOfContents, true);
  assert.equal(extras.pdf.removeBlankPages, true);

  // Gamla installationer får autoskala på, men inget annat påslaget.
  const old = mergeSettings({ version: 3, pdf: { format: 'A4' } });
  assert.equal(old.pdf.autoScale, true);
  assert.equal(old.pdf.darkMode, false);
  assert.equal(old.pdf.reader, false);
});

test('rullning för lazy-innehåll och gränssnittstäthet normaliseras', () => {
  assert.equal(DEFAULT_SETTINGS.layoutDensity, 'spacious');
  assert.equal(DEFAULT_SETTINGS.pdf.scrollToLoad, false);
  assert.equal(mergeSettings({}).layoutDensity, 'spacious');
  assert.equal(mergeSettings({ layoutDensity: 'compact' }).layoutDensity, 'compact');
  assert.equal(mergeSettings({ layoutDensity: 'unknown' }).layoutDensity, 'spacious');
  assert.equal(mergeSettings({ pdf: { scrollToLoad: true } }).pdf.scrollToLoad, true);
  assert.equal(mergeSettings({ pdf: { scrollToLoad: 'yes' } }).pdf.scrollToLoad, false);
});

test('temat normaliseras till auto, light eller dark', () => {
  assert.equal(DEFAULT_SETTINGS.theme, 'auto');
  assert.equal(mergeSettings({}).theme, 'auto');
  assert.equal(mergeSettings({ theme: 'dark' }).theme, 'dark');
  assert.equal(mergeSettings({ theme: 'light' }).theme, 'light');
  assert.equal(mergeSettings({ theme: 'sepia' }).theme, 'auto');
  assert.equal(mergeSettings({ theme: 42 }).theme, 'auto');
  assert.equal(normalizeTheme('dark'), 'dark');
  assert.equal(normalizeTheme(undefined), 'auto');
});
