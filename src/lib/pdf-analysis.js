/** Pixel-level helpers shared by the PDF post-processor and its tests. */
export function countInkPixels(data, width, height, { threshold = 245 } = {}) {
  if (!data || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return 0;
  let count = 0;
  const pixels = Math.min(width * height, Math.floor(data.length / 4));
  for (let index = 0; index < pixels; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3];
    if (!alpha) continue;
    const luminance = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
    if (luminance < threshold) count += 1;
  }
  return count;
}

/** Keep pages with even sparse content; ignore only near-empty raster output. */
export function isBlankPageRaster(data, width, height, options = {}) {
  const ink = countInkPixels(data, width, height, options);
  const area = Math.max(1, width * height);
  const minimumInk = Number.isFinite(options.minimumInk) ? Math.max(0, options.minimumInk) : 28;
  const ratio = Number.isFinite(options.maximumInkRatio) ? Math.max(0, options.maximumInkRatio) : 0.00025;
  return ink < Math.max(minimumInk, Math.ceil(area * ratio));
}
