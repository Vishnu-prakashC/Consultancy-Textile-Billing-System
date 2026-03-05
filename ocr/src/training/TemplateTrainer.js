/**
 * TemplateTrainer.js — One-time training: run OCR on sample images, detect anchors, compute layout, average.
 * Output: layout object. Use exportLayoutAsJson / downloadLayoutAsJson to save (e.g. templates/NEW_GOOD_NITS_LAYOUT.json).
 */

import { detectAnchors } from "./AnchorDetector.js";
import { computeLayoutFromAnchors, averageLayouts } from "./LayoutCalculator.js";

/**
 * Export layout as JSON string (for saving to file in Node or copy-paste).
 * @param {Object} layout - Layout from trainTemplate() or averageLayouts()
 * @returns {string}
 */
export function exportLayoutAsJson(layout) {
  return JSON.stringify(layout, null, 2);
}

/**
 * Trigger browser download of layout as JSON file (e.g. NEW_GOOD_NITS_LAYOUT.json).
 * @param {Object} layout - Layout from trainTemplate() or averageLayouts()
 * @param {string} [filename] - Default "NEW_GOOD_NITS_LAYOUT.json"
 */
export function downloadLayoutAsJson(layout, filename = "NEW_GOOD_NITS_LAYOUT.json") {
  if (typeof document === "undefined" || !document.createElement) return;
  const blob = new Blob([exportLayoutAsJson(layout)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Train a template layout from multiple sample invoice images.
 * @param {Array<HTMLImageElement|File|Blob|string>} images - 3+ sample invoice images
 * @param {Object} opts - { preprocess(img), runOCR(canvas) }
 * @param {function} opts.preprocess - Async (img) => canvas
 * @param {function} opts.runOCR - Async (canvas) => { words }
 * @returns {Promise<Object>} Averaged layout { header, customer, billMeta, table, totals } with y, h (, x, w)
 */
export async function trainTemplate(images, { preprocess, runOCR }) {
  const layouts = [];

  for (const img of images || []) {
    const canvas = await preprocess(img);
    const { words } = await runOCR(canvas);
    const anchors = detectAnchors(words);
    const layout = computeLayoutFromAnchors(anchors, canvas);
    layouts.push(layout);
  }

  return averageLayouts(layouts);
}

/**
 * Train and optionally download the averaged layout as JSON.
 * @param {Array<HTMLImageElement|File|Blob|string>} images - 3+ sample invoice images
 * @param {Object} opts - { preprocess, runOCR, download?: boolean, filename?: string }
 * @returns {Promise<Object>} Averaged layout
 */
export async function trainAndExport(images, opts = {}) {
  const { download = false, filename = "NEW_GOOD_NITS_LAYOUT.json", ...rest } = opts;
  const layout = await trainTemplate(images, rest);
  if (download && layout) {
    downloadLayoutAsJson(layout, filename);
  }
  return layout;
}
