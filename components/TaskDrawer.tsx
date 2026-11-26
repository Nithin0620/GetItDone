"use client";

import { Archive, Bell, Check, Clock3, Plus, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/components/StoreProvider";
import { minutesLabel } from "@/lib/analytics";
import type { Priority, Recurrence, Status } from "@/lib/types";
import { PRIORITIES, PRIORITY_LABELS, RECURRENCES, STATUSES, STATUS_LABELS } from "@/lib/utils";

export function TaskDrawer({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const {
    state,
    updateTask,
    toggleTask,
    archiveTask,
    restoreTask,
    toggleChecklist,
    addChecklistItem,
    addComment,
    updateSettings,
    notify,
  } = useStore();
  const task = state.tasks.find((item) => item.id === taskId);
  const workspace = state.workspaces.find((item) => item.id === task?.workspaceId);
  const actualSeconds = state.focusSessions
    .filter((session) => session.taskId === taskId && session.endedAt)
    .reduce((total, session) => total + session.actualSeconds, 0);
  const [tagText, setTagText] = useState(() => task?.tags.join(", ") ?? "");
  const [linkText, setLinkText] = useState(() => task?.links.join(", ") ?? "");
  const [newItem, setNewItem] = useState("");
  const [newComment, setNewComment] = useState("");

  if (!task) return null;

  function commitTags() {
    updateTask(taskId, {
      tags: tagText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
  }

  function commitLinks() {
    updateTask(taskId, {
      links: linkText
        .split(/[,\n]/)
        .map((link) => link.trim())
        .filter(Boolean),
    });
  }

  async function setReminder(value: string) {
    if (!value) {
      updateTask(taskId, { reminderAt: undefined });
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") updateSettings({ notifications: true });
      else notify("Enable browser notifications to get reminders");
    } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      updateSettings({ notifications: true });
    }
    updateTask(taskId, { reminderAt: new Date(value).toISOString() });
  }

  return (
    <>
      <div className="drawer-backdrop" onMouseDown={onClose} />
      <aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <span className="chip">
            {workspace ? `${workspace.icon} ${workspace.name}` : "Inbox"}
          </span>
          <div className="grow" />
          {task.archived ? (
            <button className="btn btn-sm" onClick={() => restoreTask(taskId)}>
              <RotateCcw /> Restore
            </button>
          ) : (
            <button className="btn btn-sm" onClick={() => archiveTask(taskId)} title="Archive task">
              <Archive /> Archive
            </button>
          )}
          <button className="icon-btn" onClick={onClose} title="Close">
            <X />
          </button>
        </div>

        <div className="drawer-body">
          <input
            className="title-input"
            value={task.title}
            onChange={(event) => updateTask(taskId, { title: event.target.value })}
            placeholder="Task title"
          />

          {actualSeconds > 0 && (
            <div className="row small muted">
              <Clock3 size={14} />
              Actual focus {minutesLabel(actualSeconds)}
              {task.estimatedMinutes ? ` · estimated ${task.estimatedMinutes}m` : ""}
            </div>
          )}

          <div className="field">
            <label>Description</label>
            <textarea
              className="textarea"
              value={task.description}
              onChange={(event) => updateTask(taskId, { description: event.target.value })}
              placeholder="Add a little context…"
            />
          </div>

          <div className="detail-grid">
            <div className="field">
              <label>Status</label>
              <select
                className="select"
                value={task.status}
                onChange={(event) => updateTask(taskId, { status: event.target.value as Status })}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Priority</label>
              <select
                className="select"
                value={task.priority}
                onChange={(event) => updateTask(taskId, { priority: event.target.value as Priority })}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Start date</label>
              <input
                type="date"
                className="input"
                value={task.startDate ?? ""}
                onChange={(event) => updateTask(taskId, { startDate: event.target.value || undefined })}
              />
            </div>
            <div className="field">
              <label>Due date</label>
              <input
                type="date"
                className="input"
                value={task.dueDate ?? ""}
                onChange={(event) => updateTask(taskId, { dueDate: event.target.value || undefined })}
              />
            </div>
            <div className="field">
              <label>Estimated time (minutes)</label>
              <input
                type="number"
                min="0"
                step="15"
                className="input"
                value={task.estimatedMinutes ?? ""}
                onChange={(event) =>
                  updateTask(taskId, {
                    estimatedMinutes: event.target.value ? Number(event.target.value) : undefined,
                  })
                }
              />
            </div>
            <div className="field">
              <label>Repeat</label>
              <select
                className="select"
                value={task.recurrence}
                onChange={(event) => updateTask(taskId, { recurrence: event.target.value as Recurrence })}
              >
                {RECURRENCES.map((item) => (
                  <option key={item} value={item}>
                    {item === "none" ? "No repeat" : item}
                  </option>
                ))}
              </select>
            </div>
            {task.myDay && (
              <div className="field">
                <label>My Day time</label>
                <input
                  type="time"
                  className="input"
                  value={task.dayBlock ?? ""}
                  onChange={(event) => updateTask(taskId, { dayBlock: event.target.value || undefined })}
                />
              </div>
            )}
          </div>

          <div className="field">
            <label className="row" style={{ gap: 6 }}>
              <Bell style={{ width: 13, height: 13 }} /> Reminder
            </label>
            <input
              type="datetime-local"
              className="input"
              value={task.reminderAt ? new Date(task.reminderAt).toISOString().slice(0, 16) : ""}
              onChange={(event) => void setReminder(event.target.value)}
            />
          </div>

          <div className="detail-grid">
            <div className="field">
              <label>Tags (comma separated)</label>
              <input
                className="input"
                value={tagText}
                onChange={(event) => setTagText(event.target.value)}
                onBlur={commitTags}
                placeholder="dp, revision"
              />
            </div>
            <div className="field">
              <label>Workspace</label>
              <select
                className="select"
                value={task.workspaceId ?? ""}
                onChange={(event) => updateTask(taskId, { workspaceId: event.target.value || null })}
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
          </div>

          <div>
            <div className="row space-between" style={{ marginBottom: 8 }}>
              <span className="small strong">Checklist</span>
              <span className="tiny faint">
                {task.checklist.filter((item) => item.done).length}/{task.checklist.length}
              </span>
            </div>
            {task.checklist.map((item) => (
              <div key={item.id} className={`checklist-item ${item.done ? "done" : ""}`}>
                <button
                  className={`checkbox ${item.done ? "checked" : ""}`}
                  onClick={() => toggleChecklist(taskId, item.id)}
                >
                  <Check />
                </button>
                <span className="grow">{item.title}</span>
                <button
                  className="icon-btn"
                  title="Remove"
                  onClick={() =>
                    updateTask(taskId, {
                      checklist: task.checklist.filter((entry) => entry.id !== item.id),
                    })
                  }
                >
                  <X />
                </button>
              </div>
            ))}
            <form
              className="row mt-8"
              onSubmit={(event) => {
                event.preventDefault();
                if (!newItem.trim()) return;
                addChecklistItem(taskId, newItem);
                setNewItem("");
              }}
            >
              <input
                className="input"
                placeholder="Add an item"
                value={newItem}
                onChange={(event) => setNewItem(event.target.value)}
              />
              <button className="icon-btn" type="submit" title="Add item">
                <Plus />
              </button>
            </form>
          </div>

          <div className="field">
            <label>Reference links (comma separated)</label>
            <input
              className="input"
              value={linkText}
              onChange={(event) => setLinkText(event.target.value)}
              onBlur={commitLinks}
              placeholder="https://…"
            />
          </div>

          <div>
            <div className="small strong" style={{ marginBottom: 6 }}>
              Comments
            </div>
            {task.comments.length === 0 && <div className="tiny faint">No comments yet.</div>}
            {task.comments.map((comment) => (
              <div key={comment.id} className="comment">
                <div className="small">{comment.text}</div>
                <div className="comment-meta">
                  {new Date(comment.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
            <form
              className="row mt-8"
              onSubmit={(event) => {
                event.preventDefault();
                if (!newComment.trim()) return;
                addComment(taskId, newComment);
                setNewComment("");
              }}
            >
              <input
                className="input"
                placeholder="Write a comment…"
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
              />
              <button className="icon-btn" type="submit" title="Add comment">
                <Plus />
              </button>
            </form>
          </div>

          <div className="row small muted">
            <Clock3 style={{ width: 14, height: 14 }} />
            Created {new Date(task.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            <span className="dot-sep" />
            Updated {new Date(task.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
        </div>

        <div className="drawer-foot">
          <button
            className={`btn ${task.status === "done" ? "" : "btn-primary"}`}
            onClick={() => toggleTask(taskId)}
          >
            <Check /> {task.status === "done" ? "Mark as todo" : "Complete"}
          </button>
          <div className="grow" />
          <button
            className="btn"
            onClick={() => {
              updateTask(taskId, { myDay: !task.myDay, dayBlock: task.myDay ? undefined : "09:00" });
              notify(task.myDay ? "Removed from My Day" : "Added to My Day");
            }}
          >
            {task.myDay ? "Remove from My Day" : "Add to My Day"}
          </button>
        </div>
      </aside>
    </>
  );
}
