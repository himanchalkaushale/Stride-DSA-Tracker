import assert from "node:assert/strict";
import test from "node:test";
import { completionPatch, overdueTodos, sortTodos, todosForDate, validateTodoInput } from "./todos.ts";
import type { Todo } from "../types/models.ts";

const todo = (patch: Partial<Todo> = {}): Todo => ({
  id: "1", user_id: "user", title: "Task", notes: null, todo_date: "2026-07-31",
  is_completed: false, completed_at: null, created_at: "2026-07-31T08:00:00Z",
  updated_at: "2026-07-31T08:00:00Z", ...patch,
});

test("todo validation trims fields and rejects invalid titles", () => {
  assert.deepEqual(validateTodoInput({ title: "  Read  ", notes: " note ", todoDate: "2026-07-31" }),
    { title: "Read", notes: "note", todoDate: "2026-07-31" });
  assert.throws(() => validateTodoInput({ title: " ", notes: null, todoDate: "2026-07-31" }), /required/);
  assert.throws(() => validateTodoInput({ title: "x".repeat(161), notes: null, todoDate: "2026-07-31" }), /160/);
  assert.throws(() => validateTodoInput({ title: "Task", notes: null, todoDate: "2026-02-31" }), /valid/);
});

test("todos sort incomplete before completed and retain creation order", () => {
  const result = sortTodos([
    todo({ id: "3", is_completed: true, completed_at: "2026-07-31T09:00:00Z" }),
    todo({ id: "2", created_at: "2026-07-31T09:00:00Z" }),
    todo({ id: "1" }),
  ]);
  assert.deepEqual(result.map((item) => item.id), ["1", "2", "3"]);
});

test("date and overdue filters keep todos on their original dates", () => {
  const items = [
    todo({ id: "old", todo_date: "2026-07-30" }),
    todo({ id: "today" }),
    todo({ id: "done", todo_date: "2026-07-29", is_completed: true, completed_at: "2026-07-29T10:00:00Z" }),
  ];
  assert.deepEqual(todosForDate(items, "2026-07-31").map((item) => item.id), ["today"]);
  assert.deepEqual(overdueTodos(items, "2026-07-31").map((item) => item.id), ["old"]);
});

test("completion timestamps are set and cleared", () => {
  const now = new Date("2026-07-31T10:00:00Z");
  assert.deepEqual(completionPatch(true, now), { is_completed: true, completed_at: now.toISOString() });
  assert.deepEqual(completionPatch(false, now), { is_completed: false, completed_at: null });
});
