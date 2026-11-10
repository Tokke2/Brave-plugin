/**
 * Inställningssida – webbplatslista, knapp, PDF- och filinställningar.
 */

import {
  getSettings,
  saveSettings,
  updateSettings,
  createId,
  onSettingsChanged,
  DEFAULT_SETTINGS,
  SITE_PDF_PROFILES,
  mergeSettings,
  normalizeTheme
} from './lib/settings.js';
import { normalizePattern, isValidPattern, originPatternFor } from './lib/sites.js';
import { resolveLang, applyI18n, t } from './lib/i18n.js';
import { buildFilename } from './lib/filename.js';
import { releaseUnusedOrigin } from './lib/access.js';
import { applyTheme, watchSystemTheme } from './lib/theme.js';
import {
  getSavedDirectoryHandle,
  getOrCreateSavePickerId,
  saveDirectoryHandle,
  clearDirectoryHandle
} from './lib/directory-storage.js';

window.SidaPdfIcons.hydrate(document);
const { icon: iconSvg } = window.SidaPdfIcons;

const els = {
  banner: document.getElementById('banner'),
  appVersion: document.getElementById('app-version'),
  saveFlash: document.getElementById('save-flash'),
  siteCount: document.getElementById('site-count'),
  addForm: document.getElementById('add-form'),
  newPattern: document.getElementById('new-pattern'),
  siteFeedback: document.getElementById('site-feedback'),
  siteList: document.getElementById('site-list'),
  siteEmpty: document.getElementById('site-empty'),
  buttonShow: document.getElementById('button-show'),
  buttonPosition: document.getElementById('button-position'),
  pdfMargin: document.getElementById('pdf-margin'),
  pdfScale: document.getElementById('pdf-scale'),
  pdfWait: document.getElementById('pdf-wait'),
  pdfBackground: document.getElementById('pdf-background'),
  pdfHeader: document.getElementById('pdf-header'),
  pdfReader: document.getElementById('pdf-reader'),
  pdfDark: document.getElementById('pdf-dark'),
  pdfWatermark: document.getElementById('pdf-watermark'),
  pdfOptimizeImages: document.getElementById('pdf-optimize-images'),
  pdfOpenAfterSave: document.getElementById('pdf-open-after-save'),
  pdfTableOfContents: document.getElementById('pdf-table-of-contents'),
  pdfRemoveBlankPages: document.getElementById('pdf-remove-blank-pages'),
  pdfFooterTitle: document.getElementById('pdf-footer-title'),
  pdfFooterUrl: document.getElementById('pdf-footer-url'),
  pdfFooterDate: document.getElementById('pdf-footer-date'),
  resetPdf: document.getElementById('reset-pdf'),
  fileTemplate: document.getElementById('file-template'),
  filePreview: document.getElementById('file-preview'),
  fileSaveAs: document.getElementById('file-save-as'),
  fileConflictAction: document.getElementById('file-conflict-action'),
  saveAsHint: document.getElementById('save-as-hint'),
  savedFolderStatus: document.getElementById('saved-folder-status'),
  diagnosticsList: document.getElementById('diagnostics-list'),
  runDiagnostics: document.getElementById('run-diagnostics'),
  chooseSaveFolder: document.getElementById('choose-save-folder'),
  clearSaveFolder: document.getElementById('clear-save-folder'),
  theme: document.getElementById('theme'),
  language: document.getElementById('language'),
  allowAll: document.getElementById('allow-all'),
  shortcutValue: document.getElementById('shortcut-value'),
  shortcutButton: document.getElementById('shortcut-button'),
  exportButton: document.getElementById('export-button'),
  importButton: document.getElementById('import-button'),
  importFile: document.getElementById('import-file'),
  resetAll: document.getElementById('reset-all')
};

els.appVersion.textContent = `v${chrome.runtime.getManifest().version}`;

const state = {
  settings: null,
  lang: 'sv',
  access: new Map(),
  savedDirectoryHandle: null,
  feedbackTimer: null,
  flashTimer: null
};

/* ------------------------------------------------------------------ */
/* Små hjälpfunktioner                                                 */
/* ------------------------------------------------------------------ */

function showBanner(kind, text, timeout = 6000) {
  els.banner.hidden = !text;
  els.banner.className = `banner ${kind}`;
  els.banner.textContent = text || '';
  if (text && timeout) {
    window.clearTimeout(showBanner.timer);
    showBanner.timer = window.setTimeout(() => {
      els.banner.hidden = true;
    }, timeout);
  }
}

function flashSaved() {
  els.saveFlash.hidden = false;
  window.clearTimeout(state.flashTimer);
  state.flashTimer = window.setTimeout(() => {
    els.saveFlash.hidden = true;
  }, 1600);
}

function feedback(kind, text) {
  els.siteFeedback.hidden = !text;
  els.siteFeedback.className = `field-note ${kind}`;
  els.siteFeedback.textContent = text || '';
  window.clearTimeout(state.feedbackTimer);
  if (text) {
    state.feedbackTimer = window.setTimeout(() => {
      els.siteFeedback.hidden = true;
    }, 7000);
  }
}

function syncScripts() {
  chrome.runtime.sendMessage({ type: 'SYNC_CONTENT_SCRIPTS' }).catch(() => {});
}

async function reload() {
  state.settings = await getSettings();
  state.lang = resolveLang(state.settings.language, chrome.i18n.getUILanguage());
  applyLanguage();
  await refreshAccess();
  renderAll();
  void runDiagnostics();
}

function applyLanguage() {
  applyI18n(document, state.lang);
  document.title = `${t(state.lang, 'appName')} · ${t(state.lang, 'options.title')}`;
}

async function persist(mutator, { message = '', reloadAccess = false } = {}) {
  await updateSettings(mutator);
  state.settings = await getSettings();
  if (reloadAccess) await refreshAccess();
  renderAll();
  flashSaved();
  if (message) showBanner('ok', message);
}

/* ------------------------------------------------------------------ */
/* Åtkomst till webbplatser                                            */
/* ------------------------------------------------------------------ */

async function refreshAccess() {
  const entries = await Promise.all(
    state.settings.sites.map(async (site) => {
      const origin = originPatternFor(site.pattern);
      let granted = false;
      if (origin) {
        try {
          granted = await chrome.permissions.contains({ origins: [origin] });
        } catch {
          granted = false;
        }
      }
      return [site.id, granted];
    })
  );
  state.access = new Map(entries);
}

async function requestAccess(pattern) {
  const origin = originPatternFor(pattern);
  if (!origin) return false;
  try {
    return await chrome.permissions.request({ origins: [origin] });
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function renderAll() {
  const { settings } = state;
  if (!settings) return;

  els.buttonShow.checked = settings.button.show;
  els.buttonPosition.value = settings.button.position;

  els.pdfMargin.value = String(settings.pdf.marginMm);
  els.pdfScale.value = String(Math.round(settings.pdf.scale * 100));
  els.pdfWait.value = String(settings.pdf.waitMs);
  els.pdfBackground.checked = settings.pdf.printBackground;
  els.pdfHeader.checked = settings.pdf.headerFooter;
  els.pdfReader.checked = settings.pdf.reader;
  els.pdfDark.checked = settings.pdf.darkMode;
  els.pdfWatermark.value = settings.pdf.watermark;
  els.pdfOptimizeImages.checked = settings.pdf.optimizeImages;
  els.pdfOpenAfterSave.checked = settings.pdf.openAfterSave;
  els.pdfTableOfContents.checked = settings.pdf.tableOfContents;
  els.pdfRemoveBlankPages.checked = settings.pdf.removeBlankPages;
  els.pdfFooterTitle.checked = settings.pdf.footerTitle;
  els.pdfFooterUrl.checked = settings.pdf.footerUrl;
  els.pdfFooterDate.checked = settings.pdf.footerDate;

  els.fileTemplate.value = settings.file.template;
  els.fileSaveAs.checked = settings.file.saveAs;
  els.fileConflictAction.value = settings.file.conflictAction;
  const saveHintKey = settings.file.saveAs
    ? settings.file.rememberLocation
      ? 'options.file.saveAsHintOnRemembered'
      : 'options.file.saveAsHintOn'
    : settings.file.rememberLocation
      ? 'options.file.saveAsHintRemembered'
      : 'options.file.saveAsHint';
  els.saveAsHint.textContent = t(state.lang, saveHintKey);

  els.theme.value = normalizeTheme(settings.theme);
  applyTheme(settings.theme);

  els.language.value = settings.language;
  els.allowAll.checked = settings.allowAll;

  renderSites();
  renderPreview();
  renderShortcut();
  void renderSavedFolder();
}

async function renderSavedFolder() {
  const supported = typeof window.showDirectoryPicker === 'function';
  els.chooseSaveFolder.disabled = !supported;
  if (!supported) {
    state.savedDirectoryHandle = null;
    els.savedFolderStatus.textContent = t(state.lang, 'options.file.folderUnsupported');
    els.clearSaveFolder.hidden = true;
    return;
  }

  try {
    state.savedDirectoryHandle = await getSavedDirectoryHandle();
  } catch {
    state.savedDirectoryHandle = null;
  }

  const handle = state.savedDirectoryHandle;
  els.clearSaveFolder.hidden = !handle;
  if (!handle) {
    els.savedFolderStatus.textContent = t(state.lang, 'options.file.folderNone');
    return;
  }

  let permission = 'prompt';
  try {
    permission = await handle.queryPermission({ mode: 'readwrite' });
  } catch {
    permission = 'denied';
  }
  if (permission === 'granted') {
    els.savedFolderStatus.textContent = t(
      state.lang,
      state.settings.file.rememberLocation && !state.settings.file.saveAs
        ? 'options.file.folderActive'
        : 'options.file.folderSelected',
      { folder: handle.name }
    );
  } else {
    els.savedFolderStatus.textContent = t(state.lang, 'options.file.folderPermissionNeeded', {
      folder: handle.name
    });
  }
}

function addDiagnostic(label, status, stateClass = '') {
  const row = document.createElement('li');
  row.className = 'diagnostic-row';
  const labelNode = document.createElement('span');
  labelNode.textContent = label;
  const statusNode = document.createElement('span');
  statusNode.className = `diagnostic-status${stateClass ? ` ${stateClass}` : ''}`;
  statusNode.textContent = status;
  row.append(labelNode, statusNode);
  els.diagnosticsList.appendChild(row);
}

async function runDiagnostics() {
  if (!state.settings || els.runDiagnostics.disabled) return;
  els.runDiagnostics.disabled = true;
  els.diagnosticsList.replaceChildren();
  const key = (suffix) => `options.diagnostics.${suffix}`;
  const showCheck = (labelKey, available) => {
    addDiagnostic(
      t(state.lang, key(labelKey)),
      t(state.lang, available ? key('supported') : key('unsupported')),
      available ? 'is-ok' : 'is-warn'
    );
  };

  const savePickerAvailable = typeof window.showSaveFilePicker === 'function';
  showCheck('savePicker', savePickerAvailable);
  showCheck('folderPicker', typeof window.showDirectoryPicker === 'function');

  try {
    const pickerId = await getOrCreateSavePickerId();
    addDiagnostic(
      t(state.lang, key('storage')),
      pickerId ? t(state.lang, key('ready')) : t(state.lang, key('failed')),
      pickerId ? 'is-ok' : 'is-warn'
    );
  } catch {
    addDiagnostic(t(state.lang, key('storage')), t(state.lang, key('failed')), 'is-warn');
  }

  let hasUsableSavedFolder = false;
  try {
    const handle = await getSavedDirectoryHandle();
    if (!handle) {
      addDiagnostic(t(state.lang, key('folderPermission')), t(state.lang, key('notSet')));
    } else {
      const permission = await handle.queryPermission({ mode: 'readwrite' }).catch(() => 'denied');
      const granted = permission === 'granted';
      hasUsableSavedFolder = granted;
      addDiagnostic(
        t(state.lang, key('folderPermission')),
        t(state.lang, granted ? key('permissionGranted') : key('permissionNeeded')),
        granted ? 'is-ok' : 'is-warn'
      );
    }
  } catch {
    addDiagnostic(t(state.lang, key('folderPermission')), t(state.lang, key('failed')), 'is-warn');
  }

  const flowKey = state.settings.file.saveAs
    ? savePickerAvailable ? 'customFlow' : 'browserFlow'
    : state.settings.file.rememberLocation
      ? hasUsableSavedFolder ? 'directFlow' : 'browserFlow'
      : 'downloadsFlow';
  addDiagnostic(t(state.lang, key('saveFlow')), t(state.lang, key(flowKey)));
  els.runDiagnostics.disabled = false;
}

function renderSites() {
  const { settings, lang, access } = state;
  const sites = settings.sites;

  els.siteList.replaceChildren();
  els.siteEmpty.hidden = sites.length > 0;

  if (sites.length === 0) {
    els.siteCount.textContent = t(lang, 'options.sites.countNone');
  } else if (sites.length === 1) {
    els.siteCount.textContent = t(lang, 'options.sites.countOne');
  } else {
    els.siteCount.textContent = t(lang, 'options.sites.count', { n: sites.length });
  }

  for (const site of sites) {
    const row = document.createElement('li');
    row.className = `site-row${site.enabled ? '' : ' is-disabled'}`;
    row.dataset.id = site.id;

    const main = document.createElement('div');
    main.className = 'site-main';

    const pattern = document.createElement('span');
    pattern.className = 'site-pattern';
    pattern.textContent = site.pattern;
    main.appendChild(pattern);

    const meta = document.createElement('div');
    meta.className = 'site-meta';

    const granted = access.get(site.id) === true;
    const pill = document.createElement('span');
    pill.className = `pill ${granted ? 'ok' : 'warn'}`;
    pill.textContent = t(lang, granted ? 'options.sites.hasAccess' : 'options.sites.noAccess');
    meta.appendChild(pill);

    if (!granted) {
      const grant = document.createElement('button');
      grant.type = 'button';
      grant.className = 'link grant-link';
      grant.dataset.action = 'grant';

      const grantIcon = document.createElement('span');
      grantIcon.className = 'grant-icon';
      grantIcon.setAttribute('aria-hidden', 'true');
      grantIcon.innerHTML = iconSvg('shield', 12);

      grant.append(grantIcon, document.createTextNode(t(lang, 'options.sites.grant')));
      meta.appendChild(grant);
    }

    if (!site.enabled) {
      const off = document.createElement('span');
      off.className = 'pill';
      off.textContent = t(lang, 'options.sites.off');
      meta.appendChild(off);
    }

    main.appendChild(meta);

    const profile = document.createElement('select');
    profile.className = 'select select-sm site-profile';
    profile.dataset.action = 'profile';
    profile.setAttribute('aria-label', t(lang, 'options.sites.pdfProfileFor', { site: site.pattern }));
    for (const value of SITE_PDF_PROFILES) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = t(lang, `options.sites.profile.${value}`);
      option.selected = site.pdfProfile === value;
      profile.appendChild(option);
    }
    main.appendChild(profile);

    const actions = document.createElement('div');
    actions.className = 'site-actions';

    const toggle = document.createElement('label');
    toggle.className = 'switch';
    toggle.title = t(lang, 'options.sites.enable');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = site.enabled;
    checkbox.dataset.action = 'toggle';
    const track = document.createElement('span');
    track.className = 'track';
    const srOnly = document.createElement('span');
    srOnly.className = 'sr-only';
    srOnly.textContent = `${t(lang, 'options.sites.enable')}: ${site.pattern}`;
    toggle.append(checkbox, track, srOnly);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'icon-btn';
    remove.dataset.action = 'remove';
    remove.title = t(lang, 'options.sites.remove');
    remove.setAttribute('aria-label', `${t(lang, 'options.sites.remove')}: ${site.pattern}`);
    remove.innerHTML = iconSvg('trash', 16);

    actions.append(toggle, remove);
    row.append(main, actions);
    els.siteList.appendChild(row);
  }
}

function renderPreview() {
  const { settings, lang } = state;
  const sample = buildFilename({
    template: settings.file.template,
    site: 'example.com',
    title: t(lang, 'options.file.sampleTitle'),
    date: new Date()
  });
  els.filePreview.textContent = sample;
}

async function renderShortcut() {
  try {
    const commands = await chrome.commands.getAll();
    const main = commands.find((item) => item.name === 'save-pdf')?.shortcut;
    const quiet = commands.find((item) => item.name === 'save-pdf-quiet')?.shortcut;

    if (main && quiet) {
      els.shortcutValue.textContent = t(state.lang, 'options.general.shortcutValueBoth', {
        main,
        quiet
      });
    } else if (main) {
      els.shortcutValue.textContent = t(state.lang, 'options.general.shortcutValue', {
        shortcut: main
      });
    } else {
      els.shortcutValue.textContent = t(state.lang, 'popup.noShortcut');
    }
  } catch {
    els.shortcutValue.textContent = '';
  }
}

/* ------------------------------------------------------------------ */
/* Händelser                                                           */
/* ------------------------------------------------------------------ */

els.runDiagnostics.addEventListener('click', () => void runDiagnostics());

els.addForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const pattern = normalizePattern(els.newPattern.value);

  if (!isValidPattern(pattern)) {
    feedback('error', t(state.lang, 'options.sites.invalid'));
    els.newPattern.focus();
    return;
  }

  const duplicate = state.settings.sites.some(
    (site) => normalizePattern(site.pattern) === pattern
  );
  if (duplicate) {
    feedback('error', t(state.lang, 'options.sites.duplicate'));
    return;
  }

  // Behörighetsfrågan måste ske direkt i klicket.
  const granted = await requestAccess(pattern);

  await updateSettings((draft) => {
    draft.sites.push({ id: createId(), pattern, enabled: true });
  });
  els.newPattern.value = '';
  state.settings = await getSettings();
  await refreshAccess();
  renderAll();
  feedback('ok', t(state.lang, granted ? 'options.sites.added' : 'options.sites.denied', { site: pattern }));
  syncScripts();
});

els.siteList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const row = button.closest('.site-row');
  const site = state.settings.sites.find((item) => item.id === row?.dataset.id);
  if (!site) return;

  if (button.dataset.action === 'grant') {
    const granted = await requestAccess(site.pattern);
    await refreshAccess();
    renderSites();
    showBanner(
      granted ? 'ok' : 'error',
      t(state.lang, granted ? 'options.sites.granted' : 'options.sites.denied', { site: site.pattern })
    );
    syncScripts();
    return;
  }

  if (button.dataset.action === 'remove') {
    await persist(
      (draft) => {
        draft.sites = draft.sites.filter((item) => item.id !== site.id);
      },
      { message: t(state.lang, 'options.sites.removed', { site: site.pattern }) }
    );
    await releaseUnusedOrigin(state.settings, site.pattern);
    await refreshAccess();
    renderSites();
    syncScripts();
  }
});

els.siteList.addEventListener('change', async (event) => {
  const row = event.target.closest('.site-row');
  const id = row?.dataset.id;
  if (!id) return;

  const profile = event.target.closest('select[data-action="profile"]');
  if (profile) {
    await persist((draft) => {
      const site = draft.sites.find((item) => item.id === id);
      if (site) site.pdfProfile = profile.value;
    });
    return;
  }

  const checkbox = event.target.closest('input[data-action="toggle"]');
  if (!checkbox) return;
  await persist((draft) => {
    const site = draft.sites.find((item) => item.id === id);
    if (site) site.enabled = checkbox.checked;
  });
  syncScripts();
});

els.buttonShow.addEventListener('change', () => {
  void persist((draft) => {
    draft.button.show = els.buttonShow.checked;
  }).then(syncScripts);
});

els.buttonPosition.addEventListener('change', () => {
  void persist((draft) => {
    draft.button.position = els.buttonPosition.value;
  });
});

els.pdfMargin.addEventListener('change', () => {
  void persist((draft) => {
    draft.pdf.marginMm = els.pdfMargin.value;
  });
});

els.pdfScale.addEventListener('change', () => {
  void persist((draft) => {
    draft.pdf.scale = Number(els.pdfScale.value) / 100;
  });
});

els.pdfWait.addEventListener('change', () => {
  void persist((draft) => {
    draft.pdf.waitMs = els.pdfWait.value;
  });
});

els.pdfBackground.addEventListener('change', () => {
  void persist((draft) => {
    draft.pdf.printBackground = els.pdfBackground.checked;
  });
});

els.pdfHeader.addEventListener('change', () => {
  void persist((draft) => {
    draft.pdf.headerFooter = els.pdfHeader.checked;
  });
});

els.pdfReader.addEventListener('change', () => {
  void persist((draft) => {
    draft.pdf.reader = els.pdfReader.checked;
  });
});

els.pdfDark.addEventListener('change', () => {
  void persist((draft) => {
    draft.pdf.darkMode = els.pdfDark.checked;
  });
});

els.pdfWatermark.addEventListener('change', () => {
  void persist((draft) => {
    draft.pdf.watermark = els.pdfWatermark.value;
  });
});

els.pdfOptimizeImages.addEventListener('change', () => {
  void persist((draft) => {
    draft.pdf.optimizeImages = els.pdfOptimizeImages.checked;
  });
});

els.pdfOpenAfterSave.addEventListener('change', () => {
  void persist((draft) => {
    draft.pdf.openAfterSave = els.pdfOpenAfterSave.checked;
  });
});

els.pdfTableOfContents.addEventListener('change', () => {
  void persist((draft) => {
    draft.pdf.tableOfContents = els.pdfTableOfContents.checked;
  });
});

els.pdfRemoveBlankPages.addEventListener('change', () => {
  void persist((draft) => {
    draft.pdf.removeBlankPages = els.pdfRemoveBlankPages.checked;
  });
});

els.pdfFooterTitle.addEventListener('change', () => {
  void persist((draft) => {
    draft.pdf.footerTitle = els.pdfFooterTitle.checked;
  });
});

els.pdfFooterUrl.addEventListener('change', () => {
  void persist((draft) => {
    draft.pdf.footerUrl = els.pdfFooterUrl.checked;
  });
});

els.pdfFooterDate.addEventListener('change', () => {
  void persist((draft) => {
    draft.pdf.footerDate = els.pdfFooterDate.checked;
  });
});

els.resetPdf.addEventListener('click', () => {
  void persist((draft) => {
    draft.pdf = structuredClone(DEFAULT_SETTINGS.pdf);
  });
});

els.fileTemplate.addEventListener('change', () => {
  void persist((draft) => {
    draft.file.template = els.fileTemplate.value;
  });
});

els.fileSaveAs.addEventListener('change', () => {
  void persist((draft) => {
    draft.file.saveAs = els.fileSaveAs.checked;
  });
});

els.fileConflictAction.addEventListener('change', () => {
  void persist((draft) => {
    draft.file.conflictAction = els.fileConflictAction.value;
  });
});

els.chooseSaveFolder.addEventListener('click', async () => {
  if (typeof window.showDirectoryPicker !== 'function') {
    showBanner('error', t(state.lang, 'options.file.folderUnsupported'));
    return;
  }
  try {
    // Start the picker before awaiting anything so the browser accepts the user gesture.
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    const permission = await handle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      showBanner('error', t(state.lang, 'options.file.folderPermissionDenied'));
      return;
    }
    await saveDirectoryHandle(handle);
    await persist((draft) => {
      draft.file.rememberLocation = true;
    }, { message: t(state.lang, 'options.file.folderSaved', { folder: handle.name }) });
  } catch (error) {
    if (error?.name !== 'AbortError') showBanner('error', t(state.lang, 'options.file.folderFailed'));
  }
});

els.clearSaveFolder.addEventListener('click', async () => {
  try {
    await clearDirectoryHandle();
    await persist((draft) => {
      draft.file.rememberLocation = false;
    }, { message: t(state.lang, 'options.file.folderCleared') });
  } catch {
    showBanner('error', t(state.lang, 'options.file.folderFailed'));
  }
});

els.theme.addEventListener('change', () => {
  applyTheme(els.theme.value);
  void persist((draft) => {
    draft.theme = els.theme.value;
  });
});

// Följer systemet när temat är "automatiskt".
watchSystemTheme(() => {
  if (normalizeTheme(state.settings?.theme) === 'auto') applyTheme('auto');
});

els.language.addEventListener('change', async () => {
  await updateSettings((draft) => {
    draft.language = els.language.value;
  });
  state.settings = await getSettings();
  state.lang = resolveLang(state.settings.language, chrome.i18n.getUILanguage());
  applyLanguage();
  renderAll();
  flashSaved();
});

els.allowAll.addEventListener('change', () => {
  void persist((draft) => {
    draft.allowAll = els.allowAll.checked;
  }).then(syncScripts);
});

els.shortcutButton.addEventListener('click', async () => {
  try {
    await chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  } catch {
    showBanner('info', 'chrome://extensions/shortcuts');
  }
});

els.exportButton.addEventListener('click', () => {
  const payload = {
    app: 'sida-till-pdf',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      ...state.settings,
      file: { ...state.settings.file, rememberLocation: false }
    }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sida-till-pdf-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
});

els.importButton.addEventListener('click', () => els.importFile.click());

els.importFile.addEventListener('change', async () => {
  const file = els.importFile.files?.[0];
  els.importFile.value = '';
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const candidate = parsed?.settings ?? parsed;
    if (!candidate || typeof candidate !== 'object') throw new Error('Ogiltig struktur');
    const settings = mergeSettings(candidate);
    // A directory handle is browser-local and is deliberately not imported.
    settings.file.rememberLocation = false;
    await saveSettings(settings);
    state.settings = await getSettings();
    state.lang = resolveLang(state.settings.language, chrome.i18n.getUILanguage());
    applyLanguage();
    await refreshAccess();
    renderAll();
    syncScripts();
    showBanner('ok', t(state.lang, 'options.general.imported'));
  } catch {
    showBanner('error', t(state.lang, 'options.general.importFailed'));
  }
});

els.resetAll.addEventListener('click', async () => {
  if (!window.confirm(t(state.lang, 'options.general.resetConfirm'))) return;
  await clearDirectoryHandle();
  await saveSettings(structuredClone(DEFAULT_SETTINGS));
  state.settings = await getSettings();
  state.lang = resolveLang(state.settings.language, chrome.i18n.getUILanguage());
  applyLanguage();
  await refreshAccess();
  renderAll();
  syncScripts();
  showBanner('ok', t(state.lang, 'options.general.resetDone'));
});

onSettingsChanged((settings) => {
  const languageChanged = settings.language !== state.settings?.language;
  state.settings = settings;
  if (languageChanged) {
    state.lang = resolveLang(settings.language, chrome.i18n.getUILanguage());
    applyLanguage();
  }
  void (async () => {
    await refreshAccess();
    renderAll();
  })();
});

window.addEventListener('focus', () => {
  void (async () => {
    await refreshAccess();
    renderSites();
    await renderShortcut();
  })();
});

void reload();
