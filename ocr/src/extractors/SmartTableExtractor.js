/**
 * SmartTableExtractor.js — Table extraction from word list: cluster by Y, sort by X, map to columns.
 * Columns: Sl No | DC | Date | GG | Fabric | Counts | Mill | Dia | Wt | Rate | Amount
 */

import { parseRepairedNumber } from "../parsers/NumericRepair.js";

const ROW_Y_TOLERANCE = 18;

function midY(bbox) {
  if (!bbox) return 0;
  const y0 = bbox.y0 ?? bbox.top ?? 0;
  const y1 = bbox.y1 ?? bbox.bottom ?? y0;
  return (y0 + y1) / 2;
}

function midX(bbox) {
  if (!bbox) return 0;
  const x0 = bbox.x0 ?? bbox.left ?? 0;
  const x1 = bbox.x1 ?? bbox.right ?? x0;
  return (x0 + x1) / 2;
}

/**
 * Group words into rows by Y coordinate (cluster by similar midY).
 * @param {Array<{ text: string, bbox }>} words
 * @returns {Array<Array<{ text: string, midX: number }>>}
 */
function clusterByY(words) {
  const withMid = (words || []).map((w) => ({
    text: (w.text || "").trim(),
    midY: midY(w.bbox),
    midX: midX(w.bbox)
  }));

  const sorted = withMid.filter((w) => w.text).sort((a, b) => a.midY - b.midY || a.midX - b.midX);

  const rows = [];
  let currentRow = [];
  let lastY = -1e9;

  for (const w of sorted) {
    if (currentRow.length && Math.abs(w.midY - lastY) > ROW_Y_TOLERANCE) {
      rows.push(currentRow);
      currentRow = [];
    }
    lastY = w.midY;
    currentRow.push(w);
  }
  if (currentRow.length) rows.push(currentRow);

  return rows;
}

/**
 * Extract table rows from OCR words: cluster by Y, sort each row by X, map to columns.
 * Expects columns: Sl No, DC, Date, GG, Fabric, Counts, Mill, Dia, Wt, Rate, Amount (10–11).
 * @param {Array<{ text: string, bbox }>} words - Words from table region OCR
 * @returns {Array<{ slNo?, dc?, date?, gg?, fabric?, counts?, mill?, dia?, weight, rate, amount }>}
 */
export function extractTable(words) {
  const rows = clusterByY(words);
  const table = [];

  for (const row of rows) {
    const cols = row.slice().sort((a, b) => a.midX - b.midX);
    if (cols.length < 10) continue;

    const lastNumericIdx = cols.map((c, i) => (parseRepairedNumber(c.text) != null ? i : -1)).filter((i) => i >= 0);
    if (lastNumericIdx.length < 3) continue;

    const amount = parseRepairedNumber(cols[cols.length - 1].text);
    const rate = parseRepairedNumber(cols[cols.length - 2].text);
    const weight = parseRepairedNumber(cols[cols.length - 3].text);
    if (amount == null || rate == null || weight == null) continue;
    if (amount <= 0 || amount > 1e9) continue;

    table.push({
      slNo: cols[0]?.text ?? "",
      dc: cols[1]?.text ?? "",
      date: cols[2]?.text ?? "",
      gg: cols[3]?.text ?? "",
      fabric: cols[4]?.text ?? "",
      counts: cols[5]?.text ?? "",
      mill: cols[6]?.text ?? "",
      dia: cols[7]?.text ?? "",
      weight,
      rate,
      amount
    });
  }

  return table;
}
