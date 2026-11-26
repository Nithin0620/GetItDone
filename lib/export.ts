import type { AppState } from "@/lib/types";

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function tasksCsv(state: AppState): string {
  const header = [
    "id",
    "title",
    "workspace",
    "status",
    "priority",
    "dueDate",
    "startDate",
    "tags",
    "description",
    "completedAt",
    "archived",
  ];
  const rows = state.tasks.map((task) => {
    const workspace = state.workspaces.find((entry) => entry.id === task.workspaceId);
    return [
      task.id,
      task.title,
      workspace?.name ?? "Inbox",
      task.status,
      task.priority,
      task.dueDate,
      task.startDate,
      task.tags.join(" "),
      task.description,
      task.completedAt,
      task.archived,
    ]
      .map(csvCell)
      .join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

export function downloadText(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
