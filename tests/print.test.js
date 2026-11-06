import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPrintParams,
  buildFooterTemplate,
  autoFitScale,
  choosePageOrientation,
  normalizePageRanges,
  paperWidthCssPx,
  escapeHtml,
  mmToInch,
  MIXED_ORIENTATION_CSS
} from '../src/lib/print.js';
import { mergeSettings } from '../src/lib/settings.js';

function settings(pdf = {}) {
  return mergeSettings({ pdf });
}

test('marginaler räknas om från millimeter till tum', () => {
  assert.equal(mmToInch(25.4), 1);
  assert.equal(mmToInch(10), 0.3937);
});

test('sidintervall valideras och normaliseras', () => {
  assert.equal(normalizePageRanges(' 1 - 3, 5 '), '1-3,5');
  assert.equal(normalizePageRanges(''), '');
  assert.equal(normalizePageRanges('0,2'), null);
  assert.equal(normalizePageRanges('4-2'), null);
  assert.equal(normalizePageRanges('1,abc'), null);
  assert.equal(normalizePageRanges('1,'.repeat(110)), null);
});

test('pappersbredden i CSS-pixlar tar hänsyn till marginaler', () => {
  const a4 = paperWidthCssPx({ format: 'A4', marginMm: 10 });
  assert.ok(a4 > 680 && a4 < 740, `oväntad bredd: ${a4}`);
  const utanMarginal = paperWidthCssPx({ format: 'A4', marginMm: 0 });
  assert.ok(utanMarginal > a4);
  assert.equal(paperWidthCssPx({ format: 'A3', marginMm: 10 }), a4);
});

test('autoskalan rör inte sidor som får plats', () => {
  assert.equal(autoFitScale({ contentWidth: 700, usableWidth: 720, scale: 1 }), 1);
  assert.equal(autoFitScale({ contentWidth: 0, usableWidth: 720, scale: 1 }), 1);
  assert.equal(autoFitScale({}), 1);
});

test('autoskalan krymper alltid till A4-bredd utan att klippa breda sidor', () => {
  const fitted = autoFitScale({ contentWidth: 1440, usableWidth: 720, scale: 1 });
  assert.equal(fitted, 0.5);

  const veryWide = autoFitScale({ contentWidth: 5000, usableWidth: 720, scale: 1 });
  assert.equal(veryWide, 0.144);

  // Användarens skala är ett tak; passande innehåll förstoras inte utanför papperet.
  const capped = autoFitScale({ contentWidth: 1000, usableWidth: 500, scale: 0.8 });
  assert.equal(capped, 0.5);
  assert.equal(autoFitScale({ contentWidth: 700, usableWidth: 720, scale: 2 }), 1.029);
});

test('HTML i sidfoten escapas', () => {
  assert.equal(escapeHtml('<b>"x" & \'y\'</b>'), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
  assert.equal(escapeHtml(null), '');
});

test('sidfoten byggs bara när något ska visas', () => {
  assert.equal(buildFooterTemplate({}), null);
  assert.equal(buildFooterTemplate({ title: '', url: '', date: null, showPages: false }), null);

  const source = buildFooterTemplate({ title: 'Rubrik', url: 'https://example.com/a', date: new Date('2026-11-05T10:00:00Z') });
  assert.ok(source.includes('Rubrik'));
  assert.ok(source.includes('https://example.com/a'));
  assert.ok(source.includes('2026-11-05'));
  assert.ok(source.includes('class="pageNumber"') === false);

  const pages = buildFooterTemplate({ showPages: true });
  assert.ok(pages.includes('class="pageNumber"'));
  assert.ok(pages.includes('class="totalPages"'));
});

test('utskriftsparametrar följer inställningarna', () => {
  const base = buildPrintParams({ settings: settings({ format: 'A4', marginMm: 10 }), tab: {} });
  assert.equal(base.displayHeaderFooter, false);
  assert.equal(base.printBackground, false);
  assert.equal(base.scale, 1);
  assert.equal(base.paperWidth, 8.27);
  assert.equal(base.marginTop, 0.3937);

  const footer = buildPrintParams({
    settings: settings({ footerUrl: true, footerDate: true }),
    tab: { url: 'https://example.com/a' }
  });
  assert.equal(footer.displayHeaderFooter, true);
  assert.ok(footer.footerTemplate.includes('https://example.com/a'));
  // Sidfoten behöver plats – marginalen växer till minst 0,6 tum.
  assert.equal(footer.marginBottom, 0.6);

  const numbers = buildPrintParams({ settings: settings({ headerFooter: true }), tab: {} });
  assert.equal(numbers.displayHeaderFooter, true);
  assert.ok(numbers.footerTemplate.includes('class="pageNumber"'));
});

test('utskriftsparametrar inkluderar sidintervall och dokumentöversikt', () => {
  const params = buildPrintParams({
    settings: settings(),
    tab: {},
    pageRanges: '1-2, 5'
  });
  assert.equal(params.pageRanges, '1-2,5');
  assert.equal(params.generateDocumentOutline, true);
  assert.equal(buildPrintParams({ settings: settings(), pageRanges: 'invalid' }).pageRanges, undefined);
});

test('A4-orienteringen väljs efter vilken riktning som passar innehållet bäst', () => {
  assert.equal(
    choosePageOrientation({
      portraitContentWidth: 1000,
      landscapeContentWidth: 1000,
      marginMm: 10
    }),
    'landscape'
  );
  assert.equal(
    choosePageOrientation({
      portraitContentWidth: 600,
      landscapeContentWidth: 1200,
      marginMm: 10
    }),
    'portrait'
  );
  assert.equal(
    choosePageOrientation({ portraitContentWidth: 500, landscapeContentWidth: 700 }),
    'portrait'
  );
  assert.equal(choosePageOrientation({}), 'portrait');
});

test('tulostusparametrit käyttävät valittua A4-suuntaa vanhoista arvoista riippumatta', () => {
  const portrait = buildPrintParams({
    settings: settings({ format: 'A3', preferCssPageSize: true }),
    tab: {}
  });
  assert.equal(portrait.paperWidth, 8.27);
  assert.equal(portrait.paperHeight, 11.69);
  assert.equal(portrait.landscape, false);
  assert.equal(portrait.preferCSSPageSize, false);

  const landscape = buildPrintParams({
    settings: settings({ format: 'A3', preferCssPageSize: true }),
    tab: {},
    landscape: true
  });
  assert.equal(landscape.paperWidth, 11.69);
  assert.equal(landscape.paperHeight, 8.27);
  assert.equal(landscape.landscape, true);
});

test('mörk utskrift slår på bakgrundsfärger', () => {
  const params = buildPrintParams({ settings: settings({ darkMode: true }), tab: {} });
  assert.equal(params.printBackground, true);
});

test('skalan som skickas in vinner över inställningens', () => {
  const params = buildPrintParams({ settings: settings({ scale: 1 }), tab: {}, scale: 0.62 });
  assert.equal(params.scale, 0.62);
});

test('blandad sidriktning behåller A4 men låter CSS välja sidstorlek per sida', () => {
  const params = buildPrintParams({ settings: settings(), tab: {}, mixedOrientation: true });
  assert.equal(params.paperWidth, 8.27);
  assert.equal(params.paperHeight, 11.69);
  assert.equal(params.preferCSSPageSize, true);
  assert.match(MIXED_ORIENTATION_CSS, /@page stp-landscape \{ size: A4 landscape;/);
  assert.match(MIXED_ORIENTATION_CSS, /page: stp-landscape/);
});
