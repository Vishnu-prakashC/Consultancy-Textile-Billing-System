/**
 * AnchorDetector.js — Detect anchor words from OCR word list for template learning.
 * Anchors: NEW GOOD NITS, GSTIN, TO, NO, TOTAL, NET TOTAL. bbox: { x0, y0, x1, y1 } or { left, top, right, bottom }.
 */

/**
 * Get top-left y from a word bbox (Tesseract may use y0 or top).
 * @param {{ x0?: number, y0?: number, x1?: number, y1?: number, left?: number, top?: number, right?: number, bottom?: number }} bbox
 */
function bboxY(bbox) {
  if (!bbox) return 0;
  return bbox.y0 ?? bbox.top ?? 0;
}

/**
 * Get top-left x from a word bbox.
 */
function bboxX(bbox) {
  if (!bbox) return 0;
  return bbox.x0 ?? bbox.left ?? 0;
}

/**
 * Detect anchor positions from OCR words. Used to compute layout from a single invoice.
 * @param {Array<{ text: string, bbox?: object }>} words - Words from runOCR(canvas).words
 * @returns {{ company?: object, gstin?: object, customer?: object, billNo?: object, total?: object, netTotal?: object }}
 */
export function detectAnchors(words) {
  const anchors = {};

  for (const w of words || []) {
    const text = (w.text || "").trim().toUpperCase();
    const bbox = w.bbox;

    if (text.includes("NEW") && (text.includes("GOOD") || text.includes("NITS"))) {
      anchors.company = bbox ? { x: bboxX(bbox), y: bboxY(bbox) } : null;
    }
    if (text === "GSTIN") {
      anchors.gstin = bbox ? { x: bboxX(bbox), y: bboxY(bbox) } : null;
    }
    if (text === "TO") {
      anchors.customer = bbox ? { x: bboxX(bbox), y: bboxY(bbox) } : null;
    }
    if (text === "NO" && !anchors.billNo) {
      anchors.billNo = bbox ? { x: bboxX(bbox), y: bboxY(bbox) } : null;
    }
    if (text.includes("TOTAL") && !text.includes("NET")) {
      anchors.total = bbox ? { x: bboxX(bbox), y: bboxY(bbox) } : null;
    }
    if (text.includes("NET") && text.includes("TOTAL")) {
      anchors.netTotal = bbox ? { x: bboxX(bbox), y: bboxY(bbox) } : null;
    }
  }

  return anchors;
}
