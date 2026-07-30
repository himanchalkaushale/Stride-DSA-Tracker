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
export type PlanOrigin = "csv" | "manual" | "adopted";

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
          planner_last_generated_date: string | null;
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
          plan_id: string | null;
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
      plans: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          origin: PlanOrigin;
          source_filename: string | null;
          daily_capacity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["plans"]["Row"]> & {
          owner_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["plans"]["Row"]>;
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
    Functions: {
      create_practice_plan: {
        Args: { p_name: string; p_origin?: PlanOrigin; p_source_filename?: string | null; p_daily_capacity?: number };
        Returns: Database["public"]["Tables"]["plans"]["Row"];
      };
      import_practice_plan: {
        Args: { p_name: string; p_source_filename: string | null; p_daily_capacity: number; p_entries: Json };
        Returns: string;
      };
      adopt_tasks_into_plan: {
        Args: { p_name: string; p_daily_capacity: number; p_task_ids: string[] };
        Returns: string;
      };
      shift_plan_tasks: {
        Args: { p_plan_id: string; p_from_date: string; p_days: number };
        Returns: number;
      };
      redistribute_plan_tasks: {
        Args: { p_plan_id: string; p_from_date: string; p_start_date: string; p_capacity: number };
        Returns: number;
      };
      remove_plan_task: { Args: { p_task_id: string }; Returns: string };
      delete_practice_plan: { Args: { p_plan_id: string }; Returns: undefined };
    };
    Enums: {
      difficulty_level: Difficulty;
      problem_status: ProblemStatus;
      task_status: TaskStatus;
      attempt_result: AttemptResult;
      task_source: TaskSource;
      plan_origin: PlanOrigin;
    };
    CompositeTypes: Record<string, never>;
  };
}
