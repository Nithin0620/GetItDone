"use client";

import { NotebookPen, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/components/StoreProvider";

export default function NotesPage() {
  const { state, addNote, updateNote, deleteNote, notify } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const notes = state.notes;
  const current = notes.find((note) => note.id === selectedId) ?? notes[0];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Notes</h1>
          <p>Keep context close to the work.</p>
        </div>
        <div className="page-head-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              const note = addNote();
              setSelectedId(note.id);
            }}
          >
            <Plus /> New note
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="empty card">
          <div className="empty-icon"><NotebookPen /></div>
          <div className="empty-title">No notes yet</div>
          <div className="small">Create one to keep ideas and references nearby.</div>
        </div>
      ) : (
        <div className="notes-layout">
          <div className="card">
            {notes.map((note) => {
              const workspace = state.workspaces.find((item) => item.id === note.workspaceId);
              return (
                <button
                  key={note.id}
                  className={`note-item ${current?.id === note.id ? "active" : ""}`}
                  style={{ width: "100%", textAlign: "left", background: "transparent", border: 0 }}
                  onClick={() => setSelectedId(note.id)}
                >
                  <div className="small strong truncate">{note.title || "Untitled note"}</div>
                  <div className="tiny muted truncate">
                    {workspace ? `${workspace.icon} ${workspace.name}` : "General"}
                  </div>
                </button>
              );
            })}
          </div>

          {current && (
            <div className="card">
              <div className="row" style={{ borderBottom: "1px solid var(--border)" }}>
                <input
                  className="note-title-input grow"
                  value={current.title}
                  onChange={(event) => updateNote(current.id, { title: event.target.value })}
                />
                <select
                  className="select"
                  style={{ width: 170, marginRight: 12 }}
                  value={current.workspaceId ?? ""}
                  onChange={(event) => updateNote(current.id, { workspaceId: event.target.value || null })}
                >
                  <option value="">General</option>
                  {state.workspaces
                    .filter((workspace) => !workspace.archived)
                    .map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.icon} {workspace.name}
                      </option>
                    ))}
                </select>
                <button
                  className="icon-btn"
                  title="Delete note"
                  style={{ marginRight: 10 }}
                  onClick={() => {
                    deleteNote(current.id);
                    setSelectedId(null);
                    notify("Note deleted");
                  }}
                >
                  <Trash2 />
                </button>
              </div>
              <textarea
                className="note-editor"
                value={current.body}
                onChange={(event) => updateNote(current.id, { body: event.target.value })}
                placeholder="Start writing…"
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
