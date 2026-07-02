// ── Drive storage ──────────────────────────────────────────────
// All reads/writes target the appDataFolder — a special Drive
// space that's invisible in the normal Drive UI/Trash and only
// ever accessible to the app that created it, under the signed-in
// user's own account. This is what makes "private storage in your
// own Drive" actually true rather than just a claim.

const DriveStore = (() => {
  const API = "https://www.googleapis.com/drive/v3";
  const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

  async function authFetch(url, opts = {}) {
    const token = Auth.getToken();
    if (!token) throw new Error("Not signed in");
    opts.headers = { ...(opts.headers || {}), Authorization: `Bearer ${token}` };
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`);
    return res;
  }

  async function findFileId(name) {
    const q = encodeURIComponent(`name='${name}' and 'appDataFolder' in parents and trashed=false`);
    const url = `${API}/files?q=${q}&spaces=appDataFolder&fields=files(id,name)`;
    const res = await authFetch(url);
    const data = await res.json();
    return data.files && data.files[0] ? data.files[0].id : null;
  }

  async function readJSON(name, fallback) {
    const id = await findFileId(name);
    if (!id) return fallback;
    const res = await authFetch(`${API}/files/${id}?alt=media`);
    try {
      return await res.json();
    } catch {
      return fallback;
    }
  }

  async function writeJSON(name, obj) {
    const id = await findFileId(name);
    const body = JSON.stringify(obj, null, 2);
    const metadata = { name, parents: id ? undefined : ["appDataFolder"] };

    const boundary = "ledger_boundary_" + Date.now();
    const multipart =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${body}\r\n` +
      `--${boundary}--`;

    const url = id
      ? `${UPLOAD_API}/files/${id}?uploadType=multipart`
      : `${UPLOAD_API}/files?uploadType=multipart`;

    await authFetch(url, {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: multipart,
    });
  }

  return { readJSON, writeJSON };
})();
