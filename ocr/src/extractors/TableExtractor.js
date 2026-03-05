/**
 * TableExtractor.js — Extract table rows from table region text or words.
 * Rows detected by Y clustering; last 3 numeric tokens = weight, rate, amount. Uses NumericRepair.
 */

import { parseRepairedNumber } from "../parsers/NumericRepair.js";
import { isFuzzyTotal } from "../parsers/TextCleaner.js";

const ROW_Y_TOLERANCE = 15;

/**
 * Normalize word for bbox (supports both bbox and flat left/top/right/bottom).
 */
function normWord(w) {
  const b = w.bbox || w;
  return {
    text: (w.text || "").trim(),
    midY: ((b.y0 ?? b.top ?? 0) + (b.y1 ?? b.bottom ?? 0)) / 2,
    midX: ((b.x0 ?? b.left ?? 0) + (b.x1 ?? b.right ?? 0)) / 2
  };
}

/**
 * Extract table rows from word list (with bboxes). Cluster by Y, sort by X, last 3 numerics = weight, rate, amount.
 * @param {Array<{ text: string, bbox?: object }>} words
 * @returns {Array<{ slNo, dc, date, gg, fabric, counts, mill, dia, weight, rate, amount }>}
 */
export function extractTableFromWords(words) {
  if (!words || !words.length) return [];

  const normalized = words.map(normWord);
  const totalY = normalized.find((w) => isFuzzyTotal(w.text))?.midY ?? 1e9;
  const below = normalized.filter((w) => w.midY < totalY - 10).sort((a, b) => a.midY - b.midY || a.midX - b.midX);

  const rows = [];
  let currentRow = [];
  let lastY = -1e9;

  for (const w of below) {
    if (currentRow.length && Math.abs(w.midY - lastY) > ROW_Y_TOLERANCE) {
      const parsed = parseRowTokens(currentRow.map((x) => x.text));
      if (parsed) rows.push(parsed);
      currentRow = [];
    }
    lastY = w.midY;
    currentRow.push(w);
  }
  if (currentRow.length) {
    const parsed = parseRowTokens(currentRow.map((x) => x.text));
    if (parsed) rows.push(parsed);
  }

  return rows;
}

/**
 * Parse a single row: tokens left-to-right; last 3 numeric = amount, rate, weight; rest map to slNo, dc, date, gg, fabric, counts, mill, dia.
 */
function parseRowTokens(tokens) {
  const values = [];
  const indices = [];
  tokens.forEach((t, i) => {
    const n = parseRepairedNumber(t);
    if (n != null && n >= 0) {
      values.push(n);
      indices.push(i);
    }
  });
  if (values.length < 3) return null;

  const amount = values[values.length - 1];
  const rate = values[values.length - 2];
  const weight = values[values.length - 3];
  if (amount <= 0 || amount > 1e9) return null;

  const thirdLastIdx = indices[indices.length - 3];
  const leading = tokens.slice(0, thirdLastIdx);

  return {
    slNo: leading[0] ?? null,
    dc: leading[1] ?? null,
    date: leading[2] ?? null,
    gg: leading[3] ?? null,
    fabric: leading.length >= 8 ? leading.slice(4, -3).join(" ") : (leading[4] ?? null),
    counts: leading.length >= 7 ? leading[leading.length - 3] : null,
    mill: leading.length >= 7 ? leading[leading.length - 2] : null,
    dia: leading.length >= 7 ? leading[leading.length - 1] : null,
    weight,
    rate,
    amount
  };
}

/**
 * Extract table rows from plain text (line-based). Uses same last-3-numeric rule per line.
 * @param {string} text - Raw OCR text from table region
 * @returns {Array<{ slNo, dc, date, gg, fabric, counts, mill, dia, weight, rate, amount }>}
 */
export function extractTableFromText(text) {
  if (!text || typeof text !== "string") return [];

  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const totalIdx = lines.findIndex((l) => isFuzzyTotal(l) || /^T[O0D]?TAL$/i.test(l.replace(/\s/g, "")));
  const endIdx = totalIdx >= 0 ? totalIdx : lines.length;
  const headerKeywords = /S\.?\s*No|D\.?\s*C\.?|Fabric|Wt\.?\s*Kgs|Rate|Amount/i;
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (headerKeywords.test(lines[i])) {
      startIdx = i + 1;
      break;
    }
  }

  const rows = [];
  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i];
    if (/TOTAL|CGST|SGST|NET\s*T/i.test(line)) break;
    const tokens = line.split(/\s+/).filter(Boolean);
    const parsed = parseRowTokens(tokens);
    if (parsed) rows.push(parsed);
  }
  return rows;
}
