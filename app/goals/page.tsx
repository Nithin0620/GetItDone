"use client";

import { CalendarDays, Check, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/components/StoreProvider";
import { goalProgress } from "@/lib/analytics";
import type { Goal, Milestone } from "@/lib/types";
import { formatDate, uid } from "@/lib/utils";

function parseMilestones(text: string): Milestone[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, target] = line.split(":");
      return {
        id: uid("ms"),
        title: title.trim(),
        target: Math.max(1, Number(target?.trim()) || 1),
        current: 0,
      };
    });
}

function GoalModal({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const { state, addGoal, updateGoal } = useStore();
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [workspaceId, setWorkspaceId] = useState(goal?.workspaceId ?? "");
  const [targetValue, setTargetValue] = useState(String(goal?.targetValue ?? 100));
  const [unit, setUnit] = useState(goal?.unit ?? "tasks");
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [linkedTag, setLinkedTag] = useState(goal?.linkedTag ?? "");
  const [milestones, setMilestones] = useState(
    goal?.milestones.map((item) => `${item.title}: ${item.target}`).join("\n") ?? "",
  );

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const parsed = parseMilestones(milestones);
    const preserved = goal?.milestones ?? [];
    const input = {
      title: title.trim(),
      description: description.trim(),
      workspaceId: workspaceId || null,
      targetValue: Math.max(1, Number(targetValue) || 1),
      unit: unit.trim() || "tasks",
      deadline: deadline || undefined,
      linkedTag: linkedTag.trim() || undefined,
      milestones: parsed.map((item, index) => ({
        ...item,
        current: preserved[index]?.title === item.title ? preserved[index].current : 0,
      })),
    };
    if (goal) updateGoal(goal.id, input);
    else addGoal(input);
    onClose();
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">{goal ? "Edit goal" : "New goal"}</div>
        <div className="modal-body">
          <div className="field">
            <label>Title</label>
            <input className="input" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Solve 200 DSA problems" />
          </div>
          <div className="field">
            <label>Description</label>
            <input className="input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional context" />
          </div>
          <div className="detail-grid">
            <div className="field">
              <label>Workspace</label>
              <select className="select" value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
                <option value="">Any workspace</option>
                {state.workspaces
                  .filter((item) => !item.archived)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.icon} {item.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="field">
              <label>Deadline</label>
              <input className="input" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
            </div>
            <div className="field">
              <label>Target</label>
              <input className="input" type="number" min="1" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} />
            </div>
            <div className="field">
              <label>Unit</label>
              <input className="input" value={unit} onChange={(event) => setUnit(event.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Linked tag (progress from completed tasks, optional)</label>
            <input className="input" value={linkedTag} onChange={(event) => setLinkedTag(event.target.value)} placeholder="e.g. dp" />
          </div>
          <div className="field">
            <label>Milestones — one per line as “Name: target”</label>
            <textarea
              className="textarea"
              value={milestones}
              onChange={(event) => setMilestones(event.target.value)}
              placeholder={"Arrays: 30\nTrees: 30\nDP: 40"}
            />
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
            {goal ? "Save goal" : "Create goal"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function GoalsPage() {
  const { state, updateGoal, deleteGoal, notify } = useStore();
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const activeTasks = state.tasks.filter((task) => !task.archived);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Goals</h1>
          <p>Long-term targets, broken into reachable milestones.</p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-primary" onClick={() => setEditing("new")}>
            <Plus /> New goal
          </button>
        </div>
      </div>

      {state.goals.length === 0 ? (
        <div className="empty card">
          <div className="empty-icon"><Target /></div>
          <div className="empty-title">No goals yet</div>
          <div className="small">Set a target and break it into milestones.</div>
          <button className="btn btn-primary mt-16" onClick={() => setEditing("new")}>
            <Plus /> New goal
          </button>
        </div>
      ) : (
        <div className="grid grid-2">
          {state.goals.map((goal) => {
            const current = goalProgress(goal, activeTasks);
            const percent = Math.min(100, Math.round((current / Math.max(1, goal.targetValue)) * 100));
            const workspace = state.workspaces.find((item) => item.id === goal.workspaceId);
            const daysLeft = goal.deadline
              ? Math.ceil((new Date(`${goal.deadline}T12:00:00`).getTime() - Date.now()) / 86400000)
              : null;
            return (
              <section key={goal.id} className="card card-pad">
                <div className="row">
                  <div className="workspace-icon" style={{ width: 30, height: 30, fontSize: 15 }}>
                    <Target size={15} />
                  </div>
                  <div className="grow">
                    <div className="strong">{goal.title}</div>
                    <div className="tiny muted">
                      {workspace ? `${workspace.icon} ${workspace.name}` : "All workspaces"}
                    </div>
                  </div>
                  <button className="icon-btn" onClick={() => setEditing(goal)} title="Edit goal">
                    <Pencil />
                  </button>
                  <button className="icon-btn" onClick={() => { deleteGoal(goal.id); notify("Goal deleted"); }} title="Delete goal">
                    <Trash2 />
                  </button>
                </div>
                {goal.description && <p className="small muted" style={{ margin: "12px 0 0" }}>{goal.description}</p>}

                <div className="row space-between small mt-16">
                  <span className="muted">{current} / {goal.targetValue} {goal.unit}</span>
                  <span className="strong">{percent}%</span>
                </div>
                <div className="progress-track mt-8">
                  <div className="progress-fill" style={{ width: `${percent}%` }} />
                </div>

                <div className="row wrap mt-8" style={{ gap: 8 }}>
                  {goal.deadline && (
                    <span className="chip">
                      <CalendarDays size={12} /> {formatDate(goal.deadline)}
                      {daysLeft !== null ? ` · ${daysLeft > 0 ? `${daysLeft}d left` : "due"}` : ""}
                    </span>
                  )}
                  {goal.linkedTag && <span className="chip">#{goal.linkedTag}</span>}
                </div>

                {goal.milestones.length > 0 && (
                  <div className="mt-16">
                    <div className="tiny muted" style={{ marginBottom: 6 }}>Milestones</div>
                    {goal.milestones.map((milestone) => {
                      const ratio = Math.min(100, Math.round((milestone.current / Math.max(1, milestone.target)) * 100));
                      return (
                        <div key={milestone.id} className="row" style={{ gap: 8, padding: "5px 0" }}>
                          <span className="small grow truncate">{milestone.title}</span>
                          <div className="progress-track" style={{ width: 70 }}>
                            <div className="progress-fill" style={{ width: `${ratio}%` }} />
                          </div>
                          <span className="tiny muted" style={{ width: 52, textAlign: "right" }}>
                            {milestone.current}/{milestone.target}
                          </span>
                          <button
                            className="btn btn-sm"
                            onClick={() =>
                              updateGoal(goal.id, {
                                milestones: goal.milestones.map((item) =>
                                  item.id === milestone.id
                                    ? { ...item, current: Math.min(item.target, item.current + 1) }
                                    : item,
                                ),
                              })
                            }
                            title="Add one"
                          >
                            <Plus />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!goal.milestones.length && !goal.linkedTag && (
                  <button
                    className="btn btn-sm mt-16"
                    onClick={() => updateGoal(goal.id, { currentValue: current + 1 })}
                  >
                    <Check /> Log one {goal.unit}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}

      {editing && (
        <GoalModal
          key={editing === "new" ? "new" : editing.id}
          goal={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
