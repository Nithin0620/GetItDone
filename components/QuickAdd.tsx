"use client";

import { useState } from "react";
import { useStore } from "@/components/StoreProvider";
import type { Priority } from "@/lib/types";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/utils";

export function QuickAdd() {
  const { state, addTask, setQuickAddOpen, quickAddWorkspaceId, notify } = useStore();
  const [title, setTitle] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string>(quickAddWorkspaceId ?? "");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    addTask({
      title: title.trim(),
      workspaceId: workspaceId || null,
      priority: priority as Priority,
      dueDate: dueDate || undefined,
      estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
    });
    notify("Task added");
    setQuickAddOpen(false);
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => setQuickAddOpen(false)}>
      <form className="modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">Quick capture</div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="qa-title">Task</label>
            <input
              id="qa-title"
              className="input"
              autoFocus
              placeholder="What needs to get done?"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="detail-grid">
            <div className="field">
              <label htmlFor="qa-workspace">Workspace</label>
              <select
                id="qa-workspace"
                className="select"
                value={workspaceId}
                onChange={(event) => setWorkspaceId(event.target.value)}
              >
                <option value="">Inbox</option>
                {state.workspaces
                  .filter((workspace) => !workspace.archived)
                  .map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.icon} {workspace.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="qa-priority">Priority</label>
              <select
                id="qa-priority"
                className="select"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                {PRIORITIES.map((item) => (
                  <option key={item} value={item}>
                    {PRIORITY_LABELS[item]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="qa-due">Due date</label>
              <input
                id="qa-due"
                type="date"
                className="input"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="qa-time">Estimate (minutes)</label>
              <input
                id="qa-time"
                type="number"
                min="0"
                step="15"
                className="input"
                placeholder="e.g. 60"
                value={estimatedMinutes}
                onChange={(event) => setEstimatedMinutes(event.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={() => setQuickAddOpen(false)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
            Add task
          </button>
        </div>
      </form>
    </div>
  );
}
