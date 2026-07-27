import assert from "node:assert/strict";
import test from "node:test";
import { buildReminders, calculateAnalytics } from "./analytics.ts";
import type { Attempt, DailyTask, ProblemWithProgress } from "../types/models.ts";

const stamp = "2026-07-28T10:00:00.000Z";

function problem(id: string, topics: string[], difficulty: "easy" | "medium" | "hard", progress: ProblemWithProgress["progress"] = null): ProblemWithProgress {
  return {
    id, owner_id: null, title: id, slug: id, description: null, difficulty, topics, patterns: [],
    source: "test", external_url: null, estimated_minutes: 30, is_curated: true, created_at: stamp, updated_at: stamp,
    progress,
  };
}

function task(id: string, problemId: string, date: string, status: DailyTask["status"], source: DailyTask["source"] = "adaptive"): DailyTask {
  return {
    id, user_id: "user", problem_id: problemId, task_date: date, position: 0, status, source,
    completed_at: status === "completed" ? `${date}T10:00:00.000Z` : null, created_at: stamp, updated_at: stamp,
  };
}

function attempt(id: string, problemId: string, date: string, result: Attempt["result"], confidence: number, minutes: number): Attempt {
  return {
    id, user_id: "user", problem_id: problemId, result, language: "TypeScript", duration_minutes: minutes,
    confidence, notes: null, attempted_at: `${date}T10:00:00.000Z`, created_at: `${date}T10:00:00.000Z`,
  };
}

test("analytics calculates filtered trends, efficiency, mastery, time, retention, and streaks", () => {
  const problems = [
    problem("arrays", ["Arrays"], "easy"),
    problem("graphs", ["Graphs"], "hard"),
  ];
  const tasks = [
    task("t1", "arrays", "2026-07-27", "completed"),
    task("t2", "arrays", "2026-07-28", "completed", "review"),
    task("t3", "graphs", "2026-07-28", "completed"),
  ];
  const attempts = [
    attempt("a1", "arrays", "2026-07-27", "solved", 3, 20),
    attempt("a2", "arrays", "2026-07-28", "reviewed", 5, 10),
    attempt("a3", "graphs", "2026-07-28", "failed", 2, 60),
  ];
  const result = calculateAnalytics(attempts, tasks, problems, {
    range: "7d", topic: "Arrays", timezone: "UTC", now: new Date("2026-07-28T12:00:00Z"), todayKey: "2026-07-28",
  });

  assert.equal(result.totals.completed, 2);
  assert.equal(result.totals.attempts, 2);
  assert.equal(result.totals.averageMinutes, 15);
  assert.equal(result.totals.efficiency, 100);
  assert.equal(result.totals.reviewRetention, 100);
  assert.deepEqual(result.difficulty.map((item) => item.count), [2, 0, 0]);
  assert.equal(result.topicMastery[0]?.topic, "Arrays");
  assert.equal(result.confidence.at(-1)?.average, 5);
  assert.equal(result.totals.currentStreak, 2);
  assert.equal(result.totals.longestStreak, 2);
});

test("reminders cover target, overdue review, stalled work, and streak risk", () => {
  const progress: NonNullable<ProblemWithProgress["progress"]> = {
    id: "progress", user_id: "user", problem_id: "arrays", status: "in_progress", bookmarked: false,
    confidence: 2, priority: 0, first_started_at: "2026-07-01T00:00:00Z", completed_at: null,
    next_review_at: "2026-07-20T00:00:00Z", last_activity_at: "2026-07-10T00:00:00Z",
    created_at: stamp, updated_at: stamp,
  };
  const tasks = [task("yesterday", "arrays", "2026-07-27", "completed")];
  const reminders = buildReminders({ daily_target: 2 }, tasks, [problem("arrays", ["Arrays"], "easy", progress)], "2026-07-28", new Date("2026-07-28T12:00:00Z"));

  assert.deepEqual(new Set(reminders.map((item) => item.kind)), new Set(["target", "review", "stalled", "streak"]));
});

test("empty analytics returns stable zero values and a complete heatmap", () => {
  const result = calculateAnalytics([], [], [], {
    range: "30d", topic: "", timezone: "UTC", now: new Date("2026-07-28T12:00:00Z"), todayKey: "2026-07-28",
  });
  assert.equal(result.totals.efficiency, 0);
  assert.equal(result.totals.averageMinutes, 0);
  assert.equal(result.dailyTrend.length, 30);
  assert.equal(result.heatmap.length, 84);
});
