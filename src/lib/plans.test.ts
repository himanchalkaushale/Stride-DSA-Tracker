import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DailyTask, PlanWithTasks } from "@/types/models";
import { exportPlanCsv, previewRedistribution, previewShift, sortPlanTasks, summarizePlan, validatePlanName } from "./plans.ts";

const stamp = "2026-07-30T00:00:00.000Z";
function task(id: string, date: string, position = 0, patch: Partial<DailyTask> = {}): DailyTask {
  return {
    id, user_id: "user", problem_id: `problem-${id}`, plan_id: "plan", task_date: date,
    position, status: "planned", source: "manual", completed_at: null,
    created_at: stamp, updated_at: stamp, ...patch,
  };
}

describe("practice plans", () => {
  it("validates names and summarizes progress", () => {
    assert.equal(validatePlanName("  Arrays sprint "), "Arrays sprint");
    assert.throws(() => validatePlanName(" ".repeat(3)), /between 1 and 120/);
    const plan = {
      id: "plan", owner_id: "user", name: "Plan", origin: "manual", source_filename: null,
      daily_capacity: 2, created_at: stamp, updated_at: stamp,
      tasks: [task("a", "2026-08-02", 0, { status: "completed" }), task("b", "2026-08-01")],
    } as PlanWithTasks;
    assert.deepEqual(summarizePlan(plan), {
      total: 2, completed: 1, skipped: 0, startDate: "2026-08-01",
      endDate: "2026-08-02", progress: 50, isComplete: false,
    });
  });

  it("orders entries and reports shift conflicts without mutating", () => {
    const tasks = [task("b", "2026-08-02"), task("a", "2026-08-01"), task("fixed", "2026-08-02", 1, {
      plan_id: null, problem_id: "problem-a",
    })];
    assert.deepEqual(sortPlanTasks(tasks).map((item) => item.id), ["a", "b", "fixed"]);
    const result = previewShift(tasks, "plan", "2026-08-01", 1);
    assert.equal(result.preview[0].taskDate, "2026-08-02");
    assert.deepEqual(result.conflicts, ["problem-a on 2026-08-02"]);
  });

  it("redistributes around all incomplete workload", () => {
    const tasks = [
      task("a", "2026-08-01"), task("b", "2026-08-01", 1),
      task("outside", "2026-08-05", 0, { plan_id: null }),
    ];
    const result = previewRedistribution(tasks, "plan", "2026-08-01", "2026-08-05", 1);
    assert.deepEqual(result.preview.map((item) => item.taskDate), ["2026-08-06", "2026-08-07"]);
  });

  it("escapes exported CSV metadata", () => {
    const base = task("a", "2026-08-01");
    const csv = exportPlanCsv({
      id: "plan", owner_id: "user", name: "Plan", origin: "csv", source_filename: "x.csv",
      daily_capacity: 2, created_at: stamp, updated_at: stamp,
    }, [{ ...base, problem: {
      id: "problem-a", owner_id: "user", title: 'Merge, "Sort"', slug: "merge", description: "line 1\nline 2",
      difficulty: "medium", topics: ["Arrays"], patterns: ["Sorting"], source: "Custom",
      external_url: null, estimated_minutes: 30, is_curated: false, created_at: stamp, updated_at: stamp,
    } }]);
    assert.match(csv, /"Merge, ""Sort"""/);
    assert.match(csv, /"line 1\nline 2"/);
  });
});
