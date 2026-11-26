"use client";

import {
  Archive,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Columns3,
  List,
  Plus,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { TaskRow } from "@/components/TaskRow";
import { useStore } from "@/components/StoreProvider";
import type { Status } from "@/lib/types";
import {
  formatDate,
  progress,
  STATUSES,
  STATUS_LABELS,
  todayKey,
} from "@/lib/utils";

type View = "list" | "board" | "calendar";
type Filter = "all" | "today" | "upcoming" | "done";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "done", label: "Done" },
];

export default function WorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { state, setQuickAddOpen, updateTask, updateWorkspace, openTask, notify } = useStore();
  const [view, setView] = useState<View>("list");
  const [filter, setFilter] = useState<Filter>("all");
  const [month, setMonth] = useState(() => new Date());
  const workspace = state.workspaces.find((item) => item.id === params.id);

  if (!workspace) {
    return (
      <div className="empty card">
        <div className="empty-title">Workspace not found</div>
        <button className="btn mt-8" onClick={() => router.push("/workspaces")}>
          Back to workspaces
        </button>
      </div>
    );
  }

  const allTasks = state.tasks.filter(
    (task) => task.workspaceId === workspace.id && !task.archived,
  );
  const filtered = allTasks.filter((task) => {
    if (filter === "today") return task.dueDate === todayKey() || task.myDay;
    if (filter === "upcoming") return task.dueDate && task.dueDate > todayKey() && task.status !== "done";
    if (filter === "done") return task.status === "done";
    return true;
  });
  const stat = progress(allTasks);

  return (
    <>
      <div className="page-head">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="workspace-icon" style={{ width: 42, height: 42, fontSize: 21 }}>
            {workspace.icon}
          </div>
          <div>
            <h1>{workspace.name}</h1>
            <p>{workspace.description || "Your tasks in one place."}</p>
          </div>
        </div>
        <div className="page-head-actions">
          <button
            className="icon-btn"
            title="Archive workspace"
            onClick={() => {
              updateWorkspace(workspace.id, { archived: true });
              notify("Workspace archived");
              router.push("/workspaces");
            }}
          >
            <Archive />
          </button>
          <button className="btn btn-primary" onClick={() => setQuickAddOpen(true, workspace.id)}>
            <Plus /> New task
          </button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="row space-between small">
          <span className="muted">{stat.done} of {stat.total} completed</span>
          <span className="strong">{stat.percent}%</span>
        </div>
        <div className="progress-track mt-8">
          <div className="progress-fill" style={{ width: `${stat.percent}%`, background: workspace.color }} />
        </div>
        {workspace.categories.length > 0 && (
          <div className="row wrap mt-16" style={{ gap: 6 }}>
            {workspace.categories.map((category) => (
              <span key={category} className="chip">
                {category} · {allTasks.filter((task) => task.category === category).length}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="row space-between mt-24" style={{ gap: 12 }}>
        <div className="row wrap" style={{ gap: 5 }}>
          {FILTERS.map((item) => (
            <button
              key={item.id}
              className={`chip ${filter === item.id ? "active" : ""}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="view-switch">
          <button className={view === "list" ? "active" : ""} onClick={() => setView("list")} title="List">
            <List /> List
          </button>
          <button className={view === "board" ? "active" : ""} onClick={() => setView("board")} title="Board">
            <Columns3 /> Board
          </button>
          <button className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")} title="Calendar">
            <CalendarDays /> Calendar
          </button>
        </div>
      </div>

      <div className="mt-16">
        {filtered.length === 0 && view !== "calendar" ? (
          <div className="empty card">
            <div className="empty-title">Nothing here yet</div>
            <div className="small">Create a task or change the filter.</div>
            <button className="btn btn-primary mt-16" onClick={() => setQuickAddOpen(true, workspace.id)}>
              <Plus /> New task
            </button>
          </div>
        ) : view === "list" ? (
          <div className="card">
            {filter === "all" ? (
              STATUSES.map((status) => {
                const group = filtered.filter((task) => task.status === status);
                if (group.length === 0) return null;
                return (
                  <div key={status}>
                    <div className="group-label">
                      {STATUS_LABELS[status]} · {group.length}
                    </div>
                    <div className="task-list">
                      {group.map((task) => (
                        <TaskRow key={task.id} task={task} />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="task-list">
                {filtered.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            )}
          </div>
        ) : view === "board" ? (
          <div className="board">
            {STATUSES.map((status) => (
              <div
                key={status}
                className="board-col"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = event.dataTransfer.getData("text/plain");
                  if (id) updateTask(id, { status: status as Status });
                }}
              >
                <div className="board-head">
                  <span>{STATUS_LABELS[status]}</span>
                  <span className="board-count">
                    {filtered.filter((task) => task.status === status).length}
                  </span>
                </div>
                {filtered
                  .filter((task) => task.status === status)
                  .map((task) => (
                    <div
                      key={task.id}
                      className="board-card"
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", task.id)}
                      onClick={() => openTask(task.id)}
                    >
                      <div className="row" style={{ gap: 7 }}>
                        <span className={`priority-dot p-${task.priority}`} />
                        <span className="task-title">{task.title}</span>
                      </div>
                      <div className="task-meta">
                        {task.dueDate && <span>{formatDate(task.dueDate)}</span>}
                        {task.checklist.length > 0 && (
                          <>
                            <span className="dot-sep" />
                            <span>
                              {task.checklist.filter((item) => item.done).length}/{task.checklist.length}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        ) : (
          <CalendarView month={month} setMonth={setMonth} tasks={filtered} />
        )}
      </div>
    </>
  );
}

function CalendarView({
  month,
  setMonth,
  tasks,
}: {
  month: Date;
  setMonth: (date: Date) => void;
  tasks: ReturnType<typeof useStore>["state"]["tasks"];
}) {
  const { openTask } = useStore();
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const start = new Date(year, monthIndex, 1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
  const current = todayKey();

  return (
    <div className="card">
      <div className="calendar-head">
        <strong className="grow" style={{ fontWeight: 600 }}>
          {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </strong>
        <button
          className="icon-btn"
          onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}
          title="Previous month"
        >
          <ChevronLeft />
        </button>
        <button className="icon-btn" onClick={() => setMonth(new Date())} title="Today">
          Today
        </button>
        <button
          className="icon-btn"
          onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}
          title="Next month"
        >
          <ChevronRight />
        </button>
      </div>
      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="calendar-weekday">
            {day}
          </div>
        ))}
        {cells.map((date) => {
          const key = todayKey(date);
          const dayTasks = tasks.filter((task) => task.dueDate === key);
          return (
            <div
              key={key}
              className={`calendar-cell ${date.getMonth() !== monthIndex ? "outside" : ""}`}
            >
              <div className={`calendar-date ${key === current ? "today" : ""}`}>
                {date.getDate()}
              </div>
              {dayTasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className={`calendar-task ${task.status === "done" ? "done" : ""}`}
                  onClick={() => openTask(task.id)}
                  title={task.title}
                >
                  {task.title}
                </div>
              ))}
              {dayTasks.length > 3 && (
                <div className="tiny faint">+{dayTasks.length - 3} more</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
