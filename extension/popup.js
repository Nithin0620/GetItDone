const DEFAULTS = {
  tracking: true,
  connected: false,
  token: "",
  apiUrl: "https://getitdone.ssh.net.in",
  lastError: "",
  dailyTabData: {},
  sessionTabData: {},
  activeDomain: null,
  activeDomains: [],
  current: null,
  pending: {},
  timeLimits: {},
  strictLimits: {},
  lastTickAt: Date.now(),
};

const $ = (id) => document.getElementById(id);
let currentView = "dashboard";
let optionsKey = "";
let faviconDomain = "";

function send(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => resolve(response || { ok: false }));
  });
}

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMs(ms) {
  const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function fallbackIcon(domain) {
  const letter = escapeHtml(String(domain || "?").charAt(0).toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="7" fill="#e4f4ea"/><text x="16" y="22" font-family="Arial" font-size="17" text-anchor="middle" fill="#1d6b4f">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function faviconSrc(domain) {
  if (/^[a-z]+:/.test(domain)) return fallbackIcon(domain);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

function iconTag(domain, className = "favicon") {
  return `<img class="${className}" src="${faviconSrc(domain)}" data-fallback="${fallbackIcon(domain)}" alt="" />`;
}

document.addEventListener(
  "error",
  (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    const fallback = image.dataset.fallback;
    if (!fallback) return;
    delete image.dataset.fallback;
    image.src = fallback;
  },
  true,
);

async function render(full = false) {
  const s = await chrome.storage.local.get(DEFAULTS);
  if (full) {
    $("apiUrl").value = s.apiUrl;
    $("token").value = s.token;
  }
  $("setup").hidden = s.connected;
  $("views").hidden = !s.connected;
  $("status").textContent = !s.connected ? "Not connected" : s.tracking ? "Tracking" : "Paused";
  $("status").classList.toggle("off", !s.connected || !s.tracking);
  if (!s.connected) return;

  const daily = s.dailyTabData[todayKey()] || { tabData: {}, totalTime: 0 };
  const totals = new Map(
    Object.entries(daily.tabData || {}).map(([domain, ms]) => [domain, Number(ms) || 0]),
  );
  const liveDelta = Math.min(Math.max(Date.now() - (s.lastTickAt || Date.now()), 0), 65_000);
  if (s.current?.domain && s.tracking) {
    totals.set(s.current.domain, (totals.get(s.current.domain) || 0) + liveDelta);
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);

  $("todayTotal").textContent = formatMs(total);
  $("focusTotal").textContent = formatMs(total);
  $("sitesVisited").textContent = String(daily.websitesVisited?.length || totals.size);
  $("activeTabs").textContent = String(s.activeDomains?.length || 0);
  $("limitCount").textContent = String(Object.keys(s.timeLimits || {}).length);
  $("toggleDashboard").textContent = s.tracking ? "Pause" : "Resume";
  $("toggleTracking").checked = Boolean(s.tracking);
  $("syncStatus").textContent =
    s.lastError || (Object.keys(s.pending || {}).length ? "Syncing soon" : "All time synced");
  $("syncStatus").classList.toggle("error", Boolean(s.lastError));

  $("currentDomain").textContent = s.current?.domain || "—";
  $("currentTitle").textContent = s.current?.title || "No active page";
  const currentSession = s.current?.domain
    ? (s.sessionTabData?.[s.current.domain] || 0) + liveDelta
    : 0;
  $("currentLive").textContent = s.current?.domain && s.tracking
    ? formatMs(currentSession)
    : "0m 00s";
  $("currentToday").textContent = s.current?.domain ? formatMs(totals.get(s.current.domain) || 0) : "0m 00s";
  const currentDomainIcon = s.current?.domain || "?";
  if (currentDomainIcon !== faviconDomain) {
    faviconDomain = currentDomainIcon;
    $("currentFavicon").outerHTML = iconTag(currentDomainIcon, "favicon");
  }

  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  $("topSites").innerHTML = ranked.length
    ? ranked
        .map(([domain, ms], index) => {
          const percent = total ? Math.round((ms / total) * 100) : 0;
          const limit = s.timeLimits[domain];
          const over = Boolean(limit && ms >= limit);
          const badge = limit
            ? `<span class="badge${over ? " over" : ""}">Limit ${formatMs(limit)}</span>`
            : "";
          return `<div class="site-row${over ? " over" : ""}">
            <span class="rank">${index + 1}</span>
            ${iconTag(domain)}
            <div class="site-main">
              <div class="site-line"><span class="site-domain">${escapeHtml(domain)}</span>${badge}<span class="site-time">${formatMs(ms)}</span></div>
              <div class="bar"><div class="bar-fill${over ? " over" : ""}" style="width:${percent}%"></div></div>
            </div>
            <span class="pct">${percent}%</span>
          </div>`;
        })
        .join("")
    : '<p class="muted">No sites tracked yet today.</p>';

  const domains = [
    ...new Set([
      ...ranked.map(([domain]) => domain),
      ...Object.keys(s.sessionTabData || {}),
      ...Object.keys(s.timeLimits || {}),
      ...(s.activeDomains || []),
    ]),
  ].sort((a, b) => a.localeCompare(b));
  const nextKey = domains.join("|");
  if (nextKey !== optionsKey) {
    optionsKey = nextKey;
    const selected = $("limitDomain").value;
    $("limitDomain").innerHTML = domains.length
      ? domains.map((domain) => `<option value="${escapeHtml(domain)}">${escapeHtml(domain)}</option>`).join("")
      : '<option value="">No sites tracked yet</option>';
    if (domains.includes(selected)) $("limitDomain").value = selected;
  }

  const limits = Object.entries(s.timeLimits || {}).sort((a, b) => a[0].localeCompare(b[0]));
  $("currentLimits").innerHTML = limits.length
    ? limits
        .map(
          ([domain, limit]) => `<div class="limit-row">
            ${iconTag(domain)}
            <div class="limit-info"><span>${escapeHtml(domain)}</span><small>${formatMs(limit)}${s.strictLimits[domain] ? " · strict" : ""}</small></div>
            <button class="remove-limit" data-domain="${escapeHtml(domain)}">Remove</button>
          </div>`,
        )
        .join("")
    : '<p class="muted">No limits set.</p>';
}

document.querySelectorAll(".nav-tab").forEach((button) => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.classList.toggle("active", tab === button);
    });
    for (const view of ["dashboard", "focus", "settings"]) {
      $(`view-${view}`).hidden = view !== currentView;
    }
  });
});

$("connect").addEventListener("click", async () => {
  const token = $("token").value.trim();
  const apiUrl = $("apiUrl").value.trim().replace(/\/$/, "") || DEFAULTS.apiUrl;
  $("setupError").textContent = "";
  if (!token) {
    $("setupError").textContent = "Paste your sync token first.";
    return;
  }
  $("connect").disabled = true;
  const response = await send({ type: "CONNECT", token, apiUrl });
  $("connect").disabled = false;
  if (!response.ok) $("setupError").textContent = response.error || "Could not connect.";
  await render(true);
});

$("toggleDashboard").addEventListener("click", async () => {
  const s = await chrome.storage.local.get(DEFAULTS);
  await send({ type: "TOGGLE_TRACKING", enabled: !s.tracking });
  await render(false);
});

$("toggleTracking").addEventListener("change", async (event) => {
  await send({ type: "TOGGLE_TRACKING", enabled: event.target.checked });
  await render(false);
});

$("setLimit").addEventListener("click", async () => {
  const domain = $("limitDomain").value;
  const minutes = Number($("limitMinutes").value);
  $("limitError").textContent = "";
  if (!domain) {
    $("limitError").textContent = "Select a website first.";
    return;
  }
  if (!Number.isFinite(minutes) || minutes <= 0) {
    $("limitError").textContent = "Enter a time limit in minutes.";
    return;
  }
  const response = await send({ type: "SET_TIME_LIMIT", domain, minutes, strict: $("strictMode").checked });
  if (!response.ok) $("limitError").textContent = "Could not save the limit.";
  else $("limitMinutes").value = "";
  await render(false);
});

$("currentLimits").addEventListener("click", async (event) => {
  const button = event.target.closest(".remove-limit");
  if (!button) return;
  await send({ type: "SET_TIME_LIMIT", domain: button.dataset.domain, minutes: 0 });
  await render(false);
});

$("resetSession").addEventListener("click", async () => {
  await send({ type: "RESET_SESSION" });
  await render(false);
});

$("resetToday").addEventListener("click", async () => {
  await send({ type: "RESET_TODAY" });
  await render(false);
});

$("openDashboard").addEventListener("click", async () => {
  const s = await chrome.storage.local.get(DEFAULTS);
  await chrome.tabs.create({ url: `${s.apiUrl.replace(/\/$/, "")}/analytics` });
});

$("disconnect").addEventListener("click", async () => {
  await send({ type: "DISCONNECT" });
  await render(true);
});

async function start() {
  await render(true);
  await send({ type: "GET_DATA" });
  await render(true);
}

void start();
setInterval(() => {
  if (!document.hidden) void render(false);
}, 1000);
chrome.storage.onChanged.addListener(() => void render(false));
