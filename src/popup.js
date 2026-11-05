/**
 * Popup – visar status för aktuell flik och sparar sidan som PDF.
 */

import {
  getSettings,
  updateSettings,
  getHistory,
  createId,
  onSettingsChanged,
  normalizeTheme
} from './lib/settings.js';
import {
  matchesUrl,
  suggestPatternFromUrl,
  originPatternFor,
  isPrintableUrl,
  normalizePattern
} from './lib/sites.js';
import { resolveLang, applyI18n, t } from './lib/i18n.js';
import { releaseUnusedOrigin } from './lib/access.js';
import { buildFilename } from './lib/filename.js';
import { applyTheme, watchSystemTheme } from './lib/theme.js';

const FILE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
    stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
  <path d="M14 3v5h5M12 12v6" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round"/>
  <path d="m9.3 15.3 2.7 2.7 2.7-2.7" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const PLUS_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
</svg>`;

const TRASH_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M4 7h16M9.5 7V5.2c0-.7.5-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2V7"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M6.5 7l.8 11.3c.05.7.6 1.2 1.3 1.2h6.8c.7 0 1.25-.5 1.3-1.2L17.5 7"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/>
  <path d="m8 12.3 2.6 2.6L16 9.5" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const BANNER_ICONS = {
  ok: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>
    <path d="m8 12.3 2.6 2.6L16 9.5" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  error: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>
    <path d="M12 7.5v5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="12" cy="16.6" r="1.05" fill="currentColor"/>
  </svg>`,
  info: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>
    <path d="M12 11v5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="12" cy="7.6" r="1.05" fill="currentColor"/>
  </svg>`
};

const els = {
  siteName: document.getElementById('site-name'),
  statusPill: document.getElementById('status-pill'),
  statusDot: document.getElementById('status-dot'),
  hint: document.getElementById('hint'),
  banner: document.getElementById('banner'),
  primary: document.getElementById('primary'),
  secondary: document.getElementById('secondary'),
  saveAs: document.getElementById('save-as'),
  saveAsNote: document.getElementById('save-as-note'),
  filenamePreview: document.getElementById('filename-preview'),
  bannerActions: document.getElementById('banner-actions'),
  openPdf: document.getElementById('open-pdf'),
  showFolder: document.getElementById('show-folder'),
  lastSaved: document.getElementById('last-saved'),
  shortcut: document.getElementById('shortcut'),
  openOptions: document.getElementById('open-options'),
  settingsLink: document.getElementById('settings-link')
};

const state = {
  settings: null,
  lang: 'sv',
  tab: null,
  url: '',
  printable: false,
  matchedSite: null,
  allowed: false,
  busy: false
};

function basename(path) {
  return String(path || '').split('/').pop();
}

function suggestedPattern() {
  return suggestPatternFromUrl(state.url);
}

function previewFilename() {
  if (!state.printable) return '';
  try {
    const host = new URL(state.url).hostname.replace(/^www\./, '') || 'webbplats';
    return buildFilename({
      template: state.settings.file.template,
      folder: state.settings.file.folder,
      perSiteFolder: state.settings.file.perSiteFolder,
      site: host,
      title: state.tab?.title || host,
      date: new Date()
    });
  } catch {
    return '';
  }
}

function setBannerActions(downloadId) {
  const visible = typeof downloadId === 'number';
  els.bannerActions.hidden = !visible;
  els.openPdf.dataset.downloadId = visible ? String(downloadId) : '';
  els.showFolder.dataset.downloadId = visible ? String(downloadId) : '';
}

function computeState() {
  const { settings, url } = state;
  state.printable = isPrintableUrl(url);
  state.matchedSite = null;

  if (state.printable) {
    state.matchedSite = settings.sites.find((site) => matchesUrl(url, site.pattern)) || null;
  }

  const matchedActive = Boolean(state.matchedSite?.enabled);
  state.allowed = state.printable && (settings.allowAll || matchedActive);
}

function setBanner(kind, text) {
  els.banner.hidden = !text;
  els.banner.className = `banner ${kind}`;
  els.banner.replaceChildren();
  if (!text) return;

  const icon = document.createElement('span');
  icon.className = 'banner-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = BANNER_ICONS[kind] || BANNER_ICONS.info;

  const label = document.createElement('span');
  label.className = 'banner-text';
  label.textContent = text;

  els.banner.append(icon, label);
}

function setPrimary({ icon, label, loading = false, disabled = false }) {
  els.primary.disabled = disabled;
  els.primary.replaceChildren();

  const iconSlot = document.createElement('span');
  iconSlot.className = 'primary-icon';
  iconSlot.setAttribute('aria-hidden', 'true');
  if (loading) {
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    iconSlot.appendChild(spinner);
  } else {
    iconSlot.innerHTML = icon === 'plus' ? PLUS_ICON : FILE_ICON;
  }

  const text = document.createElement('span');
  text.textContent = label;

  els.primary.append(iconSlot, text);
}

function render() {
  computeState();
  const { settings, lang, matchedSite, allowed, printable } = state;

  let hostname = '';
  try {
    hostname = new URL(state.url).hostname;
  } catch {
    hostname = '';
  }

  els.siteName.textContent = hostname || t(lang, 'popup.openPage');
  els.siteName.title = hostname;
  els.saveAs.checked = settings.file.saveAs;
  els.saveAsNote.textContent = t(
    lang,
    settings.file.saveAs ? 'popup.saveAsHintOn' : 'popup.saveAsHintOff'
  );

  const preview = previewFilename();
  els.filenamePreview.textContent = preview || '–';
  els.filenamePreview.title = preview;

  let pillText = '';
  let pillClass = 'pill';
  let dotClass = 'status-dot';
  let hintText = '';

  if (!printable) {
    pillText = t(lang, 'popup.status.internal');
    pillClass = 'pill warn';
    dotClass = 'status-dot warn';
    hintText = t(lang, 'popup.hint.internal');
  } else if (allowed) {
    const viaAll = settings.allowAll && !matchedSite?.enabled;
    pillText = t(lang, viaAll ? 'popup.status.allSites' : 'popup.status.selected');
    pillClass = 'pill ok';
    dotClass = 'status-dot ok';
    hintText = t(lang, 'popup.hint.selected');
  } else {
    pillText = t(lang, 'popup.status.notSelected');
    hintText = t(lang, 'popup.hint.notSelected');
  }

  els.statusPill.textContent = pillText;
  els.statusPill.className = pillClass;
  els.statusDot.className = dotClass;
  els.hint.textContent = hintText;

  if (!printable) {
    setPrimary({ icon: 'file', label: t(lang, 'popup.save'), disabled: true });
  } else if (allowed) {
    setPrimary({ icon: 'file', label: t(lang, 'popup.save') });
  } else {
    setPrimary({
      icon: 'plus',
      label: t(lang, 'popup.addAndSave', { site: suggestedPattern() || hostname })
    });
  }

  if (printable && matchedSite) {
    const isDisabled = !matchedSite.enabled;
    els.secondary.hidden = false;
    els.secondary.disabled = false;

    const icon = document.createElement('span');
    icon.className = 'btn-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = isDisabled ? CHECK_ICON : TRASH_ICON;

    const text = document.createElement('span');
    text.textContent = isDisabled
      ? t(lang, 'popup.enableSite', { site: matchedSite.pattern })
      : t(lang, 'popup.removeSite', { site: matchedSite.pattern });

    els.secondary.replaceChildren(icon, text);
    els.secondary.dataset.action = isDisabled ? 'enable' : 'remove';
  } else {
    els.secondary.hidden = true;
    els.secondary.disabled = true;
    els.secondary.dataset.action = '';
  }
}

async function renderHistory() {
  const history = await getHistory();
  const latest = history[0];
  els.lastSaved.textContent = latest ? basename(latest.filename) : t(state.lang, 'popup.neverSaved');
  els.lastSaved.title = latest?.filePath || latest?.filename || '';
  if (latest && typeof latest.downloadId === 'number' && !state.busy) {
    setBannerActions(latest.downloadId);
  }
}

async function renderShortcut() {
  try {
    const commands = await chrome.commands.getAll();
    const shortcut = commands.find((item) => item.name === 'save-pdf')?.shortcut;
    els.shortcut.replaceChildren();
    if (!shortcut) {
      els.shortcut.textContent = t(state.lang, 'popup.noShortcut');
      return;
    }
    const [before, after] = t(state.lang, 'popup.shortcut', { shortcut: '\u0000' }).split('\u0000');
    const key = document.createElement('kbd');
    key.textContent = shortcut;
    els.shortcut.append(before || '', key, after || '');
  } catch {
    els.shortcut.textContent = '';
  }
}

async function load({ initial = false } = {}) {
  state.settings = await getSettings();
  state.lang = resolveLang(state.settings.language, chrome.i18n.getUILanguage());
  applyTheme(state.settings.theme);
  applyI18n(document, state.lang);

  if (initial) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    state.tab = tab || null;
    state.url = tab?.url || '';
    document.title = t(state.lang, 'appName');
  }

  render();
  if (initial) {
    await renderHistory();
    await renderShortcut();
  }
}

async function savePdf() {
  if (state.busy || !state.allowed) return;
  state.busy = true;
  setPrimary({ loading: true, label: t(state.lang, 'popup.saving'), disabled: true });
  els.secondary.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_PDF',
      tabId: state.tab?.id,
      url: state.url
    });

    if (response?.ok) {
      if (response.readerFallback) {
        setBanner('info', t(state.lang, 'popup.readerFallback'));
      } else {
        setBanner('ok', `${t(state.lang, 'popup.saved')} · ${basename(response.filename)}`);
      }
      setBannerActions(response.downloadId);
      await renderHistory();
    } else if (response?.error === 'canceled') {
      setBannerActions(null);
      setBanner('info', response.message || t(state.lang, 'errors.canceled'));
    } else {
      setBanner('error', response?.message || t(state.lang, 'errors.unexpected'));
      setBannerActions(null);
    }
  } catch {
    setBanner('error', t(state.lang, 'errors.unexpected'));
    setBannerActions(null);
  } finally {
    state.busy = false;
    render();
    els.secondary.disabled = false;
  }
}

async function addSiteAndSave() {
  const pattern = suggestedPattern();
  if (!pattern || state.busy) return;

  state.busy = true;
  setPrimary({ loading: true, label: t(state.lang, 'popup.saving'), disabled: true });

  let granted = false;
  try {
    // Måste ske direkt i klicket för att räknas som en användargest.
    granted = await chrome.permissions.request({ origins: [originPatternFor(pattern)] });
  } catch {
    granted = false;
  }

  await updateSettings((draft) => {
    const existing = draft.sites.find(
      (site) => normalizePattern(site.pattern) === normalizePattern(pattern)
    );
    if (existing) existing.enabled = true;
    else draft.sites.push({ id: createId(), pattern, enabled: true });
  });

  state.settings = await getSettings();
  state.busy = false;
  render();
  chrome.runtime.sendMessage({ type: 'SYNC_CONTENT_SCRIPTS' }).catch(() => {});

  await savePdf();

  if (!granted) {
    setBanner('info', t(state.lang, 'popup.hint.addNoAccess'));
  }
}

async function removeMatchedSite() {
  if (!state.matchedSite) return;
  const { id, pattern } = state.matchedSite;
  await updateSettings((draft) => {
    draft.sites = draft.sites.filter((site) => site.id !== id);
  });
  state.settings = await getSettings();
  await releaseUnusedOrigin(state.settings, pattern);
  chrome.runtime.sendMessage({ type: 'SYNC_CONTENT_SCRIPTS' }).catch(() => {});
  render();
  setBanner('info', t(state.lang, 'options.sites.removed', { site: pattern }));
}

async function enableMatchedSite() {
  if (!state.matchedSite) return;
  const { id } = state.matchedSite;
  await updateSettings((draft) => {
    const site = draft.sites.find((item) => item.id === id);
    if (site) site.enabled = true;
  });
  state.settings = await getSettings();
  chrome.runtime.sendMessage({ type: 'SYNC_CONTENT_SCRIPTS' }).catch(() => {});
  render();
}

function openOptions(event) {
  event?.preventDefault();
  chrome.runtime.openOptionsPage();
  window.close();
}

els.primary.addEventListener('click', () => {
  if (state.allowed) void savePdf();
  else void addSiteAndSave();
});

async function downloadAction(type, downloadId) {
  if (!downloadId) return;
  try {
    await chrome.runtime.sendMessage({ type, downloadId });
  } catch {
    /* ignoreras */
  }
}

els.openPdf.addEventListener('click', () => {
  void downloadAction('OPEN_DOWNLOAD', Number(els.openPdf.dataset.downloadId));
});

els.showFolder.addEventListener('click', () => {
  void downloadAction('SHOW_DOWNLOAD', Number(els.showFolder.dataset.downloadId));
});

els.saveAs.addEventListener('change', () => {
  void (async () => {
    await updateSettings((draft) => {
      draft.file.saveAs = els.saveAs.checked;
    });
    state.settings = await getSettings();
    render();
  })();
});

els.secondary.addEventListener('click', () => {
  if (els.secondary.dataset.action === 'enable') void enableMatchedSite();
  else void removeMatchedSite();
});

els.openOptions.addEventListener('click', openOptions);
els.settingsLink.addEventListener('click', openOptions);

onSettingsChanged(() => {
  void (async () => {
    state.settings = await getSettings();
    state.lang = resolveLang(state.settings.language, chrome.i18n.getUILanguage());
    applyTheme(state.settings.theme);
    applyI18n(document, state.lang);
    render();
    await renderHistory();
  })();
});

watchSystemTheme(() => {
  if (normalizeTheme(state.settings?.theme) === 'auto') applyTheme('auto');
});

void load({ initial: true });
