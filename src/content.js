/**
 * Innehållsskript – ritar den flytande PDF-knappen och toasten.
 *
 * Skriptet är medvetet fristående (inga importer) eftersom det registreras
 * dynamiskt som ett klassiskt skript. All logik kring valda webbplatser
 * ligger i bakgrundstjänsten, som svarar på PAGE_CONTEXT.
 */

(() => {
  if (window.__pageToPdfInjected) return;
  window.__pageToPdfInjected = true;

  const HOST_ID = 'page-to-pdf-host';

  const FILE_ICON = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
              stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
        <path d="M14 3v5h5M12 12v6" stroke="currentColor" stroke-width="1.7"
              stroke-linecap="round" stroke-linejoin="round"/>
        <path d="m9.3 15.3 2.7 2.7 2.7-2.7" stroke="currentColor" stroke-width="1.7"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;

  const TOAST_ICONS = {
    saving: '<span class="spinner"></span>',
    saved: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>
        <path d="m8 12.3 2.6 2.6L16 9.5" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    error: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>
        <path d="M12 7.5v5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="12" cy="16.6" r="1.05" fill="currentColor"/>
      </svg>`,
    info: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>
        <path d="M12 11v5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="12" cy="7.6" r="1.05" fill="currentColor"/>
      </svg>`
  };
  const POSITIONS = {
    br: { bottom: '20px', right: '20px' },
    bl: { bottom: '20px', left: '20px' },
    tr: { top: '20px', right: '20px' },
    tl: { top: '20px', left: '20px' }
  };

  let context = null;
  let host = null;
  let shadow = null;
  let button = null;
  let label = null;
  let toast = null;
  let toastIcon = null;
  let toastText = null;
  let toastTimer = null;
  let busy = false;
  let lastHref = location.href;

  const CSS = `
    :host { all: initial; }
    .wrap {
      position: fixed;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: flex-end;
      font-family: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
      pointer-events: none;
    }
    .wrap.pos-br { bottom: 20px; right: 20px; }
    .wrap.pos-bl { bottom: 20px; left: 20px; align-items: flex-start; }
    .wrap.pos-tr { top: 20px; right: 20px; }
    .wrap.pos-tl { top: 20px; left: 20px; align-items: flex-start; }

    button.save {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      padding: 9px 14px 9px 11px;
      border: 0;
      border-radius: 999px;
      background: #d93b30;
      color: #fff;
      font: 600 13px/1 "Segoe UI", system-ui, -apple-system, sans-serif;
      letter-spacing: .01em;
      cursor: pointer;
      box-shadow: 0 6px 16px rgba(16, 24, 40, .22), 0 1px 2px rgba(16, 24, 40, .18);
      opacity: .96;
      transition: transform .12s ease, opacity .12s ease, background-color .12s ease, box-shadow .12s ease;
    }
    button.save:hover { opacity: 1; background: #c22f25; transform: translateY(-1px); box-shadow: 0 10px 22px rgba(16, 24, 40, .28); }
    button.save:active { transform: translateY(0); }
    button.save:focus-visible { outline: 3px solid #ffffff; outline-offset: 2px; }
    button.save[disabled] { cursor: progress; opacity: .8; }
    button.save svg { flex: none; display: block; }

    .spinner {
      width: 15px;
      height: 15px;
      border: 2px solid rgba(255,255,255,.45);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin .7s linear infinite;
      flex: none;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .toast {
      pointer-events: none;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      max-width: 320px;
      padding: 10px 13px;
      border-radius: 10px;
      background: #16181d;
      color: #f7f8fa;
      font: 500 12.5px/1.45 "Segoe UI", system-ui, -apple-system, sans-serif;
      box-shadow: 0 10px 28px rgba(16, 24, 40, .3);
      opacity: 0;
      transform: translateY(6px);
      transition: opacity .18s ease, transform .18s ease;
      word-break: break-word;
    }
    .toast.visible { opacity: 1; transform: translateY(0); }
    .toast-icon { flex: none; margin-top: 1px; display: inline-flex; }
    .toast-icon svg { display: block; }
    .toast-icon .spinner { width: 14px; height: 14px; border-width: 2px; }
    .toast-text { min-width: 0; }
    .toast.error { background: #8f1d15; }
    .toast.saved { background: #12492c; }

    @media (prefers-reduced-motion: reduce) {
      button.save, .toast { transition: none; }
      .spinner { animation-duration: 2s; }
    }
  `;

  /**
   * Constructable stylesheets påverkas inte av sidans CSP. I äldre miljöer
   * faller vi tillbaka på ett vanligt style-element.
   */
  function applyStyles(root) {
    try {
      if (typeof CSSStyleSheet === 'function' && 'adoptedStyleSheets' in root) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(CSS);
        root.adoptedStyleSheets = [sheet];
        return true;
      }
    } catch {
      /* faller tillbaka */
    }
    return false;
  }

  function buildUi(position) {
    if (host) return;
    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-page-to-pdf', '');
    shadow = host.attachShadow({ mode: 'open' });

    if (!applyStyles(shadow)) {
      const style = document.createElement('style');
      style.textContent = CSS;
      shadow.appendChild(style);
    }

    const wrap = document.createElement('div');
    wrap.className = `wrap pos-${position}`;

    toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    toastIcon = document.createElement('span');
    toastIcon.className = 'toast-icon';
    toastIcon.setAttribute('aria-hidden', 'true');

    toastText = document.createElement('span');
    toastText.className = 'toast-text';

    toast.append(toastIcon, toastText);

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'save';
    button.innerHTML = `
${FILE_ICON}
      <span class="label">PDF</span>`;

    label = button.querySelector('.label');
    button.addEventListener('click', onSaveClick);

    wrap.appendChild(toast);
    wrap.appendChild(button);
    shadow.appendChild(wrap);
    document.documentElement.appendChild(host);
  }

  function buttonTitle() {
    const base = context?.strings?.button || 'Save as PDF';
    const alt = context?.strings?.altHint;
    return alt ? `${base} · ${alt}` : base;
  }

  function positionUi(position) {
    if (!shadow) return;
    const wrap = shadow.querySelector('.wrap');
    if (!wrap) return;
    wrap.className = `wrap pos-${POSITIONS[position] ? position : 'br'}`;
  }

  function removeUi() {
    if (!host) return;
    host.remove();
    host = null;
    shadow = null;
    button = null;
    label = null;
    toast = null;
    toastIcon = null;
    toastText = null;
    clearTimeout(toastTimer);
  }

  function showToast({ state = 'info', text = '' } = {}) {
    if (!toast || !text) return;
    clearTimeout(toastTimer);
    toastIcon.innerHTML = TOAST_ICONS[state] || TOAST_ICONS.info;
    toastText.textContent = text;
    toast.className = `toast ${state}`;
    // Tvinga fram en omritning så att övergången spelas upp igen.
    void toast.offsetWidth;
    toast.classList.add('visible');
    if (state === 'saved' || state === 'error' || state === 'info') {
      toastTimer = setTimeout(() => {
        toast?.classList.remove('visible');
      }, state === 'error' ? 7000 : 4500);
    }
  }

  function setBusy(value) {
    busy = value;
    if (!button) return;
    button.disabled = value;
    button.setAttribute(
      'aria-label',
      context?.strings?.button || 'Save as PDF'
    );
    button.title = buttonTitle();
    const existingSpinner = button.querySelector('.spinner');
    if (value && !existingSpinner) {
      const spinner = document.createElement('span');
      spinner.className = 'spinner';
      button.replaceChildren(spinner);
    } else if (!value) {
      button.innerHTML = `${FILE_ICON}<span class="label"></span>`;
      label = button.querySelector('.label');
      label.textContent = context?.strings?.buttonShort || 'PDF';
      button.title = buttonTitle();
    }
  }

  async function onSaveClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      // Alt+klick hoppar över spar-dialogen och lägger filen direkt i
      // webbläsarens hämtningsmapp.
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_PDF',
        forceSaveAs: event.altKey ? false : undefined
      });
      if (response && response.ok === false) {
        const text = response.message || context?.strings?.failed || 'Error';
        if (!toast?.classList.contains('visible')) showToast({ state: 'error', text });
      }
    } catch {
      showToast({ state: 'error', text: context?.strings?.failed || 'Error' });
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!context || !context.allowed || !context.show) {
      removeUi();
      return;
    }
    buildUi(context.position);
    positionUi(context.position);
    if (label) label.textContent = context.strings?.buttonShort || 'PDF';
    if (button) {
      button.title = buttonTitle();
      button.setAttribute('aria-label', context.strings?.button || 'Save as PDF');
    }
  }

  async function refresh() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'PAGE_CONTEXT', url: location.href });
      context = response?.context || null;
    } catch {
      context = null;
    }
    apply();
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'TOAST') showToast(message);
    if (message.type === 'REFRESH') void refresh();
  });

  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area === 'local' && changes.settings) void refresh();
  });

  // SPA:er byter adress utan omladdning – håll koll på URL:en.
  setInterval(() => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    void refresh();
  }, 1200);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refresh();
  });

  void refresh();
})();
