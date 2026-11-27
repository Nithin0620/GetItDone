const DEFAULT_API = "https://getitdone.ssh.net.in";
const MAX_INTERVAL_MS = 65_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULTS = {
  tracking: true,
  connected: false,
  token: "",
  apiUrl: DEFAULT_API,
  rules: [],
  focusActive: false,
  lastError: "",
  dailyTabData: {},
  sessionTabData: {},
  activeDomain: null,
  activeDomains: [],
  current: null,
  timeLimits: {},
  strictLimits: {},
  pending: {},
  lastTickAt: Date.now(),
  lastFlushAt: 0,
};

let state = { ...DEFAULTS };
const activeIntervals = new Map();
const alertedDomains = new Set();
let alertedDay = "";
let idleState = "active";
let queue = Promise.resolve();
let initialized = false;

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function exclusive(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function save() {
  await chrome.storage.local.set(state);
}

function siteKey(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.hostname.replace(/^www\./, "").toLowerCase();
    }
    if (parsed.protocol === "about:") {
      return `about:${parsed.pathname || "blank"}`.toLowerCase();
    }
    const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname.replace(/\/$/, "") : "";
    return `${parsed.protocol.replace(/:$/, "")}://${parsed.hostname}${path}`.toLowerCase();
  } catch {
    return null;
  }
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

function daily(day = todayKey()) {
  if (!state.dailyTabData[day]) {
    state.dailyTabData[day] = { tabData: {}, websitesVisited: [], totalTime: 0 };
  }
  return state.dailyTabData[day];
}

function pruneDaily() {
  const cutoff = Date.now() - 30 * DAY_MS;
  for (const key of Object.keys(state.dailyTabData)) {
    const [year, month, day] = key.split("-").map(Number);
    if (new Date(year, month - 1, day).getTime() < cutoff) delete state.dailyTabData[key];
  }
}

function addTime(domain, ms, now, title) {
  state.sessionTabData[domain] = (state.sessionTabData[domain] || 0) + ms;
  const today = daily();
  today.tabData[domain] = (today.tabData[domain] || 0) + ms;
  if (!today.websitesVisited.includes(domain)) today.websitesVisited.push(domain);
  today.totalTime = Object.values(today.tabData).reduce((sum, value) => sum + value, 0);

  const pending = state.pending[domain] || {
    domain,
    title: title || domain,
    startTime: new Date(now - ms).toISOString(),
    endTime: new Date(now).toISOString(),
    activeSeconds: 0,
  };
  pending.title = title || pending.title;
  pending.endTime = new Date(now).toISOString();
  pending.activeSeconds += ms / 1000;
  state.pending[domain] = pending;
}

function commitInterval(entry, now = Date.now()) {
  if (!entry) return false;
  const elapsed = Math.max(0, Math.min(now - entry.startedAt, MAX_INTERVAL_MS));
  entry.startedAt = now;
  if (!elapsed || !state.tracking || idleState !== "active") return false;
  addTime(entry.domain, elapsed, now, entry.title);
  return true;
}

function commitAll(now = Date.now()) {
  let changed = false;
  for (const entry of activeIntervals.values()) {
    if (commitInterval(entry, now)) changed = true;
  }
  return changed;
}

async function syncTabs() {
  let windows;
  try {
    windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
  } catch {
    return;
  }

  const now = Date.now();
  const seen = new Set();
  let changed = false;
  let focusedEntry = null;

  for (const window of windows) {
    const tab = (window.tabs || []).find((candidate) => candidate.active);
    if (!tab) continue;
    const domain = siteKey(tab.url);
    if (!domain) continue;

    seen.add(window.id);
    let entry = activeIntervals.get(window.id);
    if (!entry || entry.tabId !== tab.id || entry.domain !== domain) {
      if (entry && commitInterval(entry, now)) changed = true;
      entry = {
        tabId: tab.id,
        windowId: window.id,
        domain,
        title: tab.title || domain,
        startedAt: now,
      };
      activeIntervals.set(window.id, entry);
      changed = true;
    } else if (entry.title !== (tab.title || domain)) {
      entry.title = tab.title || domain;
      changed = true;
    }
    if (window.focused) focusedEntry = entry;
  }

  for (const [windowId, entry] of activeIntervals) {
    if (seen.has(windowId)) continue;
    if (commitInterval(entry, now)) changed = true;
    activeIntervals.delete(windowId);
    changed = true;
  }

  const activeDomains = [...new Set([...activeIntervals.values()].map((entry) => entry.domain))];
  if (JSON.stringify(state.activeDomains) !== JSON.stringify(activeDomains)) {
    state.activeDomains = activeDomains;
    changed = true;
  }

  if (focusedEntry) {
    const current = {
      tabId: focusedEntry.tabId,
      windowId: focusedEntry.windowId,
      domain: focusedEntry.domain,
      title: focusedEntry.title,
      startedAt: focusedEntry.startedAt,
    };
    if (JSON.stringify(state.current) !== JSON.stringify(current)) {
      state.current = current;
      changed = true;
    }
    if (state.activeDomain !== focusedEntry.domain) {
      state.activeDomain = focusedEntry.domain;
      changed = true;
    }
  } else {
    if (state.current !== null) {
      state.current = null;
      changed = true;
    }
    if (state.activeDomain !== null) {
      state.activeDomain = null;
      changed = true;
    }
  }

  if (changed) await save();
}

function notify(title, message) {
  chrome.notifications.create(
    { type: "basic", iconUrl: "icons/icon128.png", title, message, priority: 1 },
    () => void chrome.runtime.lastError,
  );
}

async function checkTimeLimits() {
  const day = todayKey();
  if (alertedDay !== day) {
    alertedDomains.clear();
    alertedDay = day;
  }
  const today = daily(day);
  let changed = false;

  for (const [domain, limit] of Object.entries(state.timeLimits)) {
    if (!limit || alertedDomains.has(domain)) continue;
    const spent = today.tabData[domain] || 0;
    if (spent < limit) continue;

    alertedDomains.add(domain);
    const limitLabel = formatDuration(limit);
    if (state.strictLimits[domain]) {
      const tabs = await chrome.tabs.query({});
      let closed = 0;
      for (const tab of tabs) {
        if (siteKey(tab.url) !== domain) continue;
        try {
          await chrome.tabs.remove(tab.id);
          closed += 1;
        } catch {
          // Tab may already be closed.
        }
      }
      notify("Strict time limit enforced", `Reached ${limitLabel} on ${domain}. ${closed} tab(s) closed.`);
      delete state.timeLimits[domain];
      delete state.strictLimits[domain];
    } else {
      notify("Time limit reached", `You spent ${formatDuration(spent)} on ${domain}. Limit: ${limitLabel}.`);
    }
    changed = true;
  }

  if (changed) await save();
}

async function tick() {
  const now = Date.now();
  if (!state.tracking || idleState !== "active") {
    for (const entry of activeIntervals.values()) entry.startedAt = now;
    state.lastTickAt = now;
    await save();
    return;
  }

  let changed = commitAll(now);
  state.lastTickAt = now;
  if (state.current) {
    const focused = [...activeIntervals.values()].find((entry) => entry.windowId === state.current.windowId);
    if (focused && state.current.startedAt !== focused.startedAt) {
      state.current = { ...state.current, startedAt: focused.startedAt, title: focused.title };
      changed = true;
    }
  }
  if (changed) {
    pruneDaily();
    await checkTimeLimits();
  }
  await save();
}

async function flushEvents() {
  const events = Object.values(state.pending);
  if (!state.connected || !state.token || !events.length) return;
  try {
    const response = await fetch(`${(state.apiUrl || DEFAULT_API).replace(/\/$/, "")}/api/extension/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ events }),
    });
    if (!response.ok) throw new Error(String(response.status));
    for (const event of events) {
      if (state.pending[event.domain] === event) delete state.pending[event.domain];
    }
    state.lastFlushAt = Date.now();
    if (String(state.lastError || "").startsWith("Sync")) state.lastError = "";
  } catch {
    state.lastError = "Sync offline";
  }
  await save();
}

async function applyBlocking(rules, focusActive) {
  const blockRules = focusActive
    ? rules
        .filter((rule) => rule.blockedDuringFocus)
        .map((rule, index) => ({
          id: index + 1,
          priority: 1,
          action: { type: "block" },
          condition: { urlFilter: `||${rule.domain}^`, resourceTypes: ["main_frame"] },
        }))
    : [];
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: blockRules,
  });
}

async function loadConfig() {
  if (!state.connected || !state.token) return;
  try {
    const response = await fetch(`${(state.apiUrl || DEFAULT_API).replace(/\/$/, "")}/api/extension/config`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (!response.ok) throw new Error(String(response.status));
    const config = await response.json();
    const rules = Array.isArray(config.domainRules) ? config.domainRules : [];
    await applyBlocking(rules, Boolean(config.focusActive));
    state.rules = rules;
    state.focusActive = Boolean(config.focusActive);
    if (String(state.lastError || "").startsWith("Config")) state.lastError = "";
  } catch {
    state.lastError = "Config offline";
  }
  await save();
}

async function init() {
  if (initialized) return;
  initialized = true;
  const stored = await chrome.storage.local.get(DEFAULTS);
  state = { ...DEFAULTS, ...stored };
  if (/localhost|127\.0\.0\.1/.test(state.apiUrl)) state.apiUrl = DEFAULT_API;
  state.apiUrl = state.apiUrl.replace(/\/$/, "") || DEFAULT_API;
  try {
    idleState = await chrome.idle.queryState(60);
    await chrome.idle.setDetectionInterval(60);
  } catch {
    idleState = "active";
  }
  await chrome.alarms.create("tick", { periodInMinutes: 1 });
  await exclusive(async () => {
    await syncTabs();
    await save();
  });
  setInterval(() => void exclusive(tick), 1000);
  setInterval(() => void exclusive(syncTabs), 10_000);
  void exclusive(loadConfig);
  void exclusive(flushEvents);
}

function snapshot() {
  return {
    tracking: state.tracking,
    connected: state.connected,
    lastError: state.lastError,
    current: state.current,
    activeDomain: state.activeDomain,
    activeDomains: state.activeDomains,
    daily: state.dailyTabData[todayKey()] || { tabData: {}, websitesVisited: [], totalTime: 0 },
    sessionTabData: state.sessionTabData,
    timeLimits: state.timeLimits,
    strictLimits: state.strictLimits,
    pendingCount: Object.keys(state.pending).length,
    lastTickAt: state.lastTickAt,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message?.type;
  if (type === "PING") {
    sendResponse({ ok: true });
    return false;
  }

  void exclusive(async () => {
    try {
      if (type === "CONNECT") {
        const token = String(message.token || "").trim();
        const apiUrl = String(message.apiUrl || DEFAULT_API).trim().replace(/\/$/, "") || DEFAULT_API;
        if (!token) {
          sendResponse({ ok: false, error: "Missing sync token" });
          return;
        }
        state.token = token;
        state.apiUrl = apiUrl;
        state.connected = true;
        state.lastError = "";
        await save();
        await syncTabs();
        sendResponse({ ok: true });
        void exclusive(loadConfig);
        void exclusive(flushEvents);
      } else if (type === "DISCONNECT") {
        commitAll();
        state.connected = false;
        state.token = "";
        state.lastError = "";
        state.current = null;
        state.activeDomain = null;
        activeIntervals.clear();
        await applyBlocking([], false);
        await save();
        sendResponse({ ok: true });
      } else if (type === "TOGGLE_TRACKING") {
        state.tracking = Boolean(message.enabled);
        if (!state.tracking) commitAll();
        await syncTabs();
        await save();
        sendResponse({ ok: true, tracking: state.tracking });
      } else if (type === "SET_TIME_LIMIT") {
        const domain = String(message.domain || "").trim().toLowerCase();
        const minutes = Number(message.minutes);
        if (!domain) {
          sendResponse({ ok: false });
          return;
        }
        if (Number.isFinite(minutes) && minutes > 0) {
          state.timeLimits[domain] = minutes * 60_000;
          if (message.strict) state.strictLimits[domain] = true;
          else delete state.strictLimits[domain];
          alertedDomains.delete(domain);
        } else {
          delete state.timeLimits[domain];
          delete state.strictLimits[domain];
          alertedDomains.delete(domain);
        }
        await save();
        sendResponse({ ok: true });
      } else if (type === "RESET_SESSION") {
        state.sessionTabData = {};
        for (const entry of activeIntervals.values()) entry.startedAt = Date.now();
        await save();
        sendResponse({ ok: true });
      } else if (type === "RESET_TODAY") {
        delete state.dailyTabData[todayKey()];
        alertedDomains.clear();
        await save();
        sendResponse({ ok: true });
      } else if (type === "GET_DATA") {
        await syncTabs();
        sendResponse({ ok: true, ...snapshot() });
      } else if (type === "REFRESH") {
        await syncTabs();
        await save();
        sendResponse({ ok: true });
        void exclusive(flushEvents);
        void exclusive(loadConfig);
      } else if (type === "CLEAR_BLOCK") {
        await applyBlocking([], false);
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false });
      }
    } catch {
      sendResponse({ ok: false });
    }
  });
  return true;
});

const resync = () => void exclusive(syncTabs);

chrome.tabs.onActivated.addListener(resync);
chrome.tabs.onCreated.addListener(resync);
chrome.tabs.onRemoved.addListener(resync);
chrome.windows.onCreated.addListener(resync);
chrome.windows.onFocusChanged.addListener(resync);
chrome.windows.onRemoved.addListener(resync);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.title || changeInfo.status === "complete") resync();
});

chrome.idle.onStateChanged.addListener((newState) =>
  void exclusive(async () => {
    const now = Date.now();
    if (newState === "active") {
      idleState = "active";
      await syncTabs();
    } else {
      commitAll(now);
      for (const entry of activeIntervals.values()) entry.startedAt = now;
      idleState = newState;
      state.lastTickAt = now;
      await save();
    }
  }),
);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "tick") return;
  void exclusive(async () => {
    await syncTabs();
    await tick();
  });
  void exclusive(flushEvents);
  void exclusive(loadConfig);
});

chrome.runtime.onInstalled.addListener(() => void init());
chrome.runtime.onStartup.addListener(() => void init());

void init();
