/**
 * Rena hjälpfunktioner för PDF-utskriften.
 * Ingen chrome-beroende kod – kan testas med Node.
 */

export const PAPER_SIZES = {
  A4: [8.27, 11.69]
};

/** Minsta marginal (tum) när en sidofot skrivs ut. */
const FOOTER_MARGIN = 0.6;

/** Lägsta utskriftsskala som stöds av Chromium. */
const MIN_AUTO_SCALE = 0.1;

/** Validate and normalize Chromium's comma-separated PDF page-range syntax. */
export function normalizePageRanges(value) {
  const ranges = String(value ?? '').trim();
  if (!ranges) return '';
  if (ranges.length > 200 || !/^\d+(?:\s*-\s*\d+)?(?:\s*,\s*\d+(?:\s*-\s*\d+)?)*$/.test(ranges)) {
    return null;
  }
  const normalized = ranges.split(',').map((part) => {
    const [startText, endText] = part.split('-').map((item) => item.trim());
    const start = Number(startText);
    const end = endText === undefined ? start : Number(endText);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) return null;
    return start === end ? String(start) : `${start}-${end}`;
  });
  return normalized.some((range) => range === null) ? null : normalized.join(',');
}

export const MIXED_ORIENTATION_CSS = `
  @page { size: A4 portrait; }
  @page stp-landscape { size: A4 landscape; }
  @media print {
    .__stp-landscape-zone { page: stp-landscape !important; }
  }
`;

export const PRINT_FRIENDLY_CSS = `
  @media print {
    h1, h2, h3, h4, h5, h6 { break-after: avoid-page; page-break-after: avoid; }
    figure, figcaption, blockquote, pre, img, svg, canvas,
    tr, .card, .panel, [data-print-keep-together] {
      break-inside: avoid-page; page-break-inside: avoid;
    }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    img, svg, canvas { max-width: 100% !important; }
    p, li { orphans: 3; widows: 3; }
  }
`;

export function mmToInch(mm) {
  return Number((Number(mm) / 25.4).toFixed(4));
}

/** Pappersbredd i CSS-pixlar (96 dpi) minus marginaler – vid skala 1. */
export function paperWidthCssPx(pdf, orientation = 'portrait') {
  const [shortSide, longSide] = PAPER_SIZES.A4;
  const width = orientation === 'landscape' ? longSide : shortSide;
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
 * Begränsar maximal skala så att sidans layoutbredd ryms på A4. Höjden
 * pagineras normalt över flera A4-sidor i stället för att krympas till ett ark.
 */
export function autoFitScale({ contentWidth = 0, usableWidth = 0, scale = 1 } = {}) {
  const requested = Number.isFinite(Number(scale)) && Number(scale) > 0 ? Number(scale) : 1;
  const base = Math.min(2, Math.max(MIN_AUTO_SCALE, requested));
  if (!contentWidth || !usableWidth) return Math.min(base, 1);

  // Mätbredden är layoutad vid pappersbredden. Skalan får aldrig göra
  // innehållet bredare än papperet; höjden fortsätter över flera A4-ark.
  const fit = usableWidth / contentWidth;
  return Number(Math.max(MIN_AUTO_SCALE, Math.min(base, fit)).toFixed(3));
}

/** Choose the orientation with the larger fitted text scale; ties stay portrait. */
export function choosePageOrientation({
  portraitContentWidth = 0,
  landscapeContentWidth = 0,
  marginMm = 0,
  scale = 1
} = {}) {
  const portraitScale = autoFitScale({
    contentWidth: portraitContentWidth,
    usableWidth: paperWidthCssPx({ marginMm }, 'portrait'),
    scale
  });
  const landscapeScale = autoFitScale({
    contentWidth: landscapeContentWidth,
    usableWidth: paperWidthCssPx({ marginMm }, 'landscape'),
    scale
  });
  return landscapeScale > portraitScale ? 'landscape' : 'portrait';
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
export function buildPrintParams({ settings, tab = {}, scale, landscape = false, pageRanges = '', mixedOrientation = false } = {}) {
  const pdf = settings.pdf;
  const margin = mmToInch(pdf.marginMm);
  const [shortSide, longSide] = PAPER_SIZES.A4;
  const width = landscape ? longSide : shortSide;
  const height = landscape ? shortSide : longSide;
  const footer = buildFooterTemplate({
    title: pdf.footerTitle ? tab.title || '' : '',
    url: pdf.footerUrl ? tab.url || '' : '',
    date: pdf.footerDate ? new Date() : null,
    showPages: pdf.headerFooter
  });

  const params = {
    landscape: Boolean(landscape),
    displayHeaderFooter: Boolean(footer),
    printBackground: pdf.printBackground || pdf.darkMode,
    scale: Number.isFinite(Number(scale)) ? Number(scale) : pdf.scale,
    marginTop: margin,
    marginBottom: footer ? Math.max(margin, FOOTER_MARGIN) : margin,
    marginLeft: margin,
    marginRight: margin,
    preferCSSPageSize: Boolean(mixedOrientation),
    generateDocumentOutline: true,
    transferMode: 'ReturnAsBase64'
  };

  if (!pdf.preferCssPageSize) {
    params.paperWidth = width;
    params.paperHeight = height;
  }

  const normalizedRanges = normalizePageRanges(pageRanges);
  if (normalizedRanges) params.pageRanges = normalizedRanges;

  if (footer) {
    params.headerTemplate = '<span></span>';
    params.footerTemplate = footer;
  }

  return params;
}
