import type { FocusSession, Goal, Task } from "./types";
import { todayKey } from "./utils";

export function activityDays(tasks: Task[], sessions: FocusSession[]): Set<string> {
  const days = new Set<string>();
  tasks.forEach((task) => {
    if (task.completedAt) days.add(todayKey(new Date(task.completedAt)));
  });
  sessions.forEach((session) => {
    if (session.endedAt) days.add(todayKey(new Date(session.endedAt)));
  });
  return days;
}

export function computeStreak(tasks: Task[], sessions: FocusSession[]): number {
  const days = activityDays(tasks, sessions);
  const cursor = new Date();
  if (!days.has(todayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(todayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function lastDays(count: number): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    result.push({
      key: todayKey(date),
      label: date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2),
    });
  }
  return result;
}

export function completedByDay(tasks: Task[], days: { key: string }[]): number[] {
  return days.map((day) =>
    tasks.filter((task) => task.completedAt && todayKey(new Date(task.completedAt)) === day.key)
      .length,
  );
}

export function focusByDay(sessions: FocusSession[], days: { key: string }[]): number[] {
  return days.map((day) =>
    sessions
      .filter((session) => session.endedAt && todayKey(new Date(session.endedAt)) === day.key)
      .reduce((total, session) => total + session.actualSeconds, 0),
  );
}

export function focusByWorkspace(sessions: FocusSession[]): { id: string | null; seconds: number }[] {
  const totals = new Map<string | null, number>();
  sessions.forEach((session) => {
    if (!session.endedAt) return;
    const key = session.workspaceId;
    totals.set(key, (totals.get(key) ?? 0) + session.actualSeconds);
  });
  return [...totals.entries()].map(([id, seconds]) => ({ id, seconds }));
}

export function goalProgress(goal: Goal, tasks: Task[]): number {
  if (goal.linkedTag) {
    return tasks.filter(
      (task) => task.status === "done" && task.tags.includes(goal.linkedTag as string),
    ).length;
  }
  if (goal.milestones.length) {
    return goal.milestones.reduce((total, milestone) => total + milestone.current, 0);
  }
  return goal.currentValue;
}

export function bestDay(tasks: Task[]): string | null {
  const counts = new Map<string, number>();
  tasks.forEach((task) => {
    if (!task.completedAt) return;
    const key = todayKey(new Date(task.completedAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return null;
  return new Date(`${sorted[0][0]}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
  });
}

export function minutesLabel(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
