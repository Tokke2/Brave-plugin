/**
 * Rena hjälpfunktioner för PDF-utskriften.
 * Ingen chrome-beroende kod – kan testas med Node.
 */

export const PAPER_SIZES = {
  A4: [8.27, 11.69],
  Letter: [8.5, 11],
  Legal: [8.5, 14],
  A3: [11.69, 16.54]
};

/** Minsta marginal (tum) när en sidofot skrivs ut. */
const FOOTER_MARGIN = 0.6;

/** Minsta skala som autoskalan får krympa till. */
const MIN_AUTO_SCALE = 0.45;

export function mmToInch(mm) {
  return Number((Number(mm) / 25.4).toFixed(4));
}

/** Pappersbredd i CSS-pixlar (96 dpi) minus marginaler – vid skala 1. */
export function paperWidthCssPx(pdf) {
  const [width] = PAPER_SIZES[pdf?.format] || PAPER_SIZES.A4;
  const margin = mmToInch(pdf?.marginMm ?? 0) * 2;
  return Math.max(120, (width - margin) * 96);
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function formatDate(date) {
  const value = date instanceof Date ? date : new Date(date ?? Date.now());
  const pad = (number) => String(number).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/**
 * Bygger sidofoten med källrad (titel, URL, datum) och/eller sidnummer.
 * Returnerar null när inget ska visas.
 */
export function buildFooterTemplate({ title = '', url = '', date = null, showPages = false } = {}) {
  const parts = [];
  if (title) parts.push(title);
  if (url) parts.push(url);
  if (date) parts.push(formatDate(date));

  const source = parts.map(escapeHtml).join(' · ');
  const pages =
    '<span class="pageNumber"></span> / <span class="totalPages"></span>';

  if (!source && !showPages) return null;

  const left = source
    ? `<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${source}</span>`
    : '<span></span>';
  const right = showPages ? `<span style="flex:none;">${pages}</span>` : '<span></span>';

  return `<div style="width:100%; padding:0 10mm; box-sizing:border-box; display:flex;
    gap:12px; align-items:flex-end; justify-content:space-between;
    font-family:system-ui, -apple-system, 'Segoe UI', sans-serif; font-size:9px;
    line-height:1.3; color:#6b7280;">${left}${right}</div>`;
}

/**
 * Räknar ut skalan som behövs för att en sida som är bredare än papperet
 * ska rymmas utan att klippas av. Returnerar användarens skala när sidan
 * redan får plats.
 */
export function autoFitScale({ contentWidth = 0, usableWidth = 0, scale = 1 } = {}) {
  const base = Number.isFinite(Number(scale)) && Number(scale) > 0 ? Number(scale) : 1;
  if (!contentWidth || !usableWidth) return base;
  // Små avrundningar ska inte krympa sidan i onödan.
  if (contentWidth <= usableWidth * 1.02) return base;
  const fit = (usableWidth / contentWidth) * base;
  return Number(Math.max(Math.min(base, MIN_AUTO_SCALE), Math.min(base, fit)).toFixed(3));
}

/** CSS som ger en mörk utskrift (ljus text på mörk bakgrund). */
export const DARK_PRINT_CSS = `
  html { background: #ffffff !important; }
  html { filter: invert(1) hue-rotate(180deg) !important; }
  img, picture, video, canvas, svg, iframe, object, embed,
  [style*="background-image"], [style*="background: url"] {
    filter: invert(1) hue-rotate(180deg) !important;
  }
`;

/**
 * DevTools-protokollets parametrar för Page.printToPDF.
 * `scale` är den färdiguträknade skalan (autoskala eller användarens val).
 */
export function buildPrintParams({ settings, tab = {}, scale } = {}) {
  const pdf = settings.pdf;
  const margin = mmToInch(pdf.marginMm);
  const [width, height] = PAPER_SIZES[pdf.format] || PAPER_SIZES.A4;
  const footer = buildFooterTemplate({
    title: pdf.footerTitle ? tab.title || '' : '',
    url: pdf.footerUrl ? tab.url || '' : '',
    date: pdf.footerDate ? new Date() : null,
    showPages: pdf.headerFooter
  });

  const params = {
    landscape: false,
    displayHeaderFooter: Boolean(footer),
    printBackground: pdf.printBackground || pdf.darkMode,
    scale: Number.isFinite(Number(scale)) ? Number(scale) : pdf.scale,
    marginTop: margin,
    marginBottom: footer ? Math.max(margin, FOOTER_MARGIN) : margin,
    marginLeft: margin,
    marginRight: margin,
    preferCSSPageSize: pdf.preferCssPageSize,
    transferMode: 'ReturnAsBase64'
  };

  if (!pdf.preferCssPageSize) {
    params.paperWidth = width;
    params.paperHeight = height;
  }

  if (footer) {
    params.headerTemplate = '<span></span>';
    params.footerTemplate = footer;
  }

  return params;
}
