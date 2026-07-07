// ── Ledger config ──────────────────────────────────────────────
// Fill in CLIENT_ID after creating an OAuth client in Google Cloud
// Console (see README.md, step 1). This value is NOT a secret —
// it's safe to commit to a public GitHub repo.

const LEDGER_CONFIG = {
  GOOGLE_CLIENT_ID: "1008976129886-u3a3tjhctmqptqs35tfa8thg5918rb9j.apps.googleusercontent.com",

  // The Google Sheet the app reads from and appends to. Paste the ID
  // from the sheet's URL: docs.google.com/spreadsheets/d/<THIS_PART>/edit
  SPREADSHEET_ID: "PASTE_YOUR_SPREADSHEET_ID_HERE",

  // Sheets scope: read/write access to spreadsheets the signed-in user
  // opens with this app. Needed to append transactions and store the
  // rules/model on hidden tabs.
  SHEETS_SCOPE: "https://www.googleapis.com/auth/spreadsheets",
};
