/**
 * InvoiceProcessor.js — Main pipeline: preprocess → (OpenCV) → template detection → region crop → OCR → extract → validate → merge.
 * Supports static layout (top/bottom) or trained layout (y/h); optional smart table extraction and totals validation.
 */

import { preprocessImage } from "../ocr/ImagePreprocessor.js";
import { runOCR, terminateWorker } from "../ocr/OcrEngine.js";
import { NEW_GOOD_NITS_LAYOUT } from "../layout/InvoiceLayout.js";
import { cropRegion } from "../layout/RegionCropper.js";
import { cropRegions as smartCropRegions } from "../layout/SmartRegionCropper.js";
import { getTrainedLayout } from "../layout/TrainedLayouts.js";
import { detectTemplate } from "../template/TemplateDetector.js";
import { extractBillMeta } from "../extractors/BillMetaExtractor.js";
import { extractCustomer } from "../extractors/CustomerExtractor.js";
import { extractHeader } from "../extractors/HeaderExtractor.js";
import { extractTotals } from "../extractors/TotalsExtractor.js";
import { extractTableFromText, extractTableFromWords } from "../extractors/TableExtractor.js";
import { extractTable as extractTableSmart } from "../extractors/SmartTableExtractor.js";
import { mapToForm } from "../ui/FormMapper.js";
import { validateTotals } from "./ValidationLayer.js";
import { opencvPreprocess, waitForOpencv } from "../opencv/index.js";

/**
 * Process invoice image: preprocess, optional OpenCV pipeline, crop regions, OCR each, extract, return merged data.
 * @param {HTMLImageElement|File|Blob|string} img - Image (element, file, blob, or URL)
 * @param {Object} [options] - { tesseract, reuseWorker, preprocessAdvanced, useOpenCV, useTrainedLayout, trainedLayout, useSmartTable, logConfidence }
 * @returns {Promise<{ company?, billNo, date, jobNo, partyDc, customer, table, totals, confidence?, templateId?, validation? }>}
 */
export async function processInvoice(img, options = {}) {
  const {
    tesseract,
    reuseWorker = false,
    preprocessAdvanced = false,
    useOpenCV = true,
    useTrainedLayout = false,
    trainedLayout: injectedLayout = null,
    useSmartTable = false,
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

  const ocrOpts = { tesseract, reuseWorker };
  let header, customerRegion, billMeta, tableRegion, totals;

  if (useTrainedLayout && (injectedLayout || getTrainedLayout("NEW_GOOD_NITS"))) {
    const layout = injectedLayout || getTrainedLayout("NEW_GOOD_NITS");
    const regions = smartCropRegions(canvas, layout);
    header = regions.header;
    customerRegion = regions.customer;
    billMeta = regions.billMeta;
    tableRegion = regions.table;
    totals = regions.totals;
  } else {
    header = cropRegion(canvas, NEW_GOOD_NITS_LAYOUT.header);
    customerRegion = cropRegion(canvas, NEW_GOOD_NITS_LAYOUT.customer);
    billMeta = cropRegion(canvas, NEW_GOOD_NITS_LAYOUT.billMeta);
    tableRegion = cropRegion(canvas, NEW_GOOD_NITS_LAYOUT.table);
    totals = cropRegion(canvas, NEW_GOOD_NITS_LAYOUT.totals);
  }

  const headerOCR = await runOCR(header, ocrOpts);
  const customerOCR = await runOCR(customerRegion, ocrOpts);
  const billOCR = await runOCR(billMeta, ocrOpts);
  const tableOCR = await runOCR(tableRegion, ocrOpts);
  const totalsOCR = await runOCR(totals, ocrOpts);

  if (!reuseWorker) await terminateWorker();

  const billData = extractBillMeta(billOCR.text);
  const customerData = extractCustomer(customerOCR.text);
  const headerData = extractHeader(headerOCR.text);
  let tableRows;
  if (useSmartTable && tableOCR.words?.length) {
    tableRows = extractTableSmart(tableOCR.words);
    if (!tableRows.length) tableRows = extractTableFromWords(tableOCR.words);
    if (!tableRows.length) tableRows = extractTableFromText(tableOCR.text);
  } else {
    tableRows = extractTableFromWords(tableOCR.words);
    if (!tableRows.length) tableRows = extractTableFromText(tableOCR.text);
  }
  const totalsData = extractTotals(totalsOCR.text);

  const templateId = detectTemplate(headerOCR.text);
  const validation = validateTotals(tableRows, totalsData);

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
    company: {
      name: headerData.companyName || (templateId === "NEW_GOOD_NITS" ? "NEW GOOD NITS" : undefined),
      gstin: headerData.gstin,
      tin: headerData.tin,
      pan: headerData.pan,
      phones: headerData.phones,
      address: headerData.address
    },
    customer: customerData,
    table: tableRows,
    totals: totalsData,
    confidence: avgConfidence,
    templateId: templateId !== "UNKNOWN" ? templateId : undefined,
    validation: validation.valid ? undefined : { valid: false, message: validation.message }
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
