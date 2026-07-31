"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { createClient } from "@/lib/supabase/client";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";
import { nextReviewAt } from "@/lib/planner";
import { formatTimestamp } from "@/lib/date-format";
import { safeHttpUrl } from "@/lib/url-security";
import { Toast } from "@/components/toast";
import type { AttemptResult, ProblemStatus } from "@/types/database";
import type { Attempt, ProblemWithProgress, RevisionInput, SolutionRevision } from "@/types/models";
import { useTheme } from "@/components/theme-provider";

const languages = ["TypeScript", "JavaScript", "Python", "Java", "C++", "Go"];
const snippets: Record<string, string> = {
  TypeScript: "function solve(input: unknown): unknown {\n  // Write your solution\n  return input;\n}\n",
  JavaScript: "function solve(input) {\n  // Write your solution\n  return input;\n}\n",
  Python: "def solve(data):\n    # Write your solution\n    return data\n",
  Java: "class Solution {\n    public Object solve(Object input) {\n        return input;\n    }\n}\n",
  "C++": "#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    void solve() {\n    }\n};\n",
  Go: "package main\n\nfunc solve(input any) any {\n\treturn input\n}\n",
};
const extensionFor = (language: string) => language === "Python" ? python() : language === "Java" ? java() : language === "C++" ? cpp() : language === "Go" ? [] : javascript({ typescript: language === "TypeScript" });

export function ProblemWorkspace({ userId, problem, initialAttempts, initialRevisions, localDate, preferredLanguage, timeZone }: {
  userId: string; problem: ProblemWithProgress; initialAttempts: Attempt[]; initialRevisions: SolutionRevision[]; localDate: string; preferredLanguage: string; timeZone: string;
}) {
  const repository = useMemo(() => new SupabaseTrackerRepository(createClient()), []);
  const { theme } = useTheme();
  const initial = initialRevisions.find((revision) => revision.is_current) ?? initialRevisions[0];
  const startingLanguage = initial?.language ?? preferredLanguage;
  const [language, setLanguage] = useState(startingLanguage);
  const [draft, setDraft] = useState<RevisionInput>(() => ({
    language: startingLanguage, code: initial?.code ?? snippets[startingLanguage] ?? "",
    approachNotes: initial?.approach_notes ?? "", generalNotes: initial?.general_notes ?? "",
    timeComplexity: initial?.time_complexity ?? "", spaceComplexity: initial?.space_complexity ?? "",
  }));
  const [revisions, setRevisions] = useState(initialRevisions);
  const [attempts, setAttempts] = useState(initialAttempts);
  const [confidence, setConfidence] = useState(problem.progress?.confidence ?? 0);
  const [status, setStatus] = useState<ProblemStatus>(problem.progress?.status ?? "backlog");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty" | "error" | "offline">("saved");
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [attemptOpen, setAttemptOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [toast, setToast] = useState("");
  const initialized = useRef(false);
  const draftKey = `stride.draft.${userId}.${problem.id}.${language}`;

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update(); window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => {
    if (!initialized.current) { initialized.current = true; return; }
    setSaveState(offline ? "offline" : "dirty");
    localStorage.setItem(draftKey, JSON.stringify(draft));
    if (offline) return;
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        const saved = await repository.saveCurrentRevision(userId, problem.id, draft);
        setRevisions((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
        localStorage.removeItem(draftKey); setSaveState("saved"); setError("");
      } catch (cause) {
        setSaveState("error"); setError(cause instanceof Error ? cause.message : "Autosave failed. Your draft remains on this device.");
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [draft, draftKey, offline, problem.id, repository, userId]);
  const changeLanguage = (next: string) => {
    setLanguage(next);
    const current = revisions.find((revision) => revision.language === next && revision.is_current);
    let local: RevisionInput | null = null;
    try { local = JSON.parse(localStorage.getItem(`stride.draft.${userId}.${problem.id}.${next}`) ?? "null"); } catch { /* ignore */ }
    setDraft(local ?? {
      language: next, code: current?.code ?? snippets[next] ?? "", approachNotes: current?.approach_notes ?? "",
      generalNotes: current?.general_notes ?? "", timeComplexity: current?.time_complexity ?? "", spaceComplexity: current?.space_complexity ?? "",
    });
  };
  const updateDraft = (patch: Partial<RevisionInput>) => setDraft((current) => ({ ...current, ...patch, language }));
  const saveNewRevision = async () => {
    if (offline) return setError("Reconnect before creating a cloud revision.");
    setSaveState("saving");
    try {
      const saved = await repository.createRevision(userId, problem.id, draft);
      setRevisions((items) => [saved, ...items.map((item) => item.language === language ? { ...item, is_current: false } : item)]);
      setSaveState("saved");
      setToast("A new solution revision was saved.");
    } catch (cause) { setSaveState("error"); setError(cause instanceof Error ? cause.message : "Could not create a revision."); }
  };
  const restoreRevision = (revision: SolutionRevision) => {
    if (revision.language !== language) setLanguage(revision.language);
    setDraft({ language: revision.language, code: revision.code, approachNotes: revision.approach_notes, generalNotes: revision.general_notes, timeComplexity: revision.time_complexity, spaceComplexity: revision.space_complexity });
    setSaveState("dirty");
  };
  const updateProgress = async (patch: { confidence?: number; status?: ProblemStatus }) => {
    const oldConfidence = confidence, oldStatus = status;
    if (patch.confidence) setConfidence(patch.confidence); if (patch.status) setStatus(patch.status);
    try { await repository.saveProgress(userId, problem.id, patch); }
    catch (cause) { setConfidence(oldConfidence); setStatus(oldStatus); setError(cause instanceof Error ? `Progress rolled back: ${cause.message}` : "Progress update rolled back."); }
  };
  const recordAttempt = async (input: { result: AttemptResult; durationMinutes: number; confidence: number; notes: string }) => {
    if (input.durationMinutes < 0 || input.durationMinutes > 1440) throw new Error("Time spent must be between 0 and 1440 minutes.");
    const now = new Date();
    const created = await repository.createAttempt(userId, problem.id, { ...input, confidence: input.confidence || null, notes: input.notes || null, language });
    setAttempts((items) => [created, ...items]); setAttemptOpen(false);
    const finished = input.result === "solved" || input.result === "reviewed";
    const nextStatus: ProblemStatus = finished ? "completed" : "in_progress";
    await repository.saveProgress(userId, problem.id, {
      confidence: input.confidence || null,
      status: nextStatus,
      completed_at: finished ? now.toISOString() : problem.progress?.completed_at,
      next_review_at: nextReviewAt(now, input.result, input.confidence || null),
      first_started_at: problem.progress?.first_started_at ?? now.toISOString(),
    });
    setConfidence(input.confidence); setStatus(nextStatus);
    await repository.updateDailyTaskForProblem(userId, problem.id, localDate, {
      status: finished ? "completed" : "in_progress",
      completed_at: finished ? now.toISOString() : null,
    });
    setToast(finished ? "Attempt recorded, problem completed, and review scheduled." : "Attempt recorded and progress updated.");
  };

  const externalUrl = safeHttpUrl(problem.external_url);
  return <div className="workspace-shell">
    <header className="workspace-header">
      <div><Link href="/problems" className="back-link">← Problem library</Link><div className="workspace-title"><h1>{problem.title}</h1><span className={`difficulty ${problem.difficulty}`}>{problem.difficulty}</span></div><p>{problem.source} · {problem.topics.join(" · ")} · {problem.estimated_minutes} min</p></div>
      <div className="workspace-actions">{externalUrl && <a className="button button-quiet" href={externalUrl} target="_blank" rel="noopener noreferrer">Open question ↗</a>}<span className={`save-status ${saveState}`}><i />{saveState === "saved" ? "Saved to cloud" : saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : saveState === "offline" ? "Offline draft" : "Save failed"}</span><button className="button button-primary" onClick={() => setAttemptOpen(true)}>Record attempt</button></div>
    </header>
    {(offline || error) && <div className={`state-banner ${error ? "error" : "warning"}`} role={error ? "alert" : "status"}><span>{error ? "Save issue" : "Offline"}</span>{error || "Edits are preserved on this device and will sync after reconnection."}{error && <button onClick={() => setError("")}>Dismiss</button>}</div>}
    <div className="workspace-grid">
      <section className="editor-column">
        <div className="editor-panel panel">
          <div className="editor-toolbar"><div><span>Solution</span><select value={language} onChange={(e) => changeLanguage(e.target.value)}>{languages.map((item) => <option key={item}>{item}</option>)}</select></div><button className="text-button" onClick={saveNewRevision}>＋ New revision</button></div>
          <CodeMirror value={draft.code} height="520px" extensions={[extensionFor(language)]} onChange={(code) => updateDraft({ code })} theme={theme} basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }} />
        </div>
        <div className="notes-grid">
          <label className="panel note-field"><span>Approach</span><textarea rows={7} value={draft.approachNotes} onChange={(e) => updateDraft({ approachNotes: e.target.value })} placeholder="Describe the core idea, invariants, and edge cases…" /></label>
          <label className="panel note-field"><span>General notes</span><textarea rows={7} value={draft.generalNotes} onChange={(e) => updateDraft({ generalNotes: e.target.value })} placeholder="Capture mistakes, insights, and review cues…" /></label>
        </div>
      </section>
      <aside className="workspace-sidebar">
        <section className="panel workspace-section"><div className="section-title"><span>Progress</span><small>Autosaved separately</small></div><label>Status<select value={status} onChange={(e) => updateProgress({ status: e.target.value as ProblemStatus })}><option value="backlog">Backlog</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="review_due">Review due</option><option value="archived">Archived</option></select></label><span className="field-caption">Confidence</span><div className="confidence-buttons">{[1, 2, 3, 4, 5].map((level) => <button className={confidence === level ? "active" : ""} key={level} onClick={() => updateProgress({ confidence: level })}>{level}</button>)}</div><div className="complexity-grid"><label>Time complexity<input value={draft.timeComplexity ?? ""} onChange={(e) => updateDraft({ timeComplexity: e.target.value || null })} placeholder="O(n)" /></label><label>Space complexity<input value={draft.spaceComplexity ?? ""} onChange={(e) => updateDraft({ spaceComplexity: e.target.value || null })} placeholder="O(1)" /></label></div></section>
        <section className="panel workspace-section"><button className="section-title clickable" onClick={() => setHistoryOpen(!historyOpen)}><span>Solution history</span><small>{revisions.length} revisions {historyOpen ? "⌃" : "⌄"}</small></button>{historyOpen && <div className="history-list">{revisions.length ? revisions.map((revision, index) => <div key={revision.id}><span><b>{revision.language} {revision.is_current && <em>Current</em>}</b><small>{formatTimestamp(revision.updated_at, timeZone)}</small></span><button onClick={() => restoreRevision(revision)}>{index === 0 && revision.is_current ? "Load" : "Restore"}</button></div>) : <p className="mini-empty">Your first autosave creates a revision.</p>}</div>}</section>
        <section className="panel workspace-section"><div className="section-title"><span>Attempt history</span><small>{attempts.length} total</small></div><div className="attempt-list">{attempts.length ? attempts.map((attempt) => <div key={attempt.id}><span className={`attempt-result ${attempt.result}`}>{attempt.result}</span><span><b>{attempt.duration_minutes} min · {attempt.language}</b><small>{formatTimestamp(attempt.attempted_at, timeZone)}{attempt.confidence ? ` · Confidence ${attempt.confidence}/5` : ""}</small>{attempt.notes && <p>{attempt.notes}</p>}</span></div>) : <p className="mini-empty">No attempts yet. Record one when you finish a session.</p>}</div></section>
      </aside>
    </div>
    {attemptOpen && <AttemptForm onClose={() => setAttemptOpen(false)} onSave={recordAttempt} />}
    {toast && <Toast message={toast} onDismiss={() => setToast("")} />}
  </div>;
}

function AttemptForm({ onClose, onSave }: { onClose: () => void; onSave: (value: { result: AttemptResult; durationMinutes: number; confidence: number; notes: string }) => Promise<void> }) {
  const [result, setResult] = useState<AttemptResult>("solved");
  const [durationMinutes, setDuration] = useState(30);
  const [confidence, setConfidence] = useState(3);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); setError(""); try { await onSave({ result, durationMinutes, confidence, notes }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not record attempt."); setSaving(false); } };
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><form className="problem-modal attempt-modal panel" onSubmit={submit}><div className="modal-heading"><div><span className="page-kicker">SESSION LOG</span><h2>Record attempt</h2></div><button type="button" onClick={onClose}>×</button></div><div className="form-grid modal-grid"><label className="field"><span>Result</span><select value={result} onChange={(e) => setResult(e.target.value as AttemptResult)}><option value="solved">Solved</option><option value="partial">Partial</option><option value="failed">Failed</option><option value="reviewed">Reviewed</option></select></label><label className="field"><span>Time spent (minutes)</span><input type="number" min="0" max="1440" value={durationMinutes} onChange={(e) => setDuration(Number(e.target.value))} /></label></div><span className="field-caption">Confidence</span><div className="confidence-buttons">{[1, 2, 3, 4, 5].map((level) => <button type="button" className={confidence === level ? "active" : ""} key={level} onClick={() => setConfidence(level)}>{level}</button>)}</div><label className="field"><span>Attempt notes</span><textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What worked? Where did you get stuck?" /></label>{error && <p className="form-message error">{error}</p>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? "Recording…" : "Record attempt"}</button></div></form></div>;
}
