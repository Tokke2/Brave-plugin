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
  choosePageOrientation,
  normalizePageRanges,
  PRINT_FRIENDLY_CSS,
  DARK_PRINT_CSS
} from './lib/print.js';
import { resolveLang, t } from './lib/i18n.js';

const CONTENT_SCRIPT_ID = 'site-pdf-button';
const CONTENT_FILES = ['src/lib/icons.js', 'src/content.js'];
const MENU_ID = 'page-to-pdf-save';
const SELECTION_MENU_ID = 'page-to-pdf-save-selection';
const ELEMENT_MENU_ID = 'page-to-pdf-pick-element';
const PANEL_MENU_ID = 'page-to-pdf-open-panel';
const UPDATE_MENU_ID = 'page-to-pdf-check-updates';
const RELOAD_MENU_ID = 'page-to-pdf-reload';
const UPDATE_API_PERMISSION = 'https://api.github.com/*';
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
    'pageRangeInvalid',
    'captureTooLarge',
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
 * Mäter sidans faktiska bredd vid stående eller liggande A4-layout.
 * Ger 0 när mätningen inte går att göra.
 */
async function measurePrintWidth(target, settings, orientation = 'portrait') {
  const usable = paperWidthCssPx(settings.pdf, orientation);
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

async function applyPrintEnhancements(target, settings) {
  const watermark = String(settings.pdf.watermark || '').slice(0, 80);
  const expression = `(() => {
    document.getElementById('__stp-print-style')?.remove();
    document.getElementById('__stp-watermark')?.remove();
    const style = document.createElement('style');
    style.id = '__stp-print-style';
    style.textContent = ${JSON.stringify(PRINT_FRIENDLY_CSS)} + (${JSON.stringify(watermark)} ? '@media print { #__stp-watermark { display:block !important; } }' : '');
    (document.head || document.documentElement).appendChild(style);
    if (${JSON.stringify(watermark)}) {
      const mark = document.createElement('div');
      mark.id = '__stp-watermark';
      mark.textContent = ${JSON.stringify(watermark)};
      mark.setAttribute('aria-hidden', 'true');
      mark.style.cssText = 'display:none;position:fixed;z-index:2147483646;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-35deg);pointer-events:none;white-space:normal;overflow-wrap:anywhere;font:700 clamp(20px,5vw,56px)/1 system-ui,sans-serif;color:rgba(100,100,100,.2);width:max-content;max-width:90vw;text-align:center;';
      (document.body || document.documentElement).appendChild(mark);
    }
    return true;
  })()`;
  try {
    await sendCommand(target, 'Runtime.evaluate', { expression, returnByValue: true });
  } catch {
    return async () => {};
  }
  return async () => {
    try {
      await sendCommand(target, 'Runtime.evaluate', {
        expression: "document.getElementById('__stp-print-style')?.remove(); document.getElementById('__stp-watermark')?.remove()",
        returnByValue: true
      });
    } catch {
      /* fliken kan ha stängts under utskriften */
    }
  };
}

async function optimizePageImages(target) {
  const expression = `(() => {
    const saved = [];
    for (const image of Array.from(document.images || [])) {
      if (!image.complete || !image.naturalWidth || image.naturalWidth * image.naturalHeight < 500000) continue;
      const rect = image.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      try {
        const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/webp', 0.78);
        if (!compressed.startsWith('data:image/webp')) continue;
        saved.push({ image, src: image.getAttribute('src'), srcset: image.getAttribute('srcset'), style: image.getAttribute('style') });
        image.removeAttribute('srcset');
        image.style.setProperty('width', rect.width + 'px', 'important');
        image.style.setProperty('height', rect.height + 'px', 'important');
        image.src = compressed;
      } catch {
        // Canvas-tainted cross-origin images are left untouched.
      }
    }
    window.__stpOptimizedImages = saved;
    return saved.length;
  })()`;
  try {
    const result = await sendCommand(target, 'Runtime.evaluate', { expression, returnByValue: true });
    return Number(result?.result?.value) || 0;
  } catch {
    return 0;
  }
}

async function restorePageImages(target) {
  try {
    await sendCommand(target, 'Runtime.evaluate', {
      expression: `(() => {
        for (const saved of window.__stpOptimizedImages || []) {
          if (saved.src === null) saved.image.removeAttribute('src'); else saved.image.setAttribute('src', saved.src);
          if (saved.srcset === null) saved.image.removeAttribute('srcset'); else saved.image.setAttribute('srcset', saved.srcset);
          if (saved.style === null) saved.image.removeAttribute('style'); else saved.image.setAttribute('style', saved.style);
        }
        delete window.__stpOptimizedImages;
      })()`,
      returnByValue: true
    });
  } catch {
    /* fliken kan ha stängts under utskriften */
  }
}

async function waitForPageReady(target, waitMs) {
  const delay = Math.max(0, Math.min(5000, Number(waitMs) || 0));
  const expression = `(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    } catch (error) { /* ignoreras */ }
    const images = Array.from(document.images || []);
    for (const image of images) {
      if (image.loading === 'lazy') image.loading = 'eager';
    }
    const pending = images.filter((img) => !img.complete).slice(0, 100);
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

async function printTabToPdf(tabId, settings, tab = {}, { forceBackground = false, pageRanges = '' } = {}) {
  const target = { tabId };
  let cleanupDark = null;
  let cleanupEnhancements = null;
  let imagesOptimized = false;

  try {
    await chrome.debugger.attach(target, '1.3');
  } catch (error) {
    throw mapError(error, 'attach');
  }

  try {
    await chrome.debugger.sendCommand(target, 'Page.enable');
    await waitForPageReady(target, settings.pdf.waitMs);

    if (settings.pdf.darkMode) cleanupDark = await applyDarkPrint(target);
    cleanupEnhancements = await applyPrintEnhancements(target, settings);
    if (settings.pdf.optimizeImages) {
      imagesOptimized = (await optimizePageImages(target)) > 0;
      if (imagesOptimized) {
        await sendCommand(target, 'Runtime.evaluate', {
          expression: 'Promise.all(Array.from(document.images || []).map((image) => image.decode?.().catch(() => {})))',
          awaitPromise: true,
          returnByValue: true
        }).catch(() => {});
      }
    }

    const portraitContentWidth = await measurePrintWidth(target, settings, 'portrait');
    const landscapeContentWidth = await measurePrintWidth(target, settings, 'landscape');
    const orientation = choosePageOrientation({
      portraitContentWidth,
      landscapeContentWidth,
      marginMm: settings.pdf.marginMm,
      scale: settings.pdf.scale
    });
    const landscape = orientation === 'landscape';
    const contentWidth = landscape ? landscapeContentWidth : portraitContentWidth;
    const scale = autoFitScale({
      contentWidth,
      usableWidth: paperWidthCssPx(settings.pdf, orientation),
      scale: settings.pdf.scale
    });

    const params = buildPrintParams({ settings, tab, scale, landscape, pageRanges });
    if (forceBackground) params.printBackground = true;

    let result;
    try {
      result = await chrome.debugger.sendCommand(target, 'Page.printToPDF', params);
    } catch (error) {
      if (!/generateDocumentOutline|unknown parameter|invalid parameters/i.test(String(error?.message || error))) throw error;
      const compatibleParams = { ...params };
      delete compatibleParams.generateDocumentOutline;
      result = await chrome.debugger.sendCommand(target, 'Page.printToPDF', compatibleParams);
    }
    if (!result || typeof result.data !== 'string' || !result.data) {
      throw new PdfError('print', 'Tomt svar från Page.printToPDF');
    }
    return result.data;
  } catch (error) {
    throw mapError(error, 'print');
  } finally {
    if (settings.pdf.optimizeImages) await restorePageImages(target);
    if (cleanupEnhancements) await cleanupEnhancements();
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
async function printReaderContentPdf(tab, settings, article, { pageRanges = '' } = {}) {
  if (!article?.html) return null;
  try {
    await chrome.storage.session.set({ [READER_KEY]: article });
  } catch {
    return null;
  }

  let readerTab = null;
  try {
    readerTab = await chrome.tabs.create({ url: chrome.runtime.getURL(READER_PAGE), active: false });
    if (!readerTab?.id || !(await waitForReader(readerTab.id))) return null;
    return await printTabToPdf(
      readerTab.id,
      settings,
      { ...tab, title: article.title || tab.title },
      { forceBackground: true, pageRanges }
    );
  } catch (error) {
    console.warn('Det valda innehållet kunde inte skrivas ut', error);
    return null;
  } finally {
    if (readerTab?.id) chrome.tabs.remove(readerTab.id).catch(() => {});
    chrome.storage.session.remove(READER_KEY).catch(() => {});
  }
}

async function printReaderPdf(tab, settings, options = {}) {
  let article = null;
  try {
    article = await extractArticle(tab.id, settings.pdf.waitMs);
  } catch (error) {
    console.warn('Artikelläget kunde inte läsa sidan', error);
    return null;
  }
  if (!article || !article.html || (article.words || 0) < 300) return null;
  return printReaderContentPdf(tab, settings, article, options);
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
    const downloadId = await downloadUrl(blobUrl, filename, settings);
    return { downloadId, blobUrl };
  } catch (error) {
    const mapped = mapError(error, 'download');
    // Avbröt användaren spar-dialogen ska vi inte försöka igen.
    if (mapped.code === 'canceled') throw mapped;

    // Reservlösning om offscreen inte fungerar: data-URL, som bara klarar
    // filer under cirka 2 MB (base64).
    if (base64.length < 1400000) {
      try {
        const downloadId = await downloadUrl(`data:application/pdf;base64,${base64}`, filename, settings);
        return { downloadId, blobUrl: '' };
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

async function waitForDownloadComplete(downloadId, timeoutMs = 45000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.downloads.onChanged.removeListener(listener);
      resolve(value);
    };
    const listener = (delta) => {
      if (delta.id !== downloadId) return;
      if (delta.state?.current === 'complete') finish(true);
      else if (delta.state?.current === 'interrupted') finish(false);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    chrome.downloads.onChanged.addListener(listener);
    void getDownloadItem(downloadId).then((item) => {
      if (item?.state === 'complete') finish(true);
      else if (!item || item.state === 'interrupted') finish(false);
    });
  });
}

async function openPdfBlobAfterSave(downloadId, blobUrl) {
  if (!blobUrl || !(await waitForDownloadComplete(downloadId))) return false;
  try {
    await chrome.tabs.create({ url: blobUrl, active: true });
    return true;
  } catch {
    // Fall back to the panel's explicit Open PDF action if navigation is blocked.
    return false;
  }
}

function makeFilename(tab, settings, titleOverride = '') {
  let site = 'webbplats';
  try {
    site = new URL(tab.url).hostname.replace(/^www\./, '') || 'webbplats';
  } catch {
    /* behåll standardvärdet */
  }
  const title = titleOverride || tab.title || site;
  return buildFilename({
    template: settings.file.template,
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
  const pageRanges = normalizePageRanges(options.pageRanges);
  if (pageRanges === null) {
    const message = errorText(lang, 'pageRangeInvalid');
    return { ok: false, error: 'pageRangeInvalid', message };
  }
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

  if (!options.allowUnselected && !isAllowedUrl(tab.url, settings)) {
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
      base64 = await printReaderPdf(tab, settings, { pageRanges });
      readerFallback = !base64;
    }
    if (!base64) base64 = await printTabToPdf(tabId, settings, tab, { pageRanges });

    const filename = makeFilename(tab, settings);
    const { downloadId, blobUrl } = await downloadPdf(base64, filename, effective);
    const item = await getDownloadItem(downloadId);
    const filePath = item?.filename || '';

    await addHistory({
      filename,
      filePath,
      url: tab.url,
      title: tab.title || filename,
      downloadId
    });
    const autoOpenFailed = settings.pdf.openAfterSave && !(await openPdfBlobAfterSave(downloadId, blobUrl));

    await setBadge(tabId, BADGE_OK, '#1f7a44');
    await sendToast(tabId, {
      state: 'saved',
      text: t(lang, 'toast.saved', { file: filename.split('/').pop() })
    });
    clearBadgeLater(tabId);
    return { ok: true, filename, downloadId, filePath, readerFallback, autoOpenFailed };
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

async function runCapturedSave(tab, article, options = {}) {
  const settings = await getSettings();
  const lang = currentLang(settings);
  const pageRanges = normalizePageRanges(options.pageRanges);
  if (pageRanges === null) return { ok: false, error: 'pageRangeInvalid', message: errorText(lang, 'pageRangeInvalid') };
  if (!isPrintableUrl(tab?.url)) return { ok: false, error: 'restricted', message: errorText(lang, 'restricted') };
  if (!article?.html || article.html.length > 1_000_000) {
    return { ok: false, error: 'captureTooLarge', message: errorText(lang, 'captureTooLarge') };
  }

  await setBadge(tab.id, BADGE_BUSY, '#6b7280');
  await sendToast(tab.id, { state: 'saving', text: t(lang, 'toast.saving') });
  try {
    const base64 = await printReaderContentPdf(tab, settings, article, { pageRanges });
    if (!base64) throw new PdfError('print', 'Kunde inte skapa PDF av det valda innehållet');
    const title = String(article.title || tab.title || 'Valt innehåll').slice(0, 180);
    const filename = makeFilename(tab, settings, title);
    const { downloadId, blobUrl } = await downloadPdf(base64, filename, settings);
    const item = await getDownloadItem(downloadId);
    const filePath = item?.filename || '';
    await addHistory({ filename, filePath, url: tab.url, title, downloadId });
    const autoOpenFailed = settings.pdf.openAfterSave && !(await openPdfBlobAfterSave(downloadId, blobUrl));
    await setBadge(tab.id, BADGE_OK, '#1f7a44');
    await sendToast(tab.id, { state: 'saved', text: t(lang, 'toast.saved', { file: filename.split('/').pop() }) });
    clearBadgeLater(tab.id);
    return { ok: true, filename, downloadId, filePath, autoOpenFailed };
  } catch (error) {
    const mapped = mapError(error, 'print');
    await setBadge(tab.id, BADGE_FAIL, '#b42318');
    await sendToast(tab.id, { state: 'error', text: errorText(lang, mapped.code) });
    clearBadgeLater(tab.id, 5000);
    return { ok: false, error: mapped.code, message: errorText(lang, mapped.code) };
  }
}

async function handleCapturedSave(tab, article, options = {}) {
  if (!tab || typeof tab.id !== 'number' || inFlight.has(tab.id)) {
    return { ok: false, error: 'busy' };
  }
  const task = runCapturedSave(tab, article, options).finally(() => inFlight.delete(tab.id));
  inFlight.set(tab.id, task);
  return task;
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

function elementPicker(language) {
  const old = window.__stpElementPickerCleanup;
  if (typeof old === 'function') old();
  const style = document.createElement('style');
  style.id = '__stp-picker-style';
  style.textContent = '#__stp-picker-tip{position:fixed;z-index:2147483647;top:12px;left:50%;transform:translateX(-50%);padding:10px 14px;border-radius:10px;background:#17191d;color:white;font:600 13px/1.4 system-ui,sans-serif;box-shadow:0 4px 20px #0005}#__stp-picker-tip button{margin-left:12px;border:0;border-radius:6px;padding:5px 9px;background:#fff;color:#17191d;font:inherit;cursor:pointer}';
  document.documentElement.appendChild(style);
  const tip = document.createElement('div');
  tip.id = '__stp-picker-tip';
  tip.textContent = language === 'sv' ? 'Klicka på ett område att spara som PDF.' : 'Click an area to save it as PDF.';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = language === 'sv' ? 'Avbryt' : 'Cancel';
  tip.appendChild(cancel);
  document.documentElement.appendChild(tip);

  let previous = null;
  let previousStyle = null;
  let timeout = 0;
  const cleanup = () => {
    clearTimeout(timeout);
    if (previous) {
      if (previousStyle === null) previous.removeAttribute('style');
      else previous.setAttribute('style', previousStyle);
    }
    tip.remove();
    style.remove();
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('keydown', onKey, true);
    delete window.__stpElementPickerCleanup;
  };
  const onMove = (event) => {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!target || target === tip || tip.contains(target)) return;
    if (target === previous) return;
    if (previous) {
      if (previousStyle === null) previous.removeAttribute('style');
      else previous.setAttribute('style', previousStyle);
    }
    previous = target;
    previousStyle = target.getAttribute('style');
    target.style.setProperty('outline', '2px solid #d43b32', 'important');
    target.style.setProperty('outline-offset', '2px', 'important');
  };
  const onClick = (event) => {
    if (tip.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!target || target === document.documentElement || target === document.body) return;
    if (target === previous) {
      if (previousStyle === null) target.removeAttribute('style');
      else target.setAttribute('style', previousStyle);
      previous = null;
    }
    const clone = target.cloneNode(true);
    const absolute = (node, attribute) => {
      const value = node.getAttribute(attribute);
      if (!value) return;
      try { node.setAttribute(attribute, new URL(value, location.href).href); } catch { /* ignore */ }
    };
    for (const node of [clone, ...clone.querySelectorAll('*')]) {
      for (const attribute of [...node.attributes]) {
        if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
      }
      if (node.matches('img,source')) absolute(node, 'src');
      if (node.matches('a')) absolute(node, 'href');
    }
    const computed = getComputedStyle(target);
    // Keep the selected node's visual identity without copying the site's full stylesheet.
    for (const key of ['font-family','font-size','font-weight','line-height','color','background-color','text-align','padding','margin','border','border-radius','width','max-width','box-sizing']) {
      const value = computed.getPropertyValue(key);
      if (value) clone.style.setProperty(key, value);
    }
    const html = clone.outerHTML;
    cleanup();
    const notice = document.createElement('div');
    notice.textContent = language === 'sv' ? 'Skapar PDF…' : 'Creating PDF…';
    notice.style.cssText = 'position:fixed;z-index:2147483647;top:12px;left:50%;transform:translateX(-50%);padding:10px 14px;border-radius:10px;background:#17191d;color:white;font:600 13px/1.4 system-ui,sans-serif;box-shadow:0 4px 20px #0005;';
    document.documentElement.appendChild(notice);
    chrome.runtime.sendMessage({ type: 'ELEMENT_SELECTED', title: document.title, url: location.href, html })
      .then((response) => {
        notice.textContent = response?.ok
          ? (language === 'sv' ? 'PDF sparad.' : 'PDF saved.')
          : (response?.message || (language === 'sv' ? 'PDF kunde inte skapas.' : 'Could not create PDF.'));
        setTimeout(() => notice.remove(), 5000);
      })
      .catch(() => {
        notice.textContent = language === 'sv' ? 'PDF kunde inte skapas.' : 'Could not create PDF.';
        setTimeout(() => notice.remove(), 5000);
      });
  };
  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cleanup();
    }
  };
  cancel.addEventListener('click', cleanup);
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('click', onClick, true);
  window.addEventListener('keydown', onKey, true);
  window.__stpElementPickerCleanup = cleanup;
  timeout = window.setTimeout(cleanup, 30000);
}

async function startElementPicker(tab, settings) {
  if (typeof tab?.id !== 'number') return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: elementPicker,
      args: [currentLang(settings)]
    });
  } catch (error) {
    console.warn('Kunde inte starta innehållsväljaren', error);
  }
}

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
    chrome.contextMenus.create({
      id: SELECTION_MENU_ID,
      title: t(lang, 'menu.saveSelection'),
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: ELEMENT_MENU_ID,
      title: t(lang, 'menu.pickElement'),
      contexts: ['page', 'image', 'link']
    });
    chrome.contextMenus.create({
      id: PANEL_MENU_ID,
      title: t(lang, 'menu.openPanel'),
      contexts: ['action']
    });
    chrome.contextMenus.create({
      id: UPDATE_MENU_ID,
      title: t(lang, 'menu.checkUpdates'),
      contexts: ['action']
    });
    chrome.contextMenus.create({
      id: RELOAD_MENU_ID,
      title: t(lang, 'menu.reloadUpdatedFiles'),
      contexts: ['action']
    });
  } catch (error) {
    console.warn('Kunde inte skapa högerklicksmenyn', error);
  }

  try {
    await chrome.action.setTitle({ title: t(lang, 'action.savePage') });
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

chrome.action.onClicked.addListener((tab) => {
  if (!tab) return;
  // Ett klick på verktygsfältsikonen är ett uttryckligt val att spara just den
  // aktiva sidan, även om domänen inte finns i listan för sidknappen.
  void handleSaveRequest(tab, { allowUnselected: true });
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'save-pdf' && command !== 'save-pdf-quiet') return;
  // Snabbkommandon sparar den aktiva sidan; save-pdf-quiet hoppar över
  // spar-dialogen och lägger filen direkt i webbläsarens hämtningsmapp.
  const options = {
    allowUnselected: true,
    ...(command === 'save-pdf-quiet' ? { forceSaveAs: false } : {})
  };
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) await handleSaveRequest(tab, options);
  })();
});

function openPanelTab(tab, { checkUpdates = false } = {}) {
  const params = new URLSearchParams();
  if (typeof tab?.id === 'number') params.set('tabId', String(tab.id));
  if (checkUpdates) params.set('checkUpdates', '1');
  const query = params.toString();
  return chrome.tabs.create({
    url: `${chrome.runtime.getURL('src/popup.html')}${query ? `?${query}` : ''}`
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && tab) {
    void handleSaveRequest(tab);
    return;
  }
  if (info.menuItemId === SELECTION_MENU_ID && tab && info.selectionText) {
    const html = String(info.selectionText)
      .split(/\n\s*\n/)
      .map((paragraph) => `<p>${paragraph.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])}</p>`)
      .join('');
    void handleCapturedSave(tab, {
      title: `${tab.title || 'Valt innehåll'} – markerad text`,
      url: tab.url,
      html,
      words: info.selectionText.trim().split(/\s+/).length
    });
    return;
  }
  if (info.menuItemId === ELEMENT_MENU_ID && tab) {
    void getSettings().then((settings) => startElementPicker(tab, settings));
    return;
  }
  if (info.menuItemId === PANEL_MENU_ID) {
    void openPanelTab(tab);
    return;
  }
  if (info.menuItemId === RELOAD_MENU_ID) {
    // Reloads the extension from its existing unpacked folder; it does not download files.
    chrome.runtime.reload();
    return;
  }
  if (info.menuItemId === UPDATE_MENU_ID) {
    void (async () => {
      try {
        // Ask at the context-menu user gesture; the panel checks automatically after it opens.
        await chrome.permissions.request({ origins: [UPDATE_API_PERMISSION] });
      } catch {
        /* Panel will display the permission state and let the user retry. */
      }
      await openPanelTab(tab, { checkUpdates: true });
    })();
  }
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
        forceSaveAs: typeof message.forceSaveAs === 'boolean' ? message.forceSaveAs : undefined,
        pageRanges: typeof message.pageRanges === 'string' ? message.pageRanges : ''
      });
    }

    case 'ELEMENT_SELECTED': {
      if (sender?.id !== chrome.runtime.id || !sender?.tab?.id) return { ok: false, error: 'unexpected' };
      const tab = sender.tab;
      const article = {
        title: String(message.title || tab.title || 'Valt element').slice(0, 180),
        url: tab.url,
        html: typeof message.html === 'string' ? message.html : '',
        words: 0
      };
      return handleCapturedSave(tab, article);
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
