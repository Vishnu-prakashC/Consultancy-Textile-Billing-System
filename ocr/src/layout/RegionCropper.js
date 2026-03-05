/**
 * RegionCropper.js — Crop canvas into regions using normalized layout (0–1 fractions).
 * rightSide: true means use right half of the vertical band (e.g. customer left, billMeta right).
 */

import { NEW_GOOD_NITS_LAYOUT } from "./InvoiceLayout.js";

/**
 * Crop a single region from the source canvas.
 * @param {HTMLCanvasElement} imageCanvas - Full-page canvas (e.g. preprocessed)
 * @param {Object} regionConfig - { top, bottom, left?, right?, rightSide? }
 *   top/bottom: 0–1 fraction of height. left/right: 0–1 fraction of width (optional).
 *   If rightSide is true, use left=0.5, right=1 for the same vertical band.
 * @returns {HTMLCanvasElement} New canvas containing only the region
 */
export function cropRegion(imageCanvas, regionConfig) {
  const w = imageCanvas.width;
  const h = imageCanvas.height;

  let left = regionConfig.left;
  let right = regionConfig.right;
  if (regionConfig.rightSide === true) {
    left = 0.5;
    right = 1;
  } else if (left == null) left = 0;
  if (right == null) right = 1;

  const top = regionConfig.top ?? 0;
  const bottom = regionConfig.bottom ?? 1;

  const sx = Math.round(left * w);
  const sy = Math.round(top * h);
  const sw = Math.round((right - left) * w);
  const sh = Math.round((bottom - top) * h);

  const crop = document.createElement("canvas");
  crop.width = Math.max(1, sw);
  crop.height = Math.max(1, sh);
  const ctx = crop.getContext("2d");
  ctx.drawImage(imageCanvas, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
  return crop;
}

/**
 * Crop all regions from the layout into an object of canvases.
 * @param {HTMLCanvasElement} imageCanvas
 * @param {Object} [layout] - Default NEW_GOOD_NITS_LAYOUT
 * @returns {Object.<string, HTMLCanvasElement>}
 */
export function cropAllRegions(imageCanvas, layout = NEW_GOOD_NITS_LAYOUT) {
  const out = {};
  for (const [name, config] of Object.entries(layout)) {
    out[name] = cropRegion(imageCanvas, config);
  }
  return out;
}
