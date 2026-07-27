"use client";

import { memo, useMemo, useState } from "react";
import { calculateAnalytics, type AnalyticsRange } from "@/lib/analytics";
import type { Attempt, DailyTask, ProblemWithProgress } from "@/types/models";

interface Props {
  attempts: Attempt[];
  tasks: DailyTask[];
  problems: ProblemWithProgress[];
  todayKey: string;
  timezone: string;
}

const rangeLabels: Record<AnalyticsRange, string> = {
  "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", all: "All time",
};

export function AnalyticsDashboard({ attempts, tasks, problems, todayKey, timezone }: Props) {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [topic, setTopic] = useState("");
  const topics = useMemo(() => [...new Set(problems.flatMap((problem) => problem.topics))].sort(), [problems]);
  const analytics = useMemo(() => calculateAnalytics(attempts, tasks, problems, {
    range, topic, todayKey, timezone, now: new Date(`${todayKey}T12:00:00Z`),
  }), [attempts, problems, range, tasks, todayKey, timezone, topic]);

  return <div className="page-shell analytics-page">
    <header className="page-heading">
      <div><span className="page-kicker">INSIGHTS</span><h1>Analytics</h1><p>See what is improving, what needs review, and how consistently you show up.</p></div>
      <div className="analytics-filters">
        <label><span>Date range</span><select value={range} onChange={(event) => setRange(event.target.value as AnalyticsRange)}>{Object.entries(rangeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Topic</span><select value={topic} onChange={(event) => setTopic(event.target.value)}><option value="">All topics</option>{topics.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
    </header>

    <section className="analytics-metrics" aria-label="Analytics summary">
      <Metric label="Completed" value={analytics.totals.completed} detail={rangeLabels[range]} />
      <Metric label="Average solve time" value={`${analytics.totals.averageMinutes}m`} detail={`${analytics.totals.attempts} attempts`} />
      <Metric label="Attempt efficiency" value={`${analytics.totals.efficiency}%`} detail="Solved or reviewed" />
      <Metric label="Review retention" value={`${analytics.totals.reviewRetention}%`} detail="Successful review sessions" />
      <Metric label="Current streak" value={`${analytics.totals.currentStreak}d`} detail={`Longest ${analytics.totals.longestStreak}d`} />
    </section>

    {!analytics.totals.attempts && !analytics.totals.completed ? <section className="panel empty-state analytics-empty"><span className="empty-orbit">↗</span><h2>Your insights start with one session</h2><p>Complete a daily task or record an attempt, then return here to see your trends.</p><a className="button button-primary" href="/today">Open today&apos;s plan</a></section> : <>
      <section className="analytics-grid">
        <TrendChart daily={analytics.dailyTrend} weekly={analytics.weeklyTrend} />
        <Heatmap cells={analytics.heatmap} />
      </section>
      <section className="analytics-grid lower">
        <TopicMastery rows={analytics.topicMastery} />
        <DifficultyChart rows={analytics.difficulty} />
        <ConfidenceChart rows={analytics.confidence} />
      </section>
    </>}
    <p className="analytics-note">Mastery blends completion (45%), successful attempts (35%), and recorded confidence (20%). Review retention counts successful attempts on review-planned days.</p>
  </div>;
}

const Metric = memo(function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <article className="panel"><small>{label}</small><strong>{value}</strong><span>{detail}</span></article>;
});

const TrendChart = memo(function TrendChart({ daily, weekly }: {
  daily: { date: string; completed: number }[]; weekly: { week: string; completed: number }[];
}) {
  const useWeekly = daily.length > 45;
  const points = useWeekly ? weekly.map((item) => ({ label: item.week, value: item.completed })) : daily.map((item) => ({ label: item.date, value: item.completed }));
  const max = Math.max(1, ...points.map((item) => item.value));
  return <article className="panel chart-panel trend-panel"><div className="panel-heading"><div><span>COMPLETION TREND</span><h2>{useWeekly ? "Weekly momentum" : "Daily momentum"}</h2></div><small>{points.reduce((sum, item) => sum + item.value, 0)} completed</small></div>
    <div className="bar-chart" role="img" aria-label={`${useWeekly ? "Weekly" : "Daily"} completed problem trend`}>
      {points.map((item) => <span key={item.label} title={`${item.label}: ${item.value}`}><i style={{ height: `${Math.max(item.value ? 8 : 2, item.value / max * 100)}%` }} /><small>{item.label.slice(5)}</small></span>)}
    </div>
  </article>;
});

const Heatmap = memo(function Heatmap({ cells }: { cells: { date: string; count: number }[] }) {
  return <article className="panel chart-panel heatmap-panel"><div className="panel-heading"><div><span>12-WEEK ACTIVITY</span><h2>Consistency map</h2></div></div>
    <div className="activity-heatmap" role="img" aria-label="Calendar activity heatmap">{cells.map((cell) => <i key={cell.date} data-level={Math.min(4, cell.count)} title={`${cell.date}: ${cell.count} completed`} />)}</div>
    <div className="heatmap-legend"><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} data-level={level} />)}<span>More</span></div>
  </article>;
});

const TopicMastery = memo(function TopicMastery({ rows }: { rows: { topic: string; score: number; completed: number; attempts: number }[] }) {
  return <article className="panel chart-panel mastery-panel"><div className="panel-heading"><div><span>TOPIC MASTERY</span><h2>Strongest areas</h2></div></div>
    <div className="mastery-list">{rows.slice(0, 8).map((row) => <div key={row.topic}><span><b>{row.topic}</b><small>{row.completed} completed · {row.attempts} attempts</small></span><div><i style={{ width: `${row.score}%` }} /></div><strong>{row.score}%</strong></div>)}{!rows.length && <p className="mini-empty">No topic activity in this range.</p>}</div>
  </article>;
});

const DifficultyChart = memo(function DifficultyChart({ rows }: { rows: { difficulty: string; count: number; percent: number }[] }) {
  return <article className="panel chart-panel difficulty-panel"><div className="panel-heading"><div><span>DIFFICULTY MIX</span><h2>Completed work</h2></div></div>
    <div className="difficulty-donut" style={{ background: `conic-gradient(#56c99a 0 ${rows[0]?.percent ?? 0}%, #e5ad5f 0 ${(rows[0]?.percent ?? 0) + (rows[1]?.percent ?? 0)}%, #d56f72 0)` }}><span>{rows.reduce((sum, row) => sum + row.count, 0)}<small>total</small></span></div>
    <div className="difficulty-legend">{rows.map((row) => <span key={row.difficulty}><i className={row.difficulty} /><b>{row.difficulty}</b><small>{row.count} · {row.percent}%</small></span>)}</div>
  </article>;
});

const ConfidenceChart = memo(function ConfidenceChart({ rows }: { rows: { date: string; average: number }[] }) {
  return <article className="panel chart-panel confidence-panel"><div className="panel-heading"><div><span>CONFIDENCE</span><h2>Progression</h2></div><small>out of 5</small></div>
    <div className="confidence-chart" role="img" aria-label="Confidence progression">{rows.slice(-14).map((row) => <span key={row.date} title={`${row.date}: ${row.average}/5`}><i style={{ height: `${row.average / 5 * 100}%` }} /><small>{row.average}</small></span>)}</div>
    {!rows.length && <p className="mini-empty">Add confidence when recording attempts to see progression.</p>}
  </article>;
});
