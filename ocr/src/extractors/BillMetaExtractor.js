/**
 * BillMetaExtractor.js — Extract bill metadata from bill meta region text.
 * Bill No, Date, Job No, Party DC. Uses regex; ignores GST/TIN/PAN lines for Bill No.
 */

/**
 * Extract bill meta fields from OCR text of the bill meta region.
 * @param {string} text - Raw OCR text from bill meta region
 * @returns {{ billNo: string|null, date: string|null, jobNo: string|null, partyDc: string|null }}
 */
export function extractBillMeta(text) {
  if (!text || typeof text !== "string") {
    return { billNo: null, date: null, jobNo: null, partyDc: null };
  }

  const t = text.trim();

  let billNo = null;
  const lines = t.split(/\n/);
  for (const line of lines) {
    if (/GST|TIN|PAN|UDYAM/i.test(line)) continue;
    const m = line.match(/\bNo\.?\s*[:\-]?\s*(\d{1,6})\b/i) || line.match(/\bNo\s+(\d{1,6})\b/i);
    if (m && /^\d+$/.test(m[1])) {
      billNo = m[1];
      break;
    }
  }
  if (!billNo) {
    const fallback = t.match(/\b(\d{1,6})\b/);
    if (fallback && !/GST|TIN|PAN|UDYAM/i.test(t.slice(0, fallback.index + 60))) {
      billNo = fallback[1];
    }
  }

  const dateMatch = t.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/) || t.match(/\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/);
  const date = dateMatch ? dateMatch[0] : null;

  const jobMatch = t.match(/Job\s*No\.?\s*[:\-]?\s*(\d+)/i);
  const jobNo = jobMatch ? jobMatch[1] : null;

  const partyDcMatch = t.match(/Party\s*DC\s*No\.?\s*[:\-]?\s*(\S*)/i);
  let partyDc = partyDcMatch ? partyDcMatch[1].trim() : null;
  if (partyDc === "" || partyDc === "-") partyDc = null;

  return {
    billNo,
    date,
    jobNo,
    partyDc
  };
}
