"use client";

import { ArrowRight, CalendarDays, Clock3, Flame, Plus, SunMedium, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { TaskRow } from "@/components/TaskRow";
import { useStore } from "@/components/StoreProvider";
import {
  computeStreak,
  focusByDay,
  goalProgress,
  lastDays,
  minutesLabel,
} from "@/lib/analytics";
import { formatLongDate, isOverdue, progress, todayKey } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const { state, setQuickAddOpen } = useStore();
  const tasks = state.tasks.filter((task) => !task.archived);
  const workspaces = state.workspaces.filter((workspace) => !workspace.archived);
  const today = todayKey();
  const myDay = tasks
    .filter((task) => task.myDay)
    .sort((a, b) => (a.dayBlock ?? "99").localeCompare(b.dayBlock ?? "99"));
  const overdue = tasks.filter(isOverdue).slice(0, 4);
  const upcoming = tasks
    .filter((task) => task.dueDate && task.dueDate > today && task.status !== "done")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 4);
  const stats = progress(tasks);
  const endedSessions = state.focusSessions.filter((session) => session.endedAt);
  const focusToday = focusByDay(endedSessions, lastDays(1))[0] ?? 0;
  const streak = computeStreak(tasks, endedSessions);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greeting}.</h1>
          <p>{formatLongDate()} · a calm plan for the day ahead</p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-primary" onClick={() => setQuickAddOpen(true)}>
            <Plus /> New task
          </button>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="card stat-card">
          <div className="row muted small">
            <SunMedium size={15} /> My Day
          </div>
          <div className="stat-value">{myDay.filter((task) => task.status !== "done").length}</div>
          <div className="stat-label">tasks planned today</div>
        </div>
        <div className="card stat-card">
          <div className="row muted small">
            <CalendarDays size={15} /> Completed
          </div>
          <div className="stat-value">
            {stats.done}
            <span className="small muted" style={{ fontWeight: 400 }}>
              /{stats.total}
            </span>
          </div>
          <div className="stat-label">overall progress · {stats.percent}%</div>
        </div>
        <div className="card stat-card">
          <div className="row muted small">
            <Clock3 size={15} /> Focus today
          </div>
          <div className="stat-value">{minutesLabel(focusToday)}</div>
          <div className="stat-label">logged so far</div>
        </div>
        <div className="card stat-card">
          <div className="row muted small">
            <Flame size={15} /> Streak
          </div>
          <div className="stat-value">{streak}</div>
          <div className="stat-label">consecutive active days</div>
        </div>
      </div>

      <div className="grid grid-2 mt-16">
        <section className="card">
          <div className="card-head">
            <h2>Today&apos;s focus</h2>
            <button className="btn btn-sm muted" style={{ marginLeft: "auto" }} onClick={() => router.push("/myday")}>
              Open My Day <ArrowRight />
            </button>
          </div>
          {myDay.length === 0 ? (
            <div className="empty small">Nothing planned yet. Add a task to My Day.</div>
          ) : (
            <div className="task-list">
              {myDay.slice(0, 5).map((task) => (
                <TaskRow key={task.id} task={task} showWorkspace />
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Needs attention</h2>
            <span className="muted small" style={{ marginLeft: "auto" }}>
              overdue & upcoming
            </span>
          </div>
          {[...overdue, ...upcoming].length === 0 ? (
            <div className="empty small">All clear. Nothing overdue or upcoming.</div>
          ) : (
            <div className="task-list">
              {[...overdue, ...upcoming].slice(0, 5).map((task) => (
                <TaskRow key={task.id} task={task} showWorkspace />
              ))}
            </div>
          )}
        </section>
      </div>

      {state.goals.length > 0 && (
        <section className="card mt-16">
          <div className="card-head">
            <h2>Goals in motion</h2>
            <button className="btn btn-sm muted" style={{ marginLeft: "auto" }} onClick={() => router.push("/goals")}>
              All goals <ArrowRight />
            </button>
          </div>
          <div className="grid grid-3" style={{ padding: 16 }}>
            {state.goals.slice(0, 3).map((goal) => {
              const value = goalProgress(goal, tasks);
              const percent = Math.min(100, Math.round((value / Math.max(1, goal.targetValue)) * 100));
              return (
                <button key={goal.id} className="row" style={{ gap: 10, textAlign: "left", background: "transparent", border: 0 }} onClick={() => router.push("/goals")}>
                  <Target size={15} className="muted" />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="small truncate">{goal.title}</div>
                    <div className="progress-track mt-8">
                      <div className="progress-fill" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <span className="tiny muted">{percent}%</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="row space-between mt-24">
        <div>
          <h2 className="strong" style={{ fontSize: 16, margin: 0, letterSpacing: "-0.02em" }}>
            Workspaces
          </h2>
          <p className="muted small" style={{ margin: "4px 0 0" }}>
            Each space keeps its own tasks, categories and progress.
          </p>
        </div>
        <button className="btn btn-sm" onClick={() => router.push("/workspaces")}>
          View all <ArrowRight />
        </button>
      </div>

      <div className="grid grid-3 mt-16">
        {workspaces.slice(0, 6).map((workspace) => {
          const wsTasks = tasks.filter((task) => task.workspaceId === workspace.id);
          const stat = progress(wsTasks);
          return (
            <button
              key={workspace.id}
              className="card workspace-card"
              style={{ textAlign: "left" }}
              onClick={() => router.push(`/workspaces/${workspace.id}`)}
            >
              <div className="row">
                <div className="workspace-icon">{workspace.icon}</div>
                <div className="grow">
                  <div className="workspace-name">{workspace.name}</div>
                  <div className="tiny muted truncate">{workspace.description || "No description"}</div>
                </div>
              </div>
              <div>
                <div className="row space-between tiny muted" style={{ marginBottom: 6 }}>
                  <span>
                    {stat.done} of {stat.total} completed
                  </span>
                  <span>{stat.percent}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${stat.percent}%`, background: workspace.color }} />
                </div>
              </div>
            </button>
          );
        })}
        <button className="card workspace-card" onClick={() => router.push("/workspaces")} style={{ textAlign: "left" }}>
          <div className="row">
            <div className="workspace-icon">＋</div>
            <div>
              <div className="workspace-name">New workspace</div>
              <div className="tiny muted">Create a space for something new</div>
            </div>
          </div>
        </button>
      </div>
    </>
  );
}
