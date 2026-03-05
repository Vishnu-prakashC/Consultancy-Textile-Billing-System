/**
 * SmartRegionCropper.js — Crop regions using trained template layout (y, h and optional x, w).
 * Layout format: { header: { y, h }, customer: { y, h, x?, w? }, ... }. All fractions 0–1.
 */

/**
 * Crop all regions from canvas using a y/h (and optional x/w) layout.
 * @param {HTMLCanvasElement} canvas - Full-page canvas
 * @param {Object} layout - { [regionName]: { y, h, x?, w? } }
 * @returns {{ [regionName]: HTMLCanvasElement }}
 */
export function cropRegions(canvas, layout) {
  const regions = {};
  const w = canvas.width;
  const h = canvas.height;

  for (const key of Object.keys(layout || {})) {
    const r = layout[key];
    const y = (r.y ?? 0) * h;
    const height = Math.max(1, Math.round((r.h ?? 0) * h));
    const x = r.x != null ? r.x * w : 0;
    const width = r.w != null ? Math.max(1, Math.round(r.w * w)) : w;

    const tmp = document.createElement("canvas");
    tmp.width = width;
    tmp.height = height;

    const ctx = tmp.getContext("2d");
    ctx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

    regions[key] = tmp;
  }

  return regions;
}
