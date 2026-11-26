"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  BarChart3,
  Check,
  Inbox,
  LayoutDashboard,
  Moon,
  NotebookPen,
  Plus,
  Search,
  Settings,
  Sun,
  Target,
  Layers3,
} from "lucide-react";
import { useEffect } from "react";
import { AuthButton } from "@/components/AuthButton";
import { CommandMenu } from "@/components/CommandMenu";
import { FocusTimer } from "@/components/FocusTimer";
import { QuickAdd } from "@/components/QuickAdd";
import { TaskDrawer } from "@/components/TaskDrawer";
import { useStore } from "@/components/StoreProvider";

const NAV = [
  { href: "/", label: "Today", icon: LayoutDashboard },
  { href: "/workspaces", label: "Workspaces", icon: Layers3 },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/search", label: "Search", icon: Search },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/archive", label: "Archive", icon: Archive },
  { href: "/settings", label: "Settings", icon: Settings },
];

function pageTitle(pathname: string) {
  if (pathname === "/") return ["Today", "Your plan for today"];
  if (pathname.startsWith("/workspaces/")) return ["Workspace", "Tasks and progress"];
  if (pathname.startsWith("/workspaces")) return ["Workspaces", "Everything in its place"];
  if (pathname.startsWith("/inbox")) return ["Inbox", "Unsorted thoughts"];
  if (pathname.startsWith("/search")) return ["Search", "Find anything, fast"];
  if (pathname.startsWith("/notes")) return ["Notes", "Ideas and references"];
  if (pathname.startsWith("/goals")) return ["Goals", "Targets and milestones"];
  if (pathname.startsWith("/analytics")) return ["Analytics", "What the data says"];
  if (pathname.startsWith("/archive")) return ["Archive", "Out of sight, still kept"];
  if (pathname.startsWith("/settings")) return ["Settings", "Preferences and data"];
  return ["getitdone", ""];
}

export function AppShell({ children, authEnabled }: { children: React.ReactNode; authEnabled: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    state,
    hydrated,
    quickAddOpen,
    commandOpen,
    toast,
    setQuickAddOpen,
    setCommandOpen,
    selectedTaskId,
    closeTask,
  } = useStore();
  const [title, subtitle] = pageTitle(pathname);
  const activeTasks = state.tasks.filter((task) => !task.archived);
  const myDayCount = activeTasks.filter((task) => task.myDay && task.status !== "done").length;
  const inboxCount = activeTasks.filter((task) => !task.workspaceId).length;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(!commandOpen);
      } else if (!typing && event.key.toLowerCase() === "n" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setQuickAddOpen(true);
      } else if (event.key === "Escape") {
        setCommandOpen(false);
        setQuickAddOpen(false);
        closeTask();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen, setQuickAddOpen, commandOpen, closeTask]);

  useEffect(() => {
    if (!state.settings.notifications || typeof Notification === "undefined") return;
    const check = () => {
      if (Notification.permission !== "granted") return;
      const now = Date.now();
      activeTasks.forEach((task) => {
        if (!task.reminderAt || task.status === "done") return;
        const at = new Date(task.reminderAt).getTime();
        if (at <= now && now - at < 60000) {
          new Notification("getitdone reminder", { body: task.title });
        }
      });
    };
    const timer = window.setInterval(check, 30000);
    check();
    return () => window.clearInterval(timer);
  }, [state.settings.notifications, activeTasks]);

  if (!hydrated) {
    return <div className="boot">Loading your workspace…</div>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">g</div>
          getitdone
        </div>
        <div className="nav-section">Plan</div>
        <nav className="nav-list">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const count =
              item.href === "/" ? myDayCount : item.href === "/inbox" ? inboxCount : 0;
            return (
              <button
                key={item.href}
                className={`nav-item ${active ? "active" : ""}`}
                onClick={() => router.push(item.href)}
              >
                <Icon />
                <span>{item.label}</span>
                {count > 0 && <span className="nav-count">{count}</span>}
              </button>
            );
          })}
        </nav>
        <div className="nav-section">Workspaces</div>
        <nav className="nav-list">
          {state.workspaces
            .filter((workspace) => !workspace.archived)
            .sort((a, b) => a.order - b.order)
            .map((workspace) => (
              <button
                key={workspace.id}
                className={`nav-item ${pathname === `/workspaces/${workspace.id}` ? "active" : ""}`}
                onClick={() => router.push(`/workspaces/${workspace.id}`)}
              >
                <span className="nav-emoji">{workspace.icon}</span>
                <span>{workspace.name}</span>
              </button>
            ))}
        </nav>
        <div className="sidebar-foot">
          <ThemeButton />
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-title">{title}</div>
          <div className="topbar-sub">· {subtitle}</div>
          <div className="topbar-spacer" />
          <AuthButton enabled={authEnabled} />
          <button className="btn" onClick={() => setCommandOpen(true)}>
            <Search />
            <span className="topbar-sub">Search</span>
            <span className="kbd">⌘K</span>
          </button>
          <button className="btn btn-primary" onClick={() => setQuickAddOpen(true)}>
            <Plus />
            New
            <span className="kbd" style={{ background: "color-mix(in srgb, var(--accent-ink) 14%, transparent)", borderColor: "transparent", color: "var(--accent-ink)" }}>
              N
            </span>
          </button>
        </header>
        <div className="content">{children}</div>
      </main>

      {quickAddOpen && <QuickAdd />}
      {commandOpen && <CommandMenu />}
      {selectedTaskId && <TaskDrawer key={selectedTaskId} taskId={selectedTaskId} onClose={closeTask} />}
      <FocusTimer />
      {toast && <div className="toast"><Check size={14} /> {toast}</div>}
    </div>
  );
}

function ThemeButton() {
  const { state, updateSettings } = useStore();
  const dark = state.settings.theme === "dark";
  return (
    <button
      className="nav-item"
      onClick={() => updateSettings({ theme: dark ? "light" : "dark" })}
      title={dark ? "Switch to light" : "Switch to dark"}
    >
      {dark ? <Sun /> : <Moon />}
      <span>{dark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}

