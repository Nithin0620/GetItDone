"use client";

import { FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { TaskRow } from "@/components/TaskRow";
import { useStore } from "@/components/StoreProvider";

export default function SearchPage() {
  const router = useRouter();
  const { state } = useStore();
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query).trim().toLowerCase();

  const tasks = state.tasks
    .filter((task) => !task.archived)
    .filter((task) => !q || `${task.title} ${task.description} ${task.tags.join(" ")}`.toLowerCase().includes(q));
  const notes = state.notes.filter(
    (note) => !q || `${note.title} ${note.body}`.toLowerCase().includes(q),
  );
  const workspaces = state.workspaces.filter(
    (workspace) => !workspace.archived && (!q || workspace.name.toLowerCase().includes(q)),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Search</h1>
          <p>Every task, note and workspace in one place.</p>
        </div>
      </div>

      <div className="search-box card" style={{ padding: 8, marginBottom: 20 }}>
        <Search />
        <input
          className="input"
          autoFocus
          placeholder="Search everything…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ border: 0, background: "transparent", fontSize: 15 }}
        />
      </div>

      {tasks.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Tasks · {tasks.length}</h2></div>
          <div className="task-list">
            {tasks.slice(0, 20).map((task) => (
              <TaskRow key={task.id} task={task} showWorkspace />
            ))}
          </div>
        </section>
      )}
      {notes.length > 0 && (
        <section className="card mt-16">
          <div className="card-head"><h2>Notes · {notes.length}</h2></div>
          {notes.map((note) => (
            <button
              key={note.id}
              className="command-item"
              onClick={() => router.push("/notes")}
            >
              <FileText />
              <span>{note.title}</span>
              <small className="truncate" style={{ maxWidth: 240 }}>{note.body.slice(0, 50)}</small>
            </button>
          ))}
        </section>
      )}
      {workspaces.length > 0 && (
        <section className="card mt-16">
          <div className="card-head"><h2>Workspaces · {workspaces.length}</h2></div>
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              className="command-item"
              onClick={() => router.push(`/workspaces/${workspace.id}`)}
            >
              <span>{workspace.icon}</span>
              <span>{workspace.name}</span>
              <small>{workspace.description}</small>
            </button>
          ))}
        </section>
      )}
      {tasks.length === 0 && notes.length === 0 && workspaces.length === 0 && (
        <div className="empty card">No results for “{query}”.</div>
      )}
    </>
  );
}
