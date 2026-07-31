"use client";

import { useMemo, useState } from "react";
import { MAX_CSV_FILE_BYTES, PLAN_CSV_TEMPLATE, parsePlanCsv, type CsvPlanRow } from "@/lib/csv-plan";
import { TOPICS } from "@/lib/constants";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";
import { createClient } from "@/lib/supabase/client";

export function CsvPlanImporter({
  userId,
  defaultStartDate,
  onClose,
  onImported,
  defaultPlanName = "",
}: {
  userId: string;
  defaultStartDate: string;
  onClose: () => void;
  onImported: (planId: string) => void;
  defaultPlanName?: string;
}) {
  const repository = useMemo(() => new SupabaseTrackerRepository(createClient()), []);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [questionsPerDay, setQuestionsPerDay] = useState(2);
  const [planTopic, setPlanTopic] = useState("");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [planName, setPlanName] = useState(defaultPlanName);
  const [preview, setPreview] = useState<CsvPlanRow[]>([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  const parse = (text: string, date = startDate, dailyCount = questionsPerDay, topic = planTopic) => {
    try {
      const rows = parsePlanCsv(text, { startDate: date, questionsPerDay: dailyCount, topicOverride: topic || undefined });
      setPreview(rows);
      setError("");
    } catch (cause) {
      setPreview([]);
      setError(cause instanceof Error ? cause.message : "The CSV could not be read.");
    }
  };

  const selectFile = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Choose a file ending in .csv.");
      return;
    }
    if (file.size > MAX_CSV_FILE_BYTES) {
      setError("The CSV file cannot exceed 1 MB.");
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError("The CSV file could not be read.");
      return;
    }
    const detectedTopic = /linked[\s_-]*lists?/i.test(file.name) ? "Linked Lists" : "";
    setCsvText(text);
    setFileName(file.name);
    if (!planName) setPlanName(file.name.replace(/\.csv$/i, "").replace(/[-_]+/g, " ").trim());
    setPlanTopic(detectedTopic);
    parse(text, startDate, questionsPerDay, detectedTopic);
  };

  const changeStartDate = (value: string) => {
    setStartDate(value);
    if (csvText) parse(csvText, value, questionsPerDay);
  };

  const changeDailyCount = (value: number) => {
    setQuestionsPerDay(value);
    if (csvText) parse(csvText, startDate, value);
  };

  const changePlanTopic = (value: string) => {
    setPlanTopic(value);
    if (csvText) parse(csvText, startDate, questionsPerDay, value);
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([PLAN_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "stride-monthly-plan-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importPlan = async () => {
    if (!preview.length) return;
    if (!planName.trim()) {
      setError("Enter a plan name.");
      return;
    }
    setImporting(true);
    setError("");
    try {
      const planId = await repository.importPlan(userId, planName, fileName, questionsPerDay, preview);
      onImported(planId);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The monthly plan could not be imported.");
      setImporting(false);
    }
  };

  const dates = [...new Set(preview.map((row) => row.taskDate))];
  const topics = [...new Set(preview.flatMap((row) => row.question.topics))];

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !importing && onClose()}>
      <section className="panel csv-import-modal" role="dialog" aria-modal="true" aria-labelledby="csv-import-title">
        <div className="modal-heading">
          <div><span className="page-kicker">MONTHLY PLANNER</span><h2 id="csv-import-title">Import a CSV plan</h2><p>Upload dated questions, or let Stride schedule them evenly from a start date.</p></div>
          <button type="button" disabled={importing} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="csv-options">
          <label className="field"><span>Plan name</span><input maxLength={120} required value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="August interview sprint" /></label>
          <label className="field"><span>Plan start date</span><input type="date" value={startDate} onChange={(event) => changeStartDate(event.target.value)} /></label>
          <label className="field"><span>Questions per day</span><input type="number" min="1" max="20" value={questionsPerDay} onChange={(event) => changeDailyCount(Number(event.target.value))} /></label>
          <label className="field"><span>Main topic for Questions</span><select value={planTopic} onChange={(event) => changePlanTopic(event.target.value)}><option value="">Use CSV topic values</option>{TOPICS.map((topic) => <option key={topic}>{topic}</option>)}</select></label>
        </div>

        <label className={`csv-dropzone ${fileName ? "selected" : ""}`}>
          <input type="file" accept=".csv,text/csv" onChange={(event) => selectFile(event.target.files?.[0])} />
          <span className="csv-upload-icon">↑</span>
          <strong>{fileName || "Choose your CSV file"}</strong>
          <small>{fileName ? "Select another file to replace it" : "60 questions at 2 per day creates a 30-day plan"}</small>
        </label>

        <button className="text-button csv-template" type="button" onClick={downloadTemplate}>Download CSV template</button>

        {error && <p className="form-message error csv-error">{error}</p>}
        {!!preview.length && <div className="csv-preview">
          <div><span><b>{preview.length}</b><small>questions</small></span><span><b>{dates.length}</b><small>plan days</small></span><span><b>{topics.length || "—"}</b><small>topics</small></span></div>
          <p><b>{dates[0]}</b> through <b>{dates.at(-1)}</b></p>
          <div className="csv-preview-list">
            {preview.slice(0, 4).map((row) => <span key={`${row.rowNumber}-${row.question.title}`}><time>{row.taskDate}</time><b>{row.question.title}</b><small>{row.question.topics.join(", ") || "No topic"} · {row.question.difficulty}</small></span>)}
            {preview.length > 4 && <em>+ {preview.length - 4} more questions</em>}
          </div>
        </div>}

        <div className="modal-actions">
          <button className="button button-quiet" type="button" disabled={importing} onClick={onClose}>Cancel</button>
          <button className="button button-primary" type="button" disabled={!preview.length || importing} onClick={importPlan}>{importing ? "Building your plan…" : `Import ${preview.length || ""} questions`}</button>
        </div>
      </section>
    </div>
  );
}
