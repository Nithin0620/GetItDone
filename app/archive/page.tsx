"use client";

import { Archive, RotateCcw } from "lucide-react";
import { TaskRow } from "@/components/TaskRow";
import { useStore } from "@/components/StoreProvider";

export default function ArchivePage() {
  const { state, restoreTask, updateWorkspace } = useStore();
  const tasks = state.tasks.filter((task) => task.archived);
  const workspaces = state.workspaces.filter((workspace) => workspace.archived);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Archive</h1>
          <p>Completed projects stay here, out of the way.</p>
        </div>
      </div>

      {tasks.length === 0 && workspaces.length === 0 ? (
        <div className="empty card">
          <div className="empty-icon"><Archive /></div>
          <div className="empty-title">Nothing archived</div>
          <div className="small">Archived tasks and workspaces will appear here.</div>
        </div>
      ) : (
        <div className="stack">
          {tasks.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h2>Tasks · {tasks.length}</h2>
              </div>
              <div className="task-list">
                {tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    showWorkspace
                    trailing={
                      <button className="btn btn-sm" onClick={() => restoreTask(task.id)}>
                        <RotateCcw /> Restore
                      </button>
                    }
                  />
                ))}
              </div>
            </section>
          )}
          {workspaces.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h2>Workspaces · {workspaces.length}</h2>
              </div>
              {workspaces.map((workspace) => (
                <div key={workspace.id} className="task-row">
                  <span>{workspace.icon}</span>
                  <span className="grow">{workspace.name}</span>
                  <button
                    className="btn btn-sm"
                    onClick={() => updateWorkspace(workspace.id, { archived: false })}
                  >
                    <RotateCcw /> Restore
                  </button>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </>
  );
}
