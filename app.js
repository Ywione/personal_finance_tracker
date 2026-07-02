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
  const [tx, rules, inv] = await Promise.all([
    DriveStore.readJSON(LEDGER_CONFIG.FILES.transactions, []),
    DriveStore.readJSON(LEDGER_CONFIG.FILES.rules, DEFAULT_RULES),
    DriveStore.readJSON(LEDGER_CONFIG.FILES.investments, []),
  ]);
  STATE.transactions = tx;
  STATE.navHistory = inv;
  Categorize.setRules(rules);
  renderRulesEditor();
  renderTransactionsTable();
  renderDashboard();
}

async function saveToDrive() {
  await Promise.all([
    DriveStore.writeJSON(LEDGER_CONFIG.FILES.transactions, STATE.transactions),
    DriveStore.writeJSON(LEDGER_CONFIG.FILES.rules, Categorize.getRules()),
    DriveStore.writeJSON(LEDGER_CONFIG.FILES.investments, STATE.navHistory),
  ]);
}

// ---- Upload → parse → review pipeline --------------------------------
function initUploads() {
  $("#monzoFile").addEventListener("change", async (e) => {
    const text = await e.target.files[0].text();
    queueReview(Categorize.applyTo(Parsers.monzo(text)));
  });

  $("#ibkrFile").addEventListener("change", async (e) => {
    const text = await e.target.files[0].text();
    const result = Parsers.ibkr(text);
    queueReview(Categorize.applyTo(result.transactions));
    if (result.nav && result.nav.length) {
      STATE.navHistory.push({ importedAt: new Date().toISOString(), nav: result.nav });
    }
  });

  $("#hsbcFile").addEventListener("change", async (e) => {
    const buf = await e.target.files[0].arrayBuffer();
    let customRe = null;
    const custom = $("#hsbcRegex").value.trim();
    if (custom) {
      try { customRe = new RegExp(custom, "gm"); } catch { alert("Invalid custom regex, using default."); }
    }
    const rows = await Parsers.hsbc(buf, customRe);
    if (!rows.length) {
      alert("No transactions matched. Open Settings and adjust the HSBC line pattern to match your statement's layout, then try again.");
    }
    queueReview(Categorize.applyTo(rows));
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
  STATE.transactions = STATE.transactions.concat(STATE.pendingReview);
  STATE.pendingReview = [];
  renderReviewTable();
  renderTransactionsTable();
  await saveToDrive();
  renderDashboard();
  alert("Saved to your private Drive folder.");
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
    invBox.textContent = ret
      ? `Last import: NAV ${ret.start.toFixed(2)} → ${ret.end.toFixed(2)}, net flows ${ret.deposits.toFixed(2)}, P&L ${ret.pnl.toFixed(2)} (${ret.returnPct.toFixed(2)}%)`
      : "Import an IBKR Flex Query with a Change in NAV section to see return figures here.";
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
});
