// ── Google Sheets storage ──────────────────────────────────────
// Direct Sheets API v4 from the browser, using the same OAuth token
// flow as Drive. The spreadsheet is the single source of truth:
//   Transactions  — one row per transaction (appended)
//   _rules        — hidden: category keyword rules (JSON in A1)
//   _model        — hidden: learned NLP model (JSON in A1)
// Reference/Summary tabs are user/formula-owned; the app never writes them.

const SheetStore = (() => {
  const API = "https://sheets.googleapis.com/v4/spreadsheets";
  const TX_SHEET = "Transactions";
  const TX_RANGE = "Transactions!A:L"; // 12 columns, matches the workbook
  const RULES_CELL = "_rules!A1";
  const MODEL_CELL = "_model!A1";
  const MERCH_EDITS_RANGE = "_merchant_edits!A:C"; // key | clean name | category

  function sheetId() {
    const id = (LEDGER_CONFIG.SPREADSHEET_ID || "").trim();
    if (!id) throw new Error("No SPREADSHEET_ID set in config.js");
    return id;
  }

  async function authFetch(url, opts = {}) {
    const token = Auth.getToken();
    if (!token) throw new Error("Not signed in");
    opts.headers = { ...(opts.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
    return res;
  }

  // Map an app transaction to the workbook's 12-column row order.
  function toRow(t) {
    return [
      t.date || "",
      t.source === "hsbc" ? "HSBC" : t.source === "monzo" ? "Monzo" : t.source === "ibkr" ? "IBKR" : (t.bank || ""),
      t.accountName || t.account || "",
      t.description || "",
      t.category || "",
      t.trip || "",
      t.currency || "",
      typeof t.amount === "number" ? t.amount : "",
      "", // Amount (BMD) — leave blank; the sheet's own formula fills it
      typeof t.fxTax === "number" && t.fxTax ? t.fxTax : "",
      t.notes || "",
      t.id || makeSourceId(t),
    ];
  }

  // Stable per-transaction ID so re-importing a statement can't duplicate
  // rows: hash of the fields that identify a transaction.
  function makeSourceId(t) {
    const basis = [t.source, t.date, t.amount, (t.description || "").slice(0, 24), t.account || ""].join("|");
    let h = 0;
    for (let i = 0; i < basis.length; i++) { h = (h * 31 + basis.charCodeAt(i)) | 0; }
    return `${t.source || "tx"}_${(h >>> 0).toString(36)}`;
  }

  async function existingSourceIds() {
    // Source ID is column L.
    const url = `${API}/${sheetId()}/values/${encodeURIComponent(TX_SHEET + "!L:L")}`;
    const res = await authFetch(url);
    const data = await res.json();
    const ids = new Set();
    (data.values || []).forEach((r) => { if (r[0]) ids.add(r[0]); });
    return ids;
  }

  // Append only transactions whose Source ID isn't already present.
  async function appendTransactions(transactions) {
    const seen = await existingSourceIds();
    const fresh = [];
    for (const t of transactions) {
      const id = t.id || makeSourceId(t);
      if (!seen.has(id)) { t.id = id; fresh.push(t); }
    }
    if (!fresh.length) return { appended: 0, skipped: transactions.length };

    const rows = fresh.map(toRow);
    const url = `${API}/${sheetId()}/values/${encodeURIComponent(TX_RANGE)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    await authFetch(url, { method: "POST", body: JSON.stringify({ values: rows }) });
    return { appended: fresh.length, skipped: transactions.length - fresh.length };
  }

  // Small JSON blobs (rules, model) live in a single cell on a hidden tab.
  async function readJSONCell(cellRange, fallback) {
    try {
      const url = `${API}/${sheetId()}/values/${encodeURIComponent(cellRange)}`;
      const res = await authFetch(url);
      const data = await res.json();
      const raw = data.values && data.values[0] && data.values[0][0];
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  async function writeJSONCell(cellRange, obj) {
    const url = `${API}/${sheetId()}/values/${encodeURIComponent(cellRange)}?valueInputOption=RAW`;
    await authFetch(url, { method: "PUT", body: JSON.stringify({ values: [[JSON.stringify(obj)]] }) });
  }

  // Update a transaction's Description (D) and Category (E) by row number.
  // Row 2 = first data row (matches readAllTransactions order).
  async function updateRows(updates) {
    if (!updates.length) return;
    const data = [];
    for (const u of updates) {
      if (u.description !== undefined)
        data.push({ range: `${TX_SHEET}!D${u.rowNumber}`, values: [[u.description]] });
      if (u.category !== undefined)
        data.push({ range: `${TX_SHEET}!E${u.rowNumber}`, values: [[u.category]] });
    }
    await authFetch(`${API}/${sheetId()}/values:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
    });
  }

  async function readMerchantEdits() {
    try {
      const url = `${API}/${sheetId()}/values/${encodeURIComponent(MERCH_EDITS_RANGE)}`;
      const res = await authFetch(url);
      const data = await res.json();
      const out = {};
      (data.values || []).slice(1).forEach((r) => {
        if (r[0]) out[r[0].toLowerCase()] = { name: r[1] || "", category: r[2] || "" };
      });
      return out;
    } catch {
      return {};
    }
  }

  async function writeMerchantEdits(editsMap) {
    const rows = [["Match key (lowercase)", "Clean name", "Category"]];
    for (const [key, v] of Object.entries(editsMap)) rows.push([key, v.name, v.category]);
    await authFetch(`${API}/${sheetId()}/values/${encodeURIComponent("_merchant_edits!A:C")}:clear`, { method: "POST", body: "{}" });
    await authFetch(`${API}/${sheetId()}/values/${encodeURIComponent("_merchant_edits!A1")}?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values: rows }) });
  }

  async function readAllTransactions() {
    const url = `${API}/${sheetId()}/values/${encodeURIComponent(TX_RANGE)}`;
    const res = await authFetch(url);
    const data = await res.json();
    const vals = data.values || [];
    if (vals.length < 2) return [];
    return vals.slice(1).map((r, idx) => ({
      rowNumber: idx + 2, // header is row 1; first data row is 2
      date: r[0], bank: r[1], account: r[2], description: r[3], category: r[4],
      trip: r[5], currency: r[6], amount: parseFloat(r[7]) || 0,
      fxTax: parseFloat(r[9]) || 0, notes: r[10], id: r[11],
      source: (r[1] || "").toLowerCase(),
    })).filter((t) => t.date);
  }

  async function appendNav(nav, statementDate) {
    const row = [
      statementDate || new Date().toISOString().slice(0, 10),
      nav.start ?? "", nav.end ?? "", nav.netFlowsMTD ?? "",
      nav.markToMarket ?? "", nav.dividends ?? "", nav.withholdingTax ?? "",
      typeof nav.twrPct === "number" ? nav.twrPct / 100 : "", // store as ratio for 0.00% format
      "", // Cumulative — sheet formula fills it
    ];
    const url = `${API}/${sheetId()}/values/${encodeURIComponent("Investments!A:I")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    await authFetch(url, { method: "POST", body: JSON.stringify({ values: [row] }) });
  }

  return {
    appendTransactions, readAllTransactions, appendNav,
    updateRows, readMerchantEdits, writeMerchantEdits,
    readRules: (fb) => readJSONCell(RULES_CELL, fb),
    writeRules: (o) => writeJSONCell(RULES_CELL, o),
    readModel: (fb) => readJSONCell(MODEL_CELL, fb),
    writeModel: (o) => writeJSONCell(MODEL_CELL, o),
    makeSourceId,
  };
})();
