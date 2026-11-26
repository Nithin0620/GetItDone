"use client";

import { Inbox, Plus } from "lucide-react";
import { TaskRow } from "@/components/TaskRow";
import { useStore } from "@/components/StoreProvider";

export default function InboxPage() {
  const { state, setQuickAddOpen, updateTask, notify } = useStore();
  const tasks = state.tasks.filter((task) => !task.archived && !task.workspaceId);
  const workspaces = state.workspaces.filter((workspace) => !workspace.archived);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inbox</h1>
          <p>Capture now, organize later.</p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-primary" onClick={() => setQuickAddOpen(true)}>
            <Plus /> New task
          </button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="empty card">
          <div className="empty-icon"><Inbox /></div>
          <div className="empty-title">Inbox zero</div>
          <div className="small">Everything has a home. Press N to capture something new.</div>
        </div>
      ) : (
        <div className="card">
          <div className="task-list">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                trailing={
                  <select
                    className="select"
                    style={{ width: 150, padding: "5px 8px", fontSize: 11 }}
                    value=""
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      updateTask(task.id, { workspaceId: event.target.value });
                      notify("Task moved to workspace");
                    }}
                  >
                    <option value="">Move to…</option>
                    {workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.icon} {workspace.name}
                      </option>
                    ))}
                  </select>
                }
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
