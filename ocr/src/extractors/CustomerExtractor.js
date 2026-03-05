/**
 * CustomerExtractor.js — Extract customer block from customer region text.
 * Find GST number first; words above = customer block. Extract name, address, gstNumber, state.
 */

const GST_PATTERN = /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]/i;

/**
 * Extract customer fields from OCR text of the customer region.
 * Logic: find GST pattern; text above GST = customer block. First uppercase-heavy line = name, rest = address.
 * @param {string} text - Raw OCR text from customer region
 * @returns {{ customerName: string|null, address: string, gstNumber: string|null, state: string|null }}
 */
export function extractCustomer(text) {
  if (!text || typeof text !== "string") {
    return { customerName: null, address: "", gstNumber: null, state: null };
  }

  const t = text.trim();
  const gstMatch = t.match(GST_PATTERN);
  const gstNumber = gstMatch ? gstMatch[0].replace(/\s/g, "") : null;

  const beforeGst = gstMatch ? t.slice(0, gstMatch.index) : t;
  const lines = beforeGst.split(/\n/).map((l) => l.trim()).filter(Boolean).slice(-6);

  const nameLine = lines.find(
    (l) => (l.match(/[A-Z]/g) || []).length >= 2 && l.length <= 80 && !/^\d+$/.test(l)
  );
  const customerName = nameLine || lines[0] || null;
  const rest = nameLine ? lines.filter((l) => l !== nameLine) : lines.slice(1);
  const address = rest.join(", ").trim() || "";

  const stateMatch = text.match(/Tamil\s*Nadu\s*\((\d+)\)|\((\d+)\)/i) || text.match(/Tamil\s*Nadu/i);
  let state = null;
  if (stateMatch) {
    if (stateMatch[1]) state = stateMatch[1]; // (33) style
    else if (stateMatch[0] && /Tamil/i.test(stateMatch[0])) state = "Tamil Nadu";
  }

  return {
    customerName,
    address,
    gstNumber,
    state: state || null
  };
}
