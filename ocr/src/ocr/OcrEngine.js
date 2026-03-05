/**
 * OcrEngine.js — Tesseract.js v5 wrapper. runOCR(canvas) → { text, words, confidence }.
 * Supports: (1) ESM import from CDN, (2) global Tesseract from script tag.
 * Option reuseWorker: false = create/terminate per call (matches spec); true = one worker for all regions (faster).
 */

const DEFAULT_PSM = 6; // Uniform block of text (invoices)

let workerInstance = null;
let tesseractModule = null;

async function getTesseract(injected) {
  if (injected?.createWorker) return injected;
  if (typeof window !== "undefined" && window.Tesseract?.createWorker) return window.Tesseract;
  if (!tesseractModule) {
    try {
      tesseractModule = await import("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js");
    } catch (e) {
      throw new Error("Tesseract not available. Load tesseract.js script or pass createWorker.");
    }
  }
  return tesseractModule;
}

/**
 * Run OCR on a canvas (or image). When reuseWorker is false, creates and terminates worker each time (per your spec).
 * @param {HTMLCanvasElement|HTMLImageElement} canvas - Region to OCR
 * @param {Object} [opts] - { tesseract, reuseWorker }
 * @returns {Promise<{ text: string, words: Array<{ text: string, confidence: number, bbox }>, confidence: number }>}
 */
export async function runOCR(canvas, opts = {}) {
  const { tesseract: injected, reuseWorker = false } = opts;
  const T = await getTesseract(injected);

  let worker;
  if (reuseWorker && workerInstance) {
    worker = workerInstance;
  } else {
    worker = await T.createWorker();
    if (worker.loadLanguage) await worker.loadLanguage("eng");
    if (worker.initialize) await worker.initialize("eng");
    await worker.setParameters({ tessedit_pageseg_mode: DEFAULT_PSM });
    if (reuseWorker) workerInstance = worker;
  }

  const result = await worker.recognize(canvas);

  if (!reuseWorker) {
    await worker.terminate();
  }

  const data = result.data;
  const words = (data.words || []).map((w) => ({
    text: (w.text || "").trim(),
    confidence: w.confidence ?? 0,
    bbox: w.bbox
  }));

  return {
    text: data.text || "",
    words,
    confidence: data.confidence != null ? data.confidence / 100 : 0
  };
}

/**
 * Terminate the shared worker (call when done with all OCR when using reuseWorker).
 */
export async function terminateWorker() {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
  }
}
