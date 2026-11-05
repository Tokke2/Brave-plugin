import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeSegment, sanitizeTitle, buildFilename, dateParts } from '../src/lib/filename.js';

const date = new Date(2026, 10, 4, 14, 5, 9); // 2026-11-04 14:05:09 lokal tid

test('sanitizeSegment rensar otillåtna tecken', () => {
  assert.equal(sanitizeSegment('Hej: världen?/ja*'), 'Hej- världen-ja');
  assert.equal(sanitizeSegment('   '), 'sida');
  assert.equal(sanitizeSegment('...fil...'), 'fil');
  assert.equal(sanitizeSegment(''), 'sida');
  assert.equal(sanitizeSegment('CON'), '_CON');
  assert.equal(sanitizeSegment('en', 1), 'e');
});

test('sanitizeTitle tar bort otillåtna tecken i stället för att ersätta dem', () => {
  assert.equal(
    sanitizeTitle(' removing - refitting : multifunction video camera '),
    'removing - refitting multifunction video camera'
  );
  assert.equal(sanitizeTitle('FAQ: Vanliga/Frågor?'), 'FAQ VanligaFrågor');
  assert.equal(sanitizeTitle('  -- Titel: X -- '), 'Titel X');
  assert.equal(sanitizeTitle('...'), 'sida');
  assert.equal(sanitizeTitle('NUL'), '_NUL');
});

test('dateParts formaterar lokal tid', () => {
  assert.deepEqual(dateParts(date), {
    date: '2026-11-04',
    time: '14-05-09',
    year: '2026',
    month: '11',
    day: '04'
  });
});

test('buildFilename bygger mapp och filnamn', () => {
  assert.equal(
    buildFilename({
      template: '{date}_{title}',
      folder: 'Sidor',
      perSiteFolder: true,
      site: 'example.com',
      title: 'Nyheter idag',
      date
    }),
    'Sidor/example.com/2026-11-04_Nyheter idag.pdf'
  );
});

test('buildFilename klarar tom mall, tom mapp och utan sajtmapp', () => {
  // Tom mall faller tillbaka på standardmallen {title}.
  assert.equal(
    buildFilename({
      template: '',
      folder: '',
      perSiteFolder: false,
      site: 'example.com',
      title: 'Sida',
      date
    }),
    'Sida.pdf'
  );
});

test('buildFilename ersätter okända taggar och städar filnamn', () => {
  const name = buildFilename({
    template: '{site}/{title} ({okand})',
    folder: 'PDF',
    perSiteFolder: false,
    site: 'www.example.com',
    title: 'A/B: test?',
    date
  });
  assert.equal(name, 'PDF/www.example.com-AB test.pdf');
  assert.ok(!name.includes('{'), 'inga taggar ska vara kvar');
});

test('buildFilename använder sidtiteln som standard', () => {
  const name = buildFilename({
    folder: 'Sidor',
    perSiteFolder: true,
    site: 'app.alldata.com',
    title: 'removing - refitting : multifunction video camera',
    date
  });
  assert.equal(
    name,
    'Sidor/app.alldata.com/removing - refitting multifunction video camera.pdf'
  );
});

test('buildFilename lägger bara till .pdf en gång', () => {
  const name = buildFilename({
    template: 'rapport.pdf',
    folder: '',
    perSiteFolder: false,
    site: 'example.com',
    title: 'x',
    date
  });
  assert.equal(name, 'rapport.pdf');
});

test('buildFilename begränsar långa titlar', () => {
  const longTitle = 'a'.repeat(300);
  const name = buildFilename({
    template: '{title}',
    folder: 'Sidor',
    perSiteFolder: true,
    site: 'example.com',
    title: longTitle,
    date
  });
  const fileName = name.split('/').pop();
  assert.ok(fileName.length <= 125, `filnamnet var ${fileName.length} tecken`);
  assert.ok(fileName.endsWith('.pdf'));
});

test('buildFilename använder alla taggar', () => {
  const name = buildFilename({
    template: '{year}-{month}-{day}_{time}_{site}',
    folder: 'S',
    perSiteFolder: false,
    site: 'example.com',
    title: 'x',
    date
  });
  assert.equal(name, 'S/2026-11-04_14-05-09_example.com.pdf');
});
