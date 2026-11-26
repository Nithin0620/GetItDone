"use client";

import { ArrowRight, Clock3, Play, Plus, RotateCcw, Search, SunMedium, X } from "lucide-react";
import { useState } from "react";
import { TaskRow } from "@/components/TaskRow";
import { useStore } from "@/components/StoreProvider";
import { formatLongDate, progress, shiftDate, todayKey } from "@/lib/utils";

export default function MyDayPage() {
  const { state, updateTask, startFocus, setQuickAddOpen, notify } = useStore();
  const [query, setQuery] = useState("");
  const active = state.tasks.filter((task) => !task.archived);
  const myDay = active
    .filter((task) => task.myDay)
    .sort((a, b) => (a.dayBlock ?? "99:99").localeCompare(b.dayBlock ?? "99:99"));
  const stat = progress(myDay);
  const candidates = active
    .filter((task) => !task.myDay && task.status !== "done")
    .filter((task) => !query || task.title.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);
  const reminders = active
    .filter((task) => task.reminderAt && task.status !== "done")
    .filter((task) => new Date(task.reminderAt as string).getTime() <= Date.now())
    .slice(0, 5);

  function rollOver() {
    const tomorrow = shiftDate(todayKey(), 1);
    myDay
      .filter((task) => task.status !== "done")
      .forEach((task) =>
        updateTask(task.id, {
          dueDate: task.dueDate && task.dueDate >= tomorrow ? task.dueDate : tomorrow,
          myDay: false,
          dayBlock: undefined,
        }),
      );
    notify("Unfinished tasks moved to tomorrow");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My Day</h1>
          <p>{formatLongDate()} · pull tasks from any workspace into today</p>
        </div>
        <div className="page-head-actions">
          <button className="btn" onClick={rollOver} title="Move unfinished tasks to tomorrow">
            <RotateCcw /> Roll over
          </button>
          <button className="btn btn-primary" onClick={() => setQuickAddOpen(true)}>
            <Plus /> New task
          </button>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card stat-card">
          <div className="row muted small"><SunMedium size={15} /> Planned</div>
          <div className="stat-value">{myDay.length}</div>
          <div className="stat-label">tasks on today&apos;s plan</div>
        </div>
        <div className="card stat-card">
          <div className="row muted small"><Clock3 size={15} /> Time blocked</div>
          <div className="stat-value">
            {myDay.filter((task) => task.dayBlock).length}
          </div>
          <div className="stat-label">tasks with a start time</div>
        </div>
        <div className="card stat-card">
          <div className="row muted small"><ArrowRight size={15} /> Progress</div>
          <div className="stat-value">{stat.percent}%</div>
          <div className="stat-label">{stat.done} of {stat.total} complete</div>
        </div>
      </div>

      {reminders.length > 0 && (
        <section className="card mt-16" style={{ borderColor: "var(--danger)" }}>
          <div className="card-head">
            <h2>Reminders due</h2>
          </div>
          <div className="task-list">
            {reminders.map((task) => (
              <TaskRow key={task.id} task={task} showWorkspace />
            ))}
          </div>
        </section>
      )}

      <section className="card mt-16">
        <div className="card-head">
          <h2>Today&apos;s plan</h2>
          <span className="muted small" style={{ marginLeft: "auto" }}>
            ordered by time
          </span>
        </div>
        {myDay.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><SunMedium /></div>
            <div className="empty-title">Your day is open</div>
            <div className="small">Add a task below or press N to capture something new.</div>
          </div>
        ) : (
          <div className="task-list">
            {myDay.map((task) => (
              <div key={task.id} className="row" style={{ alignItems: "stretch", gap: 0 }}>
                <div
                  className="tiny muted"
                  style={{ width: 78, padding: "14px 10px 12px 18px", fontVariantNumeric: "tabular-nums" }}
                >
                  {task.dayBlock ?? "—"}
                </div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <TaskRow
                    task={task}
                    showWorkspace
                    trailing={
                      <>
                        <button
                          className="btn btn-sm"
                          title="Start a focus session"
                          onClick={() => {
                            startFocus(task.id, state.settings.focusMinutes);
                            notify(`Focusing on ${task.title}`);
                          }}
                        >
                          <Play /> Focus
                        </button>
                        <button
                          className="icon-btn"
                          title="Remove from My Day"
                          onClick={() => updateTask(task.id, { myDay: false, dayBlock: undefined })}
                        >
                          <X />
                        </button>
                      </>
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card mt-16">
        <div className="card-head">
          <h2>Add to today</h2>
          <div className="search-box grow" style={{ maxWidth: 260, marginLeft: "auto" }}>
            <Search />
            <input
              className="input"
              placeholder="Find a task…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        {candidates.length === 0 ? (
          <div className="empty small">No tasks available. Create one first.</div>
        ) : (
          <div className="task-list">
            {candidates.map((task) => {
              const workspace = state.workspaces.find((item) => item.id === task.workspaceId);
              return (
                <div key={task.id} className="task-row" style={{ cursor: "default" }}>
                  <div className="grow">
                    <div className="task-title">{task.title}</div>
                    <div className="task-meta">
                      <span>{workspace ? `${workspace.icon} ${workspace.name}` : "Inbox"}</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      updateTask(task.id, { myDay: true, dayBlock: "09:00" });
                      notify("Added to My Day");
                    }}
                  >
                    <Plus /> Add
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
