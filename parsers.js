// ── Parsers ────────────────────────────────────────────────────
// Every parser returns rows in a common shape:
//   { date, description, amount, currency, source, raw }
// amount: negative = money out, positive = money in.
// Nothing here ever leaves the browser except the parsed result,
// which you review/edit before it's written to Drive.

const Parsers = {};

// ---- Monzo (CSV export) -----------------------------------------
Parsers.monzo = function (fileText) {
  const parsed = Papa.parse(fileText, { header: true, skipEmptyLines: true });
  return parsed.data.map((row) => {
    // "Amount" is already the correct signed value (negative = spend,
    // positive = income) in Monzo's export — Money Out/Money In are
    // just a split view of the same number, not additional data.
    let amount = parseFloat(row["Amount"]);
    if (isNaN(amount)) {
      const moneyOut = parseFloat(row["Money Out"]) || 0;
      const moneyIn = parseFloat(row["Money In"]) || 0;
      amount = moneyOut + moneyIn;
    }
    // Linkage: moves between the person's own accounts shouldn't count
    // as income or spend. Covers Monzo savings pots ("Pot transfer" type
    // or "Savings Pot" name) and any transfer referencing HSBC.
    const type = row["Type"] || "";
    const name = row["Name"] || "";
    let category = mapMonzoCategory(row["Category"] || "");
    if (/pot transfer/i.test(type) || /savings pot/i.test(name) || /hsbc/i.test(name + " " + (row["Description"] || ""))) {
      category = "Internal Transfer";
    }
    return {
      date: normalizeUKDate(row["Date"]), // Monzo exports DD/MM/YYYY
      description: name || row["Description"] || "",
      category,
      amount,
      currency: row["Currency"] || row["Local currency"] || "GBP",
      source: "monzo",
      raw: row,
    };
  }).filter((r) => r.date && !isNaN(r.amount));
};

function normalizeUKDate(str) {
  if (!str) return "";
  const m = String(str).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return str; // already ISO or unrecognized — leave as-is
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

// The tracker's scheme IS Monzo's scheme, so this is near-identity:
// normalize capitalization, route "General" (Monzo's catch-all) through
// the rules + classifier instead of accepting it, and pass anything
// unrecognized straight through so custom Monzo categories survive.
function mapMonzoCategory(monzoCat) {
  const raw = String(monzoCat || "").trim();
  if (!raw) return "";
  const key = raw.toLowerCase();
  if (key === "general") return ""; // let rules/classifier pick something better
  const canonical = {
    "eating out": "Eating out", "groceries": "Groceries", "transport": "Transport",
    "entertainment": "Entertainment", "shopping": "Shopping", "bills": "Bills",
    "personal care": "Personal care", "holidays": "Holidays", "gifts": "Gifts",
    "charity": "Charity", "family": "Family", "finances": "Finances",
    "savings": "Savings", "income": "Income", "transfers": "Transfers", "cash": "Cash",
    "expenses": "Finances",
  };
  return canonical[key] || raw;
}

// ---- IBKR (Activity Statement or Flex Query CSV) -------------------
// IBKR's CSV export is a stack of sections, each either:
//   - "horizontal": Section,Header,Col1,Col2,...  then  Section,Data,v1,v2,...
//   - "vertical":   Section,Header,Field Name,Field Value  then one row per field
// We parse generically so this works whether you export the default
// Activity Statement or a custom Flex Query with more sections enabled.
Parsers.ibkr = function (fileText) {
  const lines = fileText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length);
  const sections = {};

  for (const line of lines) {
    const cols = splitCSVLine(line);
    if (cols.length < 2) continue;
    const [section, rowType] = cols;
    if (!sections[section]) sections[section] = { headers: null, rows: [] };
    if (rowType === "Header") {
      sections[section].headers = cols;
    } else if (rowType === "Data" && sections[section].headers) {
      sections[section].rows.push(cols);
    }
  }

  const asObjects = (section) => {
    const s = sections[section];
    if (!s || !s.headers) return [];
    return s.rows.map((r) => {
      const obj = {};
      s.headers.forEach((h, i) => (obj[h] = r[i]));
      return obj;
    });
  };

  // "Vertical" sections (Change in NAV, Account Information, etc.) list
  // one field per row as Field Name/Field Value — fold into a flat map.
  const asFieldMap = (section) => {
    const rows = asObjects(section);
    const map = {};
    rows.forEach((r) => {
      if (r["Field Name"] !== undefined) map[r["Field Name"]] = r["Field Value"];
    });
    return map;
  };

  const cashTx = asObjects("Cash Transactions");
  const deposits = asObjects("Deposits & Withdrawals");
  const cashReport = asObjects("Cash Report");
  const navMap = asFieldMap("Change in NAV");

  // "Net Asset Value" is unusual: IBKR reuses the same section name for a
  // second, differently-shaped header ("Time Weighted Rate of Return"),
  // which breaks the generic header/row pairing above (a later header
  // silently remaps every earlier row collected under the same section
  // name). Scanning the raw lines directly sidesteps that.
  let twrPct = null;
  for (let i = 0; i < lines.length; i++) {
    if (/Time Weighted Rate of Return/i.test(lines[i])) {
      const m = (lines[i + 1] || "").match(/([\d.]+)\s*%/);
      if (m) twrPct = parseFloat(m[1]);
      break;
    }
  }

  const txRows = [];

  cashTx.forEach((r) => {
    txRows.push({
      date: r["Date/Time"] || r["Date"],
      description: r["Description"] || r["Type"] || "Cash transaction",
      amount: parseFloat(r["Amount"]) || 0,
      currency: r["Currency"] || "USD",
      source: "ibkr",
      raw: r,
    });
  });

  deposits.forEach((r) => {
    txRows.push({
      date: r["Settle Date"] || r["Date"],
      description: r["Description"] || "Deposit/Withdrawal",
      amount: parseFloat(r["Amount"]) || 0,
      currency: r["Currency"] || "USD",
      source: "ibkr",
      raw: r,
    });
  });

  // Net deposits/withdrawals, month-to-date, from the Cash Report's
  // "Base Currency Summary" row. Reported separately rather than folded
  // into the NAV change above — the statement's own Starting/Ending
  // Value can cover a shorter window (e.g. a single day) than "Month to
  // Date", and subtracting one from the other would silently mix periods.
  const findCash = (label) => {
    const row = cashReport.find((r) => r["Currency Summary"] === label && r["Currency"] === "Base Currency Summary");
    return row ? parseFloat(row["Month to Date"]) || 0 : 0;
  };
  const netFlowsMTD = findCash("Deposits") + findCash("Withdrawals");

  return {
    transactions: txRows.filter((r) => r.date && !isNaN(r.amount)),
    nav: {
      start: parseFloat(navMap["Starting Value"]),
      end: parseFloat(navMap["Ending Value"]),
      markToMarket: parseFloat(navMap["Mark-to-Market"]) || 0,
      dividends: parseFloat(navMap["Dividends"]) || 0,
      withholdingTax: parseFloat(navMap["Withholding Tax"]) || 0,
      twrPct, // IBKR's own time-weighted return for this statement's period — the authoritative figure
      netFlowsMTD,
    },
  };
};

// ---- HSBC Bermuda (scanned PDF statement, via in-browser OCR) -------
// HSBC Bermuda's PDF statements have no text layer at all — they're
// scanned images — so there's nothing for pdf.js to extract directly.
// This renders each page to a canvas and runs OCR (Tesseract.js) on it
// entirely in your browser; nothing is uploaded anywhere. The parsed
// rows always land in the review table before anything is saved, since
// OCR occasionally misreads a character.
Parsers.hsbc = async function (arrayBuffer, onProgress) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  // Tesseract.js v5 — its default worker/core/language paths (all on
  // jsDelivr) are correct out of the box; overriding them was the cause
  // of earlier init failures, so we deliberately don't.
  const worker = await Tesseract.createWorker("eng", 1, {
    logger: (m) => { if (onProgress && m.status === "recognizing text") onProgress(`OCR ${Math.round((m.progress || 0) * 100)}%…`); },
  });
  const allLines = [];

  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      if (onProgress) onProgress(`Reading page ${i} of ${pdf.numPages}…`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 4 }); // ~288dpi, good OCR accuracy
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      // A data URL is the most broadly-supported input across Tesseract.js
      // builds — more reliable than passing the canvas element directly.
      const { data } = await worker.recognize(canvas.toDataURL("image/png"));
      // Tesseract's own line grouping occasionally reads a table's
      // columns as separate blocks (all the description text, then all
      // the amounts, out of row order). Rebuilding rows from each
      // word's own position is what makes this reliable regardless.
      const pageLines = reflowWords(data.words);
      allLines.push(...(pageLines.length ? pageLines : data.text.split(/\r?\n/)));
    }
  } finally {
    await worker.terminate();
  }

  return parseHsbcLines(allLines);
};

// Reconstructs reading-order lines from OCR word boxes: cluster words
// into rows by y-position, then sort each row left-to-right by x.
function reflowWords(words) {
  if (!words || !words.length) return [];
  const heights = words.map((w) => w.bbox.y1 - w.bbox.y0).filter((h) => h > 0);
  const avgHeight = heights.reduce((a, b) => a + b, 0) / (heights.length || 1);
  const tolerance = Math.max(8, avgHeight * 0.6);

  const sorted = words.slice().sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);
  const rows = [];
  for (const w of sorted) {
    let row = rows.find((r) => Math.abs(r.y - w.bbox.y0) <= tolerance);
    if (!row) {
      row = { y: w.bbox.y0, words: [] };
      rows.push(row);
    }
    row.words.push(w);
  }
  rows.sort((a, b) => a.y - b.y);
  return rows.map((r) => r.words.sort((a, b) => a.bbox.x0 - b.bbox.x0).map((w) => w.text).join(" "));
}

// Reconstructs transactions from OCR'd statement lines using the
// running balance: every amounts row shows the new balance, so
// amount = newBalance - previousBalance. This sidesteps having to trust
// OCR's read of which number is the amount vs. the balance, and survives
// transactions split across page breaks.
//
// It also enriches each row with HSBC-specific structure:
//  - account name + currency from each section's header line
//  - counterparty (merchant / payee), pulled from the descriptive lines
//    of the block (HSBC prints it below the PURCHASE/CASH line)
//  - FX purchase tax (the 1.25% FCPT levy on non-BMD transactions)
//  - classification: BMA income, internal transfers between own accounts,
//    IBKR / Monzo linkages, cash withdrawals, fees
function parseHsbcLines(lines) {
  const SKIP = [
    /^HSBC\b/i, /^Page \d+ of \d+/i, /Composite Statement/i,
    /STATEMENT AT A GLANCE/i, /STATEMENT DATE/i, /CUSTOMER NUMBER/i,
    /SEQUENCE NUMBER/i, /DESPATCH CODE/i, /Your Portfolio At A Glance/i,
    /TOTAL DEPOSITS AND INVESTMENTS/i, /TOTAL BORROWINGS/i, /NET POSITION/i,
    /^MORTGAGES/i, /Summary of Your Portfolio/i, /CCY\/Unit/i, /Credit Limit/i,
    /BMD Equivalent/i, /Protect Your Personal Information/i, /[Ff]raudster/i,
    /purporting to be from/i, /ask customers to confirm/i,
    /such requests please forward/i, /Important information/i,
    /errors, omissions/i, /as of previous month end/i, /Details of Your Accounts/i,
    /\(DR=Debit\)/i, /^Date\s+Transaction Details/i,
    /Transaction Turnover/i, /Transaction Count/i, /^END OF STATEMENT/i,
    /^BMD\s*$/i, /^USD\s*$/i, /^GBP\s*$/i,
  ];
  const BALANCE_MARKER = /(BALANCE BROUGHT FORWARD|BALANCE CARRIED FORWARD|CLOSING BALANCE)/i;
  const ACCOUNT_HEADER = /Account Number\s*[:\-]?\s*([\d\-]+)/i;
  const TABLE_HEADER = /^\(?Date\s+Transaction Details/i;
  const NUM = /(-?[\d,]+\.\d{2})\s*(DR)?/gi;

  let previousBalance = null;
  let currentDate = null;
  let account = null;
  let accountName = null;
  let accountCurrency = "BMD";
  let buffer = [];
  let tableActive = false;
  const ownAccounts = new Set();
  const rows = [];

  const parseAmount = (numStr, dr) => {
    const v = parseFloat(numStr.replace(/,/g, ""));
    return dr ? -Math.abs(v) : v;
  };

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const acctMatch = line.match(ACCOUNT_HEADER);
    if (acctMatch) {
      if (acctMatch[1] !== account) {
        account = acctMatch[1];
        ownAccounts.add(account);
        previousBalance = null;
        currentDate = null;
        buffer = [];
        tableActive = false;
        // Section header carries the account's product name and currency,
        // e.g. "(QUARTERLY BONUS SAVE  Account Number 011-256617-012  Branch 011  Currency BMD"
        const nameMatch = line.match(/^\(?\s*([A-Z][A-Z'&\s]+?)\s+Account Number/i);
        const curMatch = line.match(/Currency\s+([A-Z]{3})/i);
        accountCurrency = curMatch ? curMatch[1].toUpperCase() : "BMD";
        // OCR sometimes clips the first characters of the header (e.g.
        // "(SBC BANK ACCOUNT"), so normalize to known product names.
        const rawName = nameMatch ? nameMatch[1].trim() : "";
        if (/BONUS SAVE/i.test(rawName)) accountName = `Quarterly Bonus Save (${accountCurrency})`;
        else if (/BANK ACCOUNT/i.test(rawName)) accountName = `HSBC Bank Account (${accountCurrency})`;
        else accountName = rawName ? `${rawName} (${accountCurrency})` : null;
      }
      continue;
    }

    if (TABLE_HEADER.test(line)) {
      tableActive = true;
      continue;
    }

    if (SKIP.some((re) => re.test(line))) continue;
    if (!tableActive) continue;

    const dateMatch = line.match(/(\d{1,2}[A-Za-z]{3}\d{4})/);
    let working = line;
    if (dateMatch) {
      currentDate = normalizeHsbcDate(dateMatch[1]);
      working = working.replace(dateMatch[0], "").trim();
    }

    if (BALANCE_MARKER.test(line)) {
      const nums = [...working.matchAll(NUM)];
      if (nums.length) {
        const last = nums[nums.length - 1];
        previousBalance = parseAmount(last[1], last[2]);
      }
      // Deliberately do NOT clear the buffer: when a transaction's
      // description lines land at the bottom of one page and its amounts
      // row at the top of the next, the CARRIED/BROUGHT FORWARD pair sits
      // between them — clearing here would orphan the description.
      continue;
    }

    const nums = [...working.matchAll(NUM)];
    if (nums.length >= 2) {
      const balTok = nums[nums.length - 1];
      const amtTok = nums[nums.length - 2];
      const newBalance = parseAmount(balTok[1], balTok[2]);
      const amount = previousBalance !== null
        ? Math.round((newBalance - previousBalance) * 100) / 100
        : parseAmount(amtTok[1], null);

      const tail = working.slice(0, amtTok.index).trim();
      const blockLines = tail ? [...buffer, tail] : [...buffer];

      const enriched = enrichHsbcBlock(blockLines, amount, ownAccounts);
      rows.push({
        date: currentDate,
        description: enriched.description,
        counterparty: enriched.counterparty,
        category: enriched.category,
        fxTax: enriched.fxTax,
        amount,
        currency: accountCurrency,
        account,
        accountName,
        source: "hsbc",
        raw: blockLines.join(" | "),
      });
      previousBalance = newBalance;
      buffer = [];
      continue;
    }

    if (working) buffer.push(working);
  }

  return rows;
}

// HSBC block structure (top to bottom): a PURCHASE/CASH line with the
// original datetime, a card/txn code+currency+FX-amount line, the
// counterparty name, optional BK CHG / FCPT (foreign currency purchase
// tax, levied at 1.25% on non-BMD transactions) lines, then the REF line
// that carries the BMD amounts. The counterparty is the descriptive text
// that is none of those boilerplate patterns.
function enrichHsbcBlock(blockLines, amount, ownAccounts) {
  const BOILER = [
    /^PURCHASE\b/i, /^CASH\b/i, /^REF\b/i, /^BK CHG\b/i, /^FCPT\b/i,
    /^LP\b/i, /^TT\b/i, /^WEB-/i, /^[A-Z]{2}\d{6,}(USD|BMD|GBP|EUR)/,
    /^\d{7,}$/, /^FROM\s+[\d\-]+/i, /^TO\s+[\d\-]+/i,
    /^SAVINGS ACCOUNT FEE/i, /^\d{2}[A-Z]{3}\d{2}\s+TO\s+\d{2}[A-Z]{3}\d{2}/i,
    /^CREDIT INTEREST/i, /^TRANSFER FROM$/i, /^COMMISSION\b/i,
  ];
  const text = blockLines.join(" ");

  // Drop OCR junk that leaks in from page borders/footers when a block
  // spans a page break: fragments like "N y,", "(HSBC »", or any line
  // without enough real letters to be a name.
  const isJunk = (l) => {
    const t = l.trim();
    if (/HSBC/i.test(t) && t.length < 12) return true;
    return t.replace(/[^A-Za-z0-9]/g, "").length < 3;
  };
  let fxTax = 0;
  for (const m of text.matchAll(/FCPT\s*@?\s*\.?0?125\s*BMD\s*([\d,]+\.\d{2})/gi)) {
    fxTax += parseFloat(m[1].replace(/,/g, ""));
  }
  fxTax = Math.round(fxTax * 100) / 100 || 0;

  // Counterparty: descriptive lines that aren't boilerplate or OCR junk
  const textyLines = blockLines.filter((l) => !isJunk(l) && !BOILER.some((re) => re.test(l.trim())));
  let counterparty = textyLines.join(" ").replace(/\s+/g, " ").trim();

  // Classification
  let category = "";
  const ownTransfer = text.match(/(?:FROM|TO)\s+(011-256617-\d{3})/i);

  if (/BERMUDA MONETARY AUT/i.test(text)) {
    category = "Income";
    counterparty = "Bermuda Monetary Authority" + (counterparty ? ` — ${counterparty.replace(/BERMUDA MONETARY AUT/i, "").trim()}` : "");
  } else if (/CREDIT INTEREST/i.test(text)) {
    category = "Income";
    counterparty = counterparty || "Credit interest";
  } else if (/Interactive Brokers/i.test(text) || /U8028484/i.test(text)) {
    category = "Savings";
    counterparty = "Interactive Brokers (IBKR)";
  } else if (/MONZO/i.test(text)) {
    category = "Internal Transfer";
    counterparty = "Monzo (own account)";
  } else if (ownTransfer) {
    category = "Internal Transfer";
    counterparty = `Own account ${ownTransfer[1]}`;
  } else if (/\bTO\s+\d{3}-\d{6}-\d{3}/i.test(text)) {
    category = "Transfers";
    const acct = text.match(/TO\s+(\d{3}-\d{6}-\d{3})/i);
    counterparty = counterparty || (acct ? `Account ${acct[1]}` : "External transfer");
  } else if (/SAVINGS ACCOUNT FEE/i.test(text)) {
    category = "Finances";
    counterparty = "Savings account fee";
  } else if (blockLines.some((l) => /^CASH\b/i.test(l.trim()))) {
    category = "Cash";
    counterparty = counterparty || (amount < 0 ? "Cash withdrawal" : "Cash deposit");
  }

  const description = counterparty || blockLines[blockLines.length - 1] || "(unclear — check raw)";
  return { counterparty, category, fxTax, description };
}

function normalizeHsbcDate(tok) {
  const m = tok.match(/(\d{1,2})([A-Za-z]{3})(\d{4})/);
  if (!m) return tok;
  const months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
  const mm = months[m[2].toLowerCase()] || "01";
  return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
}

function splitCSVLine(line) {
  // Minimal CSV splitter that respects quoted commas.
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}
