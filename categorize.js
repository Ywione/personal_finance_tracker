// ── Categorization ─────────────────────────────────────────────
// Simple, transparent keyword rules rather than a black-box model —
// easy to audit and correct, which matters more than cleverness for
// your own money. Rules are stored in Drive so they persist and
// you can edit them from the Settings tab.

const DEFAULT_RULES = [
  { category: "Groceries", keywords: ["lindos", "supermart", "miles market", "marketplace", "tesco", "sainsbury", "aldi", "lidl"] },
  { category: "Transport", keywords: ["uber", "bus", "ferry", "taxi", "esso", "shell", "fuel", "petrol"] },
  { category: "Dining", keywords: ["restaurant", "cafe", "coffee", "takeaway", "deliveroo", "just eat", "uber eats"] },
  { category: "Housing", keywords: ["rent", "mortgage", "belco", "watlington", "water", "hydro"] },
  { category: "Subscriptions", keywords: ["netflix", "spotify", "apple.com/bill", "amazon prime", "icloud"] },
  { category: "Investing", keywords: ["ibkr", "interactive brokers", "transfer to ibkr"] },
  { category: "Income", keywords: ["salary", "payroll", "bma"] },
  { category: "Fees", keywords: ["service charge", "atm fee", "overdraft", "fx fee"] },
];

const Categorize = (() => {
  let rules = DEFAULT_RULES;

  function setRules(r) {
    rules = r && r.length ? r : DEFAULT_RULES;
  }

  function getRules() {
    return rules;
  }

  function categorize(description) {
    const d = (description || "").toLowerCase();
    for (const rule of rules) {
      if (rule.keywords.some((k) => d.includes(k.toLowerCase()))) {
        return rule.category;
      }
    }
    return "Uncategorized";
  }

  function applyTo(transactions) {
    return transactions.map((t) => ({
      ...t,
      category: t.category && t.category !== "" ? t.category : categorize(t.description),
    }));
  }

  return { setRules, getRules, categorize, applyTo, DEFAULT_RULES };
})();
