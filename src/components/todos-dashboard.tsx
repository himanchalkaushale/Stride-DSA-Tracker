"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { CheckIcon, ChevronIcon, ClockIcon } from "@/components/icons";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Toast } from "@/components/toast";
import { formatDateKey } from "@/lib/date-format";
import { addCalendarDays } from "@/lib/planner";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";
import { createClient } from "@/lib/supabase/client";
import { completionPatch, overdueTodos, sortTodos, TODO_TITLE_MAX_LENGTH, validateTodoInput } from "@/lib/todos";
import type { Todo, TodoInput } from "@/types/models";

export function TodosDashboard({
  userId,
  todayKey,
  selectedDate,
  initialTodos,
}: {
  userId: string;
  todayKey: string;
  selectedDate: string;
  initialTodos: Todo[];
}) {
  const router = useRouter();
  const repository = useMemo(() => new SupabaseTrackerRepository(createClient()), []);
  const [todos, setTodos] = useState(initialTodos);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [todoDate, setTodoDate] = useState(selectedDate);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [deleting, setDeleting] = useState<Todo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const selected = sortTodos(todos.filter((todo) => todo.todo_date === selectedDate));
  const overdue = overdueTodos(todos, todayKey);
  const completed = selected.filter((todo) => todo.is_completed).length;

  const navigate = (date: string) => router.push(`/todos?date=${date}`);
  const resetForm = () => {
    setTitle("");
    setNotes("");
    setTodoDate(selectedDate);
    setEditing(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    let input: TodoInput;
    try {
      input = validateTodoInput({ title, notes, todoDate });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check the todo details.");
      return;
    }

    setBusy(editing?.id ?? "create");
    if (editing) {
      const previous = todos;
      setTodos((items) => items.map((item) => item.id === editing.id ? {
        ...item, title: input.title, notes: input.notes, todo_date: input.todoDate,
      } : item));
      try {
        const saved = await repository.updateTodo(editing.id, input);
        setTodos((items) => items.map((item) => item.id === saved.id ? saved : item));
        resetForm();
        setError("");
        setToast("Todo updated.");
      } catch (cause) {
        setTodos(previous);
        setError(cause instanceof Error ? cause.message : "Could not update the todo.");
      } finally {
        setBusy(null);
      }
      return;
    }

    try {
      const saved = await repository.createTodo(userId, input);
      setTodos((items) => [...items, saved]);
      resetForm();
      setError("");
      setToast("Todo added.");
      if (input.todoDate !== selectedDate) navigate(input.todoDate);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add the todo.");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (todo: Todo) => {
    const previous = todos;
    const completedValue = !todo.is_completed;
    const patch = completionPatch(completedValue);
    setTodos((items) => items.map((item) => item.id === todo.id ? { ...item, ...patch } : item));
    setBusy(todo.id);
    try {
      const saved = await repository.setTodoCompleted(todo.id, completedValue);
      setTodos((items) => items.map((item) => item.id === saved.id ? saved : item));
      setError("");
      setToast(completedValue ? "Todo completed." : "Todo reopened.");
    } catch (cause) {
      setTodos(previous);
      setError(cause instanceof Error ? cause.message : "Could not update the todo.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    const target = deleting;
    const previous = todos;
    setTodos((items) => items.filter((item) => item.id !== target.id));
    setBusy(target.id);
    try {
      await repository.deleteTodo(target.id);
      setDeleting(null);
      setError("");
      setToast("Todo deleted.");
    } catch (cause) {
      setTodos(previous);
      setError(cause instanceof Error ? cause.message : "Could not delete the todo.");
    } finally {
      setBusy(null);
    }
  };

  const beginEdit = (todo: Todo) => {
    setEditing(todo);
    setTitle(todo.title);
    setNotes(todo.notes ?? "");
    setTodoDate(todo.todo_date);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="page-shell todos-page">
      <header className="page-heading">
        <div>
          <span className="page-kicker">PERSONAL TASKS</span>
          <h1>Todos</h1>
          <p>Plan small tasks by date without changing your practice schedule.</p>
        </div>
      </header>

      {error && <div className="state-banner error" role="alert"><span>Todo issue</span>{error}<button onClick={() => setError("")}>Dismiss</button></div>}

      <section className="todo-datebar panel">
        <button className="icon-button previous" aria-label="Previous day" onClick={() => navigate(addCalendarDays(selectedDate, -1))}><ChevronIcon /></button>
        <label>
          <span>Selected date</span>
          <input type="date" value={selectedDate} onChange={(event) => navigate(event.target.value)} />
        </label>
        <button className="icon-button" aria-label="Next day" onClick={() => navigate(addCalendarDays(selectedDate, 1))}><ChevronIcon /></button>
        <button className="button button-quiet" disabled={selectedDate === todayKey} onClick={() => navigate(todayKey)}>Today</button>
        <div className="todo-date-summary">
          <b>{formatDateKey(selectedDate, { weekday: "long", month: "long", day: "numeric" })}</b>
          <small>{completed} of {selected.length} complete</small>
        </div>
      </section>

      {overdue.length > 0 && selectedDate >= todayKey && (
        <button className="todo-overdue-banner" onClick={() => navigate(overdue[0].todo_date)}>
          <ClockIcon /><span><b>{overdue.length} overdue {overdue.length === 1 ? "todo" : "todos"}</b><small>Tasks stay on their original dates. Open the oldest overdue day.</small></span><ChevronIcon />
        </button>
      )}

      <div className="todos-layout">
        <form className="panel todo-form" onSubmit={submit}>
          <div className="panel-heading"><div><span>{editing ? "EDIT TODO" : "NEW TODO"}</span><h2>{editing ? "Update task" : "Add something to do"}</h2></div></div>
          <label><span>Title</span><input autoFocus value={title} maxLength={TODO_TITLE_MAX_LENGTH} onChange={(event) => setTitle(event.target.value)} placeholder="What needs doing?" required /></label>
          <label><span>Date</span><input type="date" value={todoDate} onChange={(event) => setTodoDate(event.target.value)} required /></label>
          <label><span>Notes <small>Optional</small></span><textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add context or a reminder…" /></label>
          <div className="todo-form-actions">
            {editing && <button className="button button-quiet" type="button" disabled={!!busy} onClick={resetForm}>Cancel</button>}
            <button className="button button-primary" disabled={!!busy || !title.trim()}>{busy === "create" ? "Adding…" : editing && busy === editing.id ? "Saving…" : editing ? "Save changes" : "Add todo"}</button>
          </div>
        </form>

        <section className="panel todo-list-panel">
          <div className="panel-heading">
            <div><span>SELECTED DAY</span><h2>{selected.length ? `${selected.length} ${selected.length === 1 ? "task" : "tasks"}` : "Nothing scheduled"}</h2></div>
            <small>{selected.length - completed} open · {completed} done</small>
          </div>
          <div className="todo-progress"><i style={{ width: `${selected.length ? (completed / selected.length) * 100 : 0}%` }} /></div>
          <div className="todo-list">
            {selected.map((todo) => (
              <article className={`todo-item ${todo.is_completed ? "completed" : ""}`} key={todo.id}>
                <button className="todo-check" disabled={busy === todo.id} aria-label={`${todo.is_completed ? "Reopen" : "Complete"} ${todo.title}`} aria-pressed={todo.is_completed} onClick={() => toggle(todo)}>{todo.is_completed && <CheckIcon />}</button>
                <div><b>{todo.title}</b>{todo.notes && <p>{todo.notes}</p>}</div>
                <div className="todo-item-actions"><button onClick={() => beginEdit(todo)}>Edit</button><button className="danger" onClick={() => setDeleting(todo)}>Delete</button></div>
              </article>
            ))}
            {!selected.length && <div className="empty-state compact"><span className="empty-orbit"><CheckIcon /></span><h3>Your day is clear</h3><p>Add a todo for this date using the form.</p></div>}
          </div>
        </section>
      </div>

      {deleting && <ConfirmDialog title="Delete this todo?" description={`“${deleting.title}” will be permanently removed.`} confirmLabel="Delete" busy={busy === deleting.id} onCancel={() => setDeleting(null)} onConfirm={remove} />}
      {toast && <Toast message={toast} onDismiss={() => setToast("")} />}
    </div>
  );
}

export function TodayTodosCard({
  userId,
  todayKey,
  initialTodos,
}: {
  userId: string;
  todayKey: string;
  initialTodos: Todo[];
}) {
  const repository = useMemo(() => new SupabaseTrackerRepository(createClient()), []);
  const [todos, setTodos] = useState(initialTodos);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const today = sortTodos(todos.filter((todo) => todo.todo_date === todayKey));
  const overdue = overdueTodos(todos, todayKey);
  const complete = today.filter((todo) => todo.is_completed).length;

  const quickAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy("add");
    try {
      const saved = await repository.createTodo(userId, { title, notes: null, todoDate: todayKey });
      setTodos((items) => [...items, saved]);
      setTitle("");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add the todo.");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (todo: Todo) => {
    const previous = todos;
    const next = !todo.is_completed;
    setTodos((items) => items.map((item) => item.id === todo.id ? { ...item, ...completionPatch(next) } : item));
    setBusy(todo.id);
    try {
      const saved = await repository.setTodoCompleted(todo.id, next);
      setTodos((items) => items.map((item) => item.id === saved.id ? saved : item));
      setError("");
    } catch (cause) {
      setTodos(previous);
      setError(cause instanceof Error ? cause.message : "Could not update the todo.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel side-panel today-todos-card">
      <div className="panel-heading"><div><span>PERSONAL TODOS</span><h2>Today&apos;s small wins</h2></div><Link href="/todos">View all</Link></div>
      <div className="todo-progress"><i style={{ width: `${today.length ? (complete / today.length) * 100 : 0}%` }} /></div>
      <small className="todo-card-count">{complete} of {today.length} complete</small>
      {error && <p className="todo-inline-error" role="alert">{error}</p>}
      <div className="todo-card-list">
        {today.slice(0, 5).map((todo) => <label className={todo.is_completed ? "completed" : ""} key={todo.id}>
          <input type="checkbox" checked={todo.is_completed} disabled={busy === todo.id} onChange={() => toggle(todo)} />
          <span>{todo.title}</span>
        </label>)}
        {!today.length && <p>No personal todos yet. Add one below.</p>}
      </div>
      <form className="todo-quick-add" onSubmit={quickAdd}>
        <input value={title} maxLength={TODO_TITLE_MAX_LENGTH} onChange={(event) => setTitle(event.target.value)} placeholder="Quick add for today" aria-label="Quick add a todo for today" />
        <button disabled={!title.trim() || busy === "add"}>{busy === "add" ? "…" : "+"}</button>
      </form>
      {overdue.length > 0 && <Link className="todo-card-overdue" href={`/todos?date=${overdue[0].todo_date}`}><ClockIcon /> {overdue.length} overdue {overdue.length === 1 ? "todo" : "todos"}</Link>}
    </section>
  );
}
