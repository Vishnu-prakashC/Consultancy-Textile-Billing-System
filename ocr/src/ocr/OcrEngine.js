/**
 * OcrEngine.js — Tesseract.js v5 wrapper for region-based OCR.
 * Exposes runOCR(canvasRegion) returning { text, words, confidence }.
 * Uses global Tesseract when not passed (browser script tag).
 */

const DEFAULT_PSM = 6; // Uniform block of text (invoices)
const DEFAULT_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./:-% ";

let workerInstance = null;

/**
 * Get or create Tesseract worker. Uses createWorker from tesseract.js or window.Tesseract.
 * @param {Object} [tesseract] - Optional: { createWorker } or Tesseract namespace
 * @returns {Promise<import("tesseract.js").Worker>}
 */
async function getWorker(tesseract) {
  if (workerInstance) return workerInstance;
  const T = tesseract || (typeof window !== "undefined" && window.Tesseract);
  if (!T || !T.createWorker) {
    throw new Error("Tesseract not available. Load tesseract.js or pass createWorker.");
  }
  workerInstance = await T.createWorker("eng");
  await workerInstance.setParameters({
    tessedit_pageseg_mode: DEFAULT_PSM,
    preserve_interword_spaces: "1",
    tessedit_char_whitelist: DEFAULT_WHITELIST
  });
  return workerInstance;
}

/**
 * Run OCR on a canvas (or image) region. Returns full text, word list with bboxes, and confidence.
 * @param {HTMLCanvasElement|HTMLImageElement|Blob} canvasRegion - Region to OCR (canvas, image, or blob)
 * @param {Object} [tesseract] - Optional Tesseract namespace (e.g. window.Tesseract)
 * @returns {Promise<{ text: string, words: Array<{ text: string, confidence: number, bbox: { x0, y0, x1, y1 } }>, confidence: number }>}
 */
export async function runOCR(canvasRegion, tesseract) {
  const worker = await getWorker(tesseract);

  let source = canvasRegion;
  if (canvasRegion instanceof HTMLCanvasElement) {
    source = canvasRegion;
  } else if (canvasRegion instanceof Blob) {
    source = await blobToDataUrl(canvasRegion);
  }

  const { data } = await worker.recognize(source);

  const words = (data.words || []).map((w) => ({
    text: (w.text || "").trim(),
    confidence: w.confidence ?? 0,
    bbox: w.bbox
      ? {
          x0: w.bbox.x0 ?? w.bbox.left ?? 0,
          y0: w.bbox.y0 ?? w.bbox.top ?? 0,
          x1: w.bbox.x1 ?? w.bbox.right ?? 0,
          y1: w.bbox.y1 ?? w.bbox.bottom ?? 0
        }
      : null
  }));

  return {
    text: data.text || "",
    words,
    confidence: data.confidence != null ? data.confidence / 100 : 0
  };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Blob read failed"));
    r.readAsDataURL(blob);
  });
}

/**
 * Terminate the worker (free memory). Call when done with all OCR.
 */
export async function terminateWorker() {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
  }
}

/**
 * Set optional logger for Tesseract progress (e.g. (m) => console.log(m)).
 * @param {Function} logger
 */
export function setLogger(logger) {
  // Tesseract recognize() accepts { logger: (m) => ... }; pass through when calling runOCR if needed
  if (workerInstance && workerInstance.recognize) {
    workerInstance.logger = logger;
  }
}
