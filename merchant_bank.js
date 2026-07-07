// ── Merchant bank ──────────────────────────────────────────────
// Canonical merchant names + categories, seeded from the person's
// manual Finances spreadsheet and the Bermuda merchants observed in
// their HSBC statements. Maps a distinctive lowercase substring of a
// (cleaned) transaction description to a clean display name and a
// default category. Longer keys are matched first so specific names
// win over generic ones (e.g. 'clarendon pharmacy' before 'pharmacy').
// Committed to the repo so canonicalisation ships with the app and
// can be extended over time.
const MERCHANT_BANK = {
  "astwood arms": [
    "Astwood Arms",
    "Eating out"
  ],
  "hog penny": [
    "Hog Penny",
    "Eating out"
  ],
  "devil's isle": [
    "Devil's Isle",
    "Eating out"
  ],
  "devils isle": [
    "Devil's Isle",
    "Eating out"
  ],
  "pickled onion": [
    "Pickled Onion & Brew",
    "Eating out"
  ],
  "wok express": [
    "Wok Express",
    "Eating out"
  ],
  "jor-jay": [
    "Jor-Jay's Lunch Wagon",
    "Eating out"
  ],
  "jamaican grill": [
    "Jamaican Grill",
    "Eating out"
  ],
  "the terrace": [
    "The Terrace",
    "Eating out"
  ],
  "front yard": [
    "The Front Yard",
    "Eating out"
  ],
  "misaki": [
    "Misaki",
    "Eating out"
  ],
  "lemongrass": [
    "Lemongrass",
    "Eating out"
  ],
  "baan thai": [
    "Baan Thai Restaurant",
    "Eating out"
  ],
  "fish & tings": [
    "Fish & Tings",
    "Eating out"
  ],
  "fish and tings": [
    "Fish & Tings",
    "Eating out"
  ],
  "ruby murrys": [
    "Ruby Murrys",
    "Eating out"
  ],
  "deja view": [
    "Deja View",
    "Eating out"
  ],
  "trini spice": [
    "Trini Spice",
    "Eating out"
  ],
  "wide awake": [
    "Wide Awake Club",
    "Eating out"
  ],
  "flanagan": [
    "Flanagan's Irish Pub",
    "Eating out"
  ],
  "bermuda pie": [
    "Bermuda Pie Company",
    "Eating out"
  ],
  "clyde best doc": [
    "Clyde Best Documentary",
    "Entertainment"
  ],
  "delicious": [
    "Delicious",
    "Eating out"
  ],
  "yardie": [
    "Yardie Kitchen",
    "Eating out"
  ],
  "harbourview": [
    "Harbourview Front St",
    "Eating out"
  ],
  "the botanist": [
    "The Botanist Cafe",
    "Eating out"
  ],
  "trattoria": [
    "La Trattoria",
    "Eating out"
  ],
  "paraquet": [
    "Paraquet Restaurant",
    "Eating out"
  ],
  "rosewood": [
    "Rosewood Bermuda",
    "Eating out"
  ],
  "mr chicken": [
    "Mr Chicken",
    "Eating out"
  ],
  "cafe": [
    "Cafe",
    "Eating out"
  ],
  "lindo": [
    "Lindo's Family Foods",
    "Groceries"
  ],
  "supermart": [
    "The Supermart",
    "Groceries"
  ],
  "marketplace": [
    "MarketPlace",
    "Groceries"
  ],
  "market place": [
    "Hamilton Market Place",
    "Groceries"
  ],
  "shopping centre": [
    "Shopping Centre",
    "Groceries"
  ],
  "c-mart": [
    "C-Mart",
    "Groceries"
  ],
  "east end variety": [
    "East End Variety",
    "Groceries"
  ],
  "belvin": [
    "Belvin's Variety",
    "Groceries"
  ],
  "harrington hundreds": [
    "Harrington Hundreds",
    "Groceries"
  ],
  "heron bay": [
    "Heron Bay MarketPlace",
    "Groceries"
  ],
  "rural hill": [
    "Rural Hill Plaza",
    "Groceries"
  ],
  "people's pharmacy": [
    "People's Pharmacy",
    "Personal care"
  ],
  "clarendon pharmacy": [
    "Clarendon Pharmacy",
    "Personal care"
  ],
  "esso": [
    "Esso",
    "Transport"
  ],
  "rubis": [
    "Rubis",
    "Transport"
  ],
  "buzz": [
    "Buzz N'Go",
    "Transport"
  ],
  "gec service": [
    "GEC Service Station",
    "Transport"
  ],
  "service station": [
    "Service Station",
    "Transport"
  ],
  "gas station": [
    "Gas Station",
    "Transport"
  ],
  "warwick gas": [
    "Warwick Gas Station",
    "Transport"
  ],
  "ferry termina": [
    "Hamilton Ferry Terminal",
    "Transport"
  ],
  "uber": [
    "Uber",
    "Transport"
  ],
  "voi": [
    "VOI",
    "Transport"
  ],
  "anthropic": [
    "Anthropic (Claude)",
    "Bills"
  ],
  "claude.ai": [
    "Anthropic (Claude)",
    "Bills"
  ],
  "claude sub": [
    "Anthropic (Claude)",
    "Bills"
  ],
  "openai": [
    "OpenAI (ChatGPT)",
    "Bills"
  ],
  "chatgpt": [
    "OpenAI (ChatGPT)",
    "Bills"
  ],
  "crunchyroll": [
    "Crunchyroll",
    "Entertainment"
  ],
  "amazon prime": [
    "Amazon Prime",
    "Entertainment"
  ],
  "netflix": [
    "Netflix",
    "Entertainment"
  ],
  "spotify": [
    "Spotify",
    "Entertainment"
  ],
  "speciality movies": [
    "Speciality Movies",
    "Entertainment"
  ],
  "cigna": [
    "Cigna (Health Insurance)",
    "Bills"
  ],
  "one communications": [
    "One Communications",
    "Bills"
  ],
  "airbnb": [
    "Airbnb",
    "Holidays"
  ],
  "fairmont": [
    "Fairmont Hamilton Princess",
    "Holidays"
  ],
  "grotto bay": [
    "Grotto Bay Beach Resort",
    "Holidays"
  ],
  "rosedon": [
    "Rosedon Hotel",
    "Holidays"
  ],
  "bermuda tix": [
    "Bermuda Tix",
    "Holidays"
  ],
  "facebk": [
    "Facebook Ads",
    "Advertising"
  ],
  "facebook": [
    "Facebook Ads",
    "Advertising"
  ],
  "interactive brokers": [
    "Interactive Brokers (IBKR)",
    "Savings"
  ],
  "ibkr": [
    "Interactive Brokers (IBKR)",
    "Savings"
  ],
  "bermuda monetary": [
    "Bermuda Monetary Authority",
    "Income"
  ],
  "credit interest": [
    "Credit Interest",
    "Income"
  ],
  "office of the tax": [
    "Office of the Tax Commissioner",
    "Finances"
  ],
  "interflora": [
    "Interflora",
    "Gifts"
  ],
  "red cr": [
    "British Red Cross",
    "Charity"
  ],
  "coral reef fisheries": [
    "Coral Reef Fisheries",
    "Transport"
  ],
  "marks and spencer": [
    "Marks and Spencer",
    "Shopping"
  ],
  "ox bus": [
    "Ox Bus",
    "Transport"
  ],
  "omnia": [
    "Omnia",
    "Entertainment"
  ],
  "chiang mai": [
    "Chiang Mai",
    "Eating out"
  ],
  "icloud storage": [
    "iCloud Storage",
    "Bills"
  ],
  "transfer commission": [
    "Transfer Commission",
    "Finances"
  ],
  "nando's": [
    "Nando's",
    "Eating out"
  ],
  "tk maxx": [
    "TK Maxx",
    "Shopping"
  ],
  "service fee": [
    "Service Fee",
    "Finances"
  ],
  "curzon": [
    "Curzon",
    "Entertainment"
  ],
  "georgina's": [
    "Georgina's",
    "Eating out"
  ],
  "our dollar, your problem": [
    "Our Dollar, Your Problem",
    "Shopping"
  ],
  "sainsbury's": [
    "Sainsbury's",
    "Eating out"
  ],
  "branca": [
    "Branca",
    "Eating out"
  ],
  "moving fee": [
    "Moving Fee",
    "Transport"
  ],
  "the alchemist": [
    "The Alchemist",
    "Eating out"
  ],
  "greene king": [
    "Greene King",
    "Eating out"
  ],
  "turf tavern": [
    "Turf Tavern",
    "Eating out"
  ],
  "caffe nero": [
    "Caffe Nero",
    "Eating out"
  ],
  "primark": [
    "Primark",
    "Shopping"
  ],
  "deliveroo": [
    "Deliveroo",
    "Eating out"
  ],
  "punting day": [
    "Punting Day",
    "Entertainment"
  ],
  "trainline": [
    "Trainline",
    "Transport"
  ],
  "hsbc": [
    "HSBC",
    "Finances"
  ],
  "opera café": [
    "Opera Café",
    "Eating out"
  ],
  "datacamp": [
    "DataCamp",
    "Bills"
  ],
  "ovo energy": [
    "OVO Energy",
    "Bills"
  ],
  "thames water": [
    "Thames Water",
    "Bills"
  ],
  "joe and the juice": [
    "Joe and the Juice",
    "Eating out"
  ],
  "tribe ignite": [
    "Tribe Ignite",
    "Entertainment"
  ],
  "market halls": [
    "Market Halls",
    "Eating out"
  ],
  "camino": [
    "Camino",
    "Eating out"
  ],
  "peckham food hall": [
    "Peckham Food Hall",
    "Eating out"
  ],
  "du-rag": [
    "Du-Rag",
    "Personal care"
  ],
  "southbank foodmarket": [
    "Southbank Foodmarket",
    "Eating out"
  ],
  "camina": [
    "Camina",
    "Eating out"
  ],
  "steel yard coat room": [
    "Steel Yard Coat Room",
    "Entertainment"
  ],
  "gail's": [
    "GAIL's",
    "Eating out"
  ],
  "monzo perks": [
    "Monzo Perks",
    "Finances"
  ],
  "raiyan bday": [
    "Raiyan BDAY",
    "Gifts"
  ],
  "imfx macro forecasting": [
    "IMFx Macro Forecasting",
    "Bills"
  ],
  "tesco": [
    "Tesco",
    "Eating out"
  ],
  "jellycat": [
    "Jellycat",
    "Gifts"
  ],
  "john lewis": [
    "John Lewis",
    "Gifts"
  ],
  "ole and steen": [
    "Ole and Steen",
    "Eating out"
  ],
  "amazon": [
    "Amazon",
    "Gifts"
  ],
  "national express": [
    "National Express",
    "Transport"
  ],
  "mercato metro": [
    "Mercato Metro",
    "Eating out"
  ],
  "shoyu": [
    "Shoyu",
    "Eating out"
  ],
  "blank street": [
    "Blank Street",
    "Eating out"
  ],
  "british airways": [
    "British Airways",
    "Holidays"
  ],
  "yo! sushi": [
    "YO! Sushi",
    "Eating out"
  ],
  "apple": [
    "Apple",
    "Bills"
  ],
  "lunch w indio and cree": [
    "Lunch w Indio and Cree",
    "Eating out"
  ],
  "transfer - uk": [
    "Transfer - UK",
    "Transfers"
  ],
  "bike - patrik": [
    "Bike - Patrik",
    "Transfers"
  ],
  "clarendon pharamacy": [
    "Clarendon Pharamacy",
    "Eating out"
  ],
  "luxury cuts": [
    "Luxury Cuts",
    "Personal care"
  ],
  "brew": [
    "Brew",
    "Eating out"
  ],
  "shopping center": [
    "Shopping Center",
    "Eating out"
  ],
  "latte's": [
    "Latte's",
    "Eating out"
  ],
  "ede & ranvenscroft": [
    "Ede & Ranvenscroft",
    "Gifts"
  ],
  "transfer - moma": [
    "Transfer - Moma",
    "Family"
  ],
  "repayment - mom": [
    "Repayment - Mom",
    "Family"
  ],
  "church raffle tickets": [
    "Church Raffle Tickets",
    "Gifts"
  ],
  "repay - vincent": [
    "Repay - Vincent",
    "Transfers"
  ],
  "repay - aunty": [
    "Repay - Aunty",
    "Transfers"
  ],
  "shelly bay pizza house": [
    "Shelly Bay Pizza House",
    "Eating out"
  ],
  "hamitlon princess": [
    "Hamitlon Princess",
    "Eating out"
  ],
  "boundary": [
    "Boundary",
    "Eating out"
  ],
  "jc's café": [
    "JC's Café",
    "Eating out"
  ],
  "wj boyle & son": [
    "WJ Boyle & Son",
    "Personal care"
  ],
  "acgl": [
    "ACGL",
    "Savings"
  ],
  "gpass": [
    "GPASS",
    "Entertainment"
  ],
  "paget fc": [
    "Paget FC",
    "Entertainment"
  ],
  "cash": [
    "Cash",
    "Entertainment"
  ],
  "foodhub": [
    "FoodHub",
    "Eating out"
  ],
  "devile's isle": [
    "Devile's Isle",
    "Eating out"
  ],
  "speciality cinema": [
    "Speciality Cinema",
    "Entertainment"
  ],
  "price rite": [
    "Price Rite",
    "Groceries"
  ],
  "sydney race": [
    "Sydney Race",
    "Gifts"
  ],
  "easyjet": [
    "EasyJet",
    "Holidays"
  ],
  "delta": [
    "Delta",
    "Holidays"
  ],
  "booking.com": [
    "Booking.com",
    "Holidays"
  ],
  "ice queen": [
    "Ice Queen",
    "Eating out"
  ],
  "deposit protection service": [
    "Deposit Protection Service",
    "Income"
  ],
  "mom hotel": [
    "Mom Hotel",
    "Family"
  ],
  "harry's": [
    "Harry's",
    "Eating out"
  ],
  "carl": [
    "Carl",
    "Finances"
  ],
  "chatham house": [
    "Chatham House",
    "Gifts"
  ],
  "vincent": [
    "Vincent",
    "Holidays"
  ],
  "holidayinn": [
    "HolidayInn",
    "Holidays"
  ],
  "nan xiang xio long ba": [
    "Nan Xiang Xio Long Ba",
    "Holidays"
  ],
  "duane reade": [
    "Duane Reade",
    "Holidays"
  ],
  "utopia bagels": [
    "Utopia Bagels",
    "Holidays"
  ],
  "hill country": [
    "Hill Country",
    "Holidays"
  ],
  "joe's pizza": [
    "Joe's Pizza",
    "Holidays"
  ],
  "toloache - 50th st": [
    "Toloache - 50th St",
    "Holidays"
  ],
  "canva": [
    "Canva",
    "Entertainment"
  ],
  "transfer - ibkr": [
    "Transfer - IBKR",
    "Transfers"
  ],
  "sydney - lunch": [
    "Sydney - Lunch",
    "Gifts"
  ],
  "game on": [
    "Game On",
    "Finances"
  ],
  "ptech": [
    "Ptech",
    "Shopping"
  ],
  "bella vista": [
    "Bella Vista",
    "Eating out"
  ],
  "monzo": [
    "Monzo",
    "Income"
  ],
  "nvda": [
    "NVDA",
    "Savings"
  ],
  "david rose": [
    "David Rose",
    "Gifts"
  ],
  "govt": [
    "GOVT",
    "Savings"
  ],
  "meta": [
    "META",
    "Savings"
  ],
  "unipowerskills": [
    "UniPowerSkills",
    "Transfers"
  ],
  "ocean view golf club": [
    "Ocean View Golf Club",
    "Entertainment"
  ],
  "bermuda bistro": [
    "Bermuda Bistro",
    "Eating out"
  ],
  "miles market": [
    "Miles Market",
    "Eating out"
  ],
  "champ's variety": [
    "Champ's Variety",
    "Eating out"
  ],
  "gbp purchase": [
    "GBP Purchase",
    "Transfers"
  ],
  "gbp receipt": [
    "GBP Receipt",
    "Transfers"
  ],
  "sgov": [
    "SGOV",
    "Savings"
  ],
  "near": [
    "NEAR",
    "Savings"
  ],
  "transfer - monzo": [
    "Transfer - Monzo",
    "Transfers"
  ],
  "bermuda book store": [
    "Bermuda Book Store",
    "Gifts"
  ],
  "mr. chicken": [
    "Mr. Chicken",
    "Eating out"
  ],
  "tabs": [
    "TABS",
    "Gifts"
  ],
  "stockholm - flights and hotel": [
    "Stockholm - Flights and Hotel",
    "Holidays"
  ],
  "capcut": [
    "Capcut",
    "Entertainment"
  ],
  "disney plus": [
    "Disney Plus",
    "Entertainment"
  ],
  "clarabell's": [
    "Clarabell's",
    "Eating out"
  ],
  "just shirts (dry cleaner)": [
    "Just Shirts (Dry Cleaner)",
    "Personal care"
  ],
  "nana": [
    "Nana",
    "Family"
  ],
  "iren": [
    "IREN",
    "Savings"
  ],
  "nbis": [
    "NBIS",
    "Savings"
  ],
  "magoosh, inc.": [
    "Magoosh, Inc.",
    "Bills"
  ]
};

// Runtime overrides layered on top of the committed bank. Populated from the
// spreadsheet's _merchant_edits tab on sync, so your in-sheet corrections take
// effect immediately and travel across devices — while the committed bank
// above stays the canonical baseline you periodically fold edits back into.
let MERCHANT_OVERRIDES = {};
function setMerchantOverrides(map) { MERCHANT_OVERRIDES = map || {}; }

// Resolve a cleaned description to {name, category} using overrides first,
// then the committed bank, via longest-substring match.
function resolveMerchant(cleanedDescription) {
  const hay = (cleanedDescription || "").toLowerCase();
  let bestKey = "", best = null;
  for (const key of Object.keys(MERCHANT_OVERRIDES)) {
    if (hay.includes(key) && key.length > bestKey.length) {
      bestKey = key; best = { name: MERCHANT_OVERRIDES[key].name, category: MERCHANT_OVERRIDES[key].category };
    }
  }
  for (const key of Object.keys(MERCHANT_BANK)) {
    if (hay.includes(key) && key.length > bestKey.length) {
      bestKey = key; best = { name: MERCHANT_BANK[key][0], category: MERCHANT_BANK[key][1] };
    }
  }
  return best; // null if nothing matched
}
