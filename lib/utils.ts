import type { Priority, Recurrence, Status, Task } from "./types";

export const STATUSES: Status[] = ["backlog", "todo", "in-progress", "done"];
export const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
export const RECURRENCES: Recurrence[] = ["none", "daily", "weekly", "monthly"];

export const STATUS_LABELS: Record<Status, string> = {
  backlog: "Backlog",
  todo: "Todo",
  "in-progress": "In progress",
  done: "Done",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function uid(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftDate(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + days);
  return todayKey(date);
}

export function formatDate(value?: string): string {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatLongDate(date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function isOverdue(task: Task): boolean {
  return Boolean(
    task.dueDate &&
      task.dueDate < todayKey() &&
      task.status !== "done" &&
      !task.archived,
  );
}

export function humanDuration(minutes?: number): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function progress(tasks: Task[]): { done: number; total: number; percent: number } {
  const active = tasks.filter((task) => !task.archived);
  const done = active.filter((task) => task.status === "done").length;
  return {
    done,
    total: active.length,
    percent: active.length ? Math.round((done / active.length) * 100) : 0,
  };
}

export function nextDate(recurrence: Recurrence, from: string): string | undefined {
  if (recurrence === "none") return undefined;
  if (recurrence === "daily") return shiftDate(from, 1);
  if (recurrence === "weekly") return shiftDate(from, 7);
  return shiftDate(from, 30);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
