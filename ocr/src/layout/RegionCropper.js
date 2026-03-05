/**
 * RegionCropper.js — Crop canvas into regions using normalized layout (0–1).
 * left/right optional; when omitted region uses full width.
 */

import { NEW_GOOD_NITS_LAYOUT } from "./InvoiceLayout.js";

/**
 * Crop a single region from the source canvas.
 * @param {HTMLCanvasElement} canvas - Full-page canvas (e.g. preprocessed)
 * @param {Object} region - { top, bottom, left?, right? } (0–1 fractions)
 * @returns {HTMLCanvasElement} Cropped canvas
 */
export function cropRegion(canvas, region) {
  const w = canvas.width;
  const h = canvas.height;

  const top = region.top * h;
  const bottom = region.bottom * h;
  const left = region.left != null ? region.left * w : 0;
  const right = region.right != null ? region.right * w : w;

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = Math.max(1, Math.round(right - left));
  cropCanvas.height = Math.max(1, Math.round(bottom - top));

  const ctx = cropCanvas.getContext("2d");
  ctx.drawImage(
    canvas,
    left,
    top,
    right - left,
    bottom - top,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height
  );

  return cropCanvas;
}

/**
 * Crop all regions from the layout.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} [layout] - Default NEW_GOOD_NITS_LAYOUT
 */
export function cropAllRegions(canvas, layout = NEW_GOOD_NITS_LAYOUT) {
  const out = {};
  for (const [name, config] of Object.entries(layout)) {
    out[name] = cropRegion(canvas, config);
  }
  return out;
}
