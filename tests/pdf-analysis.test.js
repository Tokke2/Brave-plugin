import test from 'node:test';
import assert from 'node:assert/strict';

import { countInkPixels, isBlankPageRaster } from '../src/lib/pdf-analysis.js';

function raster(width, height, pixels = []) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = data[offset + 1] = data[offset + 2] = 255;
    data[offset + 3] = 255;
  }
  for (const [x, y, color = 0] of pixels) {
    const offset = (y * width + x) * 4;
    data[offset] = data[offset + 1] = data[offset + 2] = color;
  }
  return data;
}

test('tomsidesanalysen räknar mörka pixlar men ignorerar vit bakgrund', () => {
  const pixels = raster(20, 20, [[2, 3], [4, 5], [6, 7, 250]]);
  assert.equal(countInkPixels(pixels, 20, 20), 2);
});

test('helt vit och mycket glest innehåll klassas som tom sida', () => {
  const white = raster(100, 100);
  assert.equal(isBlankPageRaster(white, 100, 100), true);
  assert.equal(isBlankPageRaster(raster(100, 100, [[10, 10], [11, 10], [12, 10]]), 100, 100), true);
});

test('vanligt text- eller bildinnehåll bevaras', () => {
  const textLine = [];
  for (let x = 10; x < 60; x += 1) textLine.push([x, 20]);
  assert.equal(isBlankPageRaster(raster(100, 100, textLine)), false);

  const image = [];
  for (let y = 20; y < 60; y += 1) {
    for (let x = 20; x < 60; x += 1) image.push([x, y, 80]);
  }
  assert.equal(isBlankPageRaster(raster(100, 100, image)), false);
});
