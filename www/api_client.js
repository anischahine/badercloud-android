/**
 * BaderCloud API Client — v2.0
 * Shared across all static hubs. Call gateway.badercloud.online/api/*
 */

const BC = {
  GATEWAY: "https://gateway.badercloud.online",
  ENGINE:  "https://engine.badercloud.online",

  // ── Auth helpers ─────────────────────────────────────────────────────────
  getToken() {
    return document.cookie.match(/bc_token=([^;]+)/)?.[1] || localStorage.getItem("bc_token") || "";
  },

  setToken(token, domain = ".badercloud.online") {
    document.cookie = `bc_token=${token}; domain=${domain}; path=/; SameSite=Lax; Secure`;
    localStorage.setItem("bc_token", token);
  },

  clearToken() {
    document.cookie = "bc_token=; domain=.badercloud.online; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    localStorage.removeItem("bc_token");
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  requireAuth(returnTo = window.location.hostname) {
    if (!this.isAuthenticated()) {
      window.location.href = `https://auth.badercloud.online/login?return_to=${returnTo}`;
      return false;
    }
    return true;
  },

  // ── Tenant detection ─────────────────────────────────────────────────────
  getTenantId() {
    // From path: /tenant_slug/... or query ?tenant=slug
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    if (pathParts.length > 0 && !["login","register","dashboard"].includes(pathParts[0])) {
      return pathParts[0];
    }
    return new URLSearchParams(window.location.search).get("tenant") || null;
  },

  // ── Core fetch ───────────────────────────────────────────────────────────
  async request(method, endpoint, body = null, extraHeaders = {}) {
    const token = this.getToken();
    const tenantId = this.getTenantId();

    const headers = {
      "Content-Type": "application/json",
      ...(token && { "Authorization": `Bearer ${token}` }),
      ...(tenantId && { "X-Tenant-ID": tenantId }),
      ...extraHeaders,
    };

    const config = { method, headers };
    if (body && method !== "GET") config.body = JSON.stringify(body);

    const url = endpoint.startsWith("http") ? endpoint : `${this.GATEWAY}/api/v1${endpoint}`;

    try {
      const res = await fetch(url, config);
      if (res.status === 401) {
        this.clearToken();
        this.requireAuth();
        return null;
      }
      const data = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      console.error(`[BC] ${method} ${endpoint} failed:`, err);
      return { ok: false, status: 0, data: null, error: err.message };
    }
  },

  get:    (endpoint, headers) => BC.request("GET",    endpoint, null, headers),
  post:   (endpoint, body, headers) => BC.request("POST",   endpoint, body, headers),
  put:    (endpoint, body, headers) => BC.request("PUT",    endpoint, body, headers),
  delete: (endpoint, headers) => BC.request("DELETE",  endpoint, null, headers),

  // ── Upload (multipart) ───────────────────────────────────────────────────
  async upload(endpoint, formData) {
    const token = this.getToken();
    const tenantId = this.getTenantId();
    const headers = {
      ...(token && { "Authorization": `Bearer ${token}` }),
      ...(tenantId && { "X-Tenant-ID": tenantId }),
    };
    const res = await fetch(`${this.GATEWAY}/api/v1${endpoint}`, { method: "POST", headers, body: formData });
    return { ok: res.ok, status: res.status, data: await res.json() };
  },

  // ── UI Utilities ─────────────────────────────────────────────────────────
  toast(message, type = "info", duration = 4000) {
    const colors = { info: "#6366F1", success: "#10B981", error: "#EF4444", warn: "#F59E0B" };
    const icons  = { info: "ℹ", success: "✓", error: "✗", warn: "⚠" };
    const el = document.createElement("div");
    el.style.cssText = `
      position:fixed; bottom:1.5rem; right:1.5rem; z-index:9999;
      background:#1C1C27; border:1px solid ${colors[type]}44;
      color:#F8FAFC; padding:.875rem 1.25rem; border-radius:12px;
      display:flex; align-items:center; gap:.75rem; font-family:Inter,sans-serif;
      font-size:.875rem; box-shadow:0 8px 32px rgba(0,0,0,0.4);
      animation:bcSlideIn .25s ease; max-width:380px;
    `;
    el.innerHTML = `<span style="color:${colors[type]};font-weight:700">${icons[type]}</span><span>${message}</span>`;
    if (!document.getElementById("bc-toast-style")) {
      const s = document.createElement("style");
      s.id = "bc-toast-style";
      s.textContent = `@keyframes bcSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`;
      document.head.appendChild(s);
    }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), duration);
  },

  showLoader(el, text = "Loading...") {
    el.disabled = true;
    el._originalText = el.textContent;
    el.innerHTML = `<svg class="bc-spin" style="width:1em;height:1em;margin-right:.5em;display:inline-block;vertical-align:middle" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="3" stroke-opacity=".25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-width="3"/></svg>${text}`;
    if (!document.getElementById("bc-spin-style")) {
      const s = document.createElement("style");
      s.id = "bc-spin-style";
      s.textContent = `@keyframes bcSpin{to{transform:rotate(360deg)}}.bc-spin{animation:bcSpin .7s linear infinite}`;
      document.head.appendChild(s);
    }
  },

  hideLoader(el) {
    el.disabled = false;
    el.textContent = el._originalText || "Submit";
  },

  getReturnTo() {
    return new URLSearchParams(window.location.search).get("return_to") || null;
  },
};

window.BC = BC;
