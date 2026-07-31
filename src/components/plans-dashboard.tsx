"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CsvPlanImporter } from "@/components/csv-plan-importer";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";
import { createClient } from "@/lib/supabase/client";
import { summarizePlan } from "@/lib/plans";
import { formatDateKey } from "@/lib/date-format";
import type { DailyTask, PlanWithTasks, ProblemWithProgress } from "@/types/models";

function displayDate(date: string | null) {
  return date ? formatDateKey(date, { month: "short", day: "numeric", year: "numeric" }) : "No entries";
}

export function PlansDashboard({
  userId, initialPlans, tasks, problems, defaultDate, defaultCapacity, loadError,
}: {
  userId: string;
  initialPlans: PlanWithTasks[];
  tasks: DailyTask[];
  problems: ProblemWithProgress[];
  defaultDate: string;
  defaultCapacity: number;
  loadError?: string;
}) {
  const repository = useMemo(() => new SupabaseTrackerRepository(createClient()), []);
  const router = useRouter();
  const [plans, setPlans] = useState(initialPlans);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"active" | "completed" | "all">("active");
  const [modal, setModal] = useState<"csv" | "manual" | "adopt" | null>(null);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(defaultCapacity);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(loadError ?? "");
  const problemById = new Map(problems.map((problem) => [problem.id, problem]));
  const legacy = tasks.filter((task) => !task.plan_id);
  const visible = plans.filter((plan) => {
    const summary = summarizePlan(plan);
    return plan.name.toLowerCase().includes(search.toLowerCase())
      && (filter === "all" || (filter === "completed" ? summary.isComplete : !summary.isComplete));
  });

  const reset = () => {
    setModal(null); setName(""); setCapacity(defaultCapacity); setSelected([]); setError("");
  };

  const createManual = async () => {
    setBusy(true); setError("");
    try {
      const plan = await repository.createPlan(userId, name, capacity);
      setPlans((items) => [{ ...plan, tasks: [] }, ...items]);
      reset();
      router.push(`/plans/${plan.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the plan.");
      setBusy(false);
    }
  };

  const adopt = async () => {
    setBusy(true); setError("");
    try {
      const planId = await repository.adoptTasks(name, capacity, selected);
      reset();
      router.push(`/plans/${planId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not adopt these tasks.");
      setBusy(false);
    }
  };

  return <div className="page-shell plans-page">
    <header className="page-heading">
      <div><span className="page-kicker">PRACTICE ROADMAPS</span><h1>Your plans</h1><p>Import, organize, and recover every dated practice schedule.</p></div>
      <div className="plan-heading-actions">
        <button className="button button-quiet" onClick={() => setModal("manual")}>New empty plan</button>
        <button className="button button-primary" onClick={() => setModal("csv")}>Import CSV</button>
      </div>
    </header>
    {error && <div className="state-banner error" role="alert"><span>Plan issue</span>{error}<button onClick={() => setError("")}>Dismiss</button></div>}
    <section className="plans-toolbar panel">
      <input type="search" aria-label="Search plans" placeholder="Search plans…" value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="segmented" aria-label="Filter plans">
        {(["active", "completed", "all"] as const).map((value) =>
          <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value}</button>)}
      </div>
      <button className="text-button" onClick={() => setModal("adopt")}>Adopt existing schedule</button>
    </section>
    <section className="plan-card-grid">
      {visible.map((plan) => {
        const summary = summarizePlan(plan);
        return <Link className="panel plan-card" href={`/plans/${plan.id}`} key={plan.id}>
          <div><span className={`plan-origin ${plan.origin}`}>{plan.origin}</span><time>Updated {displayDate(plan.updated_at.slice(0, 10))}</time></div>
          <h2>{plan.name}</h2>
          <p>{displayDate(summary.startDate)}{summary.endDate && summary.endDate !== summary.startDate ? ` – ${displayDate(summary.endDate)}` : ""}</p>
          <div className="plan-progress"><i style={{ width: `${summary.progress}%` }} /></div>
          <footer><span><b>{summary.completed}</b> / {summary.total} complete</span><span>{plan.daily_capacity} / day</span></footer>
        </Link>;
      })}
      {!visible.length && <div className="panel empty-state plan-empty"><h2>No matching plans</h2><p>Create an empty plan, import a CSV, or adopt ungrouped scheduled work.</p><button className="button button-primary" onClick={() => setModal("csv")}>Import your first plan</button></div>}
    </section>

    {modal === "csv" && <CsvPlanImporter userId={userId} defaultStartDate={defaultDate} onClose={reset} onImported={(planId) => router.push(`/plans/${planId}`)} />}
    {(modal === "manual" || modal === "adopt") && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && reset()}>
      <section className="panel plan-modal" role="dialog" aria-modal="true" aria-labelledby="plan-modal-title">
        <div className="modal-heading"><div><span className="page-kicker">{modal === "adopt" ? "LEGACY SCHEDULE" : "NEW ROADMAP"}</span><h2 id="plan-modal-title">{modal === "adopt" ? "Adopt existing schedule" : "Create an empty plan"}</h2><p>{modal === "adopt" ? "Select ungrouped tasks. Tasks already in a plan are unavailable." : "Start with a named plan and add questions next."}</p></div><button onClick={reset} aria-label="Close">×</button></div>
        <div className="form-grid modal-grid">
          <label className="field"><span>Plan name</span><input autoFocus required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field"><span>Daily capacity</span><input type="number" min={1} max={20} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></label>
        </div>
        {modal === "adopt" && <div className="adoption-list">
          {legacy.map((task) => <label key={task.id}><input type="checkbox" checked={selected.includes(task.id)} onChange={(event) => setSelected((items) => event.target.checked ? [...items, task.id] : items.filter((id) => id !== task.id))} /><span><b>{problemById.get(task.problem_id)?.title ?? "Question"}</b><small>{task.task_date} · {task.status.replace("_", " ")}</small></span></label>)}
          {!legacy.length && <p>No ungrouped scheduled tasks are available.</p>}
        </div>}
        {error && <p className="form-message error">{error}</p>}
        <div className="modal-actions"><button className="button button-quiet" disabled={busy} onClick={reset}>Cancel</button><button className="button button-primary" disabled={busy || !name.trim() || (modal === "adopt" && !selected.length)} onClick={modal === "adopt" ? adopt : createManual}>{busy ? "Saving…" : modal === "adopt" ? `Adopt ${selected.length} tasks` : "Create plan"}</button></div>
      </section>
    </div>}
  </div>;
}
