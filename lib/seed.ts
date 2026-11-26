import type { AppState, DomainRule, FocusSession, Goal, Settings, Task, Workspace } from "./types";
import { shiftDate, todayKey, uid } from "./utils";

const TODAY = todayKey();

function task(partial: Partial<Task> & { title: string; workspaceId: string | null }): Task {
  const now = new Date().toISOString();
  return {
    id: uid("task"),
    description: "",
    status: "todo",
    priority: "medium",
    tags: [],
    checklist: [],
    recurrence: "none",
    links: [],
    comments: [],
    archived: false,
    myDay: false,
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

function workspace(
  partial: Partial<Workspace> & { name: string; icon: string; color: string },
): Workspace {
  return {
    id: uid("ws"),
    description: "",
    categories: [],
    archived: false,
    order: 0,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "light",
  notifications: false,
  focusMinutes: 25,
  breakMinutes: 5,
  reminderLeadMinutes: 0,
  calendarSyncEnabled: false,
};

export function emptyState(): AppState {
  return {
    version: 1,
    workspaces: [],
    tasks: [],
    notes: [],
    tags: [],
    focusSessions: [],
    goals: [],
    domainRules: [],
    settings: DEFAULT_SETTINGS,
  };
}

export function normalizeState(value: Partial<AppState> | null | undefined): AppState {
  return {
    version: 1,
    workspaces: value?.workspaces ?? [],
    tasks: (value?.tasks ?? []).map((task) => ({
      ...task,
      calendarSyncState: task.calendarSyncState ?? "local",
    })),
    notes: value?.notes ?? [],
    tags: value?.tags ?? [],
    focusSessions: value?.focusSessions ?? [],
    goals: value?.goals ?? [],
    domainRules: value?.domainRules ?? [],
    settings: { ...DEFAULT_SETTINGS, ...value?.settings },
  };
}

export function seedState(): AppState {
  const dsa = workspace({ name: "DSA Preparation", icon: "💻", color: "#3b82f6", description: "Problem solving and revision", categories: ["Arrays", "Trees", "Graphs", "DP"], order: 1 });
  const web = workspace({ name: "Web Development", icon: "🌐", color: "#8b5cf6", description: "Frontend and backend learning", categories: ["Frontend", "Backend", "Projects"], order: 2 });
  const college = workspace({ name: "College", icon: "🎓", color: "#f59e0b", description: "Classes, practicals and assignments", categories: ["Practical", "Assignment"], order: 3 });
  const projects = workspace({ name: "Projects", icon: "🚀", color: "#10b981", description: "Things I am building", categories: ["Planning", "Build"], order: 4 });
  const personal = workspace({ name: "General / Personal", icon: "📝", color: "#f43f5e", description: "Daily activities, errands, habits and miscellaneous tasks", categories: ["Habits", "Errands"], order: 5 });

  const workspaces = [dsa, web, college, projects, personal];

  const tasks: Task[] = [
    task({
      title: "Solve DP problems",
      workspaceId: dsa.id,
      description: "Practice 5 dynamic programming problems and write short notes on each pattern.",
      status: "in-progress",
      priority: "high",
      dueDate: TODAY,
      startDate: TODAY,
      estimatedMinutes: 120,
      category: "DP",
      tags: ["dp", "revision"],
      myDay: true,
      dayBlock: "09:00",
      order: 1,
      checklist: [
        { id: uid("chk"), title: "House Robber", done: true },
        { id: uid("chk"), title: "Climbing Stairs", done: false },
        { id: uid("chk"), title: "Coin Change", done: false },
      ],
      links: ["https://leetcode.com/problemset/dynamic-programming/"],
      comments: [
        { id: uid("cmt"), text: "Focus on bottom-up solutions today.", createdAt: new Date().toISOString() },
      ],
    }),
    task({ title: "Practice binary search", workspaceId: dsa.id, status: "todo", priority: "medium", dueDate: TODAY, estimatedMinutes: 60, category: "Arrays", tags: ["arrays"], myDay: true, dayBlock: "10:30", order: 2 }),
    task({ title: "Revision: tree traversals", workspaceId: dsa.id, status: "done", priority: "low", dueDate: shiftDate(TODAY, -1), estimatedMinutes: 45, completedAt: new Date().toISOString(), category: "Trees", tags: ["revision"], order: 3 }),
    task({ title: "Graph algorithms set", workspaceId: dsa.id, status: "backlog", priority: "medium", dueDate: shiftDate(TODAY, 3), estimatedMinutes: 120, category: "Graphs", order: 4 }),
    task({ title: "Arrays: sliding window", workspaceId: dsa.id, status: "todo", priority: "high", dueDate: shiftDate(TODAY, 1), estimatedMinutes: 90, category: "Arrays", tags: ["arrays"], order: 5 }),

    task({ title: "Implement authentication", workspaceId: web.id, status: "in-progress", priority: "urgent", dueDate: TODAY, estimatedMinutes: 120, category: "Backend", tags: ["auth"], myDay: true, dayBlock: "11:00", order: 6 }),
    task({ title: "Responsive dashboard layout", workspaceId: web.id, status: "todo", priority: "medium", dueDate: shiftDate(TODAY, 2), estimatedMinutes: 90, category: "Frontend", tags: ["ui"], order: 7 }),
    task({ title: "Fix API error handling", workspaceId: web.id, status: "done", priority: "high", completedAt: new Date().toISOString(), category: "Backend", order: 8 }),
    task({ title: "Write component tests", workspaceId: web.id, status: "backlog", priority: "low", dueDate: shiftDate(TODAY, 5), estimatedMinutes: 60, category: "Frontend", order: 9 }),

    task({ title: "Software engineering practical", workspaceId: college.id, status: "todo", priority: "high", dueDate: TODAY, estimatedMinutes: 90, tags: ["college"], myDay: true, dayBlock: "14:00", order: 10 }),
    task({ title: "Database assignment", workspaceId: college.id, status: "todo", priority: "high", dueDate: shiftDate(TODAY, 1), estimatedMinutes: 120, category: "Assignment", tags: ["college"], order: 11 }),
    task({ title: "Attend systems lecture", workspaceId: college.id, status: "done", priority: "low", completedAt: new Date().toISOString(), order: 12 }),

    task({ title: "Design landing page", workspaceId: projects.id, status: "todo", priority: "medium", dueDate: shiftDate(TODAY, 4), estimatedMinutes: 120, category: "Build", order: 13 }),
    task({ title: "Set up repository", workspaceId: projects.id, status: "done", priority: "low", completedAt: new Date().toISOString(), category: "Planning", order: 14 }),
    task({ title: "Write project docs", workspaceId: projects.id, status: "backlog", priority: "low", dueDate: shiftDate(TODAY, 7), estimatedMinutes: 60, order: 15 }),

    task({ title: "Review weekly goals", workspaceId: personal.id, status: "todo", priority: "medium", dueDate: TODAY, estimatedMinutes: 30, tags: ["personal"], myDay: true, dayBlock: "17:00", order: 16 }),
    task({ title: "Grocery shopping", workspaceId: personal.id, status: "todo", priority: "low", dueDate: shiftDate(TODAY, 1), category: "Errands", order: 17 }),
    task({ title: "Morning walk", workspaceId: personal.id, status: "done", priority: "low", completedAt: new Date().toISOString(), category: "Habits", recurrence: "daily", order: 18 }),

    task({ title: "Research note-taking apps", workspaceId: null, status: "todo", priority: "low", order: 19 }),
    task({ title: "Book dentist appointment", workspaceId: null, status: "backlog", priority: "medium", order: 20 }),
    task({ title: "Old portfolio cleanup", workspaceId: projects.id, status: "done", archived: true, completedAt: new Date().toISOString(), order: 21 }),
  ];

  const focusSessions: FocusSession[] = [
    {
      id: uid("focus"),
      taskId: tasks[0].id,
      workspaceId: dsa.id,
      plannedMinutes: 25,
      actualSeconds: 25 * 60,
      pausedSeconds: 0,
      startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(Date.now() - 3 * 60 * 60 * 1000 + 25 * 60 * 1000).toISOString(),
      completed: true,
      source: "web",
    },
    {
      id: uid("focus"),
      taskId: tasks[5].id,
      workspaceId: web.id,
      plannedMinutes: 25,
      actualSeconds: 22 * 60,
      pausedSeconds: 60,
      startedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(Date.now() - 26 * 60 * 60 * 1000 + 23 * 60 * 1000).toISOString(),
      completed: true,
      source: "web",
    },
  ];

  const goals: Goal[] = [
    {
      id: uid("goal"),
      title: "Solve 200 DSA problems",
      description: "A steady run through every core topic.",
      workspaceId: dsa.id,
      targetValue: 200,
      unit: "problems",
      currentValue: 0,
      deadline: shiftDate(TODAY, 34),
      milestones: [
        { id: uid("ms"), title: "Arrays", target: 30, current: 12 },
        { id: uid("ms"), title: "Binary Search", target: 20, current: 8 },
        { id: uid("ms"), title: "Trees", target: 30, current: 6 },
        { id: uid("ms"), title: "Graphs", target: 30, current: 4 },
        { id: uid("ms"), title: "Dynamic Programming", target: 40, current: 3 },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: uid("goal"),
      title: "Ship the web app",
      description: "Finish the first usable release.",
      workspaceId: web.id,
      targetValue: 10,
      unit: "tasks",
      currentValue: 4,
      milestones: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const domainRules: DomainRule[] = [
    { id: uid("rule"), domain: "leetcode.com", workspaceId: dsa.id, category: "DP", budgetMinutesPerDay: 90, blockedDuringFocus: false },
    { id: uid("rule"), domain: "github.com", workspaceId: projects.id, blockedDuringFocus: false },
    { id: uid("rule"), domain: "youtube.com", workspaceId: personal.id, budgetMinutesPerDay: 60, blockedDuringFocus: true },
  ];

  return {
    version: 1,
    workspaces,
    tasks,
    focusSessions,
    goals,
    domainRules,
    tags: [
      { id: uid("tag"), name: "dp", color: "#3b82f6" },
      { id: uid("tag"), name: "arrays", color: "#0ea5e9" },
      { id: uid("tag"), name: "revision", color: "#a855f7" },
      { id: uid("tag"), name: "auth", color: "#f97316" },
      { id: uid("tag"), name: "ui", color: "#ec4899" },
      { id: uid("tag"), name: "college", color: "#eab308" },
      { id: uid("tag"), name: "personal", color: "#f43f5e" },
    ],
    notes: [
      { id: uid("note"), workspaceId: dsa.id, title: "DP patterns", body: "1. Identify the state\n2. Write the transition\n3. Base cases first\n\nRemember: tabulation vs memoization.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uid("note"), workspaceId: web.id, title: "Auth checklist", body: "Hash passwords, validate input, set secure cookies, add rate limits, refresh tokens.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ],
    settings: DEFAULT_SETTINGS,
  };
}
