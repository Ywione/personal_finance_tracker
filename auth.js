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

  // The GSI script tag is loaded with async/defer, so there's no
  // guarantee `google` exists yet by the time init() runs (slow
  // network, or the script simply being blocked by an ad-blocker /
  // privacy extension — accounts.google.com/gsi/client is on several
  // tracker blocklists). Poll briefly instead of assuming it's ready,
  // so a late or blocked script can't throw and abort the rest of the
  // app's setup.
  function waitForGoogle(onReady, onTimeout, attemptsLeft = 50) {
    if (window.google && google.accounts && google.accounts.oauth2) {
      onReady();
      return;
    }
    if (attemptsLeft <= 0) {
      onTimeout();
      return;
    }
    setTimeout(() => waitForGoogle(onReady, onTimeout, attemptsLeft - 1), 100);
  }

  function init(onChangeCb) {
    onChange = onChangeCb || onChange;
    waitForGoogle(
      () => {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: LEDGER_CONFIG.GOOGLE_CLIENT_ID,
          scope: LEDGER_CONFIG.DRIVE_SCOPE,
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
      },
      () => {
        console.error("Google Identity Services script never loaded.");
        onChange({ signedIn: false, error: "Google sign-in script didn't load — check your network or an ad-blocker, then reload the page." });
      }
    );
  }

  function signIn() {
    if (!tokenClient) {
      alert("Google sign-in isn't ready yet — reload the page and try again.");
      return;
    }
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
    if (!tokenClient) return;
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
