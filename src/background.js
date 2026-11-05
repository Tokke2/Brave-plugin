/**
 * Bakgrundstjänst (service worker).
 *
 * Ansvar:
 *  – skapa PDF:er av fliken via DevTools-protokollet (Page.printToPDF)
 *  – avgöra om en URL tillhör en vald webbplats
 *  – registrera den flytande knappen på beviljade webbplatser
 *  – snabbkommando, högerklicksmeny, badge och historik
 */

import { getSettings, addHistory } from './lib/settings.js';
import { matchesUrl, originPatternFor, isPrintableUrl } from './lib/sites.js';
import { buildFilename } from './lib/filename.js';
import {
  buildPrintParams,
  paperWidthCssPx,
  autoFitScale,
  DARK_PRINT_CSS
} from './lib/print.js';
import { resolveLang, t } from './lib/i18n.js';

const CONTENT_SCRIPT_ID = 'site-pdf-button';
const CONTENT_FILES = ['src/content.js'];
const MENU_ID = 'page-to-pdf-save';
const BADGE_BUSY = '…';
const BADGE_OK = '✓';
const BADGE_FAIL = '!';

/** Flikar som just nu skriver ut – förhindrar dubbelklick. */
const inFlight = new Map();

class PdfError extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

function currentLang(settings) {
  return resolveLang(settings.language, chrome.i18n.getUILanguage());
}

function errorText(lang, code) {
  const known = [
    'restricted',
    'devtools',
    'attach',
    'print',
    'download',
    'notAllowed',
    'noTab',
    'busy',
    'canceled',
    'unexpected'
  ];
  return t(lang, `errors.${known.includes(code) ? code : 'unexpected'}`);
}

function isAllowedUrl(url, settings) {
  if (!isPrintableUrl(url)) return false;
  if (settings.allowAll) return true;
  return settings.sites.some((site) => site.enabled && matchesUrl(url, site.pattern));
}

/* ------------------------------------------------------------------ */
/* Badge och toast                                                     */
/* ------------------------------------------------------------------ */

async function setBadge(tabId, text, color) {
  try {
    await chrome.action.setBadgeText({ tabId, text });
    if (color) await chrome.action.setBadgeBackgroundColor({ tabId, color });
  } catch {
    /* fliken kan ha stängts */
  }
}

function clearBadgeLater(tabId, delay = 2500) {
  setTimeout(() => {
    void setBadge(tabId, '');
  }, delay);
}

async function sendToast(tabId, payload) {
  if (typeof tabId !== 'number') return;
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'TOAST', ...payload });
  } catch {
    /* ingen innehållsskript i fliken – inget att visa */
  }
}

/* ------------------------------------------------------------------ */
/* PDF-generering                                                      */
/* ------------------------------------------------------------------ */

/** Skickar ett DevTools-kommando till en flik. */
function sendCommand(target, method, params) {
  return chrome.debugger.sendCommand(target, method, params);
}

/**
 * Mäter hur bred sidan blir när den layouter mot pappersbredden.
 * Ger 0 när mätningen inte går att göra – då används användarens skala.
 */
async function measurePrintWidth(target, settings) {
  const usable = paperWidthCssPx(settings.pdf);
  try {
    await sendCommand(target, 'Emulation.setDeviceMetricsOverride', {
      width: Math.round(usable),
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    const result = await sendCommand(target, 'Runtime.evaluate', {
      expression:
        'Math.max(document.documentElement.scrollWidth || 0, document.body ? document.body.scrollWidth || 0 : 0)',
      returnByValue: true
    });
    return Number(result?.result?.value) || 0;
  } catch {
    return 0;
  } finally {
    try {
      await sendCommand(target, 'Emulation.clearDeviceMetricsOverride');
    } catch {
      /* ignoreras */
    }
  }
}

/** Lägger in mörk utskrift i sidan och returnerar en städare. */
async function applyDarkPrint(target) {
  const expression = `(() => {
    const id = '__page-to-pdf-dark';
    document.getElementById(id)?.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = ${JSON.stringify(DARK_PRINT_CSS)};
    (document.head || document.documentElement).appendChild(style);
    return true;
  })()`;

  await sendCommand(target, 'Runtime.evaluate', { expression, returnByValue: true });

  return async () => {
    try {
      await sendCommand(target, 'Runtime.evaluate', {
        expression: "document.getElementById('__page-to-pdf-dark')?.remove()",
        returnByValue: true
      });
    } catch {
      /* fliken kan ha stängts under utskriften */
    }
  };
}

async function waitForPageReady(target, waitMs) {
  const delay = Math.max(0, Math.min(5000, Number(waitMs) || 0));
  const expression = `(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    } catch (error) { /* ignoreras */ }
    const pending = Array.from(document.images || []).filter((img) => !img.complete).slice(0, 60);
    await Promise.all(pending.map((img) => new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 5000);
    })));
    await sleep(${delay});
    return true;
  })()`;

  try {
    await Promise.race([
      chrome.debugger.sendCommand(target, 'Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
      }),
      new Promise((resolve) => setTimeout(resolve, 8000))
    ]);
  } catch {
    /* sidan kan sakna Runtime – då hoppar vi bara över väntan */
  }
}

function mapError(error, stage) {
  const message = String(error?.detail || error?.message || error || '');
  if (/another debugger is already attached/i.test(message)) {
    return new PdfError('devtools', message);
  }
  if (/cancel/i.test(message)) {
    return new PdfError('canceled', message);
  }
  if (/cannot access|chrome:\/\/|extension pages|the tab is not|not supported/i.test(message)) {
    return new PdfError('restricted', message);
  }
  if (/no tab with given id|tab was closed/i.test(message)) {
    return new PdfError('noTab', message);
  }
  if (error instanceof PdfError) return error;
  return new PdfError(stage, message);
}

async function printTabToPdf(tabId, settings, tab = {}, { forceBackground = false } = {}) {
  const target = { tabId };
  let cleanupDark = null;

  try {
    await chrome.debugger.attach(target, '1.3');
  } catch (error) {
    throw mapError(error, 'attach');
  }

  try {
    await chrome.debugger.sendCommand(target, 'Page.enable');
    await waitForPageReady(target, settings.pdf.waitMs);

    if (settings.pdf.darkMode) cleanupDark = await applyDarkPrint(target);

    let scale = settings.pdf.scale;
    if (settings.pdf.autoScale) {
      const contentWidth = await measurePrintWidth(target, settings);
      scale = autoFitScale({
        contentWidth,
        usableWidth: paperWidthCssPx(settings.pdf),
        scale: settings.pdf.scale
      });
    }

    const params = buildPrintParams({ settings, tab, scale });
    if (forceBackground) params.printBackground = true;

    const result = await chrome.debugger.sendCommand(target, 'Page.printToPDF', params);
    if (!result || typeof result.data !== 'string' || !result.data) {
      throw new PdfError('print', 'Tomt svar från Page.printToPDF');
    }
    return result.data;
  } catch (error) {
    throw mapError(error, 'print');
  } finally {
    if (cleanupDark) await cleanupDark();
    chrome.debugger.detach(target).catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* Artikelläge                                                         */
/* ------------------------------------------------------------------ */

const READER_KEY = 'readerDoc';
const READER_PAGE = 'src/reader.html';

/**
 * Hämtar huvudinnehållet från sidan. Funktionen serialiseras och körs i
 * fliken, så den får inte använda något utanför sin egen kropp.
 */
function articleExtractor() {
  const absolute = (value) => {
    try {
      return new URL(value, location.href).href;
    } catch (error) {
      return value;
    }
  };

  const textLength = (element) => (element.innerText || '').trim().length;

  const linkDensity = (element) => {
    const total = textLength(element);
    if (!total) return 1;
    const links = Array.from(element.querySelectorAll('a')).reduce(
      (sum, link) => sum + (link.innerText || '').trim().length,
      0
    );
    return links / total;
  };

  const junkToken = /(^|[-_ ])(ad|ads|advert|banner|cookie|consent|gdpr|newsletter|subscribe|related|share|social|promo|popup|modal|sidebar|comment|paywall|nav|menu|breadcrumb|toolbar)([-_ ]|$)/i;

  const clean = (root) => {
    root
      .querySelectorAll(
        'script,style,noscript,nav,aside,footer,header,form,iframe,object,embed,button,input,select,textarea,[hidden],[aria-hidden="true"],[role="navigation"],[role="banner"],[role="complementary"],[role="dialog"]'
      )
      .forEach((element) => element.remove());

    root.querySelectorAll('div,section,ul,ol,aside').forEach((element) => {
      const token = `${element.className || ''} ${element.id || ''}`;
      if (junkToken.test(token)) element.remove();
    });

    root.querySelectorAll('img').forEach((image) => {
      const source =
        image.getAttribute('src') ||
        image.getAttribute('data-src') ||
        image.getAttribute('data-original') ||
        '';
      if (source) image.setAttribute('src', absolute(source));
      image.removeAttribute('srcset');
      image.removeAttribute('loading');
      image.removeAttribute('decoding');
      image.removeAttribute('data-src');
    });

    root.querySelectorAll('a[href]').forEach((link) => {
      link.setAttribute('href', absolute(link.getAttribute('href')));
      link.removeAttribute('target');
    });
  };

  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '#content',
    '.content',
    '.article',
    '.article-body',
    '.post',
    '.entry-content',
    '.post-content'
  ];

  let candidates = Array.from(document.querySelectorAll(selectors.join(',')));
  if (!candidates.length) candidates = Array.from(document.querySelectorAll('div, section'));

  let best = null;
  let bestScore = 0;
  for (const candidate of candidates.slice(0, 400)) {
    const length = textLength(candidate);
    if (length < 300) continue;
    const weight = candidate.tagName === 'ARTICLE' ? 1.3 : 1;
    const score = length * (1 - Math.min(0.9, linkDensity(candidate))) * weight;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (!best) best = document.body;
  if (!best) return null;

  const container = document.createElement('div');
  container.appendChild(best.cloneNode(true));
  clean(container);

  const heading = document.querySelector('h1');
  const title =
    (heading && heading.innerText ? heading.innerText : document.title || '').trim() || '';

  return {
    title,
    url: location.href,
    html: container.innerHTML,
    words: textLength(container)
  };
}

/** Kör artikellägets extrahering i fliken och kopplar loss debuggern. */
async function extractArticle(tabId, waitMs) {
  const target = { tabId };
  try {
    await chrome.debugger.attach(target, '1.3');
  } catch (error) {
    throw mapError(error, 'attach');
  }

  try {
    await chrome.debugger.sendCommand(target, 'Page.enable');
    await waitForPageReady(target, Math.min(Number(waitMs) || 0, 1200));
    const result = await chrome.debugger.sendCommand(target, 'Runtime.evaluate', {
      expression: `(${articleExtractor.toString()})()`,
      awaitPromise: true,
      returnByValue: true
    });
    return result?.result?.value || null;
  } finally {
    chrome.debugger.detach(target).catch(() => {});
  }
}

/** Artikelsidor som just nu väntar på att bli färdigritade. */
const readerWaiters = new Map();

function waitForReaderSignal(tabId, timeout) {
  return new Promise((resolve) => {
    const finish = (value) => {
      clearTimeout(timer);
      readerWaiters.delete(tabId);
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), timeout);
    readerWaiters.set(tabId, () => finish(true));
  });
}

/**
 * Väntar tills den tillfälliga artikelsidan är färdigritad. Sidan skickar
 * READER_READY när bilderna är klara; som reserv fortsätter vi efter en
 * kort stund även om signalen uteblir (Page.printToPDF väntar ändå på
 * teckensnitt och bilder).
 */
async function waitForReader(tabId, timeout = 6000) {
  const signal = waitForReaderSignal(tabId, timeout);
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) return false;
    if (tab.status === 'complete') break;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  const ready = await Promise.race([
    signal,
    new Promise((resolve) => setTimeout(() => resolve(true), 2000))
  ]);
  return ready;
}

/**
 * Skriver ut bara artikelns innehåll via en tillfällig sida i tillägget.
 * Returnerar null när ingen artikel hittas – då skrivs hela sidan ut i stället.
 */
async function printReaderPdf(tab, settings) {
  let article = null;
  try {
    article = await extractArticle(tab.id, settings.pdf.waitMs);
  } catch (error) {
    console.warn('Artikelläget kunde inte läsa sidan', error);
    return null;
  }

  if (!article || !article.html || (article.words || 0) < 300) return null;

  try {
    await chrome.storage.session.set({ [READER_KEY]: article });
  } catch {
    return null;
  }

  let readerTab = null;
  try {
    readerTab = await chrome.tabs.create({
      url: chrome.runtime.getURL(READER_PAGE),
      active: false
    });
    if (!readerTab?.id) return null;
    if (!(await waitForReader(readerTab.id))) return null;

    // Artikelsidan har egen, läsanpassad bredd – autoskalan behövs inte där.
    const readerSettings = { ...settings, pdf: { ...settings.pdf, autoScale: false } };

    return await printTabToPdf(
      readerTab.id,
      readerSettings,
      { ...tab, title: article.title || tab.title },
      { forceBackground: true }
    );
  } catch (error) {
    console.warn('Artikelläget misslyckades', error);
    return null;
  } finally {
    if (readerTab?.id) chrome.tabs.remove(readerTab.id).catch(() => {});
    chrome.storage.session.remove(READER_KEY).catch(() => {});
  }
}

const OFFSCREEN_URL = 'src/offscreen.html';

/** Startar det osynliga hjälpdokumentet som kan skapa blob-URL:er. */
async function ensureOffscreenDocument() {
  if (!chrome.offscreen) return false;
  try {
    if (typeof chrome.offscreen.hasDocument === 'function' && (await chrome.offscreen.hasDocument())) {
      return true;
    }
  } catch {
    /* hasDocument kan saknas – försök skapa ändå */
  }
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['BLOBS'],
      justification: 'Skapa blob-URL:er så att stora PDF-filer kan sparas utan att trunkeras.'
    });
    return true;
  } catch (error) {
    return /single offscreen|already/i.test(String(error?.message || ''));
  }
}

async function makeBlobUrl(base64) {
  if (!(await ensureOffscreenDocument())) {
    throw new PdfError('download', 'Offscreen-dokumentet kunde inte skapas');
  }
  const response = await new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { target: 'offscreen', type: 'MAKE_BLOB_URL', base64, mime: 'application/pdf' },
      (result) => {
        const error = chrome.runtime.lastError;
        if (error) reject(new PdfError('download', error.message));
        else resolve(result);
      }
    );
  });
  if (!response || !response.url) {
    throw new PdfError('download', response?.error || 'Ingen blob-URL skapades');
  }
  return response.url;
}

function downloadUrl(url, filename, settings) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url,
        filename,
        saveAs: !!settings.file.saveAs,
        conflictAction: 'uniquify'
      },
      (downloadId) => {
        const error = chrome.runtime.lastError;
        if (error || typeof downloadId !== 'number') {
          reject(new PdfError('download', error?.message || 'Inget nedladdnings-id'));
          return;
        }
        resolve(downloadId);
      }
    );
  });
}

async function downloadPdf(base64, filename, settings) {
  try {
    const blobUrl = await makeBlobUrl(base64);
    return await downloadUrl(blobUrl, filename, settings);
  } catch (error) {
    const mapped = mapError(error, 'download');
    // Avbröt användaren spar-dialogen ska vi inte försöka igen.
    if (mapped.code === 'canceled') throw mapped;

    // Reservlösning om offscreen inte fungerar: data-URL, som bara klarar
    // filer under cirka 2 MB (base64).
    if (base64.length < 1400000) {
      try {
        return await downloadUrl(`data:application/pdf;base64,${base64}`, filename, settings);
      } catch (fallbackError) {
        throw mapError(fallbackError, 'download');
      }
    }
    throw mapped;
  }
}

/** Hämtar information om en nedladdning, bl.a. den absoluta sökvägen. */
function getDownloadItem(downloadId) {
  return new Promise((resolve) => {
    try {
      chrome.downloads.search({ id: downloadId }, (items) => {
        const error = chrome.runtime.lastError;
        if (error || !Array.isArray(items) || !items.length) {
          resolve(null);
          return;
        }
        resolve(items[0]);
      });
    } catch {
      resolve(null);
    }
  });
}

function makeFilename(tab, settings) {
  let site = 'webbplats';
  try {
    site = new URL(tab.url).hostname.replace(/^www\./, '') || 'webbplats';
  } catch {
    /* behåll standardvärdet */
  }
  const title = tab.title || site;
  return buildFilename({
    template: settings.file.template,
    folder: settings.file.folder,
    perSiteFolder: settings.file.perSiteFolder,
    site,
    title,
    date: new Date()
  });
}

/* ------------------------------------------------------------------ */
/* Spara-flödet                                                         */
/* ------------------------------------------------------------------ */

async function runSave(tab, options = {}) {
  const settings = await getSettings();
  const lang = currentLang(settings);
  const tabId = tab.id;

  // Snabbkommandot utan dialog (eller Alt-klick på sidknappen) överstyr
  // inställningen för just den här sparningen.
  const forceSaveAs = typeof options.forceSaveAs === 'boolean' ? options.forceSaveAs : null;
  const effective =
    forceSaveAs === null
      ? settings
      : { ...settings, file: { ...settings.file, saveAs: forceSaveAs } };

  if (!isPrintableUrl(tab.url)) {
    const message = errorText(lang, 'restricted');
    await sendToast(tabId, { state: 'error', text: message });
    await setBadge(tabId, BADGE_FAIL, '#b42318');
    clearBadgeLater(tabId, 4000);
    return { ok: false, error: 'restricted', message };
  }

  if (!isAllowedUrl(tab.url, settings)) {
    const message = errorText(lang, 'notAllowed');
    await sendToast(tabId, { state: 'error', text: message });
    await setBadge(tabId, BADGE_FAIL, '#b42318');
    clearBadgeLater(tabId, 4000);
    return { ok: false, error: 'notAllowed', message };
  }

  await setBadge(tabId, BADGE_BUSY, '#6b7280');
  await sendToast(tabId, { state: 'saving', text: t(lang, 'toast.saving') });

  try {
    let base64 = null;
    let readerFallback = false;

    if (settings.pdf.reader) {
      base64 = await printReaderPdf(tab, settings);
      readerFallback = !base64;
    }
    if (!base64) base64 = await printTabToPdf(tabId, settings, tab);

    const filename = makeFilename(tab, settings);
    const downloadId = await downloadPdf(base64, filename, effective);
    const item = await getDownloadItem(downloadId);
    const filePath = item?.filename || '';

    await addHistory({
      filename,
      filePath,
      url: tab.url,
      title: tab.title || filename,
      downloadId
    });

    await setBadge(tabId, BADGE_OK, '#1f7a44');
    await sendToast(tabId, {
      state: 'saved',
      text: t(lang, 'toast.saved', { file: filename.split('/').pop() })
    });
    clearBadgeLater(tabId);
    return { ok: true, filename, downloadId, filePath, readerFallback };
  } catch (error) {
    const mapped = mapError(error, 'unexpected');
    const message = errorText(lang, mapped.code);

    if (mapped.code === 'canceled') {
      // Användaren stängde spar-dialogen – inget fel, bara ingen fil.
      await sendToast(tabId, { state: 'info', text: message });
      clearBadgeLater(tabId, 1500);
      return { ok: false, error: 'canceled', message };
    }

    console.warn('PDF misslyckades:', mapped.code, mapped.detail || '');
    await setBadge(tabId, BADGE_FAIL, '#b42318');
    await sendToast(tabId, { state: 'error', text: message });
    clearBadgeLater(tabId, 5000);
    return { ok: false, error: mapped.code, message };
  }
}

async function handleSaveRequest(tab, options = {}) {
  if (!tab || typeof tab.id !== 'number') {
    return { ok: false, error: 'noTab', message: t('en', 'errors.noTab') };
  }
  if (inFlight.has(tab.id)) {
    const settings = await getSettings();
    return { ok: false, error: 'busy', message: errorText(currentLang(settings), 'busy') };
  }
  const task = runSave(tab, options).finally(() => inFlight.delete(tab.id));
  inFlight.set(tab.id, task);
  return task;
}

/* ------------------------------------------------------------------ */
/* Innehållsskript för den flytande knappen                            */
/* ------------------------------------------------------------------ */

async function grantedOriginsFor(settings) {
  if (!settings.button.show) return [];
  const origins = new Set();
  for (const site of settings.sites) {
    if (!site.enabled) continue;
    const origin = originPatternFor(site.pattern);
    if (!origin) continue;
    let granted = false;
    try {
      granted = await chrome.permissions.contains({ origins: [origin] });
    } catch {
      granted = false;
    }
    if (granted) origins.add(origin);
  }
  return [...origins];
}

async function injectIntoOpenTabs(origins) {
  if (!origins.length) return;
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: origins });
  } catch {
    return;
  }
  for (const tab of tabs) {
    if (typeof tab.id !== 'number') continue;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_FILES });
    } catch {
      /* fliken kan vara en intern sida */
    }
  }
}

let syncTask = Promise.resolve();

/** Registrerar knappen på de webbplatser som användaren gett åtkomst till. */
async function getRegisteredScript() {
  try {
    const list = await chrome.scripting.getRegisteredContentScripts({ ids: [CONTENT_SCRIPT_ID] });
    return Array.isArray(list) ? list[0] || null : null;
  } catch {
    return null;
  }
}

function syncContentScripts({ inject = true } = {}) {
  syncTask = syncTask
    .then(async () => {
      const settings = await getSettings();
      const origins = [...(await grantedOriginsFor(settings))].sort();

      const existing = await getRegisteredScript();
      const unchanged =
        existing !== null &&
        Array.isArray(existing.matches) &&
        JSON.stringify([...existing.matches].sort()) === JSON.stringify(origins);

      if (!unchanged) {
        try {
          await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
        } catch {
          /* fanns inte registrerat */
        }

        if (origins.length) {
          try {
            await chrome.scripting.registerContentScripts([
              {
                id: CONTENT_SCRIPT_ID,
                matches: origins,
                js: CONTENT_FILES,
                runAt: 'document_idle',
                allFrames: false,
                persistAcrossSessions: true
              }
            ]);
          } catch (error) {
            console.warn('Kunde inte registrera innehållsskriptet', error);
            return;
          }
        }
      }

      // Flikar som redan är öppna får knappen direkt.
      if (inject && origins.length) await injectIntoOpenTabs(origins);
    })
    .catch((error) => console.warn('syncContentScripts misslyckades', error));
  return syncTask;
}

/* ------------------------------------------------------------------ */
/* Högerklicksmeny                                                     */
/* ------------------------------------------------------------------ */

async function syncContextMenu(settings) {
  const activeSettings = settings || (await getSettings());
  const lang = currentLang(activeSettings);
  try {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: MENU_ID,
      title: t(lang, 'menu.savePdf'),
      contexts: ['page']
    });
  } catch (error) {
    console.warn('Kunde inte skapa högerklicksmenyn', error);
  }

  try {
    await chrome.action.setTitle({ title: t(lang, 'appName') });
  } catch {
    /* ignoreras */
  }
}

/* ------------------------------------------------------------------ */
/* Sidkontext för innehållsskriptet                                    */
/* ------------------------------------------------------------------ */

async function buildPageContext(url) {
  const settings = await getSettings();
  const lang = currentLang(settings);
  return {
    allowed: isAllowedUrl(url, settings),
    show: settings.button.show,
    position: settings.button.position,
    lang,
    theme: settings.theme,
    strings: {
      button: t(lang, 'content.button'),
      buttonShort: t(lang, 'content.buttonShort'),
      altHint: t(lang, 'content.altHint'),
      saving: t(lang, 'toast.saving'),
      saved: t(lang, 'toast.saved'),
      failed: t(lang, 'errors.unexpected')
    }
  };
}

/* ------------------------------------------------------------------ */
/* Händelser                                                           */
/* ------------------------------------------------------------------ */

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    await syncContentScripts();
    await syncContextMenu();
    if (details.reason === 'install') {
      try {
        await chrome.runtime.openOptionsPage();
      } catch {
        /* ignoreras */
      }
    }
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void syncContentScripts();
  void syncContextMenu();
});

chrome.permissions.onAdded.addListener(() => void syncContentScripts());
chrome.permissions.onRemoved.addListener(() => void syncContentScripts());

function contentSyncNeeded(before, after) {
  const simplify = (value) => {
    if (!value || typeof value !== 'object') return '';
    const sites = Array.isArray(value.sites)
      ? value.sites.map((site) => `${site?.pattern}:${site?.enabled ? 1 : 0}`)
      : [];
    return JSON.stringify({ sites, show: value.button?.show !== false });
  };
  return simplify(before) !== simplify(after);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.settings) return;
  const { oldValue, newValue } = changes.settings;
  if (contentSyncNeeded(oldValue, newValue)) void syncContentScripts();
  if (oldValue?.language !== newValue?.language) void syncContextMenu();
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'save-pdf' && command !== 'save-pdf-quiet') return;
  // save-pdf-quiet hoppar över spar-dialogen och lägger filen direkt i
  // webbläsarens hämtningsmapp.
  const options = command === 'save-pdf-quiet' ? { forceSaveAs: false } : {};
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    const result = await handleSaveRequest(tab, options);
    if (!result.ok && result.error === 'notAllowed') {
      // Visa panelen så att användaren kan lägga till webbplatsen.
      try {
        await chrome.action.openPopup();
      } catch {
        /* openPopup saknas i äldre versioner */
      }
    }
  })();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab) return;
  void handleSaveRequest(tab);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Meddelanden till offscreen-dokumentet ska inte hanteras här.
  if (message?.target === 'offscreen') return undefined;
  handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error) => {
      console.warn('Meddelande misslyckades', error);
      sendResponse({ ok: false, error: 'unexpected' });
    });
  return true;
});

async function handleMessage(message, sender) {
  if (!message || typeof message !== 'object') return { ok: false, error: 'unexpected' };

  switch (message.type) {
    case 'PAGE_CONTEXT': {
      const url = sender?.tab?.url || message.url || '';
      return { ok: true, context: await buildPageContext(url) };
    }

    case 'SAVE_PDF': {
      let tab = sender?.tab;
      if (!tab && typeof message.tabId === 'number') {
        try {
          tab = await chrome.tabs.get(message.tabId);
        } catch {
          tab = null;
        }
      }
      if (!tab) {
        const settings = await getSettings();
        const lang = currentLang(settings);
        return { ok: false, error: 'noTab', message: errorText(lang, 'noTab') };
      }
      if (!tab.url && typeof message.url === 'string') {
        tab = { ...tab, url: message.url };
      }
      return handleSaveRequest(tab, {
        forceSaveAs: typeof message.forceSaveAs === 'boolean' ? message.forceSaveAs : undefined
      });
    }

    case 'OPEN_DOWNLOAD':
    case 'SHOW_DOWNLOAD': {
      if (typeof message.downloadId !== 'number') return { ok: false, error: 'unexpected' };
      try {
        if (message.type === 'OPEN_DOWNLOAD') chrome.downloads.open(message.downloadId);
        else chrome.downloads.show(message.downloadId);
        return { ok: true };
      } catch {
        return { ok: false, error: 'download' };
      }
    }

    case 'READER_READY': {
      if (sender?.id && sender.id !== chrome.runtime.id) return { ok: false, error: 'unexpected' };
      const waiter = readerWaiters.get(sender?.tab?.id);
      if (waiter) waiter();
      return { ok: true };
    }

    case 'SYNC_CONTENT_SCRIPTS': {
      await syncContentScripts();
      return { ok: true };
    }

    default:
      return { ok: false, error: 'unexpected' };
  }
}

// Se till att standardinställningarna finns och att knappen är registrerad
// redan innan första händelsen kommer in.
void getSettings();
void syncContentScripts({ inject: false });
