"use client";

import { Bell, Check, Link2, MessageSquare } from "lucide-react";
import { useStore } from "@/components/StoreProvider";
import { formatDate, humanDuration, isOverdue, PRIORITY_LABELS } from "@/lib/utils";
import type { Task } from "@/lib/types";

export function TaskRow({
  task,
  showWorkspace = false,
  trailing,
}: {
  task: Task;
  showWorkspace?: boolean;
  trailing?: React.ReactNode;
}) {
  const { state, openTask, toggleTask } = useStore();
  const workspace = state.workspaces.find((item) => item.id === task.workspaceId);
  const overdue = isOverdue(task);
  const doneItems = task.checklist.filter((item) => item.done).length;

  return (
    <div
      className={`task-row ${task.status === "done" ? "completed" : ""}`}
      onClick={() => openTask(task.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") openTask(task.id);
      }}
    >
      <button
        className={`checkbox ${task.status === "done" ? "checked" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          toggleTask(task.id);
        }}
        title={task.status === "done" ? "Mark as todo" : "Complete"}
      >
        <Check />
      </button>
      <div className="task-body">
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          <span
            className={`priority-dot p-${task.priority}`}
            title={`${PRIORITY_LABELS[task.priority]} priority`}
          />
          {showWorkspace && (
            <>
              <span>{workspace ? `${workspace.icon} ${workspace.name}` : "Inbox"}</span>
              <span className="dot-sep" />
            </>
          )}
          {task.dueDate && (
            <span className={overdue ? "overdue" : ""}>
              {overdue ? "Overdue · " : ""}
              {formatDate(task.dueDate)}
            </span>
          )}
          {task.dayBlock && (
            <>
              <span className="dot-sep" />
              <span>{task.dayBlock}</span>
            </>
          )}
          {task.estimatedMinutes ? (
            <>
              <span className="dot-sep" />
              <span>{humanDuration(task.estimatedMinutes)}</span>
            </>
          ) : null}
          {task.checklist.length > 0 && (
            <>
              <span className="dot-sep" />
              <span>
                {doneItems}/{task.checklist.length} items
              </span>
            </>
          )}
          {task.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="chip tag">
              {tag}
            </span>
          ))}
          {task.reminderAt && <Bell size={12} />}
          {task.links.length > 0 && <Link2 size={12} />}
          {task.comments.length > 0 && <MessageSquare size={12} />}
        </div>
      </div>
      <div className="task-side" onClick={(event) => event.stopPropagation()}>
        {trailing}
      </div>
    </div>
  );
}
