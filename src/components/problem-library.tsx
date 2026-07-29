"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";
import { Toast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { normalizeProblemTopics, normalizeTopic } from "@/lib/constants";
import type { Difficulty, ProblemStatus } from "@/types/database";
import type { CustomProblemInput, ProblemFilters, ProblemSort, ProblemView, ProblemWithProgress } from "@/types/models";

const emptyFilters: ProblemFilters = { search: "", topics: [], difficulties: [], statuses: [], patterns: [], source: null };
const difficultyRank = { easy: 1, medium: 2, hard: 3 };

export function ProblemForm({ initial, onClose, onSave, submitLabel }: {
  initial?: ProblemWithProgress; onClose: () => void; onSave: (value: CustomProblemInput) => Promise<void>;
  submitLabel?: string;
}) {
  const [value, setValue] = useState<CustomProblemInput>(() => initial ? {
    title: initial.title, description: initial.description, difficulty: initial.difficulty,
    topics: initial.topics, patterns: initial.patterns, source: initial.source,
    externalUrl: initial.external_url, estimatedMinutes: initial.estimated_minutes,
  } : { title: "", description: null, difficulty: "medium", topics: [], patterns: [], source: "Custom", externalUrl: null, estimatedMinutes: 30 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (value.title.trim().length < 2) return setError("Title must be at least 2 characters.");
    if (value.estimatedMinutes < 1 || value.estimatedMinutes > 600) return setError("Estimate must be between 1 and 600 minutes.");
    if (value.externalUrl) {
      try {
        const url = new URL(value.externalUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      } catch {
        return setError("Enter a valid link beginning with http:// or https://.");
      }
    }
    setSaving(true); setError("");
    try { await onSave(value); onClose(); } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this problem."); setSaving(false);
    }
  };
  const arrayValue = (text: string) => text.split(",").map((item) => item.trim()).filter(Boolean);
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <form className="problem-modal panel" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="problem-form-title">
      <div className="modal-heading"><div><span className="page-kicker">PERSONAL LIBRARY</span><h2 id="problem-form-title">{initial ? "Edit question" : "Add a question"}</h2></div><button type="button" onClick={onClose} aria-label="Close">×</button></div>
      <label className="field"><span>Question title *</span><input autoFocus value={value.title} maxLength={160} onChange={(e) => setValue({ ...value, title: e.target.value })} placeholder="e.g. Two Sum" /></label>
      <div className="form-grid modal-grid">
        <label className="field"><span>Difficulty</span><select value={value.difficulty} onChange={(e) => setValue({ ...value, difficulty: e.target.value as Difficulty })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
        <label className="field"><span>Estimated minutes</span><input type="number" min="1" max="600" value={value.estimatedMinutes} onChange={(e) => setValue({ ...value, estimatedMinutes: Number(e.target.value) })} /></label>
        <label className="field"><span>Topics (comma separated)</span><input value={value.topics.join(", ")} onChange={(e) => setValue({ ...value, topics: arrayValue(e.target.value) })} placeholder="Arrays, Hashing" /></label>
        <label className="field"><span>Patterns (comma separated)</span><input value={value.patterns.join(", ")} onChange={(e) => setValue({ ...value, patterns: arrayValue(e.target.value) })} placeholder="Two pointers" /></label>
        <label className="field"><span>Source</span><input value={value.source} onChange={(e) => setValue({ ...value, source: e.target.value })} placeholder="LeetCode, Codeforces, Book..." /></label>
        <label className="field"><span>Problem link (LeetCode or any URL)</span><input type="url" value={value.externalUrl ?? ""} onChange={(e) => setValue({ ...value, externalUrl: e.target.value || null })} placeholder="https://leetcode.com/problems/..." /></label>
      </div>
      <label className="field"><span>Description</span><textarea value={value.description ?? ""} onChange={(e) => setValue({ ...value, description: e.target.value || null })} rows={4} /></label>
      {error && <p className="form-message error">{error}</p>}
      <div className="modal-actions"><button className="button button-quiet" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? "Saving…" : submitLabel ?? (initial ? "Save changes" : "Add question")}</button></div>
    </form>
  </div>;
}

export function ProblemLibrary({ userId, initialProblems, loadError }: {
  userId: string; initialProblems: ProblemWithProgress[]; loadError?: string;
}) {
  const repository = useMemo(() => new SupabaseTrackerRepository(createClient()), []);
  const [problems, setProblems] = useState(initialProblems);
  const [filters, setFilters] = useState<ProblemFilters>(emptyFilters);
  const [sort, setSort] = useState<ProblemSort>("recent");
  const [view, setView] = useState<ProblemView>("grid");
  const [form, setForm] = useState<ProblemWithProgress | "new" | null>(null);
  const [message, setMessage] = useState(loadError ?? "");
  const [offline, setOffline] = useState(false);
  const [toast, setToast] = useState("");
  const [problemToDelete, setProblemToDelete] = useState<ProblemWithProgress | null>(null);
  const [deleting, setDeleting] = useState(false);
  const preferencesReady = useRef(false);

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem("stride.problem-library");
        if (saved) {
          const state = JSON.parse(saved); setFilters({ ...emptyFilters, ...state.filters });
          setSort(state.sort ?? "recent"); setView(state.view ?? "grid");
        }
      } catch { /* Invalid preferences should not block the library. */ }
      preferencesReady.current = true;
    }, 0);
    const update = () => setOffline(!navigator.onLine);
    update(); window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.clearTimeout(hydrate); window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => { if (preferencesReady.current) localStorage.setItem("stride.problem-library", JSON.stringify({ filters, sort, view })); }, [filters, sort, view]);

  const topics = useMemo(() => [...new Set(problems.flatMap((problem) => normalizeProblemTopics(problem)))].sort(), [problems]);
  const patterns = useMemo(() => [...new Set(problems.flatMap((p) => p.patterns))].sort(), [problems]);
  const sources = useMemo(() => [...new Set(problems.map((p) => p.source))].sort(), [problems]);
  const visible = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    return problems.map((problem) => ({ ...problem, topics: normalizeProblemTopics(problem) })).filter((problem) => {
      const status = problem.progress?.status ?? "not_added";
      return (!needle || [problem.title, problem.source, ...problem.topics, ...problem.patterns].join(" ").toLowerCase().includes(needle))
        && (!filters.topics.length || filters.topics.some((topic) => problem.topics.some((problemTopic) => normalizeTopic(problemTopic) === normalizeTopic(topic))))
        && (!filters.patterns.length || filters.patterns.some((pattern) => problem.patterns.includes(pattern)))
        && (!filters.difficulties.length || filters.difficulties.includes(problem.difficulty))
        && (!filters.statuses.length || filters.statuses.includes(status as ProblemStatus))
        && (!filters.source || problem.source === filters.source);
    }).sort((a, b) => sort === "title" ? a.title.localeCompare(b.title)
      : sort === "difficulty" ? difficultyRank[a.difficulty] - difficultyRank[b.difficulty]
      : sort === "estimated" ? a.estimated_minutes - b.estimated_minutes
      : new Date(b.progress?.last_activity_at ?? b.created_at).getTime() - new Date(a.progress?.last_activity_at ?? a.created_at).getTime());
  }, [problems, filters, sort]);

  const updateProgress = async (problem: ProblemWithProgress, patch: { status?: ProblemStatus; bookmarked?: boolean }) => {
    if (offline) return setMessage("You’re offline. Reconnect before changing your backlog.");
    const previous = problems;
    const now = new Date().toISOString();
    const optimistic = { ...(problem.progress ?? {
      id: `optimistic-${problem.id}`, user_id: userId, problem_id: problem.id, status: "backlog" as ProblemStatus,
      bookmarked: false, confidence: null, priority: 0, first_started_at: null, completed_at: null,
      next_review_at: null, last_activity_at: now, created_at: now, updated_at: now,
    }), ...patch };
    setProblems((items) => items.map((item) => item.id === problem.id ? { ...item, progress: optimistic } : item)); setMessage("");
    try {
      const saved = await repository.saveProgress(userId, problem.id, patch);
      setProblems((items) => items.map((item) => item.id === problem.id ? { ...item, progress: saved } : item));
      setToast("Problem progress updated.");
    } catch (cause) {
      setProblems(previous); setMessage(cause instanceof Error ? `Change rolled back: ${cause.message}` : "Change failed and was rolled back.");
    }
  };
  const saveProblem = async (input: CustomProblemInput) => {
    if (offline) throw new Error("You’re offline. Reconnect to save a problem.");
    if (form && form !== "new") {
      const saved = await repository.updateProblem(form.id, input);
      setProblems((items) => items.map((item) => item.id === saved.id ? { ...saved, progress: item.progress } : item));
      setToast("Problem changes saved.");
    } else {
      const saved = await repository.createProblem(userId, input);
      setProblems((items) => [{ ...saved, progress: null }, ...items]);
      setToast("Custom problem added.");
    }
  };
  const removeProblem = async (problem: ProblemWithProgress) => {
    setDeleting(true);
    const previous = problems; setProblems((items) => items.filter((item) => item.id !== problem.id));
    try {
      await repository.deleteProblem(problem.id);
      setProblemToDelete(null);
      setToast("Custom problem deleted.");
    } catch (cause) {
      setProblems(previous);
      setMessage(cause instanceof Error ? `Delete rolled back: ${cause.message}` : "Delete failed and was rolled back.");
    } finally {
      setDeleting(false);
    }
  };
  const activeFilters = filters.topics.length + filters.patterns.length + filters.difficulties.length + filters.statuses.length + (filters.source ? 1 : 0);

  return <div className="page-shell">
    <header className="page-heading"><div><span className="page-kicker">QUESTIONS WORKSPACE</span><h1>Question library</h1><p>Add your own questions, attach links, and keep every solution revision.</p></div><button className="button button-primary" onClick={() => setForm("new")}>+ Add question</button></header>
    {offline && <div className="state-banner warning" role="status"><span>Offline</span> Browse loaded problems; cloud changes resume when you reconnect.</div>}
    {message && <div className="state-banner error" role="alert"><span>Sync issue</span>{message}<button onClick={() => setMessage("")}>Dismiss</button></div>}
    <div className="library-controls panel">
      <div className="library-search"><span>⌕</span><input aria-label="Search problems" placeholder="Search title, topic, pattern…" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></div>
      <FilterSelect label="Topic" value={filters.topics[0]} options={topics} onChange={(v) => setFilters({ ...filters, topics: v ? [v] : [] })} />
      <FilterSelect label="Difficulty" value={filters.difficulties[0]} options={["easy", "medium", "hard"]} onChange={(v) => setFilters({ ...filters, difficulties: v ? [v as Difficulty] : [] })} />
      <FilterSelect label="Status" value={filters.statuses[0]} options={["backlog", "in_progress", "completed", "review_due", "archived"]} onChange={(v) => setFilters({ ...filters, statuses: v ? [v as ProblemStatus] : [] })} />
      <FilterSelect label="Pattern" value={filters.patterns[0]} options={patterns} onChange={(v) => setFilters({ ...filters, patterns: v ? [v] : [] })} />
      <FilterSelect label="Source" value={filters.source ?? undefined} options={sources} onChange={(v) => setFilters({ ...filters, source: v || null })} />
    </div>
    <div className="library-meta"><span><b>{visible.length}</b> of {problems.length} problems {activeFilters > 0 && `· ${activeFilters} filters active`}</span><div>
      {activeFilters > 0 && <button className="text-button" onClick={() => setFilters({ ...emptyFilters, search: filters.search })}>Clear filters</button>}
      <select value={sort} onChange={(e) => setSort(e.target.value as ProblemSort)} aria-label="Sort problems"><option value="recent">Recently active</option><option value="title">Title A–Z</option><option value="difficulty">Difficulty</option><option value="estimated">Estimated time</option></select>
      <span className="view-toggle"><button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-label="Grid view">▦</button><button className={view === "table" ? "active" : ""} onClick={() => setView("table")} aria-label="Table view">☷</button></span>
    </div></div>
    {!visible.length ? <div className="panel empty-state library-empty"><span className="empty-orbit">⌕</span><h2>{problems.length ? "No matching questions" : "Your library is empty"}</h2><p>{problems.length ? "Try clearing a filter or searching with a broader term." : "Add your first question manually. You can attach a LeetCode link or any other web link."}</p><button className="button button-quiet" onClick={() => problems.length ? setFilters(emptyFilters) : setForm("new")}>{problems.length ? "Clear all filters" : "Add your first question"}</button></div>
      : view === "grid" ? <section className="problem-grid">{visible.map((problem) => <ProblemCard key={problem.id} problem={problem} onProgress={updateProgress} onEdit={() => setForm(problem)} onDelete={() => setProblemToDelete(problem)} />)}</section>
      : <section className="problem-list panel"><div className="problem-list-row head"><span>Problem</span><span>Topic / pattern</span><span>Status</span><span>Difficulty</span><span>Actions</span></div>{visible.map((problem) => <ProblemRow key={problem.id} problem={problem} onProgress={updateProgress} onEdit={() => setForm(problem)} onDelete={() => setProblemToDelete(problem)} />)}</section>}
    {form && <ProblemForm initial={form === "new" ? undefined : form} onClose={() => setForm(null)} onSave={saveProblem} />}
    {problemToDelete && <ConfirmDialog
      title="Delete this question?"
      description={`“${problemToDelete.title}” and its attempts, notes, and solution history will be permanently deleted.`}
      confirmLabel="Delete question"
      busy={deleting}
      onCancel={() => setProblemToDelete(null)}
      onConfirm={() => removeProblem(problemToDelete)}
    />}
    {toast && <Toast message={toast} onDismiss={() => setToast("")} />}
  </div>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (value: string) => void }) {
  return <select aria-label={`${label} filter`} value={value ?? ""} onChange={(e) => onChange(e.target.value)}><option value="">All {label.toLowerCase()}s</option>{options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select>;
}

type CardProps = { problem: ProblemWithProgress; onProgress: (p: ProblemWithProgress, patch: { status?: ProblemStatus; bookmarked?: boolean }) => void; onEdit: () => void; onDelete: () => void };
function StatusSelect({ problem, onProgress }: Pick<CardProps, "problem" | "onProgress">) {
  return <select aria-label={`Status for ${problem.title}`} value={problem.progress?.status ?? ""} onChange={(e) => onProgress(problem, { status: (e.target.value || "backlog") as ProblemStatus })}><option value="">Not added</option><option value="backlog">Backlog</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="review_due">Review due</option><option value="archived">Archived</option></select>;
}
function ProblemCard({ problem, onProgress, onEdit, onDelete }: CardProps) {
  return <article className="problem-card panel"><div className="problem-card-top"><span className={`difficulty ${problem.difficulty}`}>{problem.difficulty}</span><button className={problem.progress?.bookmarked ? "bookmark active" : "bookmark"} onClick={() => onProgress(problem, { bookmarked: !problem.progress?.bookmarked })} title="Bookmark">★</button></div>
    <Link href={`/problems/${problem.id}`}><h2>{problem.title}</h2><p>{problem.description || `${problem.patterns[0] ?? "General"} practice from ${problem.source}.`}</p></Link>
    <div className="tag-list compact">{problem.topics.slice(0, 2).map((topic) => <span key={topic}>{topic}</span>)}{problem.patterns.slice(0, 1).map((pattern) => <span key={pattern}>{pattern}</span>)}</div>
    {problem.external_url && <a className="problem-external-link" href={problem.external_url} target="_blank" rel="noreferrer">Open problem link ↗</a>}
    <div className="problem-card-footer"><StatusSelect problem={problem} onProgress={onProgress} /><span>{problem.estimated_minutes} min</span>{problem.is_curated ? <button className="icon-action" onClick={() => onProgress(problem, { status: "backlog" })} title="Add to backlog">＋</button> : <span className="card-actions"><button onClick={onEdit}>Edit</button><button onClick={onDelete}>Delete</button></span>}</div>
  </article>;
}
function ProblemRow({ problem, onProgress, onEdit, onDelete }: CardProps) {
  return <div className="problem-list-row"><span><button className={problem.progress?.bookmarked ? "bookmark active" : "bookmark"} onClick={() => onProgress(problem, { bookmarked: !problem.progress?.bookmarked })}>★</button><Link href={`/problems/${problem.id}`}><b>{problem.title}</b><small>{problem.source} · {problem.estimated_minutes} min</small></Link></span><span>{problem.topics.slice(0, 2).join(", ")}<small>{problem.patterns[0]}</small></span><span><StatusSelect problem={problem} onProgress={onProgress} /></span><span><em className={`difficulty ${problem.difficulty}`}>{problem.difficulty}</em></span><span>{problem.is_curated ? <button className="text-button" onClick={() => onProgress(problem, { status: "backlog" })}>Add</button> : <><button className="text-button" onClick={onEdit}>Edit</button><button className="text-button danger" onClick={onDelete}>Delete</button></>}</span></div>;
}
