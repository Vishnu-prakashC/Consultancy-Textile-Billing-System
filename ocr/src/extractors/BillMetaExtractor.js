/**
 * BillMetaExtractor.js — Extract Bill No, Date, Job No, Party DC, Invoice Type from bill meta region text.
 */

export function extractBillMeta(text) {
  let billNo = null;
  let date = null;
  let jobNo = null;
  let partyDc = null;
  let invoiceType = null;

  if (!text || typeof text !== "string") {
    return { billNo, date, jobNo, partyDc, invoiceType };
  }

  const billMatch = text.match(/No\s*[:\-]?\s*(\d{1,6})/);
  if (billMatch) billNo = billMatch[1];

  const dateMatch = text.match(/\d{2}\/\d{2}\/\d{4}/) || text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
  if (dateMatch) date = dateMatch[0];

  const jobMatch = text.match(/Job\s*No\s*[:\-]?\s*(\d+)/i);
  if (jobMatch) jobNo = jobMatch[1];

  const partyDcMatch = text.match(/Party\s*DC\s*No\s*[:\-]?\s*(\S*)/i);
  if (partyDcMatch) {
    partyDc = partyDcMatch[1].trim();
    if (partyDc === "" || partyDc === "-") partyDc = null;
  }

  const typeMatch = text.match(/(Tax\s*Invoice|Invoice|Bill|Receipt)/i);
  if (typeMatch) invoiceType = typeMatch[1];

  return { billNo, date, jobNo, partyDc, invoiceType };
}
