// ── Dashboard ──────────────────────────────────────────────────

const Dashboard = (() => {
  let spendChart, categoryChart, investChart;

  function monthKey(dateStr) {
    const d = parseFlexibleDate(dateStr);
    if (!d) return "unknown";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function parseFlexibleDate(str) {
    if (!str) return null;
    // ISO (Monzo, IBKR) or "12 JAN" (HSBC, needs a year hint)
    const iso = new Date(str);
    if (!isNaN(iso)) return iso;
    return null;
  }

  function summarize(transactions) {
    const byMonth = {};
    transactions.forEach((t) => {
      const mk = monthKey(t.date);
      if (!byMonth[mk]) byMonth[mk] = { income: 0, spend: 0, net: 0 };
      if (t.amount >= 0) byMonth[mk].income += t.amount;
      else byMonth[mk].spend += Math.abs(t.amount);
      byMonth[mk].net += t.amount;
    });
    return byMonth;
  }

  function categoryBreakdown(transactions, month) {
    const byCat = {};
    transactions
      .filter((t) => t.amount < 0 && (!month || monthKey(t.date) === month))
      .forEach((t) => {
        byCat[t.category || "Uncategorized"] = (byCat[t.category || "Uncategorized"] || 0) + Math.abs(t.amount);
      });
    return byCat;
  }

  // Simple return approximation: (endNAV - startNAV - netFlows) / startNAV
  // Good enough for a monthly personal dashboard; not a substitute for
  // IBKR's own TWR report if you need precision.
  function investmentReturn(navRows) {
    if (!navRows || navRows.length < 1) return null;
    const start = parseFloat(navRows[0]["Starting Value"] || navRows[0]["Total"] || 0);
    const end = parseFloat(navRows[0]["Ending Value"] || navRows[0]["Total"] || 0);
    const deposits = parseFloat(navRows[0]["Deposits & Withdrawals"] || 0);
    if (!start) return null;
    const pnl = end - start - deposits;
    return { start, end, deposits, pnl, returnPct: (pnl / start) * 100 };
  }

  function renderSpendVsSave(byMonth) {
    const months = Object.keys(byMonth).filter((m) => m !== "unknown").sort();
    const ctx = document.getElementById("spendChart");
    if (spendChart) spendChart.destroy();
    spendChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: months,
        datasets: [
          { label: "Income", data: months.map((m) => byMonth[m].income), backgroundColor: "#2F6F6B" },
          { label: "Spend", data: months.map((m) => byMonth[m].spend), backgroundColor: "#B5533C" },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } },
    });
  }

  function renderCategoryBreakdown(byCat) {
    const ctx = document.getElementById("categoryChart");
    if (categoryChart) categoryChart.destroy();
    const palette = ["#2F6F6B", "#B5533C", "#C9A15A", "#5B7C99", "#8A6BAF", "#5A5A5A", "#3E8E7E", "#C97A50"];
    categoryChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: Object.keys(byCat),
        datasets: [{ data: Object.values(byCat), backgroundColor: palette }],
      },
      options: { responsive: true, plugins: { legend: { position: "right" } } },
    });
  }

  return { summarize, categoryBreakdown, investmentReturn, renderSpendVsSave, renderCategoryBreakdown, monthKey };
})();
