// ── Ledger config ──────────────────────────────────────────────
// Fill in CLIENT_ID after creating an OAuth client in Google Cloud
// Console (see README.md, step 1). This value is NOT a secret —
// it's safe to commit to a public GitHub repo.

const LEDGER_CONFIG = {
  GOOGLE_CLIENT_ID: "YOUR_CLIENT_ID.apps.googleusercontent.com",

  // Drive scope: appdata = a hidden, app-private folder in the
  // signed-in user's own Drive. No other app, and no person
  // browsing their Drive normally, can see or read it.
  DRIVE_SCOPE: "https://www.googleapis.com/auth/drive.appdata",

  // Filenames written inside the appDataFolder
  FILES: {
    transactions: "ledger_transactions.json",
    rules: "ledger_category_rules.json",
    investments: "ledger_investments.json",
  },
};
