"use client";

import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Chrome,
  Copy,
  Database,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  Sun,
  Trash2,
  Unplug,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/components/StoreProvider";

function normalizeDomain(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .toLowerCase();
}

interface CalendarStatus {
  connected: boolean;
  status: string;
  lastSyncedAt: string | null;
  channelExpiration: string | null;
  lastError: string | null;
  conflicts: number;
}

interface CalendarConflict {
  id: string;
  title: string;
  error: string | null;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const {
    state,
    updateSettings,
    resetDemo,
    notify,
    addDomainRule,
    updateDomainRule,
    deleteDomainRule,
  } = useStore();
  const dark = state.settings.theme === "dark";
  const [token, setToken] = useState<string | null>(null);
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [newDomain, setNewDomain] = useState("");

  useEffect(() => {
    if (!session?.user?.id) return;
    void (async () => {
      const response = await fetch("/api/extension/token");
      if (!response.ok) return;
      const data = (await response.json()) as { token: string | null; configured: boolean };
      setToken(data.token);
      setTokenConfigured(Boolean(data.configured));
    })();
  }, [session?.user?.id]);

  async function generateToken() {
    if (tokenConfigured) await fetch("/api/extension/token", { method: "DELETE" });
    const response = await fetch("/api/extension/token");
    if (!response.ok) {
      notify("Could not generate a sync token");
      return;
    }
    const data = (await response.json()) as { token: string | null };
    setToken(data.token);
    setTokenConfigured(true);
    notify("Sync token ready — copy it into the extension");
  }

  async function revokeToken() {
    await fetch("/api/extension/token", { method: "DELETE" });
    setToken(null);
    setTokenConfigured(false);
    notify("Extension disconnected");
  }

  const [calendar, setCalendar] = useState<CalendarStatus | null>(null);
  const [conflicts, setConflicts] = useState<CalendarConflict[]>([]);
  const [syncing, setSyncing] = useState(false);

  const loadCalendar = useCallback(async () => {
    const response = await fetch("/api/calendar/status");
    if (!response.ok) return;
    const data = (await response.json()) as CalendarStatus;
    setCalendar(data);
    if (!data.connected) {
      setConflicts([]);
      return;
    }
    const conflictResponse = await fetch("/api/calendar/conflicts");
    if (!conflictResponse.ok) return;
    const conflictData = (await conflictResponse.json()) as { items: CalendarConflict[] };
    setConflicts(conflictData.items ?? []);
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    void loadCalendar();
    const status = new URLSearchParams(window.location.search).get("calendar");
    if (status === "connected") notify("Google Calendar connected");
    if (status === "error") notify("Google Calendar connection failed");
  }, [session?.user?.id, loadCalendar, notify]);

  async function syncNow() {
    setSyncing(true);
    try {
      const response = await fetch("/api/calendar/sync", { method: "POST" });
      const data = (await response.json()) as { error?: string; pushed?: number; pulled?: number };
      if (!response.ok) {
        notify(data.error ?? "Calendar sync failed");
        return;
      }
      notify(`Synced ${data.pushed ?? 0} local and ${data.pulled ?? 0} remote changes`);
      await loadCalendar();
    } finally {
      setSyncing(false);
    }
  }

  async function resolveConflict(taskId: string, choice: "local" | "google") {
    await fetch("/api/calendar/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, choice }),
    });
    notify(choice === "local" ? "Local version kept" : "Google version applied");
    await loadCalendar();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Make the app feel like yours.</p>
        </div>
      </div>

      <div className="stack" style={{ maxWidth: 760 }}>
        <section className="card card-pad">
          <h2 className="strong" style={{ margin: "0 0 14px", fontSize: 14 }}>Appearance</h2>
          <div className="row" style={{ gap: 8 }}>
            <button
              className={`btn ${!dark ? "btn-primary" : ""}`}
              onClick={() => updateSettings({ theme: "light" })}
            >
              <Sun /> Light
            </button>
            <button
              className={`btn ${dark ? "btn-primary" : ""}`}
              onClick={() => updateSettings({ theme: "dark" })}
            >
              <Moon /> Dark
            </button>
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="strong" style={{ margin: "0 0 14px", fontSize: 14 }}>Focus timer</h2>
          <div className="detail-grid">
            <div className="field">
              <label>Focus length (minutes)</label>
              <input
                className="input"
                type="number"
                min="1"
                max="180"
                value={state.settings.focusMinutes}
                onChange={(event) => updateSettings({ focusMinutes: Math.max(1, Number(event.target.value) || 1) })}
              />
            </div>
            <div className="field">
              <label>Break length (minutes)</label>
              <input
                className="input"
                type="number"
                min="1"
                max="60"
                value={state.settings.breakMinutes}
                onChange={(event) => updateSettings({ breakMinutes: Math.max(1, Number(event.target.value) || 1) })}
              />
            </div>
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="strong" style={{ margin: "0 0 14px", fontSize: 14 }}>Reminders</h2>
          <div className="row space-between">
            <div>
              <div className="row small"><Bell size={14} /> Browser notifications</div>
              <div className="tiny muted" style={{ marginTop: 3 }}>
                {state.settings.notifications ? "Enabled" : "Off"}
              </div>
            </div>
            <button
              className="btn btn-sm"
              onClick={async () => {
                if (typeof Notification === "undefined") {
                  notify("Notifications are not supported here");
                  return;
                }
                const permission = await Notification.requestPermission();
                updateSettings({ notifications: permission === "granted" });
                notify(permission === "granted" ? "Notifications enabled" : "Notifications blocked");
              }}
            >
              Enable
            </button>
          </div>
        </section>

        <section className="card card-pad">
          <div className="row space-between" style={{ marginBottom: 12 }}>
            <h2 className="strong" style={{ margin: 0, fontSize: 14 }}>Google Calendar</h2>
            <CalendarDays size={16} className="muted" />
          </div>
          {!session?.user ? (
            <p className="muted small" style={{ margin: 0 }}>
              Sign in with Google to connect your calendar.
            </p>
          ) : !calendar ? (
            <p className="muted small" style={{ margin: 0 }}>Loading calendar status…</p>
          ) : !calendar.connected ? (
            <>
              <p className="muted small" style={{ marginTop: 0 }}>
                Sync tasks with due dates both ways. Google changes create tasks, and local edits update events.
              </p>
              <a className="btn btn-sm btn-primary" href="/api/calendar/connect">
                <CalendarDays /> Connect Google Calendar
              </a>
            </>
          ) : (
            <>
              <div className="row space-between">
                <div className="row small"><CheckCircle2 size={14} /> Connected</div>
                <span className="chip">{calendar.status}</span>
              </div>
              <div className="tiny muted" style={{ marginTop: 6 }}>
                Last synced {calendar.lastSyncedAt ? new Date(calendar.lastSyncedAt).toLocaleString() : "never"} · Push notifications{" "}
                {calendar.channelExpiration
                  ? `active until ${new Date(calendar.channelExpiration).toLocaleDateString()}`
                  : "not active"}
              </div>
              {calendar.lastError && <p className="error small">{calendar.lastError}</p>}
              <div className="row space-between mt-16">
                <span className="small">Auto-sync tasks with due dates</span>
                <button
                  className={`btn btn-sm ${state.settings.calendarSyncEnabled ? "btn-primary" : ""}`}
                  onClick={async () => {
                    const enabled = !state.settings.calendarSyncEnabled;
                    updateSettings({ calendarSyncEnabled: enabled });
                    if (enabled) await syncNow();
                  }}
                >
                  {state.settings.calendarSyncEnabled ? "On" : "Off"}
                </button>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-sm" onClick={() => void syncNow()} disabled={syncing}>
                  <RefreshCw /> {syncing ? "Syncing…" : "Sync now"}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={async () => {
                    await fetch("/api/calendar/disconnect", { method: "POST" });
                    updateSettings({ calendarSyncEnabled: false });
                    await loadCalendar();
                    notify("Google Calendar disconnected");
                  }}
                >
                  <Unplug /> Disconnect
                </button>
              </div>
              {conflicts.length > 0 && (
                <>
                  <h3 className="strong small row" style={{ margin: "18px 0 8px" }}>
                    <AlertTriangle size={14} /> Conflicts
                  </h3>
                  {conflicts.map((conflict) => (
                    <div key={conflict.id} className="rule-row">
                      <div className="grow">
                        <strong className="small">{conflict.title}</strong>
                        <div className="tiny muted">{conflict.error ?? "Changed in both places"}</div>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => void resolveConflict(conflict.id, "local")}
                        >
                          Keep local
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => void resolveConflict(conflict.id, "google")}
                        >
                          Use Google
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </section>

        <section className="card card-pad">
          <div className="row space-between" style={{ marginBottom: 12 }}>
            <h2 className="strong" style={{ margin: 0, fontSize: 14 }}>Time tracking extension</h2>
            <Chrome size={16} className="muted" />
          </div>
          {!session?.user ? (
            <p className="muted small" style={{ margin: 0 }}>
              Sign in with Google to generate a sync token and use the Chrome extension.
            </p>
          ) : (
            <>
              <p className="muted small" style={{ marginTop: 0 }}>
                Load the extension from <code>extension/</code>, then paste this token in its popup.
              </p>
              {token ? (
                <>
                  <div className="token-box">{token}</div>
                  <div className="row" style={{ gap: 8 }}>
                    <button
                      className="btn btn-sm"
                      onClick={async () => {
                        await navigator.clipboard.writeText(token);
                        notify("Token copied");
                      }}
                    >
                      <Copy /> Copy
                    </button>
                    <button className="btn btn-sm" onClick={() => void generateToken()}>
                      Replace token
                    </button>
                  </div>
                </>
              ) : (
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => void generateToken()}>
                    {tokenConfigured ? "Generate new token" : "Generate token"}
                  </button>
                  {tokenConfigured && (
                    <button className="btn btn-sm" onClick={() => void revokeToken()}>
                      <Unplug /> Revoke
                    </button>
                  )}
                </div>
              )}

              <h3 className="strong small" style={{ margin: "18px 0 8px" }}>Domain rules</h3>
              <div className="row" style={{ gap: 8 }}>
                <input
                  className="input"
                  placeholder="example.com"
                  value={newDomain}
                  onChange={(event) => setNewDomain(event.target.value)}
                />
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    const domain = normalizeDomain(newDomain);
                    if (!domain) {
                      notify("Enter a domain first");
                      return;
                    }
                    if (state.domainRules.some((rule) => rule.domain === domain)) {
                      notify("That rule already exists");
                      return;
                    }
                    addDomainRule({ domain });
                    setNewDomain("");
                  }}
                >
                  <Plus /> Add
                </button>
              </div>
              <div className="mt-16">
                {state.domainRules.length === 0 ? (
                  <div className="empty small">Add domains to map time to workspaces or set limits.</div>
                ) : (
                  state.domainRules.map((rule) => (
                    <div key={rule.id} className="rule-row">
                      <div className="grow">
                        <strong className="small">{rule.domain}</strong>
                        <select
                          className="input mt-8"
                          value={rule.workspaceId ?? ""}
                          onChange={(event) =>
                            updateDomainRule(rule.id, { workspaceId: event.target.value || null })
                          }
                        >
                          <option value="">No workspace</option>
                          {state.workspaces.map((workspace) => (
                            <option key={workspace.id} value={workspace.id}>
                              {workspace.icon} {workspace.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        <input
                          className="input"
                          style={{ width: 74 }}
                          type="number"
                          min={0}
                          max={1440}
                          placeholder="min"
                          title="Daily budget in minutes"
                          value={rule.budgetMinutesPerDay ?? ""}
                          onChange={(event) =>
                            updateDomainRule(rule.id, {
                              budgetMinutesPerDay: Number(event.target.value) || undefined,
                            })
                          }
                        />
                        <label className="tiny muted row" style={{ gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={rule.blockedDuringFocus}
                            onChange={(event) =>
                              updateDomainRule(rule.id, { blockedDuringFocus: event.target.checked })
                            }
                          />
                          Block
                        </label>
                        <button
                          className="btn btn-sm"
                          onClick={() => deleteDomainRule(rule.id)}
                          title="Delete rule"
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </section>

        <section className="card card-pad">
          <h2 className="strong" style={{ margin: "0 0 14px", fontSize: 14 }}>Data</h2>
          <div className="row space-between">
            <div>
              <div className="row small"><Database size={14} /> Local demo data</div>
              <div className="tiny muted" style={{ marginTop: 3 }}>
                {session?.user
                  ? "Synced to MongoDB for your Google account."
                  : "Stored in this browser. Add credentials from .env.example to enable Google sign-in and cloud sync."}
              </div>
            </div>
            <button className="btn btn-sm" onClick={resetDemo}>
              <RotateCcw /> Reset
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
