import type { Database, Difficulty, ProblemStatus } from "./database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Problem = Database["public"]["Tables"]["problems"]["Row"];
export type UserProblem = Database["public"]["Tables"]["user_problems"]["Row"];
export type DailyTask = Database["public"]["Tables"]["daily_tasks"]["Row"];
export type Plan = Database["public"]["Tables"]["plans"]["Row"];
export type Attempt = Database["public"]["Tables"]["attempts"]["Row"];
export type SolutionRevision = Database["public"]["Tables"]["solution_revisions"]["Row"];

export interface ProblemWithProgress extends Problem {
  progress: UserProblem | null;
}

export interface DailyTaskWithProblem extends DailyTask {
  problem: Problem;
}

export interface PlanWithTasks extends Plan {
  tasks: DailyTaskWithProblem[];
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

export type ProblemSort = "title" | "difficulty" | "recent" | "estimated";
export type ProblemView = "grid" | "table";

export interface CustomProblemInput {
  title: string;
  description: string | null;
  difficulty: Difficulty;
  topics: string[];
  patterns: string[];
  source: string;
  externalUrl: string | null;
  estimatedMinutes: number;
}

export interface RevisionInput {
  language: string;
  code: string;
  approachNotes: string;
  generalNotes: string;
  timeComplexity: string | null;
  spaceComplexity: string | null;
}

export interface AttemptInput {
  result: Database["public"]["Enums"]["attempt_result"];
  language: string;
  durationMinutes: number;
  confidence: number | null;
  notes: string | null;
}
