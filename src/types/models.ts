import type { Database, Difficulty, ProblemStatus } from "./database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Problem = Database["public"]["Tables"]["problems"]["Row"];
export type UserProblem = Database["public"]["Tables"]["user_problems"]["Row"];
export type DailyTask = Database["public"]["Tables"]["daily_tasks"]["Row"];
export type Attempt = Database["public"]["Tables"]["attempts"]["Row"];
export type SolutionRevision = Database["public"]["Tables"]["solution_revisions"]["Row"];

export interface ProblemWithProgress extends Problem {
  progress: Pick<UserProblem, "status" | "bookmarked" | "confidence" | "next_review_at"> | null;
}

export interface OnboardingPreferences {
  displayName: string;
  timezone: string;
  dailyTarget: number;
  preferredLanguages: string[];
  activeTopics: string[];
  difficultyMin: Difficulty;
  difficultyMax: Difficulty;
}

export interface ProblemFilters {
  search: string;
  topics: string[];
  difficulties: Difficulty[];
  statuses: ProblemStatus[];
  patterns: string[];
  source: string | null;
}
