import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDailyPlan, calculateStreaks, localDateKey, reviewIntervalDays } from "./planner.ts";
import type { Difficulty, ProblemStatus } from "@/types/database";
import type { ProblemWithProgress } from "@/types/models";

function problem(id: string, {
  difficulty = "medium",
  topics = ["Arrays"],
  status,
  confidence = null,
  nextReviewAt = null,
  curated = true,
}: {
  difficulty?: Difficulty;
  topics?: string[];
  status?: ProblemStatus;
  confidence?: number | null;
  nextReviewAt?: string | null;
  curated?: boolean;
} = {}): ProblemWithProgress {
  const stamp = "2026-01-01T00:00:00.000Z";
  return {
    id, owner_id: curated ? null : "user", title: id, slug: id, description: null,
    difficulty, topics, patterns: [], source: "test", external_url: null,
    estimated_minutes: 30, is_curated: curated, created_at: stamp, updated_at: stamp,
    progress: status ? {
      id: `progress-${id}`, user_id: "user", problem_id: id, status, bookmarked: false,
      confidence, priority: 0, first_started_at: null,
      completed_at: status === "completed" ? stamp : null, next_review_at: nextReviewAt,
      last_activity_at: stamp, created_at: stamp, updated_at: stamp,
    } : null,
  };
}

describe("local calendar dates", () => {
  it("uses the user's timezone across opposite date boundaries", () => {
    const instant = new Date("2026-07-28T20:00:00.000Z");
    assert.equal(localDateKey(instant, "Asia/Calcutta"), "2026-07-29");
    assert.equal(localDateKey(instant, "America/Los_Angeles"), "2026-07-28");
  });

  it("falls back to UTC for an invalid timezone", () => {
    assert.equal(localDateKey(new Date("2026-07-28T23:59:00.000Z"), "Mars/Base"), "2026-07-28");
  });
});

describe("streaks", () => {
  it("keeps a current streak alive until the current local day ends", () => {
    assert.deepEqual(calculateStreaks(["2026-07-24", "2026-07-25", "2026-07-26", "2026-07-27"], "2026-07-28"),
      { current: 4, longest: 4 });
  });

  it("calculates the longest run independently of the current run", () => {
    assert.deepEqual(calculateStreaks(
      ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-26", "2026-07-27", "2026-07-28"],
      "2026-07-28",
    ), { current: 3, longest: 3 });
  });
});

describe("review intervals", () => {
  it("returns failed work quickly and spaces confident solved work", () => {
    assert.equal(reviewIntervalDays("failed", 5), 1);
    assert.equal(reviewIntervalDays("partial", 2), 2);
    assert.equal(reviewIntervalDays("solved", 1), 1);
    assert.equal(reviewIntervalDays("solved", 5), 30);
    assert.equal(reviewIntervalDays("reviewed", 4), 14);
  });
});

describe("adaptive planner", () => {
  const now = new Date("2026-07-28T12:00:00.000Z");

  it("uses review, weak-topic, backlog, then new-curated priority", () => {
    const plan = buildDailyPlan({
      problems: [
        problem("new"),
        problem("backlog", { status: "backlog", confidence: 4 }),
        problem("weak", { status: "in_progress", confidence: 1 }),
        problem("review", { status: "completed", confidence: 3, nextReviewAt: "2026-07-27T00:00:00.000Z" }),
      ],
      target: 4, activeTopics: ["Arrays"], difficultyMin: "easy", difficultyMax: "hard", now,
    });
    assert.deepEqual(plan.map((item) => item.problemId), ["review", "weak", "backlog", "new"]);
    assert.deepEqual(plan.map((item) => item.reason), [
      "Overdue review", "Weak topic", "Unfinished backlog", "Curated suggestion",
    ]);
  });

  it("prevents duplicates across overlapping priority groups and explicit exclusions", () => {
    const plan = buildDailyPlan({
      problems: [
        problem("weak-backlog", { status: "backlog", confidence: 1 }),
        problem("excluded"),
        problem("fresh-1"),
        problem("fresh-2"),
      ],
      target: 4, activeTopics: ["Arrays"], difficultyMin: "easy", difficultyMax: "hard",
      excludedProblemIds: ["excluded"], now,
    });
    assert.deepEqual(plan.map((item) => item.problemId), ["weak-backlog", "fresh-1", "fresh-2"]);
    assert.equal(new Set(plan.map((item) => item.problemId)).size, plan.length);
  });

  it("honors topic and difficulty preferences for non-review work", () => {
    const plan = buildDailyPlan({
      problems: [
        problem("easy", { difficulty: "easy" }),
        problem("graph", { topics: ["Graphs"] }),
        problem("medium", { difficulty: "medium" }),
        problem("hard", { difficulty: "hard" }),
      ],
      target: 4, activeTopics: ["Arrays"], difficultyMin: "medium", difficultyMax: "hard", now,
    });
    assert.deepEqual(plan.map((item) => item.problemId).sort(), ["hard", "medium"]);
  });

  it("balances adjacent difficulties when candidates allow it", () => {
    const plan = buildDailyPlan({
      problems: [
        problem("easy-1", { difficulty: "easy" }),
        problem("easy-2", { difficulty: "easy" }),
        problem("medium-1", { difficulty: "medium" }),
        problem("medium-2", { difficulty: "medium" }),
      ],
      target: 4, activeTopics: ["Arrays"], difficultyMin: "easy", difficultyMax: "hard", now,
    });
    const levels = plan.map((item) => problem(item.problemId, {
      difficulty: item.problemId.startsWith("easy") ? "easy" : "medium",
    }).difficulty);
    assert.deepEqual(levels, ["easy", "medium", "easy", "medium"]);
  });
});
