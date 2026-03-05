/**
 * TableExtractor.js — Table always ends with weight, rate, amount; parse backwards.
 * extractTableFromText: each line with ≥3 numbers → last 3 = amount, rate, weight.
 * extractTableFromWords: Y-cluster rows, sort by X, same rule (advanced).
 */

import { parseRepairedNumber } from "../parsers/NumericRepair.js";

/**
 * Parse table from plain text (line-based). Last 3 numeric tokens per line = amount, rate, weight.
 * @param {string} text - OCR text from table region
 * @returns {Array<{ weight: number, rate: number, amount: number }>}
 */
export function extractTableFromText(text) {
  const lines = (text || "").split("\n");
  const rows = [];

  for (const line of lines) {
    const nums = line.match(/[\d]+\.[\d]+|[\d]+/g);
    if (nums && nums.length >= 3) {
      const amount = Number(nums[nums.length - 1]);
      const rate = Number(nums[nums.length - 2]);
      const weight = Number(nums[nums.length - 3]);
      if (Number.isFinite(amount) && Number.isFinite(rate) && Number.isFinite(weight)) {
        rows.push({ weight, rate, amount });
      }
    }
  }

  return rows;
}

/**
 * Advanced: extract from word list with bboxes. Cluster by Y, sort by X, last 3 numerics = amount, rate, weight.
 */
export function extractTableFromWords(words) {
  if (!words || !words.length) return [];

  const ROW_Y_TOLERANCE = 15;
  const norm = (w) => ({
    text: (w.text || "").trim(),
    midY: (w.bbox && ((w.bbox.y0 ?? w.bbox.top) + (w.bbox.y1 ?? w.bbox.bottom)) / 2) || 0,
    midX: (w.bbox && ((w.bbox.x0 ?? w.bbox.left) + (w.bbox.x1 ?? w.bbox.right)) / 2) || 0
  });

  const totalLine = words.find((w) => /T[O0D]?TAL|TOTAL/i.test((w.text || "").replace(/\s/g, "")));
  const totalY = totalLine?.bbox ? (totalLine.bbox.y0 ?? totalLine.bbox.top) : 1e9;
  const below = words
    .filter((w) => {
      const y = w.bbox ? (w.bbox.y0 ?? w.bbox.top) : 0;
      return y < totalY - 10;
    })
    .map(norm)
    .sort((a, b) => a.midY - b.midY || a.midX - b.midX);

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

function parseRowTokens(tokens) {
  const values = [];
  tokens.forEach((t) => {
    const n = parseRepairedNumber(t);
    if (n != null && n >= 0) values.push(n);
  });
  if (values.length < 3) return null;
  const amount = values[values.length - 1];
  const rate = values[values.length - 2];
  const weight = values[values.length - 3];
  if (amount <= 0 || amount > 1e9) return null;
  return { weight, rate, amount };
}
