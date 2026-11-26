"use client";

import { ArrowUpRight, FileText, Layers3, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/StoreProvider";

interface CommandItem {
  id: string;
  label: string;
  sub: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandMenu() {
  const router = useRouter();
  const { state, setCommandOpen, addTask, openTask, notify } = useStore();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const items = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase();
    const result: CommandItem[] = [];

    if (q) {
      result.push({
        id: "create",
        label: `Create “${query.trim()}”`,
        sub: "Inbox · press Enter",
        icon: <Plus />,
        run: () => {
          addTask({ title: query.trim(), workspaceId: null });
          notify("Task added to Inbox");
        },
      });
    }

    state.tasks
      .filter((task) => !task.archived && (!q || `${task.title} ${task.description} ${task.tags.join(" ")}`.toLowerCase().includes(q)))
      .slice(0, q ? 6 : 5)
      .forEach((task) => {
        const workspace = state.workspaces.find((item) => item.id === task.workspaceId);
        result.push({
          id: task.id,
          label: task.title,
          sub: workspace ? `${workspace.icon} ${workspace.name}` : "Inbox",
          icon: <ArrowUpRight />,
          run: () => openTask(task.id),
        });
      });

    if (q) {
      state.notes
        .filter((note) => `${note.title} ${note.body}`.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((note) => {
          result.push({
            id: note.id,
            label: note.title,
            sub: "Note",
            icon: <FileText />,
            run: () => router.push("/notes"),
          });
        });

      state.workspaces
        .filter((workspace) => !workspace.archived && workspace.name.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((workspace) => {
          result.push({
            id: workspace.id,
            label: workspace.name,
            sub: "Workspace",
            icon: <Layers3 />,
            run: () => router.push(`/workspaces/${workspace.id}`),
          });
        });
    }

    return result;
  }, [query, state.tasks, state.workspaces, state.notes, addTask, notify, openTask, router]);

  useEffect(() => setSelected(0), [query]);

  function choose(item?: CommandItem) {
    if (!item) return;
    item.run();
    setCommandOpen(false);
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => setCommandOpen(false)}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="row" style={{ borderBottom: "1px solid var(--border)" }}>
          <Search style={{ marginLeft: 18, width: 16, height: 16, color: "var(--muted)" }} />
          <input
            className="command-input"
            autoFocus
            placeholder="Search tasks, notes, workspaces…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelected((value) => Math.min(value + 1, items.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelected((value) => Math.max(value - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                choose(items[selected]);
              }
            }}
          />
        </div>
        <div className="command-list">
          {items.length === 0 ? (
            <div className="empty small">No results. Start typing to create a task.</div>
          ) : (
            items.map((item, index) => (
              <button
                key={`${item.id}-${index}`}
                className={`command-item ${index === selected ? "selected" : ""}`}
                onMouseEnter={() => setSelected(index)}
                onClick={() => choose(item)}
              >
                <span className="muted">{item.icon}</span>
                <span className="truncate">{item.label}</span>
                <small>{item.sub}</small>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
