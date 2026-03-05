/**
 * FormMapper.js — Map extracted invoice JSON to form inputs (NEW GOOD NITS).
 * Sets value on elements by ID; supports optional confidence logging.
 */

/**
 * Map extracted invoice data to form fields by element ID.
 * Uses standard NEW GOOD NITS field IDs (ngnBillNo, ngnCustomerName, etc.).
 * @param {Object} data - Extracted invoice object (billNo, date, customer, table, totals, header?)
 * @param {Object} [options] - { logConfidence: boolean }
 */
export function mapToForm(data, options = {}) {
  if (!data) return;

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el && value != null && value !== "") {
      el.value = String(value);
    }
  };

  set("billNo", data.billNo);
  set("ngnBillNo", data.billNo);
  set("date", data.date);
  set("ngnDate", formatDateForInput(data.date));
  set("ngnJobNo", data.jobNo);
  set("ngnPartyDcNo", data.partyDc);

  if (data.customer) {
    set("customer", data.customer.name || data.customer.customerName);
    set("ngnCustomerName", data.customer.name || data.customer.customerName);
    set("ngnCustomerAddress", data.customer.address);
    set("gst", data.customer.gstNumber || data.customer.gst);
    set("ngnCustomerGst", data.customer.gstNumber || data.customer.gst);
    set("ngnCustomerState", data.customer.state);
  }

  if (data.totals) {
    set("ngnSubtotal", data.totals.subtotal);
    set("ngnCgst", data.totals.cgst);
    set("ngnSgst", data.totals.sgst);
    set("ngnRoundedOff", data.totals.roundedOff);
    set("ngnNetTotal", data.totals.netTotal);
    set("total", data.totals.netTotal);
  }

  if (data.table && Array.isArray(data.table) && data.table.length > 0) {
    const tbody = document.getElementById("ngnTableBody");
    if (tbody) {
      tbody.innerHTML = "";
      data.table.forEach((row) => {
        const tr = document.createElement("tr");
        const esc = (v) => (v != null ? String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "");
        tr.innerHTML = `
          <td><input type="text" class="table-input" value="${esc(row.slNo)}" data-col="slNo"></td>
          <td><input type="text" class="table-input" value="${esc(row.dc)}" data-col="dc"></td>
          <td><input type="text" class="table-input" value="${esc(row.date)}" data-col="date"></td>
          <td><input type="text" class="table-input" value="${esc(row.gg)}" data-col="gg"></td>
          <td><input type="text" class="table-input" value="${esc(row.fabric)}" data-col="fabric"></td>
          <td><input type="text" class="table-input" value="${esc(row.counts)}" data-col="counts"></td>
          <td><input type="text" class="table-input" value="${esc(row.mill)}" data-col="mill"></td>
          <td><input type="text" class="table-input" value="${esc(row.dia)}" data-col="dia"></td>
          <td><input type="number" class="table-input" step="0.001" value="${row.weight ?? ""}" data-col="weight"></td>
          <td><input type="number" class="table-input" step="0.001" value="${row.rate ?? ""}" data-col="rate"></td>
          <td><input type="number" class="table-input" step="0.01" value="${row.amount ?? ""}" data-col="amount"></td>
          <td class="td-actions"><button type="button" class="btn-icon btn-delete-row">×</button></td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  if (options.logConfidence && data.confidence != null) {
    console.log("[FormMapper] OCR confidence:", data.confidence);
  }
}

/**
 * Format date string (DD/MM/YYYY or DD-MM-YYYY) to YYYY-MM-DD for <input type="date">.
 * @param {string} dateStr
 * @returns {string}
 */
function formatDateForInput(dateStr) {
  if (!dateStr) return "";
  const m = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/) || dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (!m) return dateStr;
  let y, month, day;
  if (m[3].length === 4) {
    day = m[1].padStart(2, "0");
    month = m[2].padStart(2, "0");
    y = m[3].length === 2 ? "20" + m[3] : m[3];
  } else {
    y = m[1].length === 2 ? "20" + m[1] : m[1];
    month = m[2].padStart(2, "0");
    day = m[3].padStart(2, "0");
  }
  return `${y}-${month}-${day}`;
}
