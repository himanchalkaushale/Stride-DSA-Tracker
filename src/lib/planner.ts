import type { AttemptResult, Difficulty, TaskSource } from "@/types/database";
import type { ProblemWithProgress } from "@/types/models";

export interface PlannedProblem {
  problemId: string;
  source: TaskSource;
  reason: "Overdue review" | "Weak topic" | "Unfinished backlog" | "Curated suggestion";
}

const difficultyRank: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

export function localDateKey(now: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function addCalendarDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function reviewIntervalDays(result: AttemptResult, confidence: number | null): number {
  const level = Math.min(5, Math.max(1, confidence ?? 1));
  if (result === "failed") return 1;
  if (result === "partial") return [1, 2, 3, 5, 7][level - 1];
  if (result === "reviewed") return [1, 3, 7, 14, 30][level - 1];
  return [1, 3, 7, 14, 30][level - 1];
}

export function nextReviewAt(
  now: Date,
  result: AttemptResult,
  confidence: number | null,
): string {
  return new Date(now.getTime() + reviewIntervalDays(result, confidence) * 86_400_000).toISOString();
}

function balanced<T extends { difficulty: Difficulty }>(items: T[]): T[] {
  const queues = {
    easy: items.filter((item) => item.difficulty === "easy"),
    medium: items.filter((item) => item.difficulty === "medium"),
    hard: items.filter((item) => item.difficulty === "hard"),
  };
  const result: T[] = [];
  let previous: Difficulty | null = null;
  while (result.length < items.length) {
    const available = (Object.keys(queues) as Difficulty[])
      .filter((difficulty) => queues[difficulty].length)
      .sort((a, b) => queues[b].length - queues[a].length || difficultyRank[a] - difficultyRank[b]);
    const difficulty = available.find((candidate) => candidate !== previous) ?? available[0];
    if (!difficulty) break;
    result.push(queues[difficulty].shift()!);
    previous = difficulty;
  }
  return result;
}

export function buildDailyPlan({
  problems,
  target,
  activeTopics,
  difficultyMin,
  difficultyMax,
  now,
  excludedProblemIds = [],
}: {
  problems: ProblemWithProgress[];
  target: number;
  activeTopics: string[];
  difficultyMin: Difficulty;
  difficultyMax: Difficulty;
  now: Date;
  excludedProblemIds?: string[];
}): PlannedProblem[] {
  const excluded = new Set(excludedProblemIds);
  const seen = new Set<string>();
  const inRange = (problem: ProblemWithProgress) =>
    difficultyRank[problem.difficulty] >= difficultyRank[difficultyMin]
    && difficultyRank[problem.difficulty] <= difficultyRank[difficultyMax];
  const active = (problem: ProblemWithProgress) =>
    activeTopics.length === 0 || problem.topics.some((topic) => activeTopics.includes(topic));
  const eligible = (problem: ProblemWithProgress) =>
    !excluded.has(problem.id) && problem.progress?.status !== "archived";
  const sortStable = (a: ProblemWithProgress, b: ProblemWithProgress) =>
    (b.progress?.priority ?? 0) - (a.progress?.priority ?? 0)
    || (a.progress?.last_activity_at ?? a.created_at).localeCompare(b.progress?.last_activity_at ?? b.created_at)
    || a.id.localeCompare(b.id);

  const overdue = problems.filter((problem) =>
    eligible(problem)
    && !!problem.progress
    && (
      problem.progress.status === "review_due"
      || (!!problem.progress.next_review_at && problem.progress.next_review_at <= now.toISOString())
    ),
  ).sort(sortStable);
  const weak = problems.filter((problem) =>
    eligible(problem) && inRange(problem) && active(problem)
    && !!problem.progress
    && (problem.progress.confidence ?? 3) <= 2
    && problem.progress.status !== "completed"
    && problem.progress.status !== "review_due",
  ).sort(sortStable);
  const backlog = problems.filter((problem) =>
    eligible(problem) && inRange(problem) && active(problem)
    && !!problem.progress
    && (problem.progress.status === "backlog" || problem.progress.status === "in_progress"),
  ).sort(sortStable);
  const curated = problems.filter((problem) =>
    eligible(problem) && inRange(problem) && active(problem)
    && problem.is_curated && !problem.progress,
  ).sort(sortStable);

  const plan: PlannedProblem[] = [];
  const add = (candidates: ProblemWithProgress[], source: TaskSource, reason: PlannedProblem["reason"]) => {
    for (const problem of balanced(candidates)) {
      if (plan.length >= target) return;
      if (seen.has(problem.id)) continue;
      seen.add(problem.id);
      plan.push({ problemId: problem.id, source, reason });
    }
  };
  add(overdue, "review", "Overdue review");
  add(weak, "adaptive", "Weak topic");
  add(backlog, "adaptive", "Unfinished backlog");
  add(curated, "adaptive", "Curated suggestion");
  return plan;
}

export function calculateStreaks(completedDateKeys: string[], todayKey: string) {
  const unique = [...new Set(completedDateKeys)].sort();
  const completed = new Set(unique);
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of unique) {
    run = previous && addCalendarDays(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  const anchor = completed.has(todayKey) ? todayKey : addCalendarDays(todayKey, -1);
  let current = 0;
  for (let cursor = anchor; completed.has(cursor); cursor = addCalendarDays(cursor, -1)) current++;
  return { current, longest };
}
