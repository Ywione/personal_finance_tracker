// ── Auth ────────────────────────────────────────────────────────
// Uses Google Identity Services' token-client flow, the pattern
// Google recommends for pure client-side apps with no backend:
// https://developers.google.com/identity/oauth2/web/guides/use-token-model
//
// The access token that comes back:
//  - lives only in this tab's memory (never written to localStorage,
//    cookies, or any server)
//  - is scoped ONLY to drive.appdata (this app's private folder)
//  - expires in ~1 hour and is discarded on refresh/close
//
// Nothing here can read the rest of the user's Drive, and no
// server (including GitHub Pages, which just serves static files)
// ever sees the token or the data it unlocks.

const Auth = (() => {
  let tokenClient = null;
  let accessToken = null;
  let tokenExpiresAt = 0;
  let onChange = () => {};

  function init(onChangeCb) {
    onChange = onChangeCb || onChange;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: LEDGER_CONFIG.GOOGLE_CLIENT_ID,
      scope: LEDGER_CONFIG.SHEETS_SCOPE,
      callback: (resp) => {
        if (resp.error) {
          console.error("Auth error:", resp);
          onChange({ signedIn: false, error: resp.error });
          return;
        }
        accessToken = resp.access_token;
        tokenExpiresAt = Date.now() + (resp.expires_in - 60) * 1000;
        onChange({ signedIn: true });
      },
    });
  }

  function signIn() {
    tokenClient.requestAccessToken({ prompt: "consent" });
  }

  function signOut() {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
    tokenExpiresAt = 0;
    onChange({ signedIn: false });
  }

  // Silently refresh if we still have an active Google session,
  // otherwise the caller should show the sign-in button.
  function trySilent() {
    tokenClient.requestAccessToken({ prompt: "" });
  }

  function getToken() {
    if (!accessToken || Date.now() > tokenExpiresAt) return null;
    return accessToken;
  }

  function isSignedIn() {
    return !!getToken();
  }

  return { init, signIn, signOut, trySilent, getToken, isSignedIn };
})();
