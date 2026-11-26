"use client";

import { BarChart3, CheckCircle2, Clock3, Flame, Globe2, Target } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/components/StoreProvider";
import {
  bestDay,
  completedByDay,
  computeStreak,
  focusByDay,
  focusByWorkspace,
  goalProgress,
  lastDays,
  minutesLabel,
} from "@/lib/analytics";
import { isOverdue, progress } from "@/lib/utils";

export default function AnalyticsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { state } = useStore();
  const [webTime, setWebTime] = useState<{ domain: string; day: string; seconds: number }[]>([]);

  useEffect(() => {
    if (!session?.user?.id) return;
    void (async () => {
      const response = await fetch("/api/web-time");
      if (!response.ok) return;
      const data = (await response.json()) as {
        items: { domain: string; day: string; seconds: number }[];
      };
      setWebTime(data.items ?? []);
    })();
  }, [session?.user?.id]);
  const activeTasks = state.tasks.filter((task) => !task.archived);
  const endedSessions = state.focusSessions.filter((session) => session.endedAt);
  const days = lastDays(7);
  const completed = completedByDay(activeTasks, days);
  const focus = focusByDay(endedSessions, days);
  const maxCompleted = Math.max(...completed, 1);
  const maxFocus = Math.max(...focus, 1);
  const stats = progress(activeTasks);
  const streak = computeStreak(activeTasks, endedSessions);
  const weekCompleted = completed.reduce((total, value) => total + value, 0);
  const weekFocus = focus.reduce((total, value) => total + value, 0);

  const workspaceStats = state.workspaces
    .filter((workspace) => !workspace.archived)
    .map((workspace) => {
      const tasks = activeTasks.filter((task) => task.workspaceId === workspace.id);
      return { workspace, stat: progress(tasks) };
    });
  const focusTotals = focusByWorkspace(endedSessions);
  const maxFocusWorkspace = Math.max(...focusTotals.map((item) => item.seconds), 1);

  const domainTotals = new Map<string, number>();
  webTime.forEach((item) => {
    domainTotals.set(item.domain, (domainTotals.get(item.domain) ?? 0) + item.seconds);
  });
  const topDomains = [...domainTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxDomain = Math.max(...topDomains.map((item) => item[1]), 1);
  const dailyWeb = days.map((day) =>
    webTime
      .filter((item) => item.day === day.key)
      .reduce((total, item) => total + item.seconds, 0),
  );
  const webTotal = [...domainTotals.values()].reduce((total, value) => total + value, 0);

  const actualByTask = new Map<string, number>();
  endedSessions.forEach((session) => {
    if (session.taskId) {
      actualByTask.set(session.taskId, (actualByTask.get(session.taskId) ?? 0) + session.actualSeconds);
    }
  });
  const estimateRows = activeTasks
    .filter((task) => task.estimatedMinutes && actualByTask.has(task.id))
    .map((task) => ({
      task,
      actual: (actualByTask.get(task.id) ?? 0) / 60,
      estimated: task.estimatedMinutes as number,
    }))
    .slice(0, 6);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p>A honest look at where the days go.</p>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="card stat-card">
          <div className="row muted small"><CheckCircle2 size={15} /> This week</div>
          <div className="stat-value">{weekCompleted}</div>
          <div className="stat-label">tasks completed</div>
        </div>
        <div className="card stat-card">
          <div className="row muted small"><Clock3 size={15} /> Focus</div>
          <div className="stat-value">{minutesLabel(weekFocus)}</div>
          <div className="stat-label">in the last 7 days</div>
        </div>
        <div className="card stat-card">
          <div className="row muted small"><Flame size={15} /> Streak</div>
          <div className="stat-value">{streak}</div>
          <div className="stat-label">consecutive active days</div>
        </div>
        <div className="card stat-card">
          <div className="row muted small"><Target size={15} /> Completion</div>
          <div className="stat-value">{stats.percent}%</div>
          <div className="stat-label">{stats.done} of {stats.total} tasks</div>
        </div>
      </div>

      <div className="grid grid-2 mt-16">
        <section className="card card-pad">
          <div className="row space-between">
            <h2 className="strong small" style={{ margin: 0 }}>Tasks completed</h2>
            <span className="tiny muted">last 7 days</span>
          </div>
          <BarChart values={completed} labels={days.map((day) => day.label)} max={maxCompleted} />
        </section>
        <section className="card card-pad">
          <div className="row space-between">
            <h2 className="strong small" style={{ margin: 0 }}>Focus time</h2>
            <span className="tiny muted">minutes per day</span>
          </div>
          <BarChart values={focus.map((value) => Math.round(value / 60))} labels={days.map((day) => day.label)} max={Math.ceil(maxFocus / 60)} />
        </section>
      </div>

      <div className="grid grid-2 mt-16">
        <section className="card card-pad">
          <div className="row space-between">
            <h2 className="strong small" style={{ margin: 0 }}>Web time by site</h2>
            <span className="tiny muted">{minutesLabel(webTotal)} total</span>
          </div>
          {topDomains.length === 0 ? (
            <div className="empty small" style={{ marginTop: 12 }}>
              Connect the Chrome extension in Settings to see website time here.
            </div>
          ) : (
            <div className="mt-16">
              {topDomains.map(([domain, seconds]) => {
                const rule = state.domainRules.find((entry) => entry.domain === domain);
                return (
                  <div key={domain} style={{ marginBottom: 12 }}>
                    <div className="row space-between tiny">
                      <span className="truncate">{domain}</span>
                      <span className="muted">
                        {minutesLabel(seconds)}
                        {rule?.budgetMinutesPerDay
                          ? ` / ${rule.budgetMinutesPerDay}m`
                          : ""}
                      </span>
                    </div>
                    <div className="progress-track mt-8">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.round((seconds / maxDomain) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <section className="card card-pad">
          <div className="row space-between">
            <h2 className="strong small row" style={{ margin: 0 }}>
              <Globe2 size={14} /> Web time trend
            </h2>
            <span className="tiny muted">minutes per day</span>
          </div>
          <BarChart
            values={dailyWeb.map((value) => Math.round(value / 60))}
            labels={days.map((day) => day.label)}
            max={Math.ceil(Math.max(...dailyWeb, 1) / 60)}
          />
        </section>
      </div>

      <div className="grid grid-2 mt-16">
        <section className="card card-pad">
          <h2 className="strong small" style={{ margin: "0 0 14px" }}>Completion by workspace</h2>
          {workspaceStats.map(({ workspace, stat }) => (
            <div key={workspace.id} style={{ marginBottom: 12 }}>
              <div className="row space-between tiny">
                <span>{workspace.icon} {workspace.name}</span>
                <span className="muted">{stat.percent}%</span>
              </div>
              <div className="progress-track mt-8">
                <div className="progress-fill" style={{ width: `${stat.percent}%`, background: workspace.color }} />
              </div>
            </div>
          ))}
        </section>

        <section className="card card-pad">
          <h2 className="strong small" style={{ margin: "0 0 14px" }}>Focus by workspace</h2>
          {focusTotals.length === 0 ? (
            <div className="empty small">No focus sessions yet.</div>
          ) : (
            focusTotals
              .sort((a, b) => b.seconds - a.seconds)
              .map((item) => {
                const workspace = state.workspaces.find((entry) => entry.id === item.id);
                return (
                  <div key={item.id ?? "none"} style={{ marginBottom: 12 }}>
                    <div className="row space-between tiny">
                      <span>{workspace ? `${workspace.icon} ${workspace.name}` : "Unassigned"}</span>
                      <span className="muted">{minutesLabel(item.seconds)}</span>
                    </div>
                    <div className="progress-track mt-8">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.round((item.seconds / maxFocusWorkspace) * 100)}%`,
                          background: workspace?.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })
          )}
        </section>
      </div>

      <div className="grid grid-2 mt-16">
        <section className="card">
          <div className="card-head">
            <h2>Estimated vs actual</h2>
          </div>
          {estimateRows.length === 0 ? (
            <div className="empty small">Focus on a task with an estimate to see this comparison.</div>
          ) : (
            <div className="task-list">
              {estimateRows.map(({ task, actual, estimated }) => (
                <div key={task.id} className="task-row" style={{ cursor: "default" }}>
                  <div className="grow">
                    <div className="task-title">{task.title}</div>
                    <div className="task-meta">
                      <span>{Math.round(actual)}m actual</span>
                      <span className="dot-sep" />
                      <span>{estimated}m estimated</span>
                    </div>
                  </div>
                  <span className={`chip ${actual > estimated ? "overdue" : ""}`}>
                    {Math.round((actual / estimated) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card card-pad">
          <h2 className="strong small" style={{ margin: "0 0 14px" }}>Signals</h2>
          <div className="row space-between small" style={{ padding: "7px 0" }}>
            <span className="muted">Most productive day</span>
            <span className="strong">{bestDay(activeTasks) ?? "—"}</span>
          </div>
          <div className="row space-between small" style={{ padding: "7px 0" }}>
            <span className="muted">Overdue tasks</span>
            <span className="strong">{activeTasks.filter(isOverdue).length}</span>
          </div>
          <div className="row space-between small" style={{ padding: "7px 0" }}>
            <span className="muted">Goals in progress</span>
            <span className="strong">{state.goals.length}</span>
          </div>
          {state.goals.slice(0, 2).map((goal) => {
            const value = goalProgress(goal, activeTasks);
            const percent = Math.min(100, Math.round((value / Math.max(1, goal.targetValue)) * 100));
            return (
              <div key={goal.id} style={{ marginTop: 10 }}>
                <div className="row space-between tiny">
                  <span className="truncate">{goal.title}</span>
                  <span className="muted">{percent}%</span>
                </div>
                <div className="progress-track mt-8">
                  <div className="progress-fill" style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
          <button className="btn btn-sm mt-16" onClick={() => router.push("/goals")}>
            <BarChart3 /> View goals
          </button>
        </section>
      </div>
    </>
  );
}

function BarChart({ values, labels, max }: { values: number[]; labels: string[]; max: number }) {
  return (
    <div className="bar-chart mt-16">
      {values.map((value, index) => (
        <div key={labels[index]} className="bar-col">
          <div className="bar-track">
            <div className="bar" style={{ height: `${Math.max(3, (value / Math.max(1, max)) * 100)}%` }} />
          </div>
          <div className="tiny muted">{labels[index]}</div>
          <div className="tiny faint" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</div>
        </div>
      ))}
    </div>
  );
}
