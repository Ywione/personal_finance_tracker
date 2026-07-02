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
    const moneyOut = parseFloat(row["Money Out"] || row["Amount"] || 0) || 0;
    const moneyIn = parseFloat(row["Money In"] || 0) || 0;
    const amount = row["Amount"] !== undefined && row["Money Out"] === undefined
      ? parseFloat(row["Amount"]) || 0
      : moneyIn + moneyOut; // Money Out is already negative in Monzo exports
    return {
      date: row["Date"],
      description: row["Name"] || row["Description"] || "",
      category: row["Category"] || "",
      amount,
      currency: row["Currency"] || row["Local currency"] || "GBP",
      source: "monzo",
      raw: row,
    };
  }).filter((r) => r.date && !isNaN(r.amount));
};

// ---- IBKR (Flex Query CSV) ---------------------------------------
// Standard multi-section Flex CSV: col1 = section name, col2 = "Header"|"Data".
// We split into sections generically so this survives you adding/removing
// sections in the Flex Query template later.
Parsers.ibkr = function (fileText) {
  const lines = fileText.split(/\r?\n/).filter((l) => l.trim().length);
  const sections = {}; // { sectionName: { headers: [...], rows: [[...]] } }

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

  const trades = asObjects("Trades");
  const cashTx = asObjects("Cash Transactions");
  const deposits = asObjects("Deposits & Withdrawals");
  const navRows = asObjects("Change in NAV");

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

  return {
    transactions: txRows.filter((r) => r.date && !isNaN(r.amount)),
    trades,
    nav: navRows, // used by dashboard.js for investment return calcs
  };
};

// ---- HSBC Bermuda (PDF statement) --------------------------------
// PDF layouts vary a lot between banks and even between statement
// eras from the same bank, so this uses a permissive line-level
// regex and always routes results through the review screen before
// anything is saved. Tune HSBC_LINE_RE in Settings if it misses rows.
Parsers.hsbc = async function (arrayBuffer, customRegex) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it) => it.str).join(" ");
    fullText += pageText + "\n";
  }

  // Default: "12 JAN  DESCRIPTION TEXT  1,234.56" style lines,
  // with an optional leading minus/CR-DR marker.
  const re = customRegex ||
    /(\d{1,2}\s?[A-Z]{3})\s+(.+?)\s+(-?[\d,]+\.\d{2})(?:\s*(CR|DR))?\s*$/gm;

  const rows = [];
  let match;
  while ((match = re.exec(fullText)) !== null) {
    const [, dateStr, desc, amtStr, crdr] = match;
    let amount = parseFloat(amtStr.replace(/,/g, ""));
    if (crdr === "DR" || (!crdr && desc.toLowerCase().match(/withdrawal|debit|purchase|fee/))) {
      amount = -Math.abs(amount);
    } else if (crdr === "CR") {
      amount = Math.abs(amount);
    }
    rows.push({
      date: dateStr,
      description: desc.trim(),
      amount,
      currency: "BMD",
      source: "hsbc",
      raw: match[0],
    });
  }
  return rows;
};

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
