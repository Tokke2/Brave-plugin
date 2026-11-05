import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizePattern,
  splitPattern,
  isValidPattern,
  isValidHost,
  hostMatches,
  matchesUrl,
  originPatternFor,
  suggestPatternFromUrl,
  isPrintableUrl
} from '../src/lib/sites.js';

test('normalizePattern tar bort protokoll, fragment och snedstreck', () => {
  assert.equal(normalizePattern('https://Example.com/'), 'example.com');
  assert.equal(normalizePattern('  http://example.com/nyheter/  '), 'example.com/nyheter');
  assert.equal(normalizePattern('example.com#avsnitt'), 'example.com');
  assert.equal(normalizePattern('example.com/sida?q=1'), 'example.com/sida');
  assert.equal(normalizePattern(''), '');
  assert.equal(normalizePattern(null), '');
});

test('splitPattern delar värd och sökväg', () => {
  assert.deepEqual(splitPattern('example.com'), { host: 'example.com', path: '' });
  assert.deepEqual(splitPattern('example.com/nyheter'), {
    host: 'example.com',
    path: '/nyheter'
  });
});

test('isValidHost accepterar domäner, localhost, port och wildcard', () => {
  assert.equal(isValidHost('example.com'), true);
  assert.equal(isValidHost('*.example.com'), true);
  assert.equal(isValidHost('localhost'), true);
  assert.equal(isValidHost('localhost:3000'), true);
  assert.equal(isValidHost('192.168.1.10'), true);
  assert.equal(isValidHost('example.com:70000'), false);
  assert.equal(isValidHost('-example.com'), false);
  assert.equal(isValidHost('example..com'), false);
  assert.equal(isValidHost('example.com/nyheter'), false);
});

test('isValidPattern godkänner och avvisar rimliga mönster', () => {
  assert.equal(isValidPattern('example.com'), true);
  assert.equal(isValidPattern('https://www.example.com/nyheter'), true);
  assert.equal(isValidPattern('*.example.com'), true);
  assert.equal(isValidPattern('inte en adress'), false);
  assert.equal(isValidPattern(''), false);
  assert.equal(isValidPattern('http://'), false);
  assert.equal(isValidPattern('example.com/' + 'a'.repeat(210)), false);
});

test('hostMatches hanterar wildcard som Chromes matchmönster', () => {
  assert.equal(hostMatches('example.com', 'example.com'), true);
  assert.equal(hostMatches('www.example.com', 'example.com'), false);
  assert.equal(hostMatches('www.example.com', '*.example.com'), true);
  assert.equal(hostMatches('example.com', '*.example.com'), true);
  assert.equal(hostMatches('deep.www.example.com', '*.example.com'), true);
  assert.equal(hostMatches('example.com.evil.se', '*.example.com'), false);
  assert.equal(hostMatches('EXAMPLE.com', 'example.com'), true);
});

test('matchesUrl matchar värd, subdomän och sökväg', () => {
  assert.equal(matchesUrl('https://example.com/a/b', 'example.com'), true);
  assert.equal(matchesUrl('https://example.com:8443/a', 'example.com:8443'), true);
  assert.equal(matchesUrl('http://example.com/', 'https://example.com'), true);
  assert.equal(matchesUrl('https://www.example.com/x', '*.example.com'), true);
  assert.equal(matchesUrl('https://example.com/nyheter/2026/11', 'example.com/nyheter'), true);
  assert.equal(matchesUrl('https://example.com/nyheter', 'example.com/nyheter'), true);
  assert.equal(matchesUrl('https://example.com/nyheterx', 'example.com/nyheter'), false);
  assert.equal(matchesUrl('https://example.com/annat', 'example.com/nyheter'), false);
  assert.equal(matchesUrl('https://other.com/', 'example.com'), false);
  assert.equal(matchesUrl('ftp://example.com/', 'example.com'), false);
  assert.equal(matchesUrl('inte-en-url', 'example.com'), false);
  assert.equal(matchesUrl('chrome://extensions', 'example.com'), false);
});

test('originPatternFor ger ett giltigt behörighetsmönster', () => {
  assert.equal(originPatternFor('example.com/nyheter'), '*://example.com/*');
  assert.equal(originPatternFor('https://*.example.com'), '*://*.example.com/*');
  assert.equal(originPatternFor('localhost:3000'), '*://localhost:3000/*');
  assert.equal(originPatternFor('inte giltigt'), '');
});

test('suggestPatternFromUrl föreslår wildcard för www', () => {
  assert.equal(suggestPatternFromUrl('https://www.example.com/a'), '*.example.com');
  assert.equal(suggestPatternFromUrl('https://example.com/a'), 'example.com');
  assert.equal(suggestPatternFromUrl('https://sub.example.com/a'), 'sub.example.com');
  assert.equal(suggestPatternFromUrl('https://www.localhost/'), 'www.localhost');
  assert.equal(suggestPatternFromUrl('chrome://extensions'), '');
  assert.equal(suggestPatternFromUrl('inte en url'), '');
});

test('isPrintableUrl godkänner bara http och https', () => {
  assert.equal(isPrintableUrl('https://example.com'), true);
  assert.equal(isPrintableUrl('http://example.com'), true);
  assert.equal(isPrintableUrl('chrome://extensions'), false);
  assert.equal(isPrintableUrl('brave://settings'), false);
  assert.equal(isPrintableUrl('file:///tmp/a.html'), false);
  assert.equal(isPrintableUrl(''), false);
});
