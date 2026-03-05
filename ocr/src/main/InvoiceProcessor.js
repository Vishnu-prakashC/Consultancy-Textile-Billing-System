/**
 * InvoiceProcessor.js — Main pipeline: preprocess → (OpenCV) → crop regions → OCR each region → extract → merge.
 * With OpenCV: perspective correction → deskew → noise removal → adaptive threshold → then region OCR.
 */

import { preprocessImage } from "../ocr/ImagePreprocessor.js";
import { runOCR, terminateWorker } from "../ocr/OcrEngine.js";
import { NEW_GOOD_NITS_LAYOUT } from "../layout/InvoiceLayout.js";
import { cropRegion } from "../layout/RegionCropper.js";
import { extractBillMeta } from "../extractors/BillMetaExtractor.js";
import { extractCustomer } from "../extractors/CustomerExtractor.js";
import { extractTotals } from "../extractors/TotalsExtractor.js";
import { extractTableFromText, extractTableFromWords } from "../extractors/TableExtractor.js";
import { mapToForm } from "../ui/FormMapper.js";
import { opencvPreprocess, waitForOpencv } from "../opencv/index.js";

/**
 * Process invoice image: preprocess, optional OpenCV pipeline, crop regions, OCR each, extract, return merged data.
 * @param {HTMLImageElement|File|Blob|string} img - Image (element, file, blob, or URL)
 * @param {Object} [options] - { tesseract, reuseWorker, preprocessAdvanced, useOpenCV, logConfidence }
 * @returns {Promise<{ billNo, date, jobNo, partyDc, customer, table, totals, confidence? }>}
 */
export async function processInvoice(img, options = {}) {
  const {
    tesseract,
    reuseWorker = false,
    preprocessAdvanced = false,
    useOpenCV = true,
    logConfidence = false
  } = options;

  let canvas = await preprocessImage(img, preprocessAdvanced ? { advanced: true } : {});

  if (useOpenCV && typeof cv !== "undefined") {
    try {
      canvas = opencvPreprocess(canvas);
    } catch (e) {
      console.warn("[InvoiceProcessor] OpenCV preprocessing failed, using basic canvas:", e.message);
    }
  } else if (useOpenCV) {
    try {
      await waitForOpencv(8000);
      canvas = opencvPreprocess(canvas);
    } catch (e) {
      console.warn("[InvoiceProcessor] OpenCV not ready, using basic canvas:", e.message);
    }
  }

  const header = cropRegion(canvas, NEW_GOOD_NITS_LAYOUT.header);
  const customerRegion = cropRegion(canvas, NEW_GOOD_NITS_LAYOUT.customer);
  const billMeta = cropRegion(canvas, NEW_GOOD_NITS_LAYOUT.billMeta);
  const tableRegion = cropRegion(canvas, NEW_GOOD_NITS_LAYOUT.table);
  const totals = cropRegion(canvas, NEW_GOOD_NITS_LAYOUT.totals);

  const ocrOpts = { tesseract, reuseWorker };

  const headerOCR = await runOCR(header, ocrOpts);
  const customerOCR = await runOCR(customerRegion, ocrOpts);
  const billOCR = await runOCR(billMeta, ocrOpts);
  const tableOCR = await runOCR(tableRegion, ocrOpts);
  const totalsOCR = await runOCR(totals, ocrOpts);

  if (!reuseWorker) await terminateWorker();

  const billData = extractBillMeta(billOCR.text);
  const customerData = extractCustomer(customerOCR.text);
  let tableRows = extractTableFromWords(tableOCR.words);
  if (!tableRows.length) tableRows = extractTableFromText(tableOCR.text);
  const totalsData = extractTotals(totalsOCR.text);

  if (logConfidence) {
    console.log("[InvoiceProcessor] confidence:", {
      header: headerOCR.confidence,
      customer: customerOCR.confidence,
      billMeta: billOCR.confidence,
      table: tableOCR.confidence,
      totals: totalsOCR.confidence
    });
  }

  const avgConfidence =
    [headerOCR, customerOCR, billOCR, tableOCR, totalsOCR].reduce((s, r) => s + r.confidence, 0) / 5;

  const result = {
    ...billData,
    customer: customerData,
    table: tableRows,
    totals: totalsData,
    confidence: avgConfidence
  };

  return result;
}

/**
 * Process invoice and fill the form. Convenience wrapper.
 */
export async function processAndFillForm(img, options = {}) {
  const data = await processInvoice(img, options);
  mapToForm(data, { logConfidence: options.logConfidence });
  return data;
}
