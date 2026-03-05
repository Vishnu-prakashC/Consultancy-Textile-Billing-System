/**
 * SpatialExtractor.js — Position-aware extraction using word bounding boxes.
 * Use when OCR text order is broken; structure is recovered by Y/X position.
 */

import { repairNumericToken, parseRepairedNumber } from "./OcrCorrection.js";

const DEFAULT_Y_TOLERANCE = 10;
const DEFAULT_ROW_TOLERANCE = 15;

function getAverageWordHeight(normalizedWords) {
  if (!normalizedWords.length) return 15;
  const heights = normalizedWords.map((w) => w.y1 - w.y0).filter((h) => h > 0);
  if (!heights.length) return 15;
  return heights.reduce((a, b) => a + b, 0) / heights.length;
}

function getTolerances(normalizedWords) {
  const avgH = getAverageWordHeight(normalizedWords);
  const yTolerance = Math.max(DEFAULT_Y_TOLERANCE, Math.round(avgH * 0.8));
  const rowTolerance = Math.max(DEFAULT_ROW_TOLERANCE, Math.round(avgH * 0.8));
  return { yTolerance, rowTolerance };
}

function normalizeWord(w, index) {
  const b = w.bbox || w;
  const x0 = b.x0 ?? b.left ?? 0;
  const y0 = b.y0 ?? b.top ?? 0;
  const x1 = b.x1 ?? b.right ?? 0;
  const y1 = b.y1 ?? b.bottom ?? 0;
  return {
    text: (w.text || "").trim(),
    x0,
    y0,
    x1,
    y1,
    midY: (y0 + y1) / 2,
    midX: (x0 + x1) / 2,
    index
  };
}

function getPageDimensions(words) {
  if (!words.length) return { pageHeight: 1000, pageWidth: 800 };
  const normalized = words.map(normalizeWord);
  return {
    pageHeight: Math.max(...normalized.map((w) => w.y1)) + 50,
    pageWidth: Math.max(...normalized.map((w) => w.x1)) + 50
  };
}

function wordsInTopPercent(words, pageHeight, percent) {
  const threshold = pageHeight * (percent / 100);
  return words.filter((w) => w.y0 < threshold);
}

function fuzzyMatchTotal(text) {
  const t = (text || "").toUpperCase().replace(/\s/g, "");
  return /^T[O0D]?TAL$/.test(t) || t === "TOTAL" || t === "TOIAL" || t === "TDTAL";
}

function fuzzyMatchNetTotal(text) {
  const t = (text || "").toUpperCase().replace(/\s/g, "");
  return /^NET\s*T[O0D]?TAL$/.test(t) || /^NETTOTAL$/.test(t);
}

function isGstLine(word, wordsOnLine) {
  const lineText = wordsOnLine.map((w) => w.text).join(" ");
  return /GST\s*No/i.test(lineText) || /^[0-9]{2}[A-Z][A-Z0-9]{12,14}$/.test(word.text);
}

/**
 * Bill No: only words in top 25% by Y; find "No" then word to the right (same row); reject if on GST line.
 */
export function findBillNoSpatial(words) {
  if (!words?.length) return null;
  const normalized = words.map((w, i) => normalizeWord(w, i));
  const { pageHeight } = getPageDimensions(normalized);
  const { yTolerance } = getTolerances(normalized);
  const topWords = wordsInTopPercent(normalized, pageHeight, 28);

  for (let i = 0; i < topWords.length; i++) {
    const w = topWords[i];
    const noMatch = /^No\.?$|^T0$|^No$/i.test(w.text);
    if (!noMatch) continue;

    const rowY = w.midY;
    const sameRow = topWords.filter((o) => Math.abs(o.midY - rowY) < yTolerance);
    if (isGstLine(w, sameRow)) continue;

    const toRight = topWords.filter(
      (o) => o.midX > w.midX && Math.abs(o.midY - rowY) < yTolerance
    );
    toRight.sort((a, b) => a.midX - b.midX);
    const next = toRight[0];
    if (!next) continue;

    const numStr = next.text.replace(/,/g, "");
    if (/^\d{1,6}$/.test(numStr)) return numStr;
    const repaired = repairNumericToken(next.text).replace(/\D/g, "");
    if (repaired.length >= 1 && repaired.length <= 6) return repaired;
  }

  const standaloneNum = topWords.find(
    (w) => /^\d{1,6}$/.test(w.text) && !/GST|TIN|PAN|UDYAM/i.test(w.text)
  );
  return standaloneNum?.text ?? null;
}

/**
 * Totals: find TOTAL word Y and NET TOTAL word Y; collect numbers only in that vertical band.
 */
export function findTotalsSpatial(words) {
  if (!words?.length) return null;
  const normalized = words.map((w, i) => normalizeWord(w, i));

  let totalY = null;
  let netTotalY = null;
  for (const w of normalized) {
    if (fuzzyMatchTotal(w.text)) totalY = totalY ?? w.y0;
    if (fuzzyMatchNetTotal(w.text)) netTotalY = w.y0;
  }

  if (totalY == null) return null;

  const yMax = netTotalY != null ? netTotalY + 80 : totalY + 600;
  const bandWords = normalized.filter((w) => w.y0 >= totalY - 5 && w.y1 <= yMax + 5);

  const decimals = [];
  for (const w of bandWords) {
    const n = parseRepairedNumber(w.text);
    if (n != null && n < 1e7 && n >= 0) {
      if (String(w.text).includes(".")) decimals.push(n);
    }
  }

  const sorted = [...decimals].sort((a, b) => b - a);
  if (sorted.length === 0) return null;

  const twoSmall = sorted.filter((v) => v < 2000 && v > 0).slice(-2);
  return {
    subtotal: sorted[1] != null ? String(sorted[1]) : null,
    cgst: twoSmall[0] != null ? String(twoSmall[0]) : null,
    sgst: twoSmall[1] != null ? String(twoSmall[1]) : twoSmall[0] != null ? String(twoSmall[0]) : null,
    roundedOff: null,
    netTotal: String(sorted[0])
  };
}

/**
 * Cluster words by Y into rows; sort each row by X; backward parse last 3 numeric as amount, rate, weight.
 */
export function findTableRowsSpatial(words) {
  if (!words?.length) return [];
  const normalized = words.map((w, i) => normalizeWord(w, i));
  const { rowTolerance } = getTolerances(normalized);

  const totalY = normalized.find((w) => fuzzyMatchTotal(w.text))?.y0 ?? 1e9;
  const belowTotal = normalized.filter((w) => w.midY < totalY - 20);

  const rows = [];
  let currentRow = [];
  let currentY = -1e9;

  const sorted = [...belowTotal].sort((a, b) => a.midY - b.midY || a.midX - b.midX);

  for (const w of sorted) {
    if (currentRow.length && Math.abs(w.midY - currentY) > rowTolerance) {
      const row = currentRow.sort((a, b) => a.midX - b.midX);
      const parsed = parseRowFromWords(row);
      if (parsed) rows.push(parsed);
      currentRow = [];
    }
    currentY = w.midY;
    currentRow.push(w);
  }
  if (currentRow.length) {
    const row = currentRow.sort((a, b) => a.midX - b.midX);
    const parsed = parseRowFromWords(row);
    if (parsed) rows.push(parsed);
  }

  return rows;
}

function parseRowFromWords(rowWords) {
  if (rowWords.length < 3) return null;
  const texts = rowWords.map((w) => w.text);
  const numerics = [];
  const numericIndices = [];
  texts.forEach((t, i) => {
    const n = parseRepairedNumber(t);
    if (n != null && n >= 0) {
      numerics.push(n);
      numericIndices.push(i);
    }
  });
  if (numerics.length < 3) return null;

  const amount = numerics[numerics.length - 1];
  const rate = numerics[numerics.length - 2];
  const weight = numerics[numerics.length - 3];
  if (amount <= 0 || amount > 1e9) return null;

  const leadingEnd = numericIndices[numericIndices.length - 3];
  const leading = texts.slice(0, leadingEnd);

  return {
    slNo: leading[0] ?? null,
    dc: leading[1] ?? null,
    date: leading[2] ?? null,
    gg: leading[3] ?? null,
    fabric: leading.length >= 8 ? leading.slice(4, -3).join(" ") : leading[4] ?? null,
    counts: leading[leading.length - 3] ?? null,
    mill: leading[leading.length - 2] ?? null,
    dia: leading[leading.length - 1] ?? null,
    weight,
    rate,
    amount
  };
}

/**
 * Customer: find GST word; use words above it (Y < gstY), cluster into lines; first uppercase-heavy = name.
 */
export function findCustomerSpatial(words) {
  if (!words?.length) return null;
  const normalized = words.map((w, i) => normalizeWord(w, i));

  const gstWord = normalized.find(
    (w) => /^[0-9]{2}[A-Z][A-Z0-9]{10,13}$/.test(w.text.replace(/\s/g, ""))
  );
  if (!gstWord) return null;

  const gstNo = gstWord.text.replace(/\s/g, "");
  if (gstNo.length !== 15) return null;

  const above = normalized
    .filter((w) => w.midY < gstWord.midY - 5)
    .sort((a, b) => b.midY - a.midY);

  const { rowTolerance } = getTolerances(normalized);
  const lineClusters = [];
  let cluster = [];
  let prevY = 1e9;

  for (const w of above) {
    if (cluster.length && Math.abs(w.midY - prevY) > rowTolerance) {
      lineClusters.push(cluster.sort((a, b) => a.midX - b.midX).map((x) => x.text).join(" "));
      cluster = [];
    }
    prevY = w.midY;
    cluster.push(w);
  }
  if (cluster.length) {
    lineClusters.push(cluster.sort((a, b) => a.midX - b.midX).map((x) => x.text).join(" "));
  }

  const nameLine = lineClusters.find(
    (l) => (l.match(/[A-Z]/g) || []).length >= 2 && l.length <= 80 && !/^\d+$/.test(l.trim())
  );
  const name = nameLine || lineClusters[0] || null;
  const rest = nameLine ? lineClusters.filter((l) => l !== nameLine) : lineClusters.slice(1);
  const stateMatch = normalized.find((w) => /\(\d+\)|Tamil\s*Nadu/i.test(w.text));
  const state = stateMatch?.text?.match(/\((\d+)\)/)?.[1] || (stateMatch ? "Tamil Nadu" : null);

  return {
    name,
    address: rest.join(", ") || "",
    gstNo,
    state
  };
}

/**
 * Full spatial extraction. Merges with text-based result (spatial overrides when present).
 */
export function extractSpatial(words, textResult) {
  if (!words?.length) return textResult;

  const billNo = findBillNoSpatial(words);
  const totals = findTotalsSpatial(words);
  const table = findTableRowsSpatial(words);
  const customer = findCustomerSpatial(words);

  return {
    customer: customer || textResult?.customer || null,
    billMeta: {
      ...(textResult?.billMeta || {}),
      ...(billNo != null && { billNo })
    },
    table: table?.length ? table : (textResult?.table || []),
    totals: totals ? { ...(textResult?.totals || {}), ...totals } : (textResult?.totals || {})
  };
}

/**
 * Return bboxes for debug overlay: Bill No = green, Customer = blue, Table rows = yellow, Totals = red.
 * Each bbox is { x0, y0, x1, y1 } in same coordinate system as input words.
 */
export function getDebugZones(words) {
  if (!words?.length) return { billNo: [], customer: [], totals: [], tableRows: [] };

  const normalized = words.map((w, i) => normalizeWord(w, i));
  const { pageHeight } = getPageDimensions(normalized);
  const { yTolerance, rowTolerance } = getTolerances(normalized);

  const billNo = [];
  const topWords = wordsInTopPercent(normalized, pageHeight, 28);
  for (let i = 0; i < topWords.length; i++) {
    const w = topWords[i];
    if (!/^No\.?$|^T0$|^No$/i.test(w.text)) continue;
    const rowY = w.midY;
    const sameRow = topWords.filter((o) => Math.abs(o.midY - rowY) < yTolerance);
    if (isGstLine(w, sameRow)) continue;
    const toRight = topWords.filter(
      (o) => o.midX > w.midX && Math.abs(o.midY - rowY) < yTolerance
    );
    toRight.sort((a, b) => a.midX - b.midX);
    const next = toRight[0];
    if (!next) continue;
    billNo.push(bbox(w), bbox(next));
    break;
  }

  const customer = [];
  const gstWord = normalized.find(
    (w) => /^[0-9]{2}[A-Z][A-Z0-9]{10,14}$/.test((w.text || "").replace(/\s/g, ""))
  );
  if (gstWord && gstWord.text.replace(/\s/g, "").length === 15) {
    const above = normalized.filter((w) => w.midY < gstWord.midY - 5);
    if (above.length) customer.push(...above.map(bbox));
  }

  let totalY = null;
  let netTotalY = null;
  for (const w of normalized) {
    if (fuzzyMatchTotal(w.text)) totalY = totalY ?? w.y0;
    if (fuzzyMatchNetTotal(w.text)) netTotalY = w.y0;
  }
  const yMax = netTotalY != null ? netTotalY + 80 : (totalY ?? 0) + 600;
  const totals = (totalY != null
    ? normalized.filter((w) => w.y0 >= totalY - 5 && w.y1 <= yMax + 5)
    : []
  ).map(bbox);

  const totalYVal = normalized.find((w) => fuzzyMatchTotal(w.text))?.y0 ?? 1e9;
  const belowTotal = normalized.filter((w) => w.midY < totalYVal - 20);
  const sorted = [...belowTotal].sort((a, b) => a.midY - b.midY || a.midX - b.midX);
  const tableRows = [];
  let currentRow = [];
  let currentY = -1e9;
  for (const w of sorted) {
    if (currentRow.length && Math.abs(w.midY - currentY) > rowTolerance) {
      tableRows.push(currentRow.map(bbox));
      currentRow = [];
    }
    currentY = w.midY;
    currentRow.push(w);
  }
  if (currentRow.length) tableRows.push(currentRow.map(bbox));

  return { billNo, customer, totals, tableRows };
}

function bbox(normalizedWord) {
  return {
    x0: normalizedWord.x0,
    y0: normalizedWord.y0,
    x1: normalizedWord.x1,
    y1: normalizedWord.y1
  };
}
