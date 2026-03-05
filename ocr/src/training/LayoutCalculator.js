/**
 * LayoutCalculator.js — Compute region layout (y, h fractions) from anchor positions.
 * Used after full-page OCR to get one layout per image; then averageLayouts() across samples.
 */

/**
 * Compute layout from anchor positions. All values are fractions of canvas height (0–1).
 * @param {{ company?: {y:number}, customer?: {y:number}, billNo?: {y:number}, total?: {y:number}, netTotal?: {y:number} }} anchors - From detectAnchors()
 * @param {HTMLCanvasElement} canvas - Full-page canvas (for height)
 * @returns {{ header: {y: number, h: number}, customer: {y: number, h: number, x?: number, w?: number}, billMeta: {y: number, h: number, x?: number, w?: number}, table: {y: number, h: number}, totals: {y: number, h: number} }}
 */
export function computeLayoutFromAnchors(anchors, canvas) {
  const height = canvas.height;
  const H = height;

  const customerY = anchors.customer?.y != null ? anchors.customer.y / H : 0.18;
  const totalY = anchors.total?.y != null ? anchors.total.y / H : 0.75;
  const netTotalY = anchors.netTotal?.y != null ? anchors.netTotal.y / H : 0.88;

  return {
    header: {
      y: 0,
      h: customerY
    },
    customer: {
      y: customerY,
      h: 0.18,
      x: 0,
      w: 0.6
    },
    billMeta: {
      y: customerY,
      h: 0.18,
      x: 0.6,
      w: 0.4
    },
    table: {
      y: customerY + 0.18,
      h: Math.max(0.35, (totalY - 0.05) - (customerY + 0.18))
    },
    totals: {
      y: Math.max(0.7, totalY - 0.05),
      h: Math.min(0.2, 1 - (totalY - 0.05))
    }
  };
}

/**
 * Average multiple layouts (e.g. from 3 sample invoices) for a stable template.
 * @param {Array<Object>} layouts - Array of layout objects from computeLayoutFromAnchors
 * @returns {Object} Single layout with averaged y/h (and optional x/w)
 */
export function averageLayouts(layouts) {
  if (!layouts || layouts.length === 0) return null;
  if (layouts.length === 1) return JSON.parse(JSON.stringify(layouts[0]));

  const avg = JSON.parse(JSON.stringify(layouts[0]));
  const n = layouts.length;

  for (let i = 1; i < n; i++) {
    const L = layouts[i];
    if (L.header) {
      avg.header = avg.header || {};
      avg.header.y = (avg.header.y || 0) + (L.header.y ?? 0);
      avg.header.h = (avg.header.h || 0) + (L.header.h ?? 0);
    }
    if (L.customer) {
      avg.customer = avg.customer || {};
      avg.customer.y = (avg.customer.y ?? 0) + (L.customer.y ?? 0);
      avg.customer.h = (avg.customer.h ?? 0) + (L.customer.h ?? 0);
      if (L.customer.x != null) avg.customer.x = (avg.customer.x ?? 0) + L.customer.x;
      if (L.customer.w != null) avg.customer.w = (avg.customer.w ?? 0) + L.customer.w;
    }
    if (L.billMeta) {
      avg.billMeta = avg.billMeta || {};
      avg.billMeta.y = (avg.billMeta.y ?? 0) + (L.billMeta.y ?? 0);
      avg.billMeta.h = (avg.billMeta.h ?? 0) + (L.billMeta.h ?? 0);
      if (L.billMeta.x != null) avg.billMeta.x = (avg.billMeta.x ?? 0) + L.billMeta.x;
      if (L.billMeta.w != null) avg.billMeta.w = (avg.billMeta.w ?? 0) + L.billMeta.w;
    }
    if (L.table) {
      avg.table = avg.table || {};
      avg.table.y = (avg.table.y ?? 0) + (L.table.y ?? 0);
      avg.table.h = (avg.table.h ?? 0) + (L.table.h ?? 0);
    }
    if (L.totals) {
      avg.totals = avg.totals || {};
      avg.totals.y = (avg.totals.y ?? 0) + (L.totals.y ?? 0);
      avg.totals.h = (avg.totals.h ?? 0) + (L.totals.h ?? 0);
    }
  }

  const keys = ["header", "customer", "billMeta", "table", "totals"];
  for (const k of keys) {
    if (!avg[k]) continue;
    avg[k].y = (avg[k].y ?? 0) / n;
    avg[k].h = (avg[k].h ?? 0) / n;
    if (avg[k].x != null) avg[k].x = avg[k].x / n;
    if (avg[k].w != null) avg[k].w = avg[k].w / n;
  }

  return avg;
}
