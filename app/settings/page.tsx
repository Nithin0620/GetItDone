"use client";

import { Bell, Database, Moon, RotateCcw, Sun } from "lucide-react";
import { useSession } from "next-auth/react";
import { useStore } from "@/components/StoreProvider";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { state, updateSettings, resetDemo, notify } = useStore();
  const dark = state.settings.theme === "dark";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Make the app feel like yours.</p>
        </div>
      </div>

      <div className="stack" style={{ maxWidth: 640 }}>
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
