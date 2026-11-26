export type ID = string;
export type Theme = "light" | "dark";
export type Priority = "low" | "medium" | "high" | "urgent";
export type Status = "backlog" | "todo" | "in-progress" | "done";
export type Recurrence = "none" | "daily" | "weekly" | "monthly";

export interface ChecklistItem {
  id: ID;
  title: string;
  done: boolean;
}

export interface TaskComment {
  id: ID;
  text: string;
  createdAt: string;
}

export interface Task {
  id: ID;
  workspaceId: ID | null;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  startDate?: string;
  dueDate?: string;
  estimatedMinutes?: number;
  reminderAt?: string;
  tags: string[];
  category?: string;
  checklist: ChecklistItem[];
  recurrence: Recurrence;
  links: string[];
  comments: TaskComment[];
  completedAt?: string;
  archived: boolean;
  myDay: boolean;
  dayBlock?: string;
  calendarEventId?: string;
  calendarSyncState?: "local" | "synced" | "conflict";
  calendarUpdatedAt?: string;
  calendarSyncError?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: ID;
  name: string;
  icon: string;
  color: string;
  description: string;
  categories: string[];
  archived: boolean;
  order: number;
  createdAt: string;
}

export interface Note {
  id: ID;
  workspaceId: ID | null;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: ID;
  name: string;
  color: string;
}

export interface FocusSession {
  id: ID;
  taskId: ID | null;
  workspaceId: ID | null;
  plannedMinutes: number;
  actualSeconds: number;
  pausedSeconds: number;
  startedAt: string;
  endedAt?: string;
  completed: boolean;
  source: "web" | "extension";
}

export interface Milestone {
  id: ID;
  title: string;
  target: number;
  current: number;
}

export interface Goal {
  id: ID;
  title: string;
  description: string;
  workspaceId: ID | null;
  targetValue: number;
  unit: string;
  currentValue: number;
  linkedTag?: string;
  deadline?: string;
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
}

export interface DomainRule {
  id: ID;
  domain: string;
  workspaceId: ID | null;
  category?: string;
  budgetMinutesPerDay?: number;
  blockedDuringFocus: boolean;
}

export interface Settings {
  theme: Theme;
  notifications: boolean;
  focusMinutes: number;
  breakMinutes: number;
  calendarSyncEnabled: boolean;
}

export interface AppState {
  version: 1;
  workspaces: Workspace[];
  tasks: Task[];
  notes: Note[];
  tags: Tag[];
  focusSessions: FocusSession[];
  goals: Goal[];
  domainRules: DomainRule[];
  settings: Settings;
}

export type TaskInput = Partial<Task> & { title: string };
