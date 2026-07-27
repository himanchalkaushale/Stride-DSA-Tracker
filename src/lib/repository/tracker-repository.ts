import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  Attempt, AttemptInput, CustomProblemInput, DailyTask, OnboardingPreferences, Problem,
  ProblemWithProgress, Profile, RevisionInput, SolutionRevision, UserProblem,
} from "@/types/models";

export interface TrackerRepository {
  getProfile(userId: string): Promise<Profile | null>;
  saveOnboarding(userId: string, preferences: OnboardingPreferences): Promise<Profile>;
  updateProfile(userId: string, patch: Database["public"]["Tables"]["profiles"]["Update"]): Promise<Profile>;
  listCuratedProblems(limit?: number): Promise<Problem[]>;
  listProblems(userId: string): Promise<ProblemWithProgress[]>;
  getProblem(userId: string, problemId: string): Promise<ProblemWithProgress | null>;
  createProblem(userId: string, input: CustomProblemInput): Promise<Problem>;
  updateProblem(problemId: string, input: CustomProblemInput): Promise<Problem>;
  deleteProblem(problemId: string): Promise<void>;
  saveProgress(userId: string, problemId: string, patch: Database["public"]["Tables"]["user_problems"]["Update"]): Promise<UserProblem>;
  listAttempts(userId: string, problemId: string): Promise<Attempt[]>;
  createAttempt(userId: string, problemId: string, input: AttemptInput): Promise<Attempt>;
  listDailyTasks(userId: string, taskDate?: string): Promise<DailyTask[]>;
  createDailyTasks(tasks: Database["public"]["Tables"]["daily_tasks"]["Insert"][]): Promise<DailyTask[]>;
  updateDailyTask(taskId: string, patch: Database["public"]["Tables"]["daily_tasks"]["Update"]): Promise<DailyTask>;
  updateDailyTaskForProblem(userId: string, problemId: string, taskDate: string, patch: Database["public"]["Tables"]["daily_tasks"]["Update"]): Promise<void>;
  deleteDailyTask(taskId: string): Promise<void>;
  listRevisions(userId: string, problemId: string): Promise<SolutionRevision[]>;
  saveCurrentRevision(userId: string, problemId: string, input: RevisionInput): Promise<SolutionRevision>;
  createRevision(userId: string, problemId: string, input: RevisionInput): Promise<SolutionRevision>;
}

export class SupabaseTrackerRepository implements TrackerRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async getProfile(userId: string) {
    const { data, error } = await this.db
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async saveOnboarding(userId: string, preferences: OnboardingPreferences) {
    const { data, error } = await this.db
      .from("profiles")
      .upsert({
        id: userId,
        display_name: preferences.displayName,
        timezone: preferences.timezone,
        daily_target: preferences.dailyTarget,
        preferred_languages: preferences.preferredLanguages,
        active_topics: preferences.activeTopics,
        difficulty_min: preferences.difficultyMin,
        difficulty_max: preferences.difficultyMax,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async updateProfile(userId: string, patch: Database["public"]["Tables"]["profiles"]["Update"]) {
    const { data, error } = await this.db.from("profiles").update({
      ...patch,
      updated_at: new Date().toISOString(),
    }).eq("id", userId).select("*").single();
    if (error) throw error;
    return data;
  }

  async listCuratedProblems(limit = 50) {
    const { data, error } = await this.db
      .from("problems")
      .select("*")
      .eq("is_curated", true)
      .order("difficulty")
      .limit(limit);
    if (error) throw error;
    return data;
  }

  async listProblems(userId: string) {
    const [{ data: problems, error: problemsError }, { data: progress, error: progressError }] = await Promise.all([
      this.db.from("problems").select("*").order("created_at", { ascending: false }),
      this.db.from("user_problems").select("*").eq("user_id", userId),
    ]);
    if (problemsError) throw problemsError;
    if (progressError) throw progressError;
    const byProblem = new Map((progress ?? []).map((item) => [item.problem_id, item]));
    return (problems ?? []).map((problem) => ({ ...problem, progress: byProblem.get(problem.id) ?? null }));
  }

  async getProblem(userId: string, problemId: string) {
    const [{ data: problem, error }, { data: progress, error: progressError }] = await Promise.all([
      this.db.from("problems").select("*").eq("id", problemId).maybeSingle(),
      this.db.from("user_problems").select("*").eq("user_id", userId).eq("problem_id", problemId).maybeSingle(),
    ]);
    if (error) throw error;
    if (progressError) throw progressError;
    return problem ? { ...problem, progress } : null;
  }

  async createProblem(userId: string, input: CustomProblemInput) {
    const baseSlug = input.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "problem";
    const { data, error } = await this.db.from("problems").insert({
      owner_id: userId,
      title: input.title.trim(),
      slug: `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`,
      description: input.description,
      difficulty: input.difficulty,
      topics: input.topics,
      patterns: input.patterns,
      source: input.source.trim() || "custom",
      external_url: input.externalUrl,
      estimated_minutes: input.estimatedMinutes,
      is_curated: false,
    }).select("*").single();
    if (error) throw error;
    return data;
  }

  async updateProblem(problemId: string, input: CustomProblemInput) {
    const { data, error } = await this.db.from("problems").update({
      title: input.title.trim(),
      description: input.description,
      difficulty: input.difficulty,
      topics: input.topics,
      patterns: input.patterns,
      source: input.source.trim() || "custom",
      external_url: input.externalUrl,
      estimated_minutes: input.estimatedMinutes,
    }).eq("id", problemId).eq("is_curated", false).select("*").single();
    if (error) throw error;
    return data;
  }

  async deleteProblem(problemId: string) {
    const { error } = await this.db.from("problems").delete().eq("id", problemId).eq("is_curated", false);
    if (error) throw error;
  }

  async saveProgress(userId: string, problemId: string, patch: Database["public"]["Tables"]["user_problems"]["Update"]) {
    const now = new Date().toISOString();
    const { data, error } = await this.db.from("user_problems").upsert({
      user_id: userId,
      problem_id: problemId,
      ...patch,
      last_activity_at: now,
      updated_at: now,
    }, { onConflict: "user_id,problem_id" }).select("*").single();
    if (error) throw error;
    return data;
  }

  async listAttempts(userId: string, problemId: string) {
    const { data, error } = await this.db.from("attempts").select("*")
      .eq("user_id", userId).eq("problem_id", problemId).order("attempted_at", { ascending: false });
    if (error) throw error;
    return data;
  }

  async createAttempt(userId: string, problemId: string, input: AttemptInput) {
    const { data, error } = await this.db.from("attempts").insert({
      user_id: userId,
      problem_id: problemId,
      result: input.result,
      language: input.language,
      duration_minutes: input.durationMinutes,
      confidence: input.confidence,
      notes: input.notes,
    }).select("*").single();
    if (error) throw error;
    return data;
  }

  async listDailyTasks(userId: string, taskDate?: string) {
    let query = this.db.from("daily_tasks").select("*").eq("user_id", userId);
    if (taskDate) query = query.eq("task_date", taskDate);
    const { data, error } = await query
      .order("task_date", { ascending: false })
      .order("position", { ascending: true });
    if (error) throw error;
    return data;
  }

  async createDailyTasks(tasks: Database["public"]["Tables"]["daily_tasks"]["Insert"][]) {
    if (!tasks.length) return [];
    const { data, error } = await this.db.from("daily_tasks").upsert(tasks, {
      onConflict: "user_id,problem_id,task_date",
      ignoreDuplicates: true,
    }).select("*");
    if (error) throw error;
    return data;
  }

  async updateDailyTask(taskId: string, patch: Database["public"]["Tables"]["daily_tasks"]["Update"]) {
    const { data, error } = await this.db.from("daily_tasks").update({
      ...patch,
      updated_at: new Date().toISOString(),
    }).eq("id", taskId).select("*").single();
    if (error) throw error;
    return data;
  }

  async updateDailyTaskForProblem(userId: string, problemId: string, taskDate: string, patch: Database["public"]["Tables"]["daily_tasks"]["Update"]) {
    const { error } = await this.db.from("daily_tasks").update({
      ...patch,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId).eq("problem_id", problemId).eq("task_date", taskDate);
    if (error) throw error;
  }

  async deleteDailyTask(taskId: string) {
    const { error } = await this.db.from("daily_tasks").delete().eq("id", taskId);
    if (error) throw error;
  }

  async listRevisions(userId: string, problemId: string) {
    const { data, error } = await this.db.from("solution_revisions").select("*")
      .eq("user_id", userId).eq("problem_id", problemId).order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }

  async saveCurrentRevision(userId: string, problemId: string, input: RevisionInput) {
    const values = {
      language: input.language,
      code: input.code,
      approach_notes: input.approachNotes,
      general_notes: input.generalNotes,
      time_complexity: input.timeComplexity,
      space_complexity: input.spaceComplexity,
      updated_at: new Date().toISOString(),
    };
    const { data: current, error: findError } = await this.db.from("solution_revisions").select("id")
      .eq("user_id", userId).eq("problem_id", problemId).eq("language", input.language).eq("is_current", true).maybeSingle();
    if (findError) throw findError;
    const query = current
      ? this.db.from("solution_revisions").update(values).eq("id", current.id)
      : this.db.from("solution_revisions").insert({ user_id: userId, problem_id: problemId, ...values, is_current: true });
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return data;
  }

  async createRevision(userId: string, problemId: string, input: RevisionInput) {
    const { data: previous, error: findError } = await this.db.from("solution_revisions").select("id")
      .eq("user_id", userId).eq("problem_id", problemId).eq("language", input.language).eq("is_current", true).maybeSingle();
    if (findError) throw findError;
    const { error: archiveError } = await this.db.from("solution_revisions").update({ is_current: false })
      .eq("user_id", userId).eq("problem_id", problemId).eq("language", input.language).eq("is_current", true);
    if (archiveError) throw archiveError;
    const { data, error } = await this.db.from("solution_revisions").insert({
      user_id: userId,
      problem_id: problemId,
      language: input.language,
      code: input.code,
      approach_notes: input.approachNotes,
      general_notes: input.generalNotes,
      time_complexity: input.timeComplexity,
      space_complexity: input.spaceComplexity,
      is_current: true,
    }).select("*").single();
    if (error) {
      if (previous) await this.db.from("solution_revisions").update({ is_current: true }).eq("id", previous.id);
      throw error;
    }
    return data;
  }
}
