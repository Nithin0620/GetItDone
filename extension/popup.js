const DEFAULTS = {
  tracking: true,
  connected: false,
  token: "",
  apiUrl: "http://localhost:3000",
  events: [],
  current: null,
  rules: [],
  focusActive: false,
  lastError: "",
};

const $ = (id) => document.getElementById(id);

function state() {
  return chrome.storage.local.get(DEFAULTS);
}

function formatSeconds(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function localDay(iso) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

async function render() {
  const s = await state();
  $("apiUrl").value = s.apiUrl;
  $("token").value = s.token;
  $("setup").hidden = s.connected;
  $("dashboard").hidden = !s.connected;
  $("status").textContent = !s.connected
    ? "Not connected"
    : s.tracking
      ? "Tracking"
      : "Paused";
  $("status").classList.toggle("off", !s.connected || !s.tracking);
  if (!s.connected) return;

  $("toggle").textContent = s.tracking ? "Pause" : "Resume";
  const today = localDay(new Date().toISOString());
  const totals = new Map();
  for (const event of s.events) {
    if (localDay(event.startTime) === today) {
      totals.set(event.domain, (totals.get(event.domain) || 0) + event.activeSeconds);
    }
  }
  if (s.current && localDay(new Date(s.current.startedAt).toISOString()) === today) {
    const elapsed = Math.round((Date.now() - s.current.startedAt) / 1000);
    totals.set(s.current.domain, (totals.get(s.current.domain) || 0) + Math.max(0, elapsed));
  }

  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  $("todayTotal").textContent = formatSeconds(total);
  $("currentDomain").textContent = s.current?.domain || "—";
  $("currentTitle").textContent = s.current?.title || "No active page";
  $("syncStatus").textContent = s.lastError || `${s.events.length} event(s) waiting to sync`;
  $("syncStatus").classList.toggle("error", Boolean(s.lastError));

  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  $("topSites").innerHTML = top.length
    ? top
        .map(
          ([domain, seconds]) =>
            `<div class="site"><span>${domain}</span><strong>${formatSeconds(seconds)}</strong></div>`,
        )
        .join("")
    : '<p class="muted">No sites tracked yet today.</p>';
}

$("connect").addEventListener("click", async () => {
  const token = $("token").value.trim();
  const apiUrl = $("apiUrl").value.trim().replace(/\/$/, "") || DEFAULTS.apiUrl;
  $("setupError").textContent = "";
  if (!token) {
    $("setupError").textContent = "Paste your sync token first.";
    return;
  }
  await chrome.storage.local.set({ token, apiUrl, connected: true, lastError: "" });
  chrome.runtime.sendMessage({ type: "refresh" });
  await render();
});

$("toggle").addEventListener("click", async () => {
  const s = await state();
  await chrome.storage.local.set({ tracking: !s.tracking });
  if (s.tracking) chrome.runtime.sendMessage({ type: "stop" });
  await render();
});

$("openDashboard").addEventListener("click", async () => {
  const s = await state();
  await chrome.tabs.create({ url: `${s.apiUrl.replace(/\/$/, "")}/analytics` });
});

$("disconnect").addEventListener("click", async () => {
  chrome.runtime.sendMessage({ type: "clearBlock" });
  await chrome.storage.local.set({ connected: false, token: "", lastError: "" });
  await render();
});

render();
