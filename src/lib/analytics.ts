import { calculateStreaks, localDateKey } from "./planner.ts";
import type { Attempt, DailyTask, ProblemWithProgress } from "../types/models.ts";

export type AnalyticsRange = "7d" | "30d" | "90d" | "all";

export interface AnalyticsFilters {
  range: AnalyticsRange;
  topic: string;
  now: Date;
  todayKey: string;
  timezone: string;
}

export interface AnalyticsResult {
  totals: {
    completed: number;
    attempts: number;
    averageMinutes: number;
    efficiency: number;
    reviewRetention: number;
    currentStreak: number;
    longestStreak: number;
  };
  dailyTrend: { date: string; completed: number }[];
  weeklyTrend: { week: string; completed: number }[];
  heatmap: { date: string; count: number }[];
  topicMastery: { topic: string; score: number; completed: number; attempts: number }[];
  difficulty: { difficulty: string; count: number; percent: number }[];
  confidence: { date: string; average: number }[];
}

const DAY_MS = 86_400_000;

function dateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function startKey(range: AnalyticsRange, now: Date) {
  if (range === "all") return null;
  const days = Number.parseInt(range, 10);
  return dateKey(new Date(now.getTime() - (days - 1) * DAY_MS));
}

function enumerateDays(start: string, end: string) {
  const days: string[] = [];
  for (let cursor = new Date(`${start}T00:00:00Z`); dateKey(cursor) <= end; cursor = new Date(cursor.getTime() + DAY_MS)) {
    days.push(dateKey(cursor));
  }
  return days;
}

function mondayKey(key: string) {
  const date = new Date(`${key}T00:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  return dateKey(new Date(date.getTime() - offset * DAY_MS));
}

function successful(result: Attempt["result"]) {
  return result === "solved" || result === "reviewed";
}

export function calculateAnalytics(
  attempts: Attempt[],
  tasks: DailyTask[],
  problems: ProblemWithProgress[],
  filters: AnalyticsFilters,
): AnalyticsResult {
  const problemById = new Map(problems.map((problem) => [problem.id, problem]));
  const appliesTopic = (problemId: string) =>
    !filters.topic || problemById.get(problemId)?.topics.includes(filters.topic);
  const from = startKey(filters.range, filters.now);
  const inRange = (key: string) => (!from || key >= from) && key <= filters.todayKey;

  const attemptDate = (attempt: Attempt) => localDateKey(new Date(attempt.attempted_at), filters.timezone);
  const filteredAttempts = attempts.filter((attempt) =>
    appliesTopic(attempt.problem_id) && inRange(attemptDate(attempt)));
  const filteredTasks = tasks.filter((task) =>
    appliesTopic(task.problem_id) && inRange(task.task_date));
  const completedTasks = filteredTasks.filter((task) => task.status === "completed");
  const completedDates = tasks.filter((task) => task.status === "completed").map((task) => task.task_date);
  const streaks = calculateStreaks(completedDates, filters.todayKey);

  const defaultDays = filters.range === "all" ? 90 : Number.parseInt(filters.range, 10);
  const trendStart = from ?? dateKey(new Date(filters.now.getTime() - (defaultDays - 1) * DAY_MS));
  const completionByDate = new Map<string, number>();
  for (const task of completedTasks) completionByDate.set(task.task_date, (completionByDate.get(task.task_date) ?? 0) + 1);
  const dailyTrend = enumerateDays(trendStart, filters.todayKey).map((date) => ({
    date,
    completed: completionByDate.get(date) ?? 0,
  }));

  const weeklyMap = new Map<string, number>();
  for (const item of dailyTrend) {
    const week = mondayKey(item.date);
    weeklyMap.set(week, (weeklyMap.get(week) ?? 0) + item.completed);
  }
  const weeklyTrend = [...weeklyMap].map(([week, completed]) => ({ week, completed }));

  const heatmapStart = dateKey(new Date(filters.now.getTime() - 83 * DAY_MS));
  const activityByDate = new Map<string, number>();
  for (const task of tasks) {
    if (task.status === "completed" && appliesTopic(task.problem_id) && task.task_date >= heatmapStart && task.task_date <= filters.todayKey) {
      activityByDate.set(task.task_date, (activityByDate.get(task.task_date) ?? 0) + 1);
    }
  }
  const heatmap = enumerateDays(heatmapStart, filters.todayKey).map((date) => ({
    date,
    count: activityByDate.get(date) ?? 0,
  }));

  const masteryTopics = new Map<string, { completed: Set<string>; attempts: Attempt[] }>();
  for (const problem of problems) {
    for (const topic of problem.topics) {
      if (filters.topic && topic !== filters.topic) continue;
      if (!masteryTopics.has(topic)) masteryTopics.set(topic, { completed: new Set(), attempts: [] });
      if (completedTasks.some((task) => task.problem_id === problem.id)) masteryTopics.get(topic)?.completed.add(problem.id);
    }
  }
  for (const attempt of filteredAttempts) {
    for (const topic of problemById.get(attempt.problem_id)?.topics ?? []) {
      if (!filters.topic || filters.topic === topic) masteryTopics.get(topic)?.attempts.push(attempt);
    }
  }
  const topicMastery = [...masteryTopics].map(([topic, value]) => {
    const attemptedProblems = new Set(value.attempts.map((attempt) => attempt.problem_id));
    const successRate = value.attempts.length
      ? value.attempts.filter((attempt) => successful(attempt.result)).length / value.attempts.length
      : 0;
    const confidenceValues = value.attempts.flatMap((attempt) => attempt.confidence ? [attempt.confidence] : []);
    const confidenceRate = confidenceValues.length
      ? confidenceValues.reduce((sum, item) => sum + item, 0) / confidenceValues.length / 5
      : 0;
    const completionRate = attemptedProblems.size ? value.completed.size / attemptedProblems.size : 0;
    return {
      topic,
      score: Math.round((completionRate * 0.45 + successRate * 0.35 + confidenceRate * 0.2) * 100),
      completed: value.completed.size,
      attempts: value.attempts.length,
    };
  }).filter((item) => item.attempts > 0 || item.completed > 0).sort((a, b) => b.score - a.score);

  const difficultyCounts = new Map<string, number>([["easy", 0], ["medium", 0], ["hard", 0]]);
  for (const task of completedTasks) {
    const difficulty = problemById.get(task.problem_id)?.difficulty;
    if (difficulty) difficultyCounts.set(difficulty, (difficultyCounts.get(difficulty) ?? 0) + 1);
  }
  const totalDifficulty = [...difficultyCounts.values()].reduce((sum, count) => sum + count, 0);
  const difficulty = [...difficultyCounts].map(([level, count]) => ({
    difficulty: level,
    count,
    percent: totalDifficulty ? Math.round(count / totalDifficulty * 100) : 0,
  }));

  const confidenceMap = new Map<string, number[]>();
  for (const attempt of filteredAttempts) {
    if (!attempt.confidence) continue;
    const key = attemptDate(attempt);
    confidenceMap.set(key, [...(confidenceMap.get(key) ?? []), attempt.confidence]);
  }
  const confidence = [...confidenceMap].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({
    date,
    average: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)),
  }));

  const successfulAttempts = filteredAttempts.filter((attempt) => successful(attempt.result)).length;
  const durations = filteredAttempts.filter((attempt) => attempt.duration_minutes > 0);
  const reviewKeys = new Set(filteredTasks.filter((task) => task.source === "review").map((task) => `${task.task_date}:${task.problem_id}`));
  const reviewAttempts = filteredAttempts.filter((attempt) => reviewKeys.has(`${attemptDate(attempt)}:${attempt.problem_id}`));
  const retainedReviews = reviewAttempts.filter((attempt) => successful(attempt.result)).length;

  return {
    totals: {
      completed: completedTasks.length,
      attempts: filteredAttempts.length,
      averageMinutes: durations.length ? Math.round(durations.reduce((sum, attempt) => sum + attempt.duration_minutes, 0) / durations.length) : 0,
      efficiency: filteredAttempts.length ? Math.round(successfulAttempts / filteredAttempts.length * 100) : 0,
      reviewRetention: reviewAttempts.length ? Math.round(retainedReviews / reviewAttempts.length * 100) : 0,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
    },
    dailyTrend,
    weeklyTrend,
    heatmap,
    topicMastery,
    difficulty,
    confidence,
  };
}

export interface Reminder {
  kind: "target" | "review" | "stalled" | "streak";
  title: string;
  detail: string;
  href: string;
}

export function buildReminders(
  profile: { daily_target: number },
  tasks: DailyTask[],
  problems: ProblemWithProgress[],
  todayKey: string,
  now: Date,
): Reminder[] {
  const todayCompleted = tasks.filter((task) => task.task_date === todayKey && task.status === "completed").length;
  const overdue = problems.filter((problem) => problem.progress?.next_review_at && new Date(problem.progress.next_review_at) < now);
  const stalled = problems.filter((problem) =>
    problem.progress?.status === "in_progress"
    && now.getTime() - new Date(problem.progress.last_activity_at).getTime() >= 7 * DAY_MS);
  const streaks = calculateStreaks(tasks.filter((task) => task.status === "completed").map((task) => task.task_date), todayKey);
  const reminders: Reminder[] = [];
  if (todayCompleted < profile.daily_target) reminders.push({
    kind: "target", title: "Daily target unfinished",
    detail: `${profile.daily_target - todayCompleted} ${profile.daily_target - todayCompleted === 1 ? "problem" : "problems"} left today.`,
    href: "/today",
  });
  if (overdue.length) reminders.push({
    kind: "review", title: `${overdue.length} overdue ${overdue.length === 1 ? "review" : "reviews"}`,
    detail: "Revisit them before the gap grows.",
    href: "/today",
  });
  if (stalled.length) reminders.push({
    kind: "stalled", title: `${stalled.length} stalled ${stalled.length === 1 ? "problem" : "problems"}`,
    detail: "No activity for at least seven days.",
    href: "/problems?status=in_progress",
  });
  if (streaks.current > 0 && todayCompleted === 0) reminders.push({
    kind: "streak", title: `${streaks.current}-day streak at risk`,
    detail: "Complete one problem before your local midnight.",
    href: "/today",
  });
  return reminders;
}
