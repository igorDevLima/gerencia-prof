/* ===========================================================================
   drive.js — envio das exportações para o Google Drive (opcional).

   Usa o Google Identity Services (GIS) no navegador, com o escopo mínimo
   "drive.file": o app só enxerga/gerencia os arquivos que ELE MESMO cria —
   nunca o restante do seu Drive. Não há backend nem segredo no código
   (apenas o Client ID público do OAuth, configurado pelo usuário).

   Requer que o app seja servido por http/https (localhost ou GitHub Pages);
   não funciona abrindo o index.html como arquivo (file://).
   =========================================================================== */
(function (global) {
  "use strict";

  const SCOPE = "https://www.googleapis.com/auth/drive.file";
  const GIS_SRC = "https://accounts.google.com/gsi/client";

  let tokenClient = null;
  let accessToken = null;
  let tokenExpiry = 0;
  let folderCache = { name: null, id: null };

  function cfg() {
    return global.Store && Store.getSettings ? Store.getSettings() : {};
  }
  function clientId() {
    return String(cfg().googleClientId || "").trim();
  }
  function isConfigured() {
    return !!clientId();
  }
  function isEnabled() {
    return !!(cfg().driveEnabled && clientId());
  }
  function isSupported() {
    // OAuth exige origem http/https (não funciona em file://).
    return typeof location !== "undefined" && /^https?:$/.test(location.protocol);
  }

  // Carrega a biblioteca do Google sob demanda (mantém o app offline por padrão).
  function loadGis() {
    return new Promise((resolve, reject) => {
      if (global.google && global.google.accounts && global.google.accounts.oauth2) {
        return resolve();
      }
      let el = document.getElementById("gis-script");
      if (!el) {
        el = document.createElement("script");
        el.id = "gis-script";
        el.src = GIS_SRC;
        el.async = true;
        el.defer = true;
        document.head.appendChild(el);
      }
      el.addEventListener("load", () => resolve(), { once: true });
      el.addEventListener("error", () =>
        reject(new Error("Falha ao carregar o Google Identity Services (verifique a internet).")), { once: true });
      // Caso o script já tenha carregado entre a checagem e o append.
      if (global.google && global.google.accounts && global.google.accounts.oauth2) resolve();
    });
  }

  function ensureTokenClient() {
    const id = clientId();
    if (!id) throw new Error("Client ID do Google não configurado.");
    if (tokenClient && tokenClient.__clientId === id) return tokenClient;
    tokenClient = global.google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: SCOPE,
      callback: () => {},
    });
    tokenClient.__clientId = id;
    return tokenClient;
  }

  // interactive=true força o consentimento (popup); false tenta silencioso.
  function requestToken(interactive) {
    return loadGis().then(() => new Promise((resolve, reject) => {
      let tc;
      try { tc = ensureTokenClient(); } catch (e) { return reject(e); }
      tc.callback = (resp) => {
        if (resp && resp.access_token) {
          accessToken = resp.access_token;
          tokenExpiry = Date.now() + ((resp.expires_in || 3600) - 60) * 1000;
          resolve(accessToken);
        } else {
          reject(new Error(resp && resp.error ? "Autorização negada: " + resp.error : "Não foi possível obter autorização do Google."));
        }
      };
      try {
        tc.requestAccessToken({ prompt: interactive ? "consent" : "" });
      } catch (e) {
        reject(e);
      }
    }));
  }

  function getToken() {
    if (accessToken && Date.now() < tokenExpiry) return Promise.resolve(accessToken);
    return requestToken(false);
  }

  // Conecta/testa a conta (interativo). Retorna Promise<true>.
  function connect() {
    if (!isSupported()) {
      return Promise.reject(new Error("O Google Drive precisa que o app seja aberto por http/https (localhost ou site), não como arquivo local."));
    }
    folderCache = { name: null, id: null };
    accessToken = null;
    tokenExpiry = 0;
    return requestToken(true).then(() => true);
  }

  async function ensureFolder(token) {
    const name = (cfg().driveFolder || "Gerência Prof").trim() || "Gerência Prof";
    if (folderCache.id && folderCache.name === name) return folderCache.id;
    const q = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false`;
    const url = "https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id,name)&q=" + encodeURIComponent(q);
    const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    if (r.ok) {
      const d = await r.json();
      if (d.files && d.files.length) {
        folderCache = { name, id: d.files[0].id };
        return folderCache.id;
      }
    }
    const cr = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }),
    });
    if (!cr.ok) throw new Error("Falha ao criar a pasta no Drive (" + cr.status + ").");
    const cd = await cr.json();
    folderCache = { name, id: cd.id };
    return folderCache.id;
  }

  // Envia um arquivo. content = string ou Uint8Array. Retorna metadados do arquivo.
  async function upload(filename, content, mime) {
    if (!isSupported()) {
      throw new Error("O Google Drive exige que o app seja aberto por http/https.");
    }
    const token = await getToken();
    const folderId = await ensureFolder(token);
    const boundary = "gp" + Math.random().toString(36).slice(2);
    const meta = { name: filename, mimeType: mime, parents: [folderId] };
    const pre = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(meta) + `\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`;
    const post = `\r\n--${boundary}--`;
    const body = new Blob([pre, content, post], { type: "multipart/related; boundary=" + boundary });
    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      { method: "POST", headers: { Authorization: "Bearer " + token }, body }
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error("Envio ao Drive falhou (" + res.status + "). " + t.slice(0, 200));
    }
    return res.json();
  }

  global.DriveSync = {
    SCOPE,
    isConfigured,
    isEnabled,
    isSupported,
    connect,
    upload,
  };
})(window);
