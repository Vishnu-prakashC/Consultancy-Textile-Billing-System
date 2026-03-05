/**
 * InvoiceProcessor.js — Main pipeline: preprocess → crop regions → OCR each region → extract → merge → structured JSON.
 * Production-ready OCR extraction for NEW GOOD NITS template. Fallback to full-page text parsing when words/bboxes missing.
 */

import { preprocessImage } from "../ocr/ImagePreprocessor.js";
import { runOCR, terminateWorker } from "../ocr/OcrEngine.js";
import { NEW_GOOD_NITS_LAYOUT } from "../layout/InvoiceLayout.js";
import { cropAllRegions } from "../layout/RegionCropper.js";
import { extractHeader } from "../extractors/HeaderExtractor.js";
import { extractCustomer } from "../extractors/CustomerExtractor.js";
import { extractBillMeta } from "../extractors/BillMetaExtractor.js";
import { extractTableFromText, extractTableFromWords } from "../extractors/TableExtractor.js";
import { extractTotals } from "../extractors/TotalsExtractor.js";
import { mapToForm } from "../ui/FormMapper.js";

const LAYOUT = NEW_GOOD_NITS_LAYOUT;

/**
 * Detect template from header text (e.g. NEW GOOD NITS, KNITTING INVOICE).
 * @param {string} headerText
 * @returns {string|null}
 */
function detectTemplate(headerText) {
  const u = (headerText || "").toUpperCase();
  if (u.includes("NEW GOOD NITS")) return "NEW_GOOD_NITS";
  if (u.includes("KNITTING INVOICE") && (u.includes("GOOD NITS") || u.includes("NEW GOOD"))) return "NEW_GOOD_NITS";
  if (u.includes("GOOD NITS") && u.includes("TIRUPUR")) return "NEW_GOOD_NITS";
  return null;
}

/**
 * Full pipeline: preprocess image, crop regions, OCR each, run extractors, return structured JSON.
 * @param {HTMLImageElement|File|Blob|string} image - Input image
 * @param {Object} [options] - { tesseract, preprocessOptions, logConfidence }
 * @returns {Promise<{ billNo, date, customer, table, totals, header?, confidence? }>}
 */
export async function processInvoice(image, options = {}) {
  const { tesseract, preprocessOptions = {}, logConfidence = false } = options;

  // 1. Preprocess
  const canvas = await preprocessImage(image, preprocessOptions);
  const w = canvas.width;
  const h = canvas.height;

  // 2. Crop regions
  const regions = cropAllRegions(canvas, LAYOUT);

  // 3. OCR each region
  const results = {};
  for (const [name, regionCanvas] of Object.entries(regions)) {
    const ocrResult = await runOCR(regionCanvas, tesseract);
    results[name] = {
      text: ocrResult.text,
      words: ocrResult.words,
      confidence: ocrResult.confidence
    };
    if (logConfidence) {
      console.log(`[InvoiceProcessor] ${name} confidence:`, ocrResult.confidence);
    }
  }

  const template = detectTemplate(results.header?.text || "");
  if (template !== "NEW_GOOD_NITS") {
    await terminateWorker();
    return mergeResults(results, null);
  }

  // 4. Run field extractors
  const header = extractHeader(results.header?.text || "");
  const customer = extractCustomer(results.customer?.text || "");
  const billMeta = extractBillMeta(results.billMeta?.text || "");
  let table = [];
  if (results.table?.words?.length) {
    table = extractTableFromWords(results.table.words);
  }
  if (!table.length && results.table?.text) {
    table = extractTableFromText(results.table.text);
  }
  const totals = extractTotals(results.totals?.text || "");

  // 5. Merge into structured JSON
  const merged = mergeResults(results, {
    header,
    customer,
    billMeta,
    table,
    totals
  });

  await terminateWorker();
  return merged;
}

/**
 * Merge OCR results and extracted fields into one structured object.
 */
function mergeResults(ocrResults, extracted) {
  const avgConfidence =
    Object.values(ocrResults).reduce((s, r) => s + (r.confidence ?? 0), 0) /
    Math.max(1, Object.keys(ocrResults).length);

  const customerObj = extracted?.customer
    ? {
        name: extracted.customer.customerName ?? extracted.customer.name,
        address: extracted.customer.address ?? "",
        gst: extracted.customer.gstNumber ?? extracted.customer.gst,
        state: extracted.customer.state
      }
    : null;

  const billMetaObj = extracted?.billMeta || {};
  const totalsObj = extracted?.totals
    ? {
        subtotal: extracted.totals.subtotal,
        cgst: extracted.totals.cgst,
        sgst: extracted.totals.sgst,
        roundedOff: extracted.totals.roundedOff,
        netTotal: extracted.totals.netTotal
      }
    : {};

  return {
    billNo: billMetaObj.billNo ?? null,
    date: billMetaObj.date ?? null,
    jobNo: billMetaObj.jobNo ?? null,
    partyDc: billMetaObj.partyDc ?? null,
    customer: customerObj,
    table: extracted?.table ?? [],
    totals: totalsObj,
    header: extracted?.header ?? null,
    confidence: avgConfidence
  };
}

/**
 * Process invoice and auto-fill the form. Convenience wrapper.
 * @param {HTMLImageElement|File|Blob|string} image
 * @param {Object} [options] - { tesseract, logConfidence }
 */
export async function processAndFillForm(image, options = {}) {
  const data = await processInvoice(image, options);
  mapToForm(data, { logConfidence: options.logConfidence });
  return data;
}
