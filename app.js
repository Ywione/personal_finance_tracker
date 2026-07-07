// ── App ────────────────────────────────────────────────────────

let STATE = {
  transactions: [], // committed, saved to Drive
  navHistory: [],   // IBKR NAV snapshots per import, saved to Drive
  pendingReview: [], // parsed rows awaiting your approval
};

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

// ---- Tabs ---------------------------------------------------------
function initTabs() {
  $all(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $all(".tab-btn").forEach((b) => b.classList.remove("active"));
      $all(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      $(`#tab-${btn.dataset.tab}`).classList.add("active");
      if (btn.dataset.tab === "dashboard") renderDashboard();
    });
  });
}

// ---- Auth wiring ----------------------------------------------------
function initAuth() {
  Auth.init(async ({ signedIn, error }) => {
    $("#authStatus").textContent = signedIn ? "Signed in — data syncing to your private Drive folder" : (error ? `Sign-in error: ${error}` : "Not signed in");
    $("#signInBtn").style.display = signedIn ? "none" : "inline-block";
    $("#signOutBtn").style.display = signedIn ? "inline-block" : "none";
    $(".app-body").style.opacity = signedIn ? "1" : "0.4";
    $(".app-body").style.pointerEvents = signedIn ? "auto" : "none";
    if (signedIn) await loadFromDrive();
  });
  $("#signInBtn").addEventListener("click", () => Auth.signIn());
  $("#signOutBtn").addEventListener("click", () => Auth.signOut());
  // Try a silent sign-in on load in case there's an active Google session.
  window.addEventListener("load", () => setTimeout(() => Auth.trySilent(), 300));
}

async function loadFromDrive() {
  // Load from the Google Sheet (single source of truth).
  const [tx, rules, model, merchantEdits] = await Promise.all([
    SheetStore.readAllTransactions(),
    SheetStore.readRules(DEFAULT_RULES),
    SheetStore.readModel(null),
    SheetStore.readMerchantEdits(),
  ]);
  STATE.transactions = tx;
  STATE.navHistory = [];
  Categorize.setRules(rules);
  Categorize.setModel(model);
  if (typeof setMerchantOverrides === "function") setMerchantOverrides(merchantEdits);
  renderRulesEditor();
  renderTransactionsTable();
  renderDashboard();
}

// Persists rules + learned model to their hidden tabs. Transactions are
// appended separately (in commitReview) so they can be deduped by Source ID.
async function saveToDrive() {
  if (!Auth.isSignedIn()) {
    alert("You're not signed in — sign in with Google first, then re-import this file so it can be saved.");
    return false;
  }
  try {
    await Promise.all([
      SheetStore.writeRules(Categorize.getRules()),
      SheetStore.writeModel(Categorize.getModel()),
    ]);
    return true;
  } catch (err) {
    console.error(err);
    alert("Couldn't save to the Sheet: " + err.message);
    return false;
  }
}

// ---- Upload → parse → review pipeline --------------------------------
function initUploads() {
  $("#monzoFile").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    let total = 0;
    for (const file of files) {
      const text = await file.text();
      const rows = Categorize.applyTo(Parsers.monzo(text));
      queueReview(rows);
      total += rows.length;
    }
    if (files.length > 1) alert(`Parsed ${files.length} Monzo files — ${total} row(s) added to review.`);
    e.target.value = ""; // reset so re-selecting the same files fires change again
  });

  $("#ibkrFile").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    let navCount = 0, txCount = 0, navErr = 0;
    for (const file of files) {
      const text = await file.text();
      const result = Parsers.ibkr(text);
      if (result.transactions.length) { queueReview(Categorize.applyTo(result.transactions)); txCount += result.transactions.length; }
      if (!isNaN(result.nav.start) && !isNaN(result.nav.end)) {
        STATE.navHistory.push({ importedAt: new Date().toISOString(), nav: result.nav });
        try { await SheetStore.appendNav(result.nav, result.nav.statementDate); navCount++; }
        catch (err) { console.error(err); navErr++; }
      }
    }
    renderDashboard();
    let msg = `Processed ${files.length} IBKR file(s): ${navCount} NAV snapshot(s) recorded`;
    if (txCount) msg += `, ${txCount} transaction row(s) to review`;
    if (navErr) msg += ` (${navErr} failed to write — see console)`;
    alert(msg + ".");
    e.target.value = "";
  });

  $("#hsbcFile").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    const statusEl = $("#hsbcStatus");
    let total = 0, failed = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const prefix = files.length > 1 ? `File ${i + 1}/${files.length} (${file.name}): ` : "";
      try {
        const buf = await file.arrayBuffer();
        const rows = await Parsers.hsbc(buf, (msg) => { statusEl.textContent = prefix + msg; });
        queueReview(Categorize.applyTo(rows));
        total += rows.length;
        if (!rows.length) failed++;
      } catch (err) {
        console.error(err);
        failed++;
        statusEl.textContent = prefix + "OCR failed — see console.";
      }
    }
    statusEl.textContent = `Done — ${total} row(s) found across ${files.length} statement(s)` + (failed ? `; ${failed} file(s) yielded nothing (check them).` : ". Review below before saving.");
    if (!total) alert("No transactions were recognized in any file. Scan quality or layout may be throwing off OCR.");
    e.target.value = "";
  });
}

function queueReview(rows) {
  STATE.pendingReview = STATE.pendingReview.concat(rows);
  renderReviewTable();
  $("#reviewCount").textContent = STATE.pendingReview.length;
}

function renderReviewTable() {
  const tbody = $("#reviewTable tbody");
  tbody.innerHTML = "";
  STATE.pendingReview.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input value="${escapeHtml(row.date || "")}" data-i="${i}" data-f="date"></td>
      <td><input value="${escapeHtml(row.description || "")}" data-i="${i}" data-f="description"></td>
      <td><input value="${escapeHtml(row.category || "")}" data-i="${i}" data-f="category"></td>
      <td class="num"><input value="${row.amount}" data-i="${i}" data-f="amount"></td>
      <td>${row.source}</td>
      <td><button class="del-row" data-i="${i}">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("change", (e) => {
      const { i, f } = e.target.dataset;
      STATE.pendingReview[i][f] = f === "amount" ? parseFloat(e.target.value) : e.target.value;
      // A manual category correction is the strongest training signal —
      // teach the classifier immediately so it recognizes this merchant
      // next month.
      if (f === "category") {
        Categorize.learn(STATE.pendingReview[i].description, e.target.value);
      }
    });
  });
  tbody.querySelectorAll(".del-row").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      STATE.pendingReview.splice(e.target.dataset.i, 1);
      renderReviewTable();
    });
  });
}

async function commitReview() {
  if (!Auth.isSignedIn()) {
    alert("Sign in with Google first, then commit.");
    return;
  }
  // Committing confirms each row's category — reinforce the classifier.
  STATE.pendingReview.forEach((t) => Categorize.learn(t.description, t.category));

  let result;
  try {
    result = await SheetStore.appendTransactions(STATE.pendingReview);
  } catch (err) {
    console.error(err);
    alert("Couldn't write to the Sheet: " + err.message);
    return;
  }

  // Persist rules + model, then refresh from the Sheet so the table
  // reflects exactly what's stored (incl. server-side dedup).
  await saveToDrive();
  STATE.pendingReview = [];
  renderReviewTable();
  await loadFromDrive();

  const msg = result.skipped
    ? `Added ${result.appended} new transaction(s); skipped ${result.skipped} already in the Sheet.`
    : `Added ${result.appended} transaction(s) to the Sheet.`;
  alert(msg);
}

// ---- Sync from Sheet: learn from edits made directly in the spreadsheet ----
// Treats the Transactions tab as ground truth. For every row it trains the
// classifier on (description → category), and detects merchant-name/category
// corrections, recording them to _merchant_edits and propagating them to
// every other row of the same merchant (written back to the sheet).
async function syncFromSheet() {
  if (!Auth.isSignedIn()) { alert("Sign in first."); return; }
  let txs, existingEdits;
  try {
    [txs, existingEdits] = await Promise.all([
      SheetStore.readAllTransactions(),
      SheetStore.readMerchantEdits(),
    ]);
  } catch (err) { console.error(err); alert("Couldn't read the Sheet: " + err.message); return; }

  let trained = 0;
  txs.forEach((t) => {
    if (t.category && t.category !== "Uncategorized") { Categorize.learn(t.description, t.category); trained++; }
  });

  const edits = { ...existingEdits };
  const merchantGroups = {};
  for (const t of txs) {
    const key = normalizeMerchantKey(t.description);
    if (!key) continue;
    if (!merchantGroups[key]) merchantGroups[key] = { rows: [] };
    merchantGroups[key].rows.push(t);
  }

  const updates = [];
  for (const [key, grp] of Object.entries(merchantGroups)) {
    const nameVotes = {}, catVotes = {};
    grp.rows.forEach((t) => {
      nameVotes[t.description] = (nameVotes[t.description] || 0) + 1;
      if (t.category) catVotes[t.category] = (catVotes[t.category] || 0) + 1;
    });
    const bestName = Object.entries(nameVotes).sort((a, b) => b[1] - a[1])[0][0];
    const bestCat = Object.entries(catVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    const resolved = (typeof resolveMerchant === "function") ? resolveMerchant(bestName) : null;
    if (!resolved || resolved.name !== bestName || (bestCat && resolved.category !== bestCat)) {
      edits[key] = { name: bestName, category: bestCat };
    }

    grp.rows.forEach((t) => {
      const needsName = t.description !== bestName;
      const needsCat = bestCat && t.category !== bestCat;
      if (needsName || needsCat) {
        updates.push({
          rowNumber: t.rowNumber,
          ...(needsName ? { description: bestName } : {}),
          ...(needsCat ? { category: bestCat } : {}),
        });
      }
    });
  }

  try {
    if (typeof setMerchantOverrides === "function") setMerchantOverrides(edits);
    await SheetStore.writeMerchantEdits(edits);
    if (updates.length) await SheetStore.updateRows(updates);
    await saveToDrive();
    await loadFromDrive();
  } catch (err) { console.error(err); alert("Sync write failed: " + err.message); return; }

  alert(`Synced: trained on ${trained} row(s), ${Object.keys(edits).length} merchant rule(s), propagated ${updates.length} correction(s).`);
}

// Normalizes a description to a merchant grouping key so OCR variants and
// your cleaned names collapse together: lowercase, strip ref codes and long
// digit runs, keep the first ~3 identifying tokens.
function normalizeMerchantKey(desc) {
  return String(desc || "")
    .toLowerCase()
    .replace(/\*[a-z0-9]{6,}/g, "")
    .replace(/[^a-z0-9'&\s]/g, " ")
    .replace(/\b\d{4,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ").slice(0, 3).join(" ");
}

// Generates a copy-paste block of merchant-bank entries from the corrections
// accumulated in the sheet, ready to fold into the committed merchant_bank.js.
// This is the deliberate manual step that keeps GitHub the canonical source.
async function generateMerchantBankExport() {
  if (!Auth.isSignedIn()) { alert("Sign in first."); return; }
  const edits = await SheetStore.readMerchantEdits();
  const keys = Object.keys(edits);
  if (!keys.length) { alert("No merchant corrections recorded yet — make edits in the sheet, Sync, then export."); return; }
  const lines = keys.sort().map((k) => {
    const { name, category } = edits[k];
    const esc = (s) => String(s).replace(/"/g, '\\"');
    return `  "${esc(k)}": ["${esc(name)}", "${esc(category)}"],`;
  });
  const block =
    "// ── Folded-in corrections from the spreadsheet (" + new Date().toISOString().slice(0, 10) + ") ──\n" +
    "// Paste these entries into the MERCHANT_BANK object in merchant_bank.js,\n" +
    "// then commit. Existing keys with the same name are overrides.\n" +
    lines.join("\n");
  // Show in a textarea overlay for easy copy.
  const box = $("#rulesBox");
  box.value = block;
  $all(".tab-btn").forEach((b) => b.classList.remove("active"));
  $all(".tab-panel").forEach((p) => p.classList.remove("active"));
  document.querySelector('.tab-btn[data-tab="settings"]').classList.add("active");
  $("#tab-settings").classList.add("active");
  alert(`Generated ${keys.length} merchant entries in the Settings box below — copy into merchant_bank.js and commit.`);
}

// ---- Transactions table ------------------------------------------------
function renderTransactionsTable() {
  const tbody = $("#txTable tbody");
  tbody.innerHTML = "";
  STATE.transactions
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .forEach((t) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHtml(t.date)}</td><td>${escapeHtml(t.description)}</td><td>${escapeHtml(t.category)}</td><td class="num ${t.amount < 0 ? "neg" : "pos"}">${t.amount.toFixed(2)}</td><td>${t.source}</td>`;
      tbody.appendChild(tr);
    });
}

// ---- Rules editor ---------------------------------------------------
function renderRulesEditor() {
  $("#rulesBox").value = JSON.stringify(Categorize.getRules(), null, 2);
}

function saveRules() {
  try {
    const rules = JSON.parse($("#rulesBox").value);
    Categorize.setRules(rules);
    saveToDrive();
    alert("Category rules saved.");
  } catch {
    alert("That's not valid JSON — check for a stray comma or bracket.");
  }
}

// ---- Dashboard --------------------------------------------------------
function renderDashboard() {
  const byMonth = Dashboard.summarize(STATE.transactions);
  Dashboard.renderSpendVsSave(byMonth);

  const months = Object.keys(byMonth).filter((m) => m !== "unknown").sort();
  const latest = months[months.length - 1];
  const byCat = Dashboard.categoryBreakdown(STATE.transactions, latest);
  Dashboard.renderCategoryBreakdown(byCat);

  const invBox = $("#investSummary");
  if (STATE.navHistory.length) {
    const last = STATE.navHistory[STATE.navHistory.length - 1];
    const ret = Dashboard.investmentReturn(last.nav);
    if (ret) {
      const parts = [`NAV ${ret.start.toFixed(2)} → ${ret.end.toFixed(2)} (${ret.change >= 0 ? "+" : ""}${ret.change.toFixed(2)})`];
      if (ret.twrPct !== null && !isNaN(ret.twrPct)) parts.push(`time-weighted return ${ret.twrPct.toFixed(2)}%`);
      if (ret.netFlowsMTD) parts.push(`net deposits/withdrawals this month: ${ret.netFlowsMTD >= 0 ? "+" : ""}${ret.netFlowsMTD.toFixed(2)}`);
      invBox.textContent = "Last import — " + parts.join(", ") + ".";
    } else {
      invBox.textContent = "This IBKR file didn't include a Change in NAV section — export an Activity Statement or Flex Query that includes it to see return figures here.";
    }
  } else {
    invBox.textContent = "No IBKR data imported yet.";
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---- Init ---------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initAuth();
  initUploads();
  $("#commitReviewBtn").addEventListener("click", commitReview);
  $("#saveRulesBtn").addEventListener("click", saveRules);
  const syncBtn = $("#syncSheetBtn");
  if (syncBtn) syncBtn.addEventListener("click", syncFromSheet);
  const exportBtn = $("#exportMerchantsBtn");
  if (exportBtn) exportBtn.addEventListener("click", generateMerchantBankExport);
});
