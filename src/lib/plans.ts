import type { DailyTask, DailyTaskWithProblem, Plan, PlanWithTasks } from "@/types/models";

export const MOVABLE_STATUSES = new Set(["planned", "in_progress", "review_due"]);

export function validatePlanName(value: string) {
  const name = value.trim();
  if (!name || name.length > 120) throw new Error("Plan name must be between 1 and 120 characters.");
  return name;
}

export function validateCapacity(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    throw new Error("Daily capacity must be between 1 and 20.");
  }
  return value;
}

export function addCalendarDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(date.valueOf())) throw new Error("Choose a valid date.");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function summarizePlan(plan: PlanWithTasks) {
  const dates = plan.tasks.map((task) => task.task_date).sort();
  const completed = plan.tasks.filter((task) => task.status === "completed").length;
  const skipped = plan.tasks.filter((task) => task.status === "skipped").length;
  const total = plan.tasks.length;
  return {
    total,
    completed,
    skipped,
    startDate: dates[0] ?? null,
    endDate: dates.at(-1) ?? null,
    progress: total ? Math.round((completed / total) * 100) : 0,
    isComplete: total > 0 && completed + skipped === total,
  };
}

export function sortPlanTasks<T extends Pick<DailyTask, "task_date" | "position" | "created_at" | "id">>(tasks: T[]) {
  return [...tasks].sort((a, b) =>
    a.task_date.localeCompare(b.task_date)
    || a.position - b.position
    || a.created_at.localeCompare(b.created_at)
    || a.id.localeCompare(b.id));
}

export function previewShift(tasks: DailyTask[], planId: string, fromDate: string, days: number) {
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("Shift must be between 1 and 365 days.");
  const moving = sortPlanTasks(tasks.filter((task) =>
    task.plan_id === planId && task.task_date >= fromDate && MOVABLE_STATUSES.has(task.status)));
  const movingIds = new Set(moving.map((task) => task.id));
  const conflicts: string[] = [];
  const preview = moving.map((task) => {
    const taskDate = addCalendarDays(task.task_date, days);
    if (tasks.some((existing) => !movingIds.has(existing.id)
      && existing.problem_id === task.problem_id && existing.task_date === taskDate)) {
      conflicts.push(`${task.problem_id} on ${taskDate}`);
    }
    return { task, taskDate };
  });
  return { preview, conflicts };
}

export function previewRedistribution(
  tasks: DailyTask[],
  planId: string,
  fromDate: string,
  startDate: string,
  capacity: number,
) {
  validateCapacity(capacity);
  const moving = sortPlanTasks(tasks.filter((task) =>
    task.plan_id === planId && task.task_date >= fromDate && MOVABLE_STATUSES.has(task.status)));
  const movingIds = new Set(moving.map((task) => task.id));
  const fixed = tasks.filter((task) => !movingIds.has(task.id) && MOVABLE_STATUSES.has(task.status));
  const assigned: { task: DailyTask; taskDate: string; position: number }[] = [];
  const conflicts: string[] = [];
  let cursor = startDate;

  for (const task of moving) {
    while (fixed.filter((item) => item.task_date === cursor).length
      + assigned.filter((item) => item.taskDate === cursor).length >= capacity) {
      cursor = addCalendarDays(cursor, 1);
    }
    if (fixed.some((item) => item.problem_id === task.problem_id && item.task_date === cursor)
      || assigned.some((item) => item.task.problem_id === task.problem_id && item.taskDate === cursor)) {
      conflicts.push(`${task.problem_id} on ${cursor}`);
    }
    const fixedPosition = fixed.filter((item) => item.task_date === cursor)
      .reduce((maximum, item) => Math.max(maximum, item.position), -1);
    const position = fixedPosition + 1 + assigned.filter((item) => item.taskDate === cursor).length;
    assigned.push({ task, taskDate: cursor, position });
  }
  return { preview: assigned, conflicts };
}

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function exportPlanCsv(plan: Plan, tasks: DailyTaskWithProblem[]) {
  const header = ["date", "position", "status", "title", "topic", "difficulty", "link", "estimated_minutes", "patterns", "description", "source"];
  const rows = sortPlanTasks(tasks).map(({ problem, ...task }) => [
    task.task_date, task.position, task.status, problem.title, problem.topics.join("|"),
    problem.difficulty, problem.external_url, problem.estimated_minutes,
    problem.patterns.join("|"), problem.description, problem.source,
  ].map(csvCell).join(","));
  return [header.join(","), ...rows].join("\r\n");
}
