const DEFAULT_API = "http://localhost:3000";

async function getState() {
  return chrome.storage.local.get({
    tracking: true,
    connected: false,
    token: "",
    apiUrl: DEFAULT_API,
    events: [],
    current: null,
    rules: [],
    focusActive: false,
    lastError: "",
  });
}

async function patchState(patch) {
  await chrome.storage.local.set(patch);
}

function baseUrl(url) {
  return (url || DEFAULT_API).replace(/\/$/, "");
}

function domainOf(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

async function closeCurrent() {
  const state = await getState();
  const current = state.current;
  if (!current) return;
  const endedAt = Date.now();
  const activeSeconds = Math.round((endedAt - current.startedAt) / 1000);
  if (activeSeconds >= 5) {
    const event = {
      domain: current.domain,
      title: current.title,
      startTime: new Date(current.startedAt).toISOString(),
      endTime: new Date(endedAt).toISOString(),
      activeSeconds,
    };
    await patchState({ current: null, events: [...state.events, event].slice(-500) });
  } else {
    await patchState({ current: null });
  }
}

async function activateTab(tabId, windowId) {
  if (!tabId) return;
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    await closeCurrent();
    return;
  }
  if (!tab.active || (windowId && tab.windowId !== windowId)) return;

  const state = await getState();
  if (!state.tracking || !state.connected) {
    await closeCurrent();
    return;
  }
  const domain = domainOf(tab.url);
  if (!domain) {
    await closeCurrent();
    return;
  }
  if (state.current && state.current.tabId === tabId && state.current.domain === domain) {
    await patchState({ current: { ...state.current, title: tab.title || domain } });
    return;
  }
  await closeCurrent();
  await patchState({
    current: {
      tabId,
      windowId: tab.windowId,
      domain,
      title: tab.title || domain,
      startedAt: Date.now(),
    },
  });
}

async function handleFocusWindow(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await closeCurrent();
    return;
  }
  const tabs = await chrome.tabs.query({ active: true, windowId });
  if (tabs[0]?.id) await activateTab(tabs[0].id, windowId);
}

async function flushEvents() {
  const state = await getState();
  if (!state.connected || !state.token || !state.events.length) return;
  try {
    const response = await fetch(`${baseUrl(state.apiUrl)}/api/extension/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ events: state.events }),
    });
    if (response.ok) await patchState({ events: [], lastError: "" });
    else await patchState({ lastError: `Sync failed (${response.status})` });
  } catch {
    await patchState({ lastError: "Sync offline" });
  }
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
  const state = await getState();
  if (!state.connected || !state.token) return;
  try {
    const response = await fetch(`${baseUrl(state.apiUrl)}/api/extension/config`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (!response.ok) throw new Error("config failed");
    const config = await response.json();
    const rules = config.domainRules || [];
    await applyBlocking(rules, Boolean(config.focusActive));
    await patchState({
      rules,
      focusActive: Boolean(config.focusActive),
      lastError: "",
    });
  } catch {
    await patchState({ lastError: "Config offline" });
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "refresh") {
    void flushEvents();
    void loadConfig();
  }
  if (message.type === "stop") void closeCurrent();
  if (message.type === "clearBlock") void applyBlocking([], false);
});

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.idle.setDetectionInterval(60);
  await chrome.alarms.create("sync", { periodInMinutes: 1 });
  await handleFocusWindow(chrome.windows.WINDOW_ID_CURRENT);
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.create("sync", { periodInMinutes: 1 });
  const windows = await chrome.windows.getAll({ windowTypes: ["normal"] });
  if (windows[0]?.id) await handleFocusWindow(windows[0].id);
});

chrome.alarms.onAlarm.addListener(async () => {
  await flushEvents();
  await loadConfig();
});

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  await activateTab(tabId, windowId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  const state = await getState();
  if (!state.current || state.current.tabId !== tabId) return;
  if (changeInfo.url) await activateTab(tabId, state.current.windowId);
  else if (changeInfo.title) {
    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      return;
    }
    await patchState({ current: { ...state.current, title: tab.title || state.current.domain } });
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState();
  if (state.current?.tabId === tabId) await closeCurrent();
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  await handleFocusWindow(windowId);
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const state = await getState();
  if (state.current?.windowId === windowId) await closeCurrent();
});

chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === "idle" || state === "locked") await closeCurrent();
  else if (state === "active") await handleFocusWindow(chrome.windows.WINDOW_ID_CURRENT);
});
