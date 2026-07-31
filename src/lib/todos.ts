import type { Todo, TodoInput } from "@/types/models";

export const TODO_TITLE_MAX_LENGTH = 160;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string): boolean {
  if (!DATE_KEY.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateTodoInput(input: TodoInput): TodoInput {
  const title = input.title.trim();
  if (!title) throw new Error("Todo title is required.");
  if (title.length > TODO_TITLE_MAX_LENGTH) {
    throw new Error(`Todo title must be ${TODO_TITLE_MAX_LENGTH} characters or fewer.`);
  }
  if (!isDateKey(input.todoDate)) {
    throw new Error("Choose a valid todo date.");
  }
  return { title, notes: input.notes?.trim() || null, todoDate: input.todoDate };
}

export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) =>
    Number(a.is_completed) - Number(b.is_completed)
    || a.created_at.localeCompare(b.created_at),
  );
}

export function todosForDate(todos: Todo[], dateKey: string): Todo[] {
  return sortTodos(todos.filter((todo) => todo.todo_date === dateKey));
}

export function overdueTodos(todos: Todo[], todayKey: string): Todo[] {
  return sortTodos(todos.filter((todo) => !todo.is_completed && todo.todo_date < todayKey));
}

export function completionPatch(completed: boolean, now = new Date()) {
  return { is_completed: completed, completed_at: completed ? now.toISOString() : null };
}
