/**
 * CustomerExtractor.js — Extract customer name, address, GST, phone, email from customer region text.
 * Find GST pattern; text before GST = customer block. name = line 3 from end, address = last 3 lines joined.
 */

const GST_REGEX = /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]/;
const PHONE_REGEX = /\b\d{10}\b|\b\d{5}[\s\-]?\d{5}\b/;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;

export function extractCustomer(text) {
  let name = "";
  let address = "";
  let gst = "";
  let state = null;
  let phone = "";
  let email = "";

  if (!text || typeof text !== "string") {
    return { name, address, gst, state, phone, email };
  }

  const gstMatch = text.match(GST_REGEX);
  if (gstMatch) {
    gst = gstMatch[0];

    const before = text.split(gstMatch[0])[0] || "";
    const lines = before.split("\n").map((l) => l.trim()).filter(Boolean);

    if (lines.length >= 3) {
      name = lines[lines.length - 3] || "";
      address = lines.slice(lines.length - 3).join(" ").trim(); // last 3 lines as address block
    } else if (lines.length >= 1) {
      name = lines[0] || "";
      address = lines.slice(1).join(" ").trim();
    }
  }

  const stateMatch = text.match(/Tamil\s*Nadu\s*\((\d+)\)|\((\d+)\)/i) || text.match(/Tamil\s*Nadu/i);
  if (stateMatch) {
    state = stateMatch[1] || (stateMatch[0] && /Tamil/i.test(stateMatch[0]) ? "Tamil Nadu" : null);
  }

  const phoneMatch = text.match(PHONE_REGEX);
  if (phoneMatch) phone = phoneMatch[0].replace(/\s/g, "");

  const emailMatch = text.match(EMAIL_REGEX);
  if (emailMatch) email = emailMatch[0];

  return { name, address, gst, state, phone, email };
}
