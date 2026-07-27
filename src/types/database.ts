export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Difficulty = "easy" | "medium" | "hard";
export type ProblemStatus = "backlog" | "in_progress" | "completed" | "review_due" | "archived";
export type TaskStatus = "planned" | "in_progress" | "completed" | "skipped" | "review_due";
export type AttemptResult = "solved" | "partial" | "failed" | "reviewed";
export type TaskSource = "adaptive" | "manual" | "review";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          timezone: string;
          daily_target: number;
          preferred_languages: string[];
          active_topics: string[];
          difficulty_min: Difficulty;
          difficulty_max: Difficulty;
          onboarding_complete: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      problems: {
        Row: {
          id: string;
          owner_id: string | null;
          title: string;
          slug: string;
          description: string | null;
          difficulty: Difficulty;
          topics: string[];
          patterns: string[];
          source: string;
          external_url: string | null;
          estimated_minutes: number;
          is_curated: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["problems"]["Row"]> & {
          title: string;
          slug: string;
          difficulty: Difficulty;
        };
        Update: Partial<Database["public"]["Tables"]["problems"]["Row"]>;
        Relationships: [];
      };
      user_problems: {
        Row: {
          id: string;
          user_id: string;
          problem_id: string;
          status: ProblemStatus;
          bookmarked: boolean;
          confidence: number | null;
          priority: number;
          first_started_at: string | null;
          completed_at: string | null;
          next_review_at: string | null;
          last_activity_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["user_problems"]["Row"]> & {
          user_id: string;
          problem_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_problems"]["Row"]>;
        Relationships: [];
      };
      daily_tasks: {
        Row: {
          id: string;
          user_id: string;
          problem_id: string;
          task_date: string;
          position: number;
          status: TaskStatus;
          source: TaskSource;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["daily_tasks"]["Row"]> & {
          user_id: string;
          problem_id: string;
          task_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["daily_tasks"]["Row"]>;
        Relationships: [];
      };
      attempts: {
        Row: {
          id: string;
          user_id: string;
          problem_id: string;
          result: AttemptResult;
          language: string;
          duration_minutes: number;
          confidence: number | null;
          notes: string | null;
          attempted_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["attempts"]["Row"]> & {
          user_id: string;
          problem_id: string;
          result: AttemptResult;
        };
        Update: Partial<Database["public"]["Tables"]["attempts"]["Row"]>;
        Relationships: [];
      };
      solution_revisions: {
        Row: {
          id: string;
          user_id: string;
          problem_id: string;
          language: string;
          code: string;
          approach_notes: string;
          general_notes: string;
          time_complexity: string | null;
          space_complexity: string | null;
          is_current: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["solution_revisions"]["Row"]> & {
          user_id: string;
          problem_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["solution_revisions"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      difficulty_level: Difficulty;
      problem_status: ProblemStatus;
      task_status: TaskStatus;
      attempt_result: AttemptResult;
      task_source: TaskSource;
    };
    CompositeTypes: Record<string, never>;
  };
}
