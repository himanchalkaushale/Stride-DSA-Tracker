"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProblemForm } from "@/components/problem-library";
import { Toast } from "@/components/toast";
import { nextReviewAt } from "@/lib/planner";
import { formatDateKey } from "@/lib/date-format";
import { exportPlanCsv, previewRedistribution, previewShift, sortPlanTasks, summarizePlan } from "@/lib/plans";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";
import { createClient } from "@/lib/supabase/client";
import type { TaskStatus } from "@/types/database";
import type { CustomProblemInput, DailyTask, DailyTaskWithProblem, PlanWithTasks, ProblemWithProgress } from "@/types/models";

type Recovery = { kind: "shift" | "redistribute"; fromDate: string; startDate: string; days: number; capacity: number };

export function PlanDetail({
  userId, initialPlan, initialAllTasks, initialProblems, defaultDate,
}: {
  userId: string;
  initialPlan: PlanWithTasks;
  initialAllTasks: DailyTask[];
  initialProblems: ProblemWithProgress[];
  defaultDate: string;
}) {
  const repository = useMemo(() => new SupabaseTrackerRepository(createClient()), []);
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [allTasks, setAllTasks] = useState(initialAllTasks);
  const [problems, setProblems] = useState(initialProblems);
  const [name, setName] = useState(plan.name);
  const [capacity, setCapacity] = useState(plan.daily_capacity);
  const [addDate, setAddDate] = useState(defaultDate);
  const [addProblemId, setAddProblemId] = useState("");
  const [form, setForm] = useState<DailyTaskWithProblem | "new" | null>(null);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [removeTask, setRemoveTask] = useState<DailyTaskWithProblem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const summary = summarizePlan(plan);
  const ordered = sortPlanTasks(plan.tasks);
  const dates = [...new Set(ordered.map((task) => task.task_date))];
  const problemById = new Map(problems.map((problem) => [problem.id, problem]));

  const replaceTask = (taskId: string, patch: Partial<DailyTask>) => {
    setPlan((value) => ({ ...value, tasks: value.tasks.map((task) => task.id === taskId ? { ...task, ...patch } : task) }));
    setAllTasks((items) => items.map((task) => task.id === taskId ? { ...task, ...patch } : task));
  };

  const saveSettings = async () => {
    setBusy("settings"); setError("");
    try {
      const saved = await repository.updatePlan(plan.id, { name, daily_capacity: capacity });
      setPlan((value) => ({ ...value, ...saved }));
      setToast("Plan settings saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save plan settings."); }
    finally { setBusy(null); }
  };

  const addExisting = async (problemId = addProblemId, date = addDate) => {
    if (!problemId || !date) return;
    setBusy("add"); setError("");
    try {
      const position = plan.tasks.filter((task) => task.task_date === date).length;
      const [created] = await repository.createDailyTasks([{
        user_id: userId, problem_id: problemId, plan_id: plan.id, task_date: date,
        position, status: "planned", source: "manual",
      }]);
      if (!created) throw new Error("This question is already scheduled on that date.");
      const problem = problemById.get(problemId);
      if (!problem) throw new Error("Question not found.");
      const task = { ...created, problem };
      setPlan((value) => ({ ...value, tasks: [...value.tasks, task] }));
      setAllTasks((items) => [...items, created]);
      setAddProblemId("");
      setToast("Question added to the plan.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add the question."); }
    finally { setBusy(null); }
  };

  const createAndAdd = async (input: CustomProblemInput) => {
    const problem = await repository.createProblem(userId, input);
    const withProgress: ProblemWithProgress = { ...problem, progress: null };
    setProblems((items) => [withProgress, ...items]);
    await addExisting(problem.id, addDate);
  };

  const editQuestion = async (task: DailyTaskWithProblem, input: CustomProblemInput) => {
    const saved = await repository.updateProblem(task.problem_id, input);
    setPlan((value) => ({ ...value, tasks: value.tasks.map((item) => item.problem_id === saved.id ? { ...item, problem: saved } : item) }));
    setProblems((items) => items.map((item) => item.id === saved.id ? { ...saved, progress: item.progress } : item));
    setToast("Question updated everywhere it is used.");
  };

  const changeStatus = async (task: DailyTaskWithProblem, status: TaskStatus) => {
    const now = new Date();
    const patch = { status, completed_at: status === "completed" ? now.toISOString() : null };
    setBusy(task.id); setError("");
    try {
      await repository.updateDailyTask(task.id, patch);
      replaceTask(task.id, patch);
      if (status === "completed") {
        const confidence = problemById.get(task.problem_id)?.progress?.confidence ?? 3;
        await repository.saveProgress(userId, task.problem_id, {
          status: "completed", confidence, completed_at: now.toISOString(),
          next_review_at: nextReviewAt(now, "solved", confidence),
        });
        setToast("Completed and review scheduled.");
      } else if (status === "in_progress") {
        await repository.saveProgress(userId, task.problem_id, {
          status: "in_progress",
          first_started_at: problemById.get(task.problem_id)?.progress?.first_started_at ?? now.toISOString(),
        });
        setToast("Plan entry updated.");
      } else {
        setToast(status === "planned" ? "Entry reopened; learning history was preserved." : "Plan entry updated.");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the entry."); }
    finally { setBusy(null); }
  };

  const reschedule = async (task: DailyTaskWithProblem, taskDate: string) => {
    setBusy(task.id); setError("");
    try {
      const position = plan.tasks.filter((item) => item.task_date === taskDate && item.id !== task.id).length;
      await repository.updateDailyTask(task.id, { task_date: taskDate, position });
      replaceTask(task.id, { task_date: taskDate, position });
      setToast("Entry rescheduled.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reschedule; check for a duplicate question on that date."); }
    finally { setBusy(null); }
  };

  const reorder = async (task: DailyTaskWithProblem, direction: -1 | 1) => {
    const day = sortPlanTasks(plan.tasks.filter((item) => item.task_date === task.task_date));
    const index = day.findIndex((item) => item.id === task.id);
    const target = index + direction;
    if (target < 0 || target >= day.length) return;
    [day[index], day[target]] = [day[target], day[index]];
    setBusy(task.id);
    try {
      await Promise.all(day.map((item, position) => repository.updateDailyTask(item.id, { position })));
      const positions = new Map(day.map((item, position) => [item.id, position]));
      setPlan((value) => ({ ...value, tasks: value.tasks.map((item) => positions.has(item.id) ? { ...item, position: positions.get(item.id)! } : item) }));
      setAllTasks((items) => items.map((item) => positions.has(item.id) ? { ...item, position: positions.get(item.id)! } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reorder the day."); }
    finally { setBusy(null); }
  };

  const confirmRemove = async () => {
    if (!removeTask) return;
    setBusy(removeTask.id);
    try {
      const outcome = await repository.removePlanTask(removeTask.id);
      setPlan((value) => ({ ...value, tasks: value.tasks.filter((item) => item.id !== removeTask.id) }));
      if (outcome === "deleted") setAllTasks((items) => items.filter((item) => item.id !== removeTask.id));
      else setAllTasks((items) => items.map((item) => item.id === removeTask.id ? { ...item, plan_id: null } : item));
      setRemoveTask(null);
      setToast(outcome === "detached" ? "Entry detached; its history remains intact." : "Unfinished entry removed.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove the entry."); }
    finally { setBusy(null); }
  };

  const combinedTasks = allTasks.map((task) => plan.tasks.find((item) => item.id === task.id) ?? task);
  let recoveryPreview: ReturnType<typeof previewShift> | ReturnType<typeof previewRedistribution> | null = null;
  let recoveryValidation = "";
  if (recovery) {
    try {
      recoveryPreview = recovery.kind === "shift"
        ? previewShift(combinedTasks, plan.id, recovery.fromDate, recovery.days)
        : previewRedistribution(combinedTasks, plan.id, recovery.fromDate, recovery.startDate, recovery.capacity);
    } catch (cause) {
      recoveryValidation = cause instanceof Error ? cause.message : "Check the recovery options.";
    }
  }

  const applyRecovery = async () => {
    if (!recovery || !recoveryPreview || recoveryPreview.conflicts.length) return;
    setBusy("recovery"); setError("");
    try {
      const count = recovery.kind === "shift"
        ? await repository.shiftPlan(plan.id, recovery.fromDate, recovery.days)
        : await repository.redistributePlan(plan.id, recovery.fromDate, recovery.startDate, recovery.capacity);
      const mapped = new Map(recoveryPreview.preview.map((item) => [item.task.id, item.taskDate]));
      setPlan((value) => ({ ...value, tasks: value.tasks.map((task) => mapped.has(task.id) ? { ...task, task_date: mapped.get(task.id)! } : task) }));
      setAllTasks((items) => items.map((task) => mapped.has(task.id) ? { ...task, task_date: mapped.get(task.id)! } : task));
      setRecovery(null);
      setToast(`${count} unfinished ${count === 1 ? "entry" : "entries"} moved.`);
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not recover the schedule."); }
    finally { setBusy(null); }
  };

  const downloadCsv = () => {
    const url = URL.createObjectURL(new Blob([exportPlanCsv(plan, plan.tasks)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${plan.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "stride-plan"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const deletePlan = async () => {
    setBusy("delete");
    try {
      await repository.deletePlan(plan.id);
      router.push("/plans");
      router.refresh();
    } catch (cause) { setDeleteOpen(false); setError(cause instanceof Error ? cause.message : "Could not delete the plan."); setBusy(null); }
  };

  return <div className="page-shell plan-detail-page">
    <Link className="plan-back" href="/plans">← All plans</Link>
    <header className="plan-detail-header">
      <div><span className={`plan-origin ${plan.origin}`}>{plan.origin}</span><h1>{plan.name}</h1><p>{summary.total} entries · {summary.completed} complete · {plan.daily_capacity} per day</p></div>
      <div><button className="button button-quiet" onClick={downloadCsv}>Export CSV</button><button className="button button-quiet danger" onClick={() => setDeleteOpen(true)}>Delete plan</button></div>
    </header>
    {error && <div className="state-banner error" role="alert"><span>Plan issue</span>{error}<button onClick={() => setError("")}>Dismiss</button></div>}
    <div className="plan-detail-grid">
      <main>
        <section className="panel plan-settings">
          <label className="field"><span>Plan name</span><input maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field"><span>Daily capacity</span><input type="number" min={1} max={20} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></label>
          <button className="button button-quiet" disabled={busy === "settings" || (name === plan.name && capacity === plan.daily_capacity)} onClick={saveSettings}>Save</button>
        </section>
        <section className="panel plan-add">
          <div><span className="page-kicker">ADD AN ENTRY</span><h2>Build the schedule</h2></div>
          <input type="date" aria-label="Entry date" value={addDate} onChange={(event) => setAddDate(event.target.value)} />
          <select aria-label="Choose a saved question" value={addProblemId} onChange={(event) => setAddProblemId(event.target.value)}>
            <option value="">Choose a library question…</option>
            {problems.map((problem) => <option key={problem.id} value={problem.id}>{problem.title} · {problem.difficulty}</option>)}
          </select>
          <button className="button button-quiet" disabled={!addProblemId || busy === "add"} onClick={() => addExisting()}>Add</button>
          <button className="button button-primary" onClick={() => setForm("new")}>New question</button>
        </section>
        <section className="plan-days">
          {dates.map((date) => {
            const day = ordered.filter((task) => task.task_date === date);
            return <section className="panel plan-day" key={date}>
              <header><div><time>{formatDateKey(date, { weekday: "long", month: "long", day: "numeric" })}</time><small>{day.length} {day.length === 1 ? "entry" : "entries"}</small></div></header>
              {day.map((task, index) => <article className={`plan-entry ${task.status}`} key={task.id}>
                <div className="task-order"><button disabled={index === 0 || busy === task.id} onClick={() => reorder(task, -1)} aria-label={`Move ${task.problem.title} up`}>↑</button><button disabled={index === day.length - 1 || busy === task.id} onClick={() => reorder(task, 1)} aria-label={`Move ${task.problem.title} down`}>↓</button></div>
                <div className="plan-entry-copy"><Link href={`/problems/${task.problem_id}`}>{task.problem.title}</Link><span><i className={`difficulty ${task.problem.difficulty}`}>{task.problem.difficulty}</i>{task.problem.topics.join(", ") || "No topic"} · {task.problem.estimated_minutes} min</span></div>
                <input type="date" aria-label={`Date for ${task.problem.title}`} value={task.task_date} disabled={busy === task.id} onChange={(event) => reschedule(task, event.target.value)} />
                <select aria-label={`Status for ${task.problem.title}`} value={task.status} disabled={busy === task.id} onChange={(event) => changeStatus(task, event.target.value as TaskStatus)}>
                  <option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="skipped">Skipped</option><option value="review_due">Review due</option>
                </select>
                <div className="entry-actions"><button onClick={() => setForm(task)}>Edit question</button><button className="danger" onClick={() => setRemoveTask(task)}>Remove</button></div>
              </article>)}
            </section>;
          })}
          {!dates.length && <div className="panel empty-state"><h2>This plan is empty</h2><p>Add an existing library question or create a new one for any calendar date.</p></div>}
        </section>
      </main>
      <aside className="plan-recovery panel">
        <span className="page-kicker">MISSED A DAY?</span><h2>Recover the schedule</h2><p>Completed and skipped entries stay where they are. Only unfinished work moves.</p>
        <button className="button button-quiet" onClick={() => setRecovery({ kind: "shift", fromDate: defaultDate, startDate: defaultDate, days: 1, capacity: plan.daily_capacity })}>Shift forward</button>
        <button className="button button-primary" onClick={() => setRecovery({ kind: "redistribute", fromDate: defaultDate, startDate: defaultDate, days: 1, capacity: plan.daily_capacity })}>Redistribute by capacity</button>
        <dl><div><dt>Progress</dt><dd>{summary.progress}%</dd></div><div><dt>Date range</dt><dd>{summary.startDate ?? "—"}<br />{summary.endDate ?? ""}</dd></div></dl>
      </aside>
    </div>

    {form && <ProblemForm initial={form === "new" ? undefined : { ...form.problem, progress: problemById.get(form.problem_id)?.progress ?? null }} onClose={() => setForm(null)}
      onSave={form === "new" ? createAndAdd : (input) => editQuestion(form, input)}
      submitLabel={form === "new" ? "Create and add to plan" : "Update question everywhere"} />}
    {recovery && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && busy !== "recovery" && setRecovery(null)}>
      <section className="panel plan-modal recovery-modal" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
        <div className="modal-heading"><div><span className="page-kicker">SCHEDULE RECOVERY</span><h2 id="recovery-title">{recovery.kind === "shift" ? "Shift unfinished entries" : "Redistribute unfinished entries"}</h2><p>Calendar days include weekends. Review the exact changes before confirming.</p></div><button onClick={() => setRecovery(null)} aria-label="Close">×</button></div>
        <div className="form-grid modal-grid">
          <label className="field"><span>Move entries on or after</span><input type="date" value={recovery.fromDate} onChange={(event) => setRecovery({ ...recovery, fromDate: event.target.value })} /></label>
          {recovery.kind === "shift"
            ? <label className="field"><span>Calendar days forward</span><input type="number" min={1} max={365} value={recovery.days} onChange={(event) => setRecovery({ ...recovery, days: Number(event.target.value) })} /></label>
            : <><label className="field"><span>Start placing on</span><input type="date" value={recovery.startDate} onChange={(event) => setRecovery({ ...recovery, startDate: event.target.value })} /></label><label className="field"><span>Daily capacity</span><input type="number" min={1} max={20} value={recovery.capacity} onChange={(event) => setRecovery({ ...recovery, capacity: Number(event.target.value) })} /></label></>}
        </div>
        {recoveryPreview && <div className="recovery-preview"><strong>{recoveryPreview.preview.length} unfinished entries affected</strong>
          {recoveryPreview.preview.slice(0, 8).map((item) => <div key={item.task.id}><span>{plan.tasks.find((task) => task.id === item.task.id)?.problem.title ?? "Question"}</span><small>{item.task.task_date} → {item.taskDate}</small></div>)}
          {recoveryPreview.preview.length > 8 && <p>+ {recoveryPreview.preview.length - 8} more</p>}
        </div>}
        {recoveryValidation && <p className="form-message error">{recoveryValidation}</p>}
        {!!recoveryPreview?.conflicts.length && <p className="form-message error">No changes will be made: {recoveryPreview.conflicts.join(", ")}</p>}
        <div className="modal-actions"><button className="button button-quiet" disabled={busy === "recovery"} onClick={() => setRecovery(null)}>Cancel</button><button className="button button-primary" disabled={busy === "recovery" || !recoveryPreview?.preview.length || !!recoveryPreview?.conflicts.length} onClick={applyRecovery}>{busy === "recovery" ? "Moving…" : `Confirm ${recovery.kind}`}</button></div>
      </section>
    </div>}
    {removeTask && <ConfirmDialog title={removeTask.status === "completed" || removeTask.status === "skipped" ? "Detach this entry?" : "Remove this entry?"}
      description={removeTask.status === "completed" || removeTask.status === "skipped"
        ? "The plan link will be removed, while attempts, notes, solutions, and completion history stay intact."
        : "Only this unfinished scheduled entry will be deleted. The library question and learning data remain safe."}
      busy={busy === removeTask.id} onCancel={() => setRemoveTask(null)} onConfirm={confirmRemove} />}
    {deleteOpen && <ConfirmDialog title={`Delete “${plan.name}”?`} description="Unfinished scheduling will be removed. Completed and skipped records will be detached, while questions, attempts, notes, solutions, and progress remain safe." busy={busy === "delete"} onCancel={() => setDeleteOpen(false)} onConfirm={deletePlan} />}
    {toast && <Toast message={toast} onDismiss={() => setToast("")} />}
  </div>;
}
