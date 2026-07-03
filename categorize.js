// ── Categorization ─────────────────────────────────────────────
// Category scheme: Monzo's standard categories (Eating out, Groceries,
// Transport, Shopping, Entertainment, Bills, Personal care, Holidays,
// Gifts, Charity, Family, Finances, Savings, Income, Transfers, Cash),
// plus two tracker-specific ones: "Internal Transfer" (own-account moves,
// excluded from dashboards) and "Advertising" (Facebook/BJAR ad spend).
// Two layers, in order:
//  1. Keyword rules — transparent, editable in Settings, first priority.
//  2. A Naive Bayes classifier over description tokens. It ships
//     PRE-TRAINED on 354 hand-labelled transactions from the person's
//     manual Finances spreadsheet (mapped to the Monzo scheme), and
//     keeps learning from every category set or corrected in review.

const DEFAULT_RULES = [
  { category: "Eating out", keywords: ["restaurant", "cafe", "café", "coffee", "grill", "pub", "wok express", "astwood arms", "hog penny", "devil's isle", "devils isle", "pickled onion", "jamaican", "lunch wagon", "front yard", "terrace", "misaki", "lemongrass", "trattoria", "baan thai", "fish & tings", "ruby murrys", "deja view", "trini spice", "mr chicken", "rosewood", "paraquet", "delicious", "yardie kitchen", "nando", "brewdog", "kfc", "the botanist", "deliveroo", "just eat", "uber eats", "uber *eats", "foodhub", "takeaway", "bermuda pie", "market halls"] },
  { category: "Groceries", keywords: ["lindo", "supermart", "miles market", "marketplace", "market place", "shopping centre", "c-mart", "east end variety", "belvin", "harrington hundreds", "heron bay", "tesco", "sainsbury", "aldi", "lidl", "arnold"] },
  { category: "Transport", keywords: ["uber", "voi", "bus", "ferry", "taxi", "esso", "rubis", "shell", "fuel", "petrol", "gas station", "service station", "buzz", "trainline", "tfl", "national express"] },
  { category: "Holidays", keywords: ["airbnb", "hotel", "fairmont", "grotto bay", "rosedon", "resort", "airline", "airways", "cruise", "intrepid", "bermuda tix"] },
  { category: "Entertainment", keywords: ["cinema", "theatre", "curzon", "vue", "museum", "netflix", "spotify", "amazon prime", "disney", "crunchyroll", "capcut", "speciality movies"] },
  { category: "Bills", keywords: ["belco", "watlington", "ovo energy", "thames water", "cigna", "one communications", "digicel", "icloud", "apple.com/bill", "openai", "chatgpt", "anthropic", "claude", "canva"] },
  { category: "Personal care", keywords: ["pharmacy", "dry cleaner", "barber", "salon", "just shirts", "clinic", "dental", "doctor"] },
  { category: "Shopping", keywords: ["tk maxx", "primark", "zara", "uniqlo", "amazon.co", "ptech"] },
  { category: "Savings", keywords: ["ibkr", "interactive brokers", "voo"] },
  { category: "Income", keywords: ["salary", "payroll", "bermuda monetary", "bma invoice", "credit interest"] },
  { category: "Finances", keywords: ["service charge", "atm fee", "overdraft", "fx fee", "account fee", "commission", "bk chg", "savings account fee", "service fee", "tax comm", "monzo perks"] },
  { category: "Advertising", keywords: ["facebk", "facebook ads", "meta ads", "google ads"] },
  { category: "Gifts", keywords: ["interflora", "florist"] },
  { category: "Charity", keywords: ["red cr", "charity", "donation"] },
];

// Naive Bayes model pre-trained on the person's own labelled history,
// mapped to the Monzo scheme. Token/category counts only.
const PRETRAINED_MODEL = {"tokenCats": {"VOI": {"Transport": 2}, "UBER": {"Transport": 6}, "AND": {"Shopping": 1, "Eating out": 3, "Family": 6, "Holidays": 1}, "MARKS": {"Shopping": 1}, "SPENCER": {"Shopping": 1}, "IBKR": {"Savings": 2, "Transfers": 4}, "BUS": {"Transport": 3, "Family": 6}, "OMNIA": {"Entertainment": 1}, "CHIANG": {"Eating out": 1}, "MAI": {"Eating out": 1}, "AWAKE": {"Eating out": 1}, "COFFEE": {"Eating out": 1}, "WIDE": {"Eating out": 1}, "CLUB": {"Eating out": 1, "Entertainment": 1}, "M&S": {"Eating out": 4}, "STORAGE": {"Bills": 1}, "ICLOUD": {"Bills": 1}, "COMMISSION": {"Finances": 4}, "TRANSFER": {"Finances": 4, "Transfers": 8, "Family": 1}, "NANDO'S": {"Eating out": 3}, "MAXX": {"Shopping": 2}, "VIDEO": {"Entertainment": 3}, "PRIME": {"Entertainment": 8}, "AMAZON": {"Entertainment": 8, "Gifts": 4}, "SERVICE": {"Finances": 1, "Transport": 3, "Income": 1}, "FEE": {"Finances": 1, "Transport": 1}, "CURZON": {"Entertainment": 1}, "GEORGINA'S": {"Eating out": 1}, "YOUR": {"Shopping": 1}, "OUR": {"Shopping": 1}, "PROBLEM": {"Shopping": 1}, "DOLLAR": {"Shopping": 1}, "SAINSBURY'S": {"Eating out": 11}, "BRANCA": {"Eating out": 1}, "MOVING": {"Transport": 1}, "THE": {"Eating out": 6, "Finances": 2}, "ALCHEMIST": {"Eating out": 1}, "VUE": {"Entertainment": 1}, "GREENE": {"Eating out": 1}, "KING": {"Eating out": 1}, "TURF": {"Eating out": 1}, "TAVERN": {"Eating out": 1}, "NETFLIX": {"Entertainment": 4}, "NERO": {"Eating out": 1}, "CAFFE": {"Eating out": 1}, "PRIMARK": {"Shopping": 1}, "DELIVEROO": {"Eating out": 5}, "DAY": {"Entertainment": 1}, "PUNTING": {"Entertainment": 1}, "TRAINLINE": {"Transport": 3}, "HSBC": {"Finances": 6}, "DELICIOUS": {"Eating out": 9}, "CAF": {"Eating out": 4}, "OPERA": {"Eating out": 1}, "TFL": {"Transport": 14}, "DATACAMP": {"Bills": 1}, "OVO": {"Bills": 4}, "ENERGY": {"Bills": 4}, "BREWDOG": {"Eating out": 2}, "WATER": {"Bills": 2}, "THAMES": {"Bills": 2}, "JOE": {"Eating out": 1}, "JUICE": {"Eating out": 1}, "IGNITE": {"Entertainment": 1}, "TRIBE": {"Entertainment": 1}, "MARKET": {"Eating out": 4, "Groceries": 6}, "HALLS": {"Eating out": 2}, "CAMINO": {"Eating out": 1}, "FOOD": {"Eating out": 1, "Family": 6}, "PECKHAM": {"Eating out": 1}, "HALL": {"Eating out": 1}, "RAG": {"Personal care": 1}, "FOODMARKET": {"Eating out": 1}, "SOUTHBANK": {"Eating out": 1}, "CAMINA": {"Eating out": 1}, "YARD": {"Entertainment": 1, "Eating out": 2}, "ROOM": {"Entertainment": 1}, "COAT": {"Entertainment": 1}, "STEEL": {"Entertainment": 1}, "GAIL'S": {"Eating out": 1}, "MONZO": {"Finances": 6, "Income": 1, "Transfers": 2}, "PERKS": {"Finances": 6}, "BDAY": {"Gifts": 1}, "RAIYAN": {"Gifts": 1}, "IMFX": {"Bills": 1}, "FORECASTING": {"Bills": 1}, "MACRO": {"Bills": 1}, "TESCO": {"Eating out": 1}, "OPENAI": {"Bills": 5}, "JELLYCAT": {"Gifts": 1}, "JOHN": {"Gifts": 1}, "LEWIS": {"Gifts": 1}, "STEEN": {"Eating out": 1}, "OLE": {"Eating out": 1}, "APPLE": {"Entertainment": 4, "Bills": 4, "Holidays": 1}, "PLUS": {"Entertainment": 5}, "DISNEY": {"Entertainment": 5}, "NATIONAL": {"Transport": 2}, "EXPRESS": {"Transport": 2, "Eating out": 3}, "MERCATO": {"Eating out": 1}, "METRO": {"Eating out": 1}, "SHOYU": {"Eating out": 1}, "STREET": {"Eating out": 2}, "BLANK": {"Eating out": 2}, "AIRWAYS": {"Holidays": 2}, "BRITISH": {"Holidays": 2}, "SUSHI": {"Eating out": 1}, "PAGET": {"Transport": 3, "Entertainment": 1}, "STATION": {"Transport": 3}, "SPICE": {"Eating out": 4}, "TRINI": {"Eating out": 4}, "COMMUNICATIONS": {"Bills": 3}, "ONE": {"Bills": 3}, "CREE": {"Eating out": 1}, "LUNCH": {"Eating out": 1, "Gifts": 2}, "INDIO": {"Eating out": 1}, "BIKE": {"Transfers": 1}, "PATRIK": {"Transfers": 1}, "CLARENDON": {"Eating out": 5}, "PHARAMACY": {"Eating out": 5}, "LUXURY": {"Personal care": 1}, "CUTS": {"Personal care": 1}, "GAS": {"Eating out": 4}, "WARWICK": {"Eating out": 4}, "BREW": {"Eating out": 2}, "SHOPPING": {"Eating out": 7}, "CENTER": {"Eating out": 7}, "BUZZ": {"Eating out": 1}, "NANA": {"Family": 9}, "DOCTOR": {"Family": 6}, "LATTE'S": {"Eating out": 3}, "SPOTIFY": {"Entertainment": 4}, "PLACE": {"Groceries": 6}, "DEJA": {"Eating out": 2}, "VIEW": {"Eating out": 2, "Entertainment": 1}, "EDE": {"Gifts": 1}, "RANVENSCROFT": {"Gifts": 1}, "LINDO'S": {"Groceries": 9}, "HOG": {"Eating out": 1}, "PENNY": {"Eating out": 1}, "MOMA": {"Family": 1}, "REPAYMENT": {"Family": 2}, "MOM": {"Family": 3}, "BAY": {"Groceries": 3, "Eating out": 1}, "HERON": {"Groceries": 3}, "CHURCH": {"Gifts": 1}, "TICKETS": {"Gifts": 1}, "RAFFLE": {"Gifts": 1}, "REPAY": {"Transfers": 2}, "VINCENT": {"Transfers": 1, "Holidays": 6}, "AUNTY": {"Transfers": 1}, "KFC": {"Eating out": 2}, "HOUSE": {"Eating out": 1, "Gifts": 1}, "PIZZA": {"Eating out": 1, "Holidays": 1}, "SHELLY": {"Eating out": 1}, "HAMITLON": {"Eating out": 2}, "PRINCESS": {"Eating out": 2}, "BOUNDARY": {"Eating out": 1}, "RUBIS": {"Transport": 3}, "EAST": {"Transport": 3}, "BROADWAY": {"Transport": 3}, "JC'S": {"Eating out": 3}, "COMMISSIONER": {"Finances": 2}, "TAX": {"Finances": 2}, "OFFICE": {"Finances": 2}, "BOYLE": {"Personal care": 1}, "SON": {"Personal care": 1}, "ACGL": {"Savings": 1}, "VOO": {"Savings": 2}, "GPASS": {"Entertainment": 1}, "WOK": {"Eating out": 3}, "ELECTRICITY": {"Family": 1}, "CASH": {"Entertainment": 2}, "FOODHUB": {"Eating out": 1}, "ISLE": {"Eating out": 3}, "DEVILE'S": {"Eating out": 1}, "BOTANIST": {"Eating out": 2}, "SPECIALITY": {"Entertainment": 2}, "CINEMA": {"Entertainment": 2}, "JAMAICAN": {"Eating out": 1}, "GRILL": {"Eating out": 1}, "RITE": {"Groceries": 1}, "PRICE": {"Groceries": 1}, "SYDNEY": {"Gifts": 3}, "RACE": {"Gifts": 1}, "EASYJET": {"Holidays": 1}, "DELTA": {"Holidays": 1}, "AIRBNB": {"Holidays": 1}, "BOOKING": {"Holidays": 1}, "COM": {"Holidays": 1}, "QUEEN": {"Eating out": 1}, "ICE": {"Eating out": 1}, "PROTECTION": {"Income": 1}, "DEPOSIT": {"Income": 1}, "LEMONGRASS": {"Eating out": 2}, "HOTEL": {"Family": 2, "Holidays": 1}, "HARRY'S": {"Eating out": 1}, "CARL": {"Finances": 2}, "CHATHAM": {"Gifts": 1}, "MTA": {"Holidays": 2}, "HOLIDAYINN": {"Holidays": 1}, "XIO": {"Holidays": 1}, "XIANG": {"Holidays": 1}, "NAN": {"Holidays": 1}, "LONG": {"Holidays": 1}, "DUANE": {"Holidays": 1}, "READE": {"Holidays": 1}, "UTOPIA": {"Holidays": 1}, "BAGELS": {"Holidays": 1}, "ATM": {"Holidays": 1}, "COUNTRY": {"Holidays": 1}, "HILL": {"Holidays": 1}, "JOE'S": {"Holidays": 1}, "50TH": {"Holidays": 1}, "TOLOACHE": {"Holidays": 1}, "DIAMOND": {"Holidays": 1}, "CASTLE": {"Holidays": 1}, "CANVA": {"Entertainment": 2}, "GAME": {"Finances": 1}, "PTECH": {"Shopping": 2}, "DEVIL'S": {"Eating out": 2}, "VISTA": {"Eating out": 1}, "BELLA": {"Eating out": 1}, "FLANAGANS": {"Eating out": 1}, "IRISH": {"Eating out": 1}, "PUB": {"Eating out": 1}, "TRATTORIA": {"Eating out": 1}, "NVDA": {"Savings": 1}, "SUPERMART": {"Groceries": 1}, "DAVID": {"Gifts": 1}, "ROSE": {"Gifts": 1}, "GOVT": {"Savings": 1}, "META": {"Savings": 1}, "UNIPOWERSKILLS": {"Transfers": 1}, "OCEAN": {"Entertainment": 1}, "GOLF": {"Entertainment": 1}, "FRONT": {"Eating out": 2}, "BERMUDA": {"Eating out": 2, "Gifts": 1}, "BISTRO": {"Eating out": 2}, "MILES": {"Eating out": 2}, "VARIETY": {"Eating out": 1}, "CHAMP'S": {"Eating out": 1}, "GBP": {"Transfers": 2}, "PURCHASE": {"Transfers": 1}, "RECEIPT": {"Transfers": 1}, "SGOV": {"Savings": 1}, "NEAR": {"Savings": 1}, "DIVIDENDS": {"Savings": 1}, "STORE": {"Gifts": 1}, "BOOK": {"Gifts": 1}, "CHICKEN": {"Eating out": 1}, "TABS": {"Gifts": 1}, "STOCKHOLM": {"Holidays": 1}, "FLIGHTS": {"Holidays": 1}, "CAPCUT": {"Entertainment": 2}, "JOR": {"Eating out": 1}, "JAY'S": {"Eating out": 1}, "TAKEOUT": {"Eating out": 1}, "CLARABELL'S": {"Eating out": 1}, "JUST": {"Personal care": 2}, "SHIRTS": {"Personal care": 2}, "DRY": {"Personal care": 2}, "CLEANER": {"Personal care": 2}, "IREN": {"Savings": 1}, "NBIS": {"Savings": 1}, "INC": {"Bills": 1}, "MAGOOSH": {"Bills": 1}}, "catDocs": {"Transport": 37, "Shopping": 7, "Savings": 12, "Entertainment": 38, "Eating out": 124, "Bills": 22, "Finances": 22, "Personal care": 5, "Gifts": 16, "Holidays": 22, "Transfers": 14, "Family": 13, "Groceries": 20, "Income": 2}, "totalDocs": 354};

const Categorize = (() => {
  let rules = DEFAULT_RULES;
  let model = clonePretrained();
  const CONFIDENCE_MIN = 0.65;

  function clonePretrained() {
    const m = JSON.parse(JSON.stringify(PRETRAINED_MODEL));
    m.pretrainedIncluded = true;
    m.schemeVersion = "monzo-v1";
    return m;
  }

  function setRules(r) { rules = r && r.length ? r : DEFAULT_RULES; }
  function getRules() { return rules; }

  // Saved models from the earlier detailed scheme are replaced rather
  // than merged — their category names no longer exist in this scheme,
  // and mixing schemes would corrupt predictions.
  function setModel(m) {
    if (!m || !m.tokenCats || m.schemeVersion !== "monzo-v1") {
      model = clonePretrained();
      return;
    }
    model = m;
  }
  function getModel() { return model; }

  function tokenize(description) {
    return String(description || "")
      .toUpperCase()
      .replace(/[^A-Z0-9'&\s]/g, " ")
      .split(/\s+/)
      .filter((t) =>
        t.length >= 3 &&
        !/^\d+$/.test(t) &&
        !/^[A-Z]{2}\d{4,}/.test(t) &&
        !/^REF$/.test(t) &&
        !/^\d{1,2}[A-Z]{3}\d{0,4}$/.test(t)
      );
  }

  function learn(description, category) {
    if (!category || category === "Uncategorized") return;
    const tokens = new Set(tokenize(description));
    if (!tokens.size) return;
    model.catDocs[category] = (model.catDocs[category] || 0) + 1;
    model.totalDocs += 1;
    for (const t of tokens) {
      if (!model.tokenCats[t]) model.tokenCats[t] = {};
      model.tokenCats[t][category] = (model.tokenCats[t][category] || 0) + 1;
    }
  }

  function predictLearned(description) {
    const cats = Object.keys(model.catDocs);
    if (cats.length < 2) return null;
    const tokens = tokenize(description);
    if (!tokens.length) return null;
    if (!tokens.some((t) => model.tokenCats[t])) return null;

    const vocabSize = Object.keys(model.tokenCats).length || 1;
    const logScores = {};
    for (const c of cats) {
      let score = Math.log((model.catDocs[c] + 1) / (model.totalDocs + cats.length));
      for (const t of tokens) {
        const tokenCount = (model.tokenCats[t] && model.tokenCats[t][c]) || 0;
        score += Math.log((tokenCount + 1) / (model.catDocs[c] + vocabSize));
      }
      logScores[c] = score;
    }
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
