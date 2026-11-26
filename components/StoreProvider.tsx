"use client";

import { useSession } from "next-auth/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { emptyState, normalizeState, seedState } from "@/lib/seed";
import type {
  AppState,
  FocusSession,
  Goal,
  ID,
  Note,
  Settings,
  Task,
  TaskInput,
  Theme,
  Workspace,
} from "@/lib/types";
import { nextDate, todayKey, uid } from "@/lib/utils";

const STORAGE_KEY = "getitdone:state:v1";

interface StoreValue {
  state: AppState;
  hydrated: boolean;
  selectedTaskId: ID | null;
  quickAddOpen: boolean;
  quickAddWorkspaceId: ID | null;
  commandOpen: boolean;
  toast: string | null;
  openTask: (id: ID) => void;
  closeTask: () => void;
  setQuickAddOpen: (open: boolean, workspaceId?: ID | null) => void;
  setCommandOpen: (open: boolean) => void;
  notify: (message: string) => void;
  addTask: (input: TaskInput) => Task;
  updateTask: (id: ID, patch: Partial<Task>) => void;
  toggleTask: (id: ID) => void;
  archiveTask: (id: ID) => void;
  restoreTask: (id: ID) => void;
  toggleChecklist: (taskId: ID, itemId: ID) => void;
  addChecklistItem: (taskId: ID, title: string) => void;
  addComment: (taskId: ID, text: string) => void;
  addWorkspace: (input: Partial<Workspace> & { name: string }) => Workspace;
  updateWorkspace: (id: ID, patch: Partial<Workspace>) => void;
  archiveWorkspace: (id: ID) => void;
  addNote: (input?: Partial<Note>) => Note;
  updateNote: (id: ID, patch: Partial<Note>) => void;
  deleteNote: (id: ID) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  startFocus: (taskId: ID | null, plannedMinutes: number) => FocusSession;
  updateFocus: (id: ID, patch: Partial<FocusSession>) => void;
  finishFocus: (id: ID, completed: boolean) => void;
  addGoal: (input: Partial<Goal> & { title: string }) => Goal;
  updateGoal: (id: ID, patch: Partial<Goal>) => void;
  deleteGoal: (id: ID) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [state, setState] = useState<AppState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<ID | null>(null);
  const [quickAddOpen, setQuickAddOpenState] = useState(false);
  const [quickAddWorkspaceId, setQuickAddWorkspaceId] = useState<ID | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2600);
  }, []);

  const loadLocal = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppState> | null;
        setState(parsed?.version === 1 ? normalizeState(parsed) : seedState());
      } else {
        setState(seedState());
      }
    } catch {
      setState(seedState());
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    setRemoteReady(false);
    if (userId) {
      fetch("/api/state")
        .then(async (response) => {
          if (!response.ok) throw new Error("Failed to load cloud data");
          const data = (await response.json()) as { state: Partial<AppState> };
          setState(normalizeState(data.state));
          setRemoteReady(true);
        })
        .catch(() => {
          loadLocal();
          notify("Could not load cloud data; using local data");
        })
        .finally(() => setHydrated(true));
    } else {
      loadLocal();
      setHydrated(true);
    }
  }, [status, userId, loadLocal, notify]);

  useEffect(() => {
    if (!hydrated || userId) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated, userId]);

  useEffect(() => {
    if (!hydrated || !remoteReady || !userId) return;
    const timer = window.setTimeout(() => {
      fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      }).catch(() => notify("Could not save to cloud"));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [state, hydrated, remoteReady, userId, notify]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dataset.theme = state.settings.theme;
  }, [state.settings.theme, hydrated]);

  const setQuickAddOpen = useCallback((open: boolean, workspaceId?: ID | null) => {
    setQuickAddOpenState(open);
    setQuickAddWorkspaceId(open ? workspaceId ?? null : null);
  }, []);

  const addTask = useCallback((input: TaskInput): Task => {
    const now = new Date().toISOString();
    const { title, ...rest } = input;
    const created: Task = {
      workspaceId: null,
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
      order: Date.now(),
      ...rest,
      id: uid("task"),
      title,
      createdAt: now,
      updatedAt: now,
    };
    setState((current) => ({ ...current, tasks: [...current.tasks, created] }));
    return created;
  }, []);

  const updateTask = useCallback((id: ID, patch: Partial<Task>) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) => {
        if (task.id !== id) return task;
        const now = new Date().toISOString();
        const next: Task = { ...task, ...patch, updatedAt: now };
        if (patch.status === "done" && task.status !== "done") next.completedAt = now;
        if (patch.status && patch.status !== "done") next.completedAt = undefined;
        return next;
      }),
    }));
  }, []);

  const toggleTask = useCallback((id: ID) => {
    setState((current) => {
      const source = current.tasks.find((task) => task.id === id);
      if (!source) return current;
      const completing = source.status !== "done";
      const now = new Date().toISOString();
      let tasks = current.tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              status: completing ? ("done" as const) : ("todo" as const),
              completedAt: completing ? now : undefined,
              updatedAt: now,
            }
          : task,
      );
      if (completing && source.recurrence !== "none") {
        const due = nextDate(source.recurrence, source.dueDate ?? todayKey());
        if (due) {
          tasks = [
            ...tasks,
            {
              ...source,
              id: uid("task"),
              status: "todo",
              dueDate: due,
              startDate: undefined,
              completedAt: undefined,
              myDay: false,
              dayBlock: undefined,
              createdAt: now,
              updatedAt: now,
              checklist: source.checklist.map((item) => ({ ...item, done: false })),
            },
          ];
        }
      }
      return { ...current, tasks };
    });
  }, []);

  const archiveTask = useCallback((id: ID) => {
    updateTask(id, { archived: true });
    setSelectedTaskId(null);
  }, [updateTask]);

  const restoreTask = useCallback((id: ID) => updateTask(id, { archived: false }), [updateTask]);

  const toggleChecklist = useCallback((taskId: ID, itemId: ID) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              checklist: task.checklist.map((item) =>
                item.id === itemId ? { ...item, done: !item.done } : item,
              ),
              updatedAt: new Date().toISOString(),
            }
          : task,
      ),
    }));
  }, []);

  const addChecklistItem = useCallback((taskId: ID, title: string) => {
    if (!title.trim()) return;
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              checklist: [...task.checklist, { id: uid("chk"), title: title.trim(), done: false }],
              updatedAt: new Date().toISOString(),
            }
          : task,
      ),
    }));
  }, []);

  const addComment = useCallback((taskId: ID, text: string) => {
    if (!text.trim()) return;
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              comments: [
                ...task.comments,
                { id: uid("cmt"), text: text.trim(), createdAt: new Date().toISOString() },
              ],
              updatedAt: new Date().toISOString(),
            }
          : task,
      ),
    }));
  }, []);

  const addWorkspace = useCallback((input: Partial<Workspace> & { name: string }): Workspace => {
    const created: Workspace = {
      id: uid("ws"),
      name: input.name,
      icon: input.icon ?? "✦",
      color: input.color ?? "#6b7280",
      description: input.description ?? "",
      categories: input.categories ?? [],
      archived: false,
      order: Date.now(),
      createdAt: new Date().toISOString(),
    };
    setState((current) => ({ ...current, workspaces: [...current.workspaces, created] }));
    return created;
  }, []);

  const updateWorkspace = useCallback((id: ID, patch: Partial<Workspace>) => {
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === id ? { ...workspace, ...patch } : workspace,
      ),
    }));
  }, []);

  const archiveWorkspace = useCallback((id: ID) => {
    updateWorkspace(id, { archived: true });
  }, [updateWorkspace]);

  const addNote = useCallback((input?: Partial<Note>): Note => {
    const now = new Date().toISOString();
    const created: Note = {
      id: uid("note"),
      workspaceId: input?.workspaceId ?? null,
      title: input?.title ?? "Untitled note",
      body: input?.body ?? "",
      createdAt: now,
      updatedAt: now,
    };
    setState((current) => ({ ...current, notes: [created, ...current.notes] }));
    return created;
  }, []);

  const updateNote = useCallback((id: ID, patch: Partial<Note>) => {
    setState((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        note.id === id ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note,
      ),
    }));
  }, []);

  const deleteNote = useCallback((id: ID) => {
    setState((current) => ({ ...current, notes: current.notes.filter((note) => note.id !== id) }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  }, []);

  const startFocus = useCallback((taskId: ID | null, plannedMinutes: number): FocusSession => {
    const task = state.tasks.find((item) => item.id === taskId);
    const created: FocusSession = {
      id: uid("focus"),
      taskId,
      workspaceId: task?.workspaceId ?? null,
      plannedMinutes,
      actualSeconds: 0,
      pausedSeconds: 0,
      startedAt: new Date().toISOString(),
      completed: false,
      source: "web",
    };
    setState((current) => ({ ...current, focusSessions: [created, ...current.focusSessions] }));
    return created;
  }, [state.tasks]);

  const updateFocus = useCallback((id: ID, patch: Partial<FocusSession>) => {
    setState((current) => ({
      ...current,
      focusSessions: current.focusSessions.map((session) =>
        session.id === id ? { ...session, ...patch } : session,
      ),
    }));
  }, []);

  const finishFocus = useCallback((id: ID, completed: boolean) => {
    setState((current) => ({
      ...current,
      focusSessions: current.focusSessions.map((session) =>
        session.id === id
          ? { ...session, endedAt: new Date().toISOString(), completed }
          : session,
      ),
    }));
  }, []);

  const addGoal = useCallback((input: Partial<Goal> & { title: string }): Goal => {
    const now = new Date().toISOString();
    const { title, ...rest } = input;
    const created: Goal = {
      description: "",
      workspaceId: null,
      targetValue: 1,
      unit: "tasks",
      currentValue: 0,
      milestones: [],
      ...rest,
      id: uid("goal"),
      title,
      createdAt: now,
      updatedAt: now,
    };
    setState((current) => ({ ...current, goals: [created, ...current.goals] }));
    return created;
  }, []);

  const updateGoal = useCallback((id: ID, patch: Partial<Goal>) => {
    setState((current) => ({
      ...current,
      goals: current.goals.map((goal) =>
        goal.id === id ? { ...goal, ...patch, updatedAt: new Date().toISOString() } : goal,
      ),
    }));
  }, []);

  const deleteGoal = useCallback((id: ID) => {
    setState((current) => ({ ...current, goals: current.goals.filter((goal) => goal.id !== id) }));
  }, []);

  const resetDemo = useCallback(() => {
    setState(seedState());
    setSelectedTaskId(null);
    notify("Demo data restored");
  }, [notify]);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      hydrated,
      selectedTaskId,
      quickAddOpen,
      quickAddWorkspaceId,
      commandOpen,
      toast,
      openTask: setSelectedTaskId,
      closeTask: () => setSelectedTaskId(null),
      setQuickAddOpen,
      setCommandOpen,
      notify,
      addTask,
      updateTask,
      toggleTask,
      archiveTask,
      restoreTask,
      toggleChecklist,
      addChecklistItem,
      addComment,
      addWorkspace,
      updateWorkspace,
      archiveWorkspace,
      addNote,
      updateNote,
      deleteNote,
      updateSettings,
      startFocus,
      updateFocus,
      finishFocus,
      addGoal,
      updateGoal,
      deleteGoal,
      resetDemo,
    }),
    [
      state,
      hydrated,
      selectedTaskId,
      quickAddOpen,
      quickAddWorkspaceId,
      commandOpen,
      toast,
      notify,
      setQuickAddOpen,
      addTask,
      updateTask,
      toggleTask,
      archiveTask,
      restoreTask,
      toggleChecklist,
      addChecklistItem,
      addComment,
      addWorkspace,
      updateWorkspace,
      archiveWorkspace,
      addNote,
      updateNote,
      deleteNote,
      updateSettings,
      startFocus,
      updateFocus,
      finishFocus,
      addGoal,
      updateGoal,
      deleteGoal,
      resetDemo,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const { state, updateSettings } = useStore();
  return [state.settings.theme, (theme: Theme) => updateSettings({ theme })];
}
