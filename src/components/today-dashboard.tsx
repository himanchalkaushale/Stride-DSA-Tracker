"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowIcon, CheckIcon, ClockIcon, FlameIcon, SparkIcon } from "@/components/icons";
import { calculateStreaks, nextReviewAt } from "@/lib/planner";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";
import { createClient } from "@/lib/supabase/client";
import { Toast } from "@/components/toast";
import { ProblemForm } from "@/components/problem-library";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CsvPlanImporter } from "@/components/csv-plan-importer";
import { formatDateKey, formatTimestamp } from "@/lib/date-format";
import { TodayTodosCard } from "@/components/todos-dashboard";
import type { TaskStatus } from "@/types/database";
import type { Attempt, CustomProblemInput, DailyTask, ProblemWithProgress, Profile, Todo } from "@/types/models";

interface Props {
  userId: string;
  profile: Profile;
  dateKey: string;
  initialTasks: DailyTask[];
  allTasks: DailyTask[];
  problems: ProblemWithProgress[];
  recentAttempts: Attempt[];
  initialTodos: Todo[];
}

export function TodayDashboard({
  userId, profile, dateKey, initialTasks, allTasks, problems, recentAttempts, initialTodos,
}: Props) {
  const router = useRouter();
  const repository = useMemo(() => new SupabaseTrackerRepository(createClient()), []);
  const [libraryProblems, setLibraryProblems] = useState(problems);
  const problemById = useMemo(() => new Map(libraryProblems.map((problem) => [problem.id, problem])), [libraryProblems]);
  const [tasks, setTasks] = useState(initialTasks);
  const [history, setHistory] = useState(allTasks);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [addProblemId, setAddProblemId] = useState("");
  const [questionFormOpen, setQuestionFormOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [taskToRemove, setTaskToRemove] = useState<DailyTask | null>(null);
  const [toast, setToast] = useState("");

  const completed = tasks.filter((task) => task.status === "completed").length;
  const completedDates = history.filter((task) => task.status === "completed").map((task) => task.task_date);
  const streaks = calculateStreaks(completedDates, dateKey);
  const assigned = new Set(tasks.map((task) => task.problem_id));
  const available = libraryProblems.filter((problem) => !assigned.has(problem.id) && problem.progress?.status !== "archived");
  const overdue = libraryProblems.filter((problem) =>
    !assigned.has(problem.id)
    && !!problem.progress?.next_review_at
    && problem.progress.next_review_at <= new Date().toISOString(),
  );
  const continueTask = tasks.find((task) => task.status === "in_progress")
    ?? tasks.find((task) => task.status === "planned" || task.status === "review_due");
  const streakAtRisk = streaks.current > 0 && completed === 0;
  const upcomingDates = [...new Set(history
    .filter((task) => task.task_date > dateKey && task.status !== "skipped")
    .map((task) => task.task_date))]
    .sort()
    .slice(0, 5);

  const updateTask = async (task: DailyTask, status: TaskStatus) => {
    const previous = tasks;
    const now = new Date();
    const patch = { status, completed_at: status === "completed" ? now.toISOString() : null };
    setTasks((items) => items.map((item) => item.id === task.id ? { ...item, ...patch } : item));
    setHistory((items) => items.map((item) => item.id === task.id ? { ...item, ...patch } : item));
    setBusy(task.id);
    try {
      await repository.updateDailyTask(task.id, patch);
      if (status === "completed") {
        const problem = problemById.get(task.problem_id);
        const confidence = problem?.progress?.confidence ?? 3;
        await repository.saveProgress(userId, task.problem_id, {
          status: "completed",
          confidence,
          completed_at: now.toISOString(),
          next_review_at: nextReviewAt(now, "solved", confidence),
        });
      } else if (status === "in_progress") {
        await repository.saveProgress(userId, task.problem_id, {
          status: "in_progress",
          first_started_at: problemById.get(task.problem_id)?.progress?.first_started_at ?? now.toISOString(),
        });
      }
      setError("");
      setToast(status === "completed" ? "Problem completed and review scheduled." : "Daily plan updated.");
    } catch (cause) {
      setTasks(previous);
      setHistory(allTasks);
      setError(cause instanceof Error ? cause.message : "Could not update the task.");
    } finally {
      setBusy(null);
    }
  };

  const removeTask = async (task: DailyTask) => {
    const previous = tasks;
    setBusy(task.id);
    setTasks((items) => items.filter((item) => item.id !== task.id));
    try {
      await repository.deleteDailyTask(task.id);
      setHistory((items) => items.filter((item) => item.id !== task.id));
      setTaskToRemove(null);
      setToast("Problem removed from today’s plan.");
    } catch (cause) {
      setTasks(previous);
      setError(cause instanceof Error ? cause.message : "Could not remove the task.");
    } finally {
      setBusy(null);
    }
  };

  const moveTask = async (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= tasks.length) return;
    const reordered = [...tasks];
    [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
    reordered.forEach((task, position) => { task.position = position; });
    setTasks(reordered);
    try {
      await Promise.all(reordered.map((task, position) => repository.updateDailyTask(task.id, { position })));
    } catch (cause) {
      setTasks(tasks);
      setError(cause instanceof Error ? cause.message : "Could not reorder the queue.");
    }
  };

  const addTask = async (problemId = addProblemId, position = tasks.length) => {
    if (!problemId || assigned.has(problemId)) return;
    setBusy("add");
    try {
      const [created] = await repository.createDailyTasks([{
        user_id: userId, problem_id: problemId, task_date: dateKey,
        position, status: "planned", source: "manual",
      }]);
      if (created) {
        setTasks((items) => [...items, created].sort((a, b) => a.position - b.position));
        setHistory((items) => [created, ...items]);
      }
      setAddProblemId("");
      setToast("Problem added to today’s plan.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add the problem.");
    } finally {
      setBusy(null);
    }
  };

  const createQuestionAndAdd = async (input: CustomProblemInput) => {
    const saved = await repository.createProblem(userId, input);
    const question: ProblemWithProgress = { ...saved, progress: null };
    setLibraryProblems((items) => [question, ...items]);
    const [created] = await repository.createDailyTasks([{
      user_id: userId, problem_id: saved.id, task_date: dateKey,
      position: tasks.length, status: "planned", source: "manual",
    }]);
    if (created) {
      setTasks((items) => [...items, created]);
      setHistory((items) => [created, ...items]);
    }
    setToast("Question created and added to today’s plan.");
  };

  const acceptImportedPlan = (planId: string) => {
    router.push(`/plans/${planId}`);
  };

  const date = formatDateKey(dateKey, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="page-shell today-page">
      <header className="page-heading">
        <div><span className="page-date">{date.toUpperCase()}</span><h1>Good morning, {profile.display_name.split(" ")[0]}.</h1><p>Build today’s plan yourself and practice the questions you choose.</p></div>
        {continueTask
          ? <Link className="button button-primary" href={`/problems/${continueTask.problem_id}`}>Continue solving <ArrowIcon /></Link>
          : <Link className="button button-quiet" href="/problems">Explore problems <ArrowIcon /></Link>}
      </header>

      {error && <div className="state-banner error" role="alert"><span>Planner issue</span>{error}<button onClick={() => setError("")}>Dismiss</button></div>}
      {streakAtRisk && <section className="streak-risk"><FlameIcon /><div><b>Your {streaks.current}-day streak is at risk</b><span>Complete one item before midnight in {profile.timezone}.</span></div></section>}

      <section className="metric-grid">
        <article><span className="metric-icon green"><CheckIcon /></span><div><small>Today&apos;s goal</small><strong>{completed} <em>/ {profile.daily_target}</em></strong></div><span className="metric-trend">{completed >= profile.daily_target ? "Goal met" : `${Math.max(0, profile.daily_target - completed)} left`}</span></article>
        <article><span className="metric-icon orange"><FlameIcon /></span><div><small>Current streak</small><strong>{streaks.current} <em>days</em></strong></div><span className="metric-trend neutral">Best {streaks.longest}</span></article>
        <article><span className="metric-icon blue"><ClockIcon /></span><div><small>Overdue reviews</small><strong>{overdue.length} <em>waiting</em></strong></div><span className="metric-trend neutral">{profile.timezone}</span></article>
      </section>

      <div className="dashboard-grid">
        <section className="panel today-queue">
          <div className="panel-heading"><div><span>TODAY&apos;S QUEUE</span><h2>Daily practice plan</h2></div><small>{completed} of {profile.daily_target} complete</small></div>
          <div className="goal-track"><i style={{ width: `${Math.min(100, (completed / profile.daily_target) * 100)}%` }} /></div>
          <div className="daily-task-list">
            {tasks.map((task, index) => {
              const problem = problemById.get(task.problem_id);
              if (!problem) return null;
              return <article className={`daily-task ${task.status}`} key={task.id}>
                <div className="task-order"><button disabled={index === 0} onClick={() => moveTask(index, -1)}>↑</button><button disabled={index === tasks.length - 1} onClick={() => moveTask(index, 1)}>↓</button></div>
                <div className="task-copy"><span>{task.source === "review" ? "REVIEW" : task.source === "manual" ? "MANUAL" : "ADAPTIVE"} · {problem.topics[0]}</span><Link href={`/problems/${problem.id}`}>{problem.title}</Link><small>{problem.difficulty} · {problem.estimated_minutes} min · {task.status.replace("_", " ")}</small></div>
                <div className="task-actions">
                  <select aria-label={`Status for ${problem.title}`} value={task.status} disabled={busy === task.id} onChange={(event) => updateTask(task, event.target.value as TaskStatus)}>
                    <option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="skipped">Skipped</option><option value="review_due">Review due</option>
                  </select>
                  <button className="danger" onClick={() => setTaskToRemove(task)}>Remove</button>
                </div>
              </article>;
            })}
            {!tasks.length && <div className="empty-state compact"><span className="empty-orbit"><SparkIcon /></span><h3>Build today’s plan</h3><p>Choose a saved question or create a new one below.</p></div>}
          </div>
          <div className="queue-add">
            <select value={addProblemId} onChange={(event) => setAddProblemId(event.target.value)}>
              <option value="">Choose a saved question…</option>
              {available.map((problem) => <option value={problem.id} key={problem.id}>{problem.title} · {problem.difficulty}</option>)}
            </select>
            <button className="button button-quiet" disabled={!addProblemId || busy === "add"} onClick={() => addTask()}>{busy === "add" ? "Adding…" : "Add to today"}</button>
            <button className="button button-primary" onClick={() => setQuestionFormOpen(true)}>+ New question</button>
            <button className="button button-quiet" onClick={() => setCsvImportOpen(true)}>Import CSV</button>
          </div>
        </section>

        <aside className="today-side">
          <TodayTodosCard userId={userId} todayKey={dateKey} initialTodos={initialTodos} />
          <section className="panel side-panel"><span className="page-kicker">UPCOMING PLAN</span><h2>{upcomingDates.length ? "Your next plan days" : "No future questions yet"}</h2>
            {upcomingDates.map((taskDate) => {
              const dayTasks = history.filter((task) => task.task_date === taskDate && task.status !== "skipped");
              const linkedPlanId = dayTasks.find((task) => task.plan_id)?.plan_id;
              return <div className="mini-activity upcoming-day" key={taskDate}><div><b>{formatDateKey(taskDate, { weekday: "short", month: "short", day: "numeric" })}</b><small>{dayTasks.length} {dayTasks.length === 1 ? "question" : "questions"} planned</small></div><span>{dayTasks.map((task) => problemById.get(task.problem_id)?.title).filter(Boolean).slice(0, 2).join(", ")}{linkedPlanId && <Link href={`/plans/${linkedPlanId}`}>Manage plan →</Link>}</span></div>;
            })}
            {!upcomingDates.length && <p>Import a CSV to build a dated monthly plan automatically.</p>}
          </section>
          <section className="panel side-panel"><span className="page-kicker">OVERDUE REVIEWS</span><h2>{overdue.length ? "Bring these back" : "You’re caught up"}</h2>
            {overdue.slice(0, 3).map((problem) => <div className="mini-activity" key={problem.id}><div><b>{problem.title}</b><small>Confidence {problem.progress?.confidence ?? "—"}/5</small></div><button onClick={() => addTask(problem.id)}>Add</button></div>)}
            {!overdue.length && <p>No reviews are waiting outside today&apos;s queue.</p>}
          </section>
          <section className="panel side-panel"><span className="page-kicker">RECENT ACTIVITY</span><h2>Latest sessions</h2>
            {recentAttempts.slice(0, 5).map((attempt) => <div className="mini-activity" key={attempt.id}><div><b>{problemById.get(attempt.problem_id)?.title ?? "Problem"}</b><small>{attempt.result} · {attempt.duration_minutes} min</small></div><time>{formatTimestamp(attempt.attempted_at, profile.timezone, { month: "short", day: "numeric" })}</time></div>)}
            {!recentAttempts.length && <p>Your recorded attempts will appear here.</p>}
          </section>
        </aside>
      </div>
      {questionFormOpen && <ProblemForm onClose={() => setQuestionFormOpen(false)} onSave={createQuestionAndAdd} submitLabel="Create and add to today" />}
      {csvImportOpen && <CsvPlanImporter userId={userId} defaultStartDate={dateKey} onClose={() => setCsvImportOpen(false)} onImported={acceptImportedPlan} />}
      {taskToRemove && <ConfirmDialog
        title="Remove from today’s plan?"
        description={`“${problemById.get(taskToRemove.problem_id)?.title ?? "This question"}” will be removed from today. Your attempts, notes, and solution history will remain safe.`}
        busy={busy === taskToRemove.id}
        onCancel={() => setTaskToRemove(null)}
        onConfirm={() => removeTask(taskToRemove)}
      />}
      {toast && <Toast message={toast} onDismiss={() => setToast("")} />}
    </div>
  );
}
