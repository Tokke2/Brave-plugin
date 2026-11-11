import { resolveLang, applyI18n, t } from './lib/i18n.js';
import { normalizeTheme } from './lib/settings.js';
import { applyTheme, applyDensity, watchSystemTheme } from './lib/theme.js';

const elements = {
  title: document.getElementById('preview-title'),
  mode: document.getElementById('preview-mode'),
  source: document.getElementById('source-link'),
  words: document.getElementById('word-count'),
  headings: document.getElementById('heading-count'),
  images: document.getElementById('image-count'),
  content: document.getElementById('preview-content'),
  error: document.getElementById('preview-error')
};
let themePreference = 'auto';

function sanitizeHtml(markup, baseUrl) {
  const template = document.createElement('template');
  template.innerHTML = String(markup || '');
  template.content.querySelectorAll(
    'script,style,noscript,iframe,object,embed,form,button,input,select,textarea,link,meta,base,foreignObject,svg,math,video,audio,source'
  ).forEach((node) => node.remove());

  for (const element of template.content.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (
        name.startsWith('on') ||
        name === 'style' ||
        name === 'srcdoc' ||
        name === 'srcset' ||
        name === 'id' ||
        name === 'class'
      ) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (name === 'href' || name === 'src' || name === 'xlink:href') {
        try {
          const url = new URL(value, baseUrl);
          if (!['http:', 'https:'].includes(url.protocol)) element.removeAttribute(attribute.name);
          else element.setAttribute(attribute.name, url.href);
        } catch {
          element.removeAttribute(attribute.name);
        }
      }
    }
  }
  return template.innerHTML;
}

async function boot() {
  let settings = {};
  try {
    const response = await chrome.storage.local.get('settings');
    settings = response.settings || {};
  } catch {
    settings = {};
  }
  themePreference = settings.theme || 'auto';
  applyTheme(themePreference);
  applyDensity(settings.layoutDensity);
  watchSystemTheme(() => {
    if (normalizeTheme(themePreference) === 'auto') applyTheme('auto');
  });

  let documentData = null;
  const token = new URLSearchParams(location.search).get('token') || '';
  const key = `pending-preview:${token}`;
  if (token) {
    try {
      const stored = await chrome.storage.session.get(key);
      documentData = stored[key] || null;
      await chrome.storage.session.remove(key);
    } catch {
      documentData = null;
    }
  }
  if (!documentData) {
    elements.error.hidden = false;
    return;
  }

  const lang = resolveLang(documentData.language || settings.language, chrome.i18n.getUILanguage());
  applyI18n(document, lang);
  const title = String(documentData.title || t(lang, 'preview.title')).slice(0, 240);
  document.title = `${title} · ${t(lang, 'preview.title')}`;
  elements.title.textContent = title;
  elements.source.href = documentData.url;
  elements.mode.textContent = t(lang, documentData.readerMode ? 'preview.articleMode' : 'preview.mainContentCandidate');

  const parsed = new DOMParser().parseFromString(String(documentData.html || ''), 'text/html');
  const text = (parsed.body.textContent || '').trim();
  const words = Number(documentData.words) || text.split(/\s+/).filter(Boolean).length;
  elements.words.textContent = new Intl.NumberFormat(lang === 'sv' ? 'sv-SE' : 'en-US').format(words);
  elements.headings.textContent = String(parsed.querySelectorAll('h1,h2,h3,h4,h5,h6').length);
  elements.images.textContent = String(parsed.querySelectorAll('img').length);
  elements.content.innerHTML = sanitizeHtml(documentData.html, documentData.url);
}

void boot();
