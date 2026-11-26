"use client";

import { Check, Coffee, Pause, Play, Square, Timer, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/components/StoreProvider";
import { minutesLabel } from "@/lib/analytics";

function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function FocusTimer() {
  const {
    state,
    startFocus,
    updateFocus,
    finishFocus,
    updateSettings,
    notify,
  } = useStore();
  const [open, setOpen] = useState(false);
  const [taskId, setTaskId] = useState<string>("");
  const [minutes, setMinutes] = useState(state.settings.focusMinutes);
  const [now, setNow] = useState(() => Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [breakEnd, setBreakEnd] = useState<number | null>(null);

  const running = state.focusSessions.find((session) => !session.endedAt);
  const runningId = running?.id;
  const task = state.tasks.find((item) => item.id === running?.taskId);
  const workspace = state.workspaces.find((item) => item.id === running?.workspaceId);
  const tasks = state.tasks
    .filter((item) => !item.archived && item.status !== "done")
    .sort((a, b) => Number(b.myDay) - Number(a.myDay));

  useEffect(() => {
    if (!runningId && !breakEnd) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [runningId, breakEnd]);

  useEffect(() => {
    if (!running && !open) setMinutes(state.settings.focusMinutes);
  }, [state.settings.focusMinutes, running, open]);

  useEffect(() => {
    if (breakEnd && now >= breakEnd) {
      setBreakEnd(null);
      notify("Break finished");
    }
  }, [breakEnd, now, notify]);

  if (!running) {
    return (
      <div className="focus-widget">
        {breakEnd ? (
          <div className="card focus-card">
            <div className="row">
              <Coffee size={16} className="muted" />
              <span className="small strong grow">Break</span>
              <button className="icon-btn" onClick={() => setBreakEnd(null)} title="End break">
                <X />
              </button>
            </div>
            <div className="focus-time">{clock((breakEnd - now) / 1000)}</div>
            <div className="tiny muted">Step away from the screen.</div>
          </div>
        ) : open ? (
          <div className="card focus-card">
            <div className="row">
              <Timer size={16} className="muted" />
              <span className="small strong grow">Focus session</span>
              <button className="icon-btn" onClick={() => setOpen(false)} title="Close">
                <X />
              </button>
            </div>
            <div className="field">
              <label>Working on</label>
              <select className="select" value={taskId} onChange={(event) => setTaskId(event.target.value)}>
                <option value="">No specific task</option>
                {tasks.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Duration (minutes)</label>
              <input
                className="input"
                type="number"
                min="1"
                max="180"
                value={minutes}
                onChange={(event) => {
                  const value = Number(event.target.value) || 1;
                  setMinutes(value);
                  updateSettings({ focusMinutes: value });
                }}
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              onClick={() => {
                startFocus(taskId || null, minutes);
                setOpen(false);
                notify("Focus session started");
              }}
            >
              <Play /> Start focusing
            </button>
          </div>
        ) : (
          <button className="card focus-launch" onClick={() => setOpen(true)}>
            <Timer size={16} />
            <span>Focus</span>
            <span className="focus-launch-time">{minutes}m</span>
          </button>
        )}
      </div>
    );
  }

  const elapsed =
    Math.floor(((pausedAt ?? now) - new Date(running.startedAt).getTime()) / 1000) -
    Math.floor(running.pausedSeconds);
  const remaining = running.plannedMinutes * 60 - elapsed;

  return (
    <div className="focus-widget">
      <div className="card focus-card running">
        <div className="row">
          <span className="priority-dot p-high" />
          <span className="small strong grow truncate">{task?.title ?? "Open focus"}</span>
          <button className="icon-btn" onClick={() => setPausedAt(pausedAt ? null : now)} title={pausedAt ? "Resume" : "Pause"}>
            {pausedAt ? <Play /> : <Pause />}
          </button>
        </div>
        <div className="focus-time">{clock(remaining)}</div>
        <div className="tiny muted">
          {workspace ? `${workspace.icon} ${workspace.name} · ` : ""}
          {pausedAt ? "Paused" : "In progress"} · {minutesLabel(Math.max(0, elapsed))}
        </div>
        <div className="row" style={{ gap: 6, marginTop: 10 }}>
          <button
            className="btn btn-sm grow"
            onClick={() => {
              updateFocus(running.id, { actualSeconds: Math.max(0, elapsed) });
              finishFocus(running.id, false);
              setPausedAt(null);
              notify("Session stopped");
            }}
          >
            <Square /> Stop
          </button>
          <button
            className="btn btn-sm btn-primary grow"
            onClick={() => {
              updateFocus(running.id, { actualSeconds: Math.max(0, elapsed) });
              finishFocus(running.id, true);
              setPausedAt(null);
              setBreakEnd(Date.now() + state.settings.breakMinutes * 60 * 1000);
              notify("Session complete — take a break");
            }}
          >
            <Check /> Complete
          </button>
        </div>
      </div>
    </div>
  );
}
