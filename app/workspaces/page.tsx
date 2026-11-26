"use client";

import { ArrowRight, Plus, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/components/StoreProvider";
import { progress } from "@/lib/utils";

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#f43f5e", "#64748b"];

export default function WorkspacesPage() {
  const router = useRouter();
  const { state, addWorkspace, updateWorkspace, notify } = useStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("✦");
  const [color, setColor] = useState(COLORS[0]);
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState("");
  const active = state.workspaces.filter((workspace) => !workspace.archived);
  const archived = state.workspaces.filter((workspace) => workspace.archived);

  function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const workspace = addWorkspace({
      name: name.trim(),
      icon: icon.trim() || "✦",
      color,
      description: description.trim(),
      categories: categories
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    });
    setCreating(false);
    setName("");
    setDescription("");
    setCategories("");
    notify("Workspace created");
    router.push(`/workspaces/${workspace.id}`);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Workspaces</h1>
          <p>Give every part of your life its own space.</p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus /> New workspace
          </button>
        </div>
      </div>

      <div className="grid grid-3">
        {active.map((workspace) => {
          const tasks = state.tasks.filter((task) => task.workspaceId === workspace.id && !task.archived);
          const stat = progress(tasks);
          return (
            <button
              key={workspace.id}
              className="card workspace-card"
              style={{ textAlign: "left" }}
              onClick={() => router.push(`/workspaces/${workspace.id}`)}
            >
              <div className="row">
                <div className="workspace-icon">{workspace.icon}</div>
                <div className="grow">
                  <div className="workspace-name">{workspace.name}</div>
                  <div className="tiny muted">{tasks.length} tasks · {stat.done} completed</div>
                </div>
                <ArrowRight size={15} className="faint" />
              </div>
              <p className="small muted" style={{ margin: 0, minHeight: 36 }}>
                {workspace.description || "No description yet."}
              </p>
              {workspace.categories.length > 0 && (
                <div className="row wrap" style={{ gap: 5 }}>
                  {workspace.categories.slice(0, 3).map((category) => (
                    <span key={category} className="chip">
                      {category}
                    </span>
                  ))}
                </div>
              )}
              <div>
                <div className="row space-between tiny muted" style={{ marginBottom: 6 }}>
                  <span>Progress</span>
                  <span>{stat.percent}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${stat.percent}%`, background: workspace.color }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {archived.length > 0 && (
        <section className="mt-24">
          <h2 className="strong small muted">Archived workspaces</h2>
          <div className="grid grid-3 mt-8">
            {archived.map((workspace) => (
              <div key={workspace.id} className="card card-pad row">
                <span>{workspace.icon}</span>
                <span className="grow muted">{workspace.name}</span>
                <button
                  className="btn btn-sm"
                  onClick={() => updateWorkspace(workspace.id, { archived: false })}
                >
                  <RotateCcw /> Restore
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {creating && (
        <div className="modal-backdrop" onMouseDown={() => setCreating(false)}>
          <form className="modal" onSubmit={create} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">New workspace</div>
            <div className="modal-body">
              <div className="row" style={{ gap: 12 }}>
                <div className="field" style={{ width: 64 }}>
                  <label>Icon</label>
                  <input className="input" value={icon} onChange={(event) => setIcon(event.target.value)} maxLength={3} />
                </div>
                <div className="field grow">
                  <label>Name</label>
                  <input className="input" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. DSA Preparation" />
                </div>
              </div>
              <div className="field">
                <label>Description</label>
                <input className="input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What lives here?" />
              </div>
              <div className="field">
                <label>Categories (comma separated)</label>
                <input className="input" value={categories} onChange={(event) => setCategories(event.target.value)} placeholder="Arrays, Trees, DP" />
              </div>
              <div className="field">
                <label>Color</label>
                <div className="row" style={{ gap: 7 }}>
                  {COLORS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setColor(item)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: item,
                        border: color === item ? "2px solid var(--text)" : "2px solid transparent",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setCreating(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!name.trim()}>Create workspace</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
