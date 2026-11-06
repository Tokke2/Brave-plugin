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
import { normalizePageRanges } from './lib/print.js';
import { compareVersions, diffFileHashes, gitBlobSha, TRACKED_FILES } from './lib/updates.js';

window.SidaPdfIcons.hydrate(document);
const { icon: iconSvg } = window.SidaPdfIcons;
const FILE_ICON = iconSvg('fileDown', 16);
const PLUS_ICON = iconSvg('plus', 16);
const TRASH_ICON = iconSvg('trash', 14);
const CHECK_ICON = iconSvg('checkCircle', 14);
const BANNER_ICONS = {
  ok: iconSvg('checkCircle', 14),
  error: iconSvg('alert', 14),
  info: iconSvg('info', 14)
};

const els = {
  siteName: document.getElementById('site-name'),
  statusPill: document.getElementById('status-pill'),
  statusDot: document.getElementById('status-dot'),
  hint: document.getElementById('hint'),
  banner: document.getElementById('banner'),
  primary: document.getElementById('primary'),
  secondary: document.getElementById('secondary'),
  pageRanges: document.getElementById('page-ranges'),
  saveAs: document.getElementById('save-as'),
  saveAsNote: document.getElementById('save-as-note'),
  filenamePreview: document.getElementById('filename-preview'),
  bannerActions: document.getElementById('banner-actions'),
  openPdf: document.getElementById('open-pdf'),
  showFolder: document.getElementById('show-folder'),
  lastSaved: document.getElementById('last-saved'),
  installedVersion: document.getElementById('installed-version'),
  updateStatus: document.getElementById('update-status'),
  checkUpdates: document.getElementById('check-updates'),
  releaseLink: document.getElementById('release-link'),
  changedFiles: document.getElementById('changed-files'),
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

const RELEASE_API_URL = 'https://api.github.com/repos/Tokke2/Brave-plugin/releases/latest';
const RELEASE_PERMISSION = 'https://api.github.com/*';
els.installedVersion.textContent = `v${chrome.runtime.getManifest().version}`;

async function compareReleaseFiles(remoteEntries) {
  const files = new Set(TRACKED_FILES);
  for (const entry of remoteEntries) {
    if (entry?.type !== 'blob' || typeof entry.path !== 'string') continue;
    if (entry.path.startsWith('/') || entry.path.split('/').includes('..')) continue;
    files.add(entry.path);
  }

  const localHashes = Object.create(null);
  await Promise.all(
    [...files].map(async (path) => {
      try {
        const response = await fetch(chrome.runtime.getURL(path));
        if (!response.ok) return;
        localHashes[path] = await gitBlobSha(await response.arrayBuffer());
      } catch {
        // Missing local file is reported as a difference from the release tree.
      }
    })
  );
  return diffFileHashes(localHashes, remoteEntries);
}

function renderChangedFiles(paths) {
  els.changedFiles.replaceChildren();
  const visiblePaths = paths.slice(0, 8);
  for (const path of visiblePaths) {
    const item = document.createElement('li');
    item.textContent = path;
    els.changedFiles.append(item);
  }
  if (paths.length > visiblePaths.length) {
    const item = document.createElement('li');
    item.textContent = `… +${paths.length - visiblePaths.length}`;
    els.changedFiles.append(item);
  }
  els.changedFiles.hidden = paths.length === 0;
}

async function checkForUpdates({ requestPermission = true } = {}) {
  els.checkUpdates.disabled = true;
  els.releaseLink.hidden = true;
  renderChangedFiles([]);
  els.updateStatus.textContent = t(state.lang, 'update.checking');

  try {
    // The toolbar context-menu route requests permission before opening this tab;
    // the panel button requests it directly from its own click gesture.
    const granted = requestPermission
      ? await chrome.permissions.request({ origins: [RELEASE_PERMISSION] })
      : await chrome.permissions.contains({ origins: [RELEASE_PERMISSION] });
    if (!granted) {
      els.updateStatus.textContent = t(state.lang, 'update.permissionDenied');
      return;
    }

    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    const response = await fetch(RELEASE_API_URL, { headers });
    if (response.status === 404) {
      els.updateStatus.textContent = t(state.lang, 'update.noRelease');
      return;
    }
    if (!response.ok) throw new Error(`GitHub release API returned ${response.status}`);

    const release = await response.json();
    const latest = String(release.tag_name || '').trim();
    const commitResponse = await fetch(
      `https://api.github.com/repos/Tokke2/Brave-plugin/commits/${encodeURIComponent(latest)}`,
      { headers }
    );
    if (!commitResponse.ok) throw new Error(`GitHub commit API returned ${commitResponse.status}`);
    const commit = await commitResponse.json();
    const treeSha = commit.commit?.tree?.sha;
    if (!/^[a-f0-9]{40}$/i.test(treeSha || '')) throw new Error('GitHub returned an invalid tree SHA');

    const treeResponse = await fetch(
      `https://api.github.com/repos/Tokke2/Brave-plugin/git/trees/${treeSha}?recursive=1`,
      { headers }
    );
    if (!treeResponse.ok) throw new Error(`GitHub tree API returned ${treeResponse.status}`);
    const tree = await treeResponse.json();
    if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('GitHub returned an incomplete file tree');

    const remoteEntries = tree.tree.filter(
      (entry) => entry?.type === 'blob' && typeof entry.path === 'string' && /^[a-f0-9]{40}$/i.test(entry.sha || '')
    );
    if (!remoteEntries.some((entry) => entry.path === 'manifest.json')) {
      throw new Error('Release tree does not contain manifest.json');
    }
    const changes = await compareReleaseFiles(remoteEntries);
    renderChangedFiles(changes);

    const installed = chrome.runtime.getManifest().version;
    const comparison = compareVersions(latest, installed);
    if (comparison === null) {
      els.updateStatus.textContent = t(state.lang, 'update.invalidVersion');
      return;
    }

    if (comparison > 0) {
      els.updateStatus.textContent = t(state.lang, 'update.available', {
        latest,
        installed,
        count: changes.length
      });
      const url = new URL(release.html_url || 'https://github.com/Tokke2/Brave-plugin/releases/latest');
      if (url.origin !== 'https://github.com') throw new Error('Unexpected release URL');
      els.releaseLink.href = url.href;
      els.releaseLink.hidden = false;
    } else if (comparison < 0) {
      els.updateStatus.textContent = t(state.lang, 'update.installedNewer', {
        installed,
        latest,
        count: changes.length
      });
    } else if (changes.length) {
      els.updateStatus.textContent = t(state.lang, 'update.filesDiffer', {
        installed,
        count: changes.length
      });
      els.releaseLink.href = release.html_url;
      els.releaseLink.hidden = false;
    } else {
      els.updateStatus.textContent = t(state.lang, 'update.same', { installed });
    }
  } catch (error) {
    console.warn('GitHub release check failed', error);
    els.updateStatus.textContent = t(state.lang, 'update.error');
  } finally {
    els.checkUpdates.disabled = false;
  }
}

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
  const saveAsHintKey = settings.file.saveAs
    ? 'popup.saveAsHintOn'
    : settings.file.rememberLocation
      ? 'popup.saveAsHintRemembered'
      : 'popup.saveAsHintOff';
  els.saveAsNote.textContent = t(lang, saveAsHintKey);

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
    const requestedTabId = Number(new URLSearchParams(window.location.search).get('tabId'));
    let tab = null;
    if (Number.isInteger(requestedTabId) && requestedTabId > 0) {
      try {
        tab = await chrome.tabs.get(requestedTabId);
      } catch {
        tab = null;
      }
    }
    if (!tab) {
      [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    }
    state.tab = tab || null;
    state.url = tab?.url || '';
    if (new URLSearchParams(window.location.search).has('tabId')) {
      document.body.classList.add('panel-tab');
    }
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
  const pageRanges = normalizePageRanges(els.pageRanges.value);
  if (pageRanges === null) {
    setBanner('error', t(state.lang, 'errors.pageRangeInvalid'));
    return;
  }
  state.busy = true;
  setPrimary({ loading: true, label: t(state.lang, 'popup.saving'), disabled: true });
  els.secondary.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_PDF',
      tabId: state.tab?.id,
      url: state.url,
      pageRanges
    });

    if (response?.ok) {
      const removedPages = Number(response.blankPagesRemoved) || 0;
      const cleanupNote = removedPages
        ? ` · ${t(state.lang, 'pdf.blankPagesRemoved', { count: removedPages })}`
        : '';
      const locationNote = response.locationFallback
        ? ` · ${t(state.lang, 'popup.locationFallback')}`
        : '';
      if (response.autoOpenFailed) {
        setBanner('info', `${t(state.lang, 'popup.autoOpenBlocked')}${cleanupNote}${locationNote}`);
      } else if (response.readerFallback) {
        setBanner('info', `${t(state.lang, 'popup.readerFallback')}${cleanupNote}${locationNote}`);
      } else {
        setBanner('ok', `${t(state.lang, 'popup.saved')} · ${basename(response.filename)}${cleanupNote}${locationNote}`);
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
  if (normalizePageRanges(els.pageRanges.value) === null) {
    setBanner('error', t(state.lang, 'errors.pageRangeInvalid'));
    return;
  }

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
els.checkUpdates.addEventListener('click', () => void checkForUpdates());

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

void load({ initial: true }).then(() => {
  if (new URLSearchParams(window.location.search).get('checkUpdates') === '1') {
    void checkForUpdates({ requestPermission: false });
  }
});
