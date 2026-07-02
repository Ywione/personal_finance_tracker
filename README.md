# Ledger — private monthly finance tracker

A static site (deployable on GitHub Pages) that parses your HSBC Bermuda,
Monzo UK, and IBKR statements **in your browser** and stores the results
only in a private, app-scoped folder in your own Google Drive. No backend,
no database, no third party ever sees your data.

## 1. Create your own Google OAuth client (one-time, ~5 min)

This app needs its own OAuth client ID so it can ask Google, on your
behalf, for permission to read/write its private Drive folder. You create
this yourself — I can't create it for you, since it lives in your Google
Cloud account.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (e.g. "ledger").
2. **APIs & Services → Library** → enable the **Google Drive API**.
3. **APIs & Services → OAuth consent screen** → User type: External → fill in app name ("Ledger"), your email. Under Scopes, you don't need to add anything here. Under Test users, add your own Google account (keeps the app in "Testing" mode, which is fine for personal use and doesn't require Google review).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → Application type: **Web application**.
   - Under "Authorized JavaScript origins," add the URL you'll host this on, e.g. `https://<your-username>.github.io`.
   - Save, then copy the **Client ID** (looks like `123...apps.googleusercontent.com`).
5. Paste that into `config.js`:
   ```js
   GOOGLE_CLIENT_ID: "123...apps.googleusercontent.com",
   ```

This Client ID is not a secret — it's fine that it's visible in a public
GitHub repo. It only identifies which app is asking; it can't grant
access on its own.

## 2. Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "Ledger tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Then: repo **Settings → Pages → Deploy from branch → main → / (root)**.
Your app will be live at `https://<your-username>.github.io/<repo-name>/`.

Because the app is in "Testing" mode in the Google Cloud console (step 1.3
above), only accounts you've added as test users can sign in — which in
practice means only you, even though the code is public.

## 3. Statement export instructions

**HSBC Bermuda** — download the PDF statement from online banking. PDF
text layout varies by bank and can shift between statement eras, so the
parser is intentionally permissive and every parsed row goes through a
review screen before anything is saved — check the first import carefully
and adjust the pattern in **Settings → HSBC line pattern** if rows are
missed.

**Monzo UK** — in the Monzo app: Account → Export → CSV. Import that file
directly.

**IBKR** — build a **Flex Query** (Performance & Reports → Flex Queries)
including these sections for full functionality:
- **Cash Transactions** (for spend/income tracking)
- **Deposits & Withdrawals** (for transfers in/out)
- **Change in NAV** (for the investment return figure on the dashboard)

Export as CSV each month and upload it here.

## 4. How your data stays private

- GitHub Pages serves static files only — there is no server component
  that could log or store anything.
- Sign-in uses Google's official token-client flow for JS-only apps: the
  browser gets a short-lived access token directly from Google, scoped
  only to `drive.appdata` (a hidden per-app folder Google reserves for
  exactly this use case — invisible in your normal Drive UI, and
  inaccessible to any other app).
- The access token lives only in memory in your browser tab. It's never
  written to localStorage, cookies, or sent anywhere but Google's API.
- All statement parsing (PDF text extraction, CSV parsing) happens
  client-side. Only the structured transactions you've reviewed and
  approved get written to Drive.

## 5. Local development

Just open `index.html` via a local server (Google's OAuth flow requires
`http://` or `https://`, not `file://`):

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`, and add `http://localhost:8000` as an
additional Authorized JavaScript origin in step 1.4 above while testing.
