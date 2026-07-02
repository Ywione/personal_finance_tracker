// ── Categorization ─────────────────────────────────────────────
// Two layers, in order:
//  1. Keyword rules — transparent, editable in Settings, first priority.
//  2. A learned Naive Bayes classifier over description tokens, trained
//     on YOUR corrections: every category you set or fix in the review
//     table updates a word→category probability model (stored privately
//     in Drive alongside your transactions). Unknown merchants start as
//     Uncategorized, you label them once, and from then on they're
//     recognized automatically — including fuzzy variants OCR produces.

const DEFAULT_RULES = [
  { category: "Groceries", keywords: ["lindo", "supermart", "miles market", "marketplace", "market place", "shopping centre", "c-mart", "east end variety", "belvin", "harrington hundreds", "tesco", "sainsbury", "aldi", "lidl", "arnold"] },
  { category: "Dining", keywords: ["restaurant", "cafe", "coffee", "grill", "pub", "wok express", "astwood arms", "hog penny", "devil's isle", "devils isle", "pickled onion", "jamaican", "lunch wagon", "front yard", "terrace", "misaki", "lemongrass", "trattoria", "baan thai", "fish & tings", "ruby murrys", "deja view", "trini spice", "mr chicken", "rosewood", "paraquet", "delicious", "yardie kitchen", "deliveroo", "just eat", "uber eats", "uber *eats", "foodhub", "takeaway", "bermuda pie"] },
  { category: "Transport", keywords: ["uber", "bus", "ferry", "taxi", "esso", "rubis", "shell", "fuel", "petrol", "gas station", "service station", "buzz"] },
  { category: "Housing", keywords: ["rent", "mortgage", "belco", "watlington", "water", "hydro", "flooring"] },
  { category: "Utilities & Telecom", keywords: ["one communications", "digicel", "logic", "vodafone", "ee ", "o2"] },
  { category: "Subscriptions", keywords: ["netflix", "spotify", "apple.com/bill", "amazon prime", "icloud", "crunchyroll", "openai", "chatgpt", "anthropic", "claude", "speciality movies", "signup *", "cigna"] },
  { category: "Health", keywords: ["pharmacy", "clinic", "hospital", "dental", "doctor", "clyde best doc"] },
  { category: "Travel", keywords: ["airbnb", "hotel", "fairmont", "grotto bay", "rosedon", "resort", "airline", "airways", "bermuda tix", "intrepid", "cruise"] },
  { category: "Investing", keywords: ["ibkr", "interactive brokers"] },
  { category: "Income", keywords: ["salary", "payroll", "bermuda monetary", "bma invoice", "credit interest"] },
  { category: "Fees", keywords: ["service charge", "atm fee", "overdraft", "fx fee", "account fee", "commission", "bk chg"] },
  { category: "Advertising", keywords: ["facebk", "facebook ads", "meta ads", "google ads"] },
  { category: "Gifts & Flowers", keywords: ["interflora", "florist", "gift"] },
  { category: "Government & Tax", keywords: ["tax comm", "government", "gov't", "customs"] },
  { category: "Charity", keywords: ["red cr", "charity", "donation"] },
];

const Categorize = (() => {
  let rules = DEFAULT_RULES;

  // Naive Bayes model: token → per-category counts, plus category totals.
  // Small, human-inspectable JSON; lives in your Drive appData folder.
  let model = { tokenCats: {}, catDocs: {}, totalDocs: 0 };
  const CONFIDENCE_MIN = 0.65; // only auto-apply learned predictions when reasonably sure

  function setRules(r) { rules = r && r.length ? r : DEFAULT_RULES; }
  function getRules() { return rules; }
  function setModel(m) { if (m && m.tokenCats) model = m; }
  function getModel() { return model; }

  // Tokenizer tuned for bank-statement text: drops REF codes, card/txn
  // codes (BM123456USD), pure numbers, dates, and short noise tokens.
  function tokenize(description) {
    return String(description || "")
      .toUpperCase()
      .replace(/[^A-Z0-9'&\s]/g, " ")
      .split(/\s+/)
      .filter((t) =>
        t.length >= 3 &&
        !/^\d+$/.test(t) &&
        !/^[A-Z]{2}\d{4,}/.test(t) &&      // BM915537USD-style codes
        !/^REF$/.test(t) &&
        !/^\d{1,2}[A-Z]{3}\d{0,4}$/.test(t) // 14MAR / 14MAR2026 dates
      );
  }

  function learn(description, category) {
    if (!category || category === "Uncategorized") return;
    const tokens = new Set(tokenize(description)); // presence, not frequency
    if (!tokens.size) return;
    model.catDocs[category] = (model.catDocs[category] || 0) + 1;
    model.totalDocs += 1;
    for (const t of tokens) {
      if (!model.tokenCats[t]) model.tokenCats[t] = {};
      model.tokenCats[t][category] = (model.tokenCats[t][category] || 0) + 1;
    }
  }

  // Multinomial Naive Bayes with Laplace smoothing, returning the top
  // category and a normalized confidence. Two guards keep it honest:
  // it stays silent until it has seen at least two distinct categories
  // (with one, softmax degenerates to predicting it for everything),
  // and it only predicts when the description shares at least one token
  // with something it was actually trained on.
  function predictLearned(description) {
    const cats = Object.keys(model.catDocs);
    if (cats.length < 2) return null;
    const tokens = tokenize(description);
    if (!tokens.length) return null;
    if (!tokens.some((t) => model.tokenCats[t])) return null;

    const vocabSize = Object.keys(model.tokenCats).length || 1;
    const logScores = {};
    for (const c of cats) {
      let score = Math.log((model.catDocs[c] + 1) / (model.totalDocs + cats.length)); // prior
      for (const t of tokens) {
        const tokenCount = (model.tokenCats[t] && model.tokenCats[t][c]) || 0;
        score += Math.log((tokenCount + 1) / (model.catDocs[c] + vocabSize));
      }
      logScores[c] = score;
    }
    // softmax-normalize log scores into a confidence
    const maxLog = Math.max(...Object.values(logScores));
    let sum = 0;
    const expd = {};
    for (const c of cats) { expd[c] = Math.exp(logScores[c] - maxLog); sum += expd[c]; }
    let best = null, bestP = 0;
    for (const c of cats) {
      const p = expd[c] / sum;
      if (p > bestP) { bestP = p; best = c; }
    }
    return bestP >= CONFIDENCE_MIN ? { category: best, confidence: bestP } : null;
  }

  function categorize(description) {
    const d = (description || "").toLowerCase();
    for (const rule of rules) {
      if (rule.keywords.some((k) => d.includes(k.toLowerCase()))) return rule.category;
    }
    const learned = predictLearned(description);
    if (learned) return learned.category;
    return "Uncategorized";
  }

  function applyTo(transactions) {
    return transactions.map((t) => ({
      ...t,
      category: t.category && t.category !== "" ? t.category : categorize(t.description),
    }));
  }

  return { setRules, getRules, setModel, getModel, categorize, applyTo, learn, tokenize, DEFAULT_RULES };
})();
