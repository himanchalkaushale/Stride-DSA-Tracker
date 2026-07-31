import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { normalizeProblemTopics, normalizeTopics } from "@/lib/constants";
import type {
  Attempt, AttemptInput, CustomProblemInput, DailyTask, OnboardingPreferences, Problem,
  Plan, PlanWithTasks, ProblemWithProgress, Profile, RevisionInput, SolutionRevision, Todo, TodoInput, UserProblem,
} from "@/types/models";
import type { CsvPlanRow } from "@/lib/csv-plan";
import { validateCapacity, validatePlanName } from "@/lib/plans";
import { completionPatch, validateTodoInput } from "@/lib/todos";

function isMissingTodosTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return code === "42P01"
    || code === "PGRST205"
    || (typeof message === "string" && message.includes("public.todos"));
}

function todoRepositoryError(error: unknown) {
  if (isMissingTodosTable(error)) {
    return new Error("Todos require supabase/migrations/0006_todos.sql to be applied to the connected Supabase project.");
  }
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return new Error(error.message);
  }
  return error instanceof Error ? error : new Error("The todo request failed.");
}

export interface TrackerRepository {
  getProfile(userId: string): Promise<Profile | null>;
  saveOnboarding(userId: string, preferences: OnboardingPreferences): Promise<Profile>;
  updateProfile(userId: string, patch: Database["public"]["Tables"]["profiles"]["Update"]): Promise<Profile>;
  listCuratedProblems(limit?: number): Promise<Problem[]>;
  listProblems(userId: string): Promise<ProblemWithProgress[]>;
  getProblem(userId: string, problemId: string): Promise<ProblemWithProgress | null>;
  createProblem(userId: string, input: CustomProblemInput): Promise<Problem>;
  createProblems(userId: string, inputs: CustomProblemInput[]): Promise<Problem[]>;
  updateProblem(problemId: string, input: CustomProblemInput): Promise<Problem>;
  deleteProblem(problemId: string): Promise<void>;
  deleteProblems(problemIds: string[]): Promise<void>;
  saveProgress(userId: string, problemId: string, patch: Database["public"]["Tables"]["user_problems"]["Update"]): Promise<UserProblem>;
  listAttempts(userId: string, problemId: string): Promise<Attempt[]>;
  createAttempt(userId: string, problemId: string, input: AttemptInput): Promise<Attempt>;
  listDailyTasks(userId: string, taskDate?: string): Promise<DailyTask[]>;
  createDailyTasks(tasks: Database["public"]["Tables"]["daily_tasks"]["Insert"][]): Promise<DailyTask[]>;
  updateDailyTask(taskId: string, patch: Database["public"]["Tables"]["daily_tasks"]["Update"]): Promise<DailyTask>;
  updateDailyTaskForProblem(userId: string, problemId: string, taskDate: string, patch: Database["public"]["Tables"]["daily_tasks"]["Update"]): Promise<void>;
  deleteDailyTask(taskId: string): Promise<void>;
  listPlans(userId: string): Promise<PlanWithTasks[]>;
  getPlan(userId: string, planId: string): Promise<PlanWithTasks | null>;
  createPlan(userId: string, name: string, capacity: number): Promise<Plan>;
  importPlan(userId: string, name: string, filename: string, capacity: number, rows: CsvPlanRow[]): Promise<string>;
  updatePlan(planId: string, patch: Database["public"]["Tables"]["plans"]["Update"]): Promise<Plan>;
  adoptTasks(name: string, capacity: number, taskIds: string[]): Promise<string>;
  shiftPlan(planId: string, fromDate: string, days: number): Promise<number>;
  redistributePlan(planId: string, fromDate: string, startDate: string, capacity: number): Promise<number>;
  removePlanTask(taskId: string): Promise<"deleted" | "detached">;
  deletePlan(planId: string): Promise<void>;
  listRevisions(userId: string, problemId: string): Promise<SolutionRevision[]>;
  saveCurrentRevision(userId: string, problemId: string, input: RevisionInput): Promise<SolutionRevision>;
  createRevision(userId: string, problemId: string, input: RevisionInput): Promise<SolutionRevision>;
  listTodos(userId: string, todoDate?: string): Promise<Todo[]>;
  createTodo(userId: string, input: TodoInput): Promise<Todo>;
  updateTodo(todoId: string, input: TodoInput): Promise<Todo>;
  setTodoCompleted(todoId: string, completed: boolean): Promise<Todo>;
  deleteTodo(todoId: string): Promise<void>;
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
    return (problems ?? []).map((problem) => ({
      ...problem,
      topics: normalizeProblemTopics(problem),
      progress: byProblem.get(problem.id) ?? null,
    }));
  }

  async getProblem(userId: string, problemId: string) {
    const [{ data: problem, error }, { data: progress, error: progressError }] = await Promise.all([
      this.db.from("problems").select("*").eq("id", problemId).maybeSingle(),
      this.db.from("user_problems").select("*").eq("user_id", userId).eq("problem_id", problemId).maybeSingle(),
    ]);
    if (error) throw error;
    if (progressError) throw progressError;
    return problem ? { ...problem, topics: normalizeProblemTopics(problem), progress } : null;
  }

  async createProblem(userId: string, input: CustomProblemInput) {
    const [created] = await this.createProblems(userId, [input]);
    return created;
  }

  async createProblems(userId: string, inputs: CustomProblemInput[]) {
    if (!inputs.length) return [];
    const values = inputs.map((input, index) => {
      const baseSlug = input.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "problem";
      return {
        owner_id: userId,
        title: input.title.trim(),
        slug: `${baseSlug}-${crypto.randomUUID().slice(0, 8)}-${index}`,
        description: input.description,
        difficulty: input.difficulty,
        topics: normalizeTopics(input.topics),
        patterns: input.patterns,
        source: input.source.trim() || "custom",
        external_url: input.externalUrl,
        estimated_minutes: input.estimatedMinutes,
        is_curated: false,
      };
    });
    const { data, error } = await this.db.from("problems").insert(values).select("*");
    if (error) throw error;
    const bySlug = new Map((data ?? []).map((problem) => [problem.slug, problem]));
    return values.map((value) => bySlug.get(value.slug)).filter((problem): problem is Problem => !!problem);
  }

  async updateProblem(problemId: string, input: CustomProblemInput) {
    const { data, error } = await this.db.from("problems").update({
      title: input.title.trim(),
      description: input.description,
      difficulty: input.difficulty,
      topics: normalizeTopics(input.topics),
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

  async deleteProblems(problemIds: string[]) {
    if (!problemIds.length) return;
    const { error } = await this.db.from("problems").delete().in("id", problemIds).eq("is_curated", false);
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

  async listTodos(userId: string, todoDate?: string) {
    let query = this.db.from("todos").select("*").eq("user_id", userId);
    if (todoDate) query = query.eq("todo_date", todoDate);
    const { data, error } = await query
      .order("is_completed", { ascending: true })
      .order("created_at", { ascending: true });
    // Keep the rest of the dashboard available during a rolling deployment where
    // the application has been updated before the todos migration is applied.
    if (isMissingTodosTable(error)) return [];
    if (error) throw todoRepositoryError(error);
    return data;
  }

  async createTodo(userId: string, input: TodoInput) {
    const value = validateTodoInput(input);
    const { data, error } = await this.db.from("todos").insert({
      user_id: userId, title: value.title, notes: value.notes, todo_date: value.todoDate,
    }).select("*").single();
    if (error) throw todoRepositoryError(error);
    return data;
  }

  async updateTodo(todoId: string, input: TodoInput) {
    const value = validateTodoInput(input);
    const { data, error } = await this.db.from("todos").update({
      title: value.title, notes: value.notes, todo_date: value.todoDate,
    }).eq("id", todoId).select("*").single();
    if (error) throw todoRepositoryError(error);
    return data;
  }

  async setTodoCompleted(todoId: string, completed: boolean) {
    const { data, error } = await this.db.from("todos").update(completionPatch(completed))
      .eq("id", todoId).select("*").single();
    if (error) throw todoRepositoryError(error);
    return data;
  }

  async deleteTodo(todoId: string) {
    const { error } = await this.db.from("todos").delete().eq("id", todoId);
    if (error) throw todoRepositoryError(error);
  }

  async listPlans(userId: string) {
    const [{ data: plans, error: planError }, { data: tasks, error: taskError }, { data: problems, error: problemError }] = await Promise.all([
      this.db.from("plans").select("*").eq("owner_id", userId).order("updated_at", { ascending: false }),
      this.db.from("daily_tasks").select("*").eq("user_id", userId).not("plan_id", "is", null)
        .order("task_date").order("position"),
      this.db.from("problems").select("*"),
    ]);
    if (planError) throw planError;
    if (taskError) throw taskError;
    if (problemError) throw problemError;
    const problemById = new Map((problems ?? []).map((problem) => [problem.id, problem]));
    return (plans ?? []).map((plan) => ({
      ...plan,
      tasks: (tasks ?? []).filter((task) => task.plan_id === plan.id).map((task) => ({
        ...task,
        problem: problemById.get(task.problem_id),
      })).filter((task) => !!task.problem),
    })) as PlanWithTasks[];
  }

  async getPlan(userId: string, planId: string) {
    const plans = await this.listPlans(userId);
    return plans.find((plan) => plan.id === planId) ?? null;
  }

  async createPlan(_userId: string, name: string, capacity: number) {
    const { data, error } = await this.db.rpc("create_practice_plan", {
      p_name: validatePlanName(name),
      p_origin: "manual",
      p_daily_capacity: validateCapacity(capacity),
    });
    if (error) throw error;
    return data;
  }

  async importPlan(_userId: string, name: string, filename: string, capacity: number, rows: CsvPlanRow[]) {
    const positions = new Map<string, number>();
    const entries = rows.map((row) => {
      const position = positions.get(row.taskDate) ?? 0;
      positions.set(row.taskDate, position + 1);
      return {
        task_date: row.taskDate,
        position,
        question: {
          title: row.question.title,
          description: row.question.description,
          difficulty: row.question.difficulty,
          topics: row.question.topics,
          patterns: row.question.patterns,
          source: row.question.source,
          external_url: row.question.externalUrl,
          estimated_minutes: row.question.estimatedMinutes,
        },
      };
    });
    const { data, error } = await this.db.rpc("import_practice_plan", {
      p_name: validatePlanName(name),
      p_source_filename: filename || null,
      p_daily_capacity: validateCapacity(capacity),
      p_entries: entries,
    });
    if (error) throw error;
    return data;
  }

  async updatePlan(planId: string, patch: Database["public"]["Tables"]["plans"]["Update"]) {
    const values = { ...patch };
    if (values.name !== undefined) values.name = validatePlanName(values.name);
    if (values.daily_capacity !== undefined) values.daily_capacity = validateCapacity(values.daily_capacity);
    const { data, error } = await this.db.from("plans").update(values).eq("id", planId).select("*").single();
    if (error) throw error;
    return data;
  }

  async adoptTasks(name: string, capacity: number, taskIds: string[]) {
    const { data, error } = await this.db.rpc("adopt_tasks_into_plan", {
      p_name: validatePlanName(name),
      p_daily_capacity: validateCapacity(capacity),
      p_task_ids: taskIds,
    });
    if (error) throw error;
    return data;
  }

  async shiftPlan(planId: string, fromDate: string, days: number) {
    const { data, error } = await this.db.rpc("shift_plan_tasks", {
      p_plan_id: planId, p_from_date: fromDate, p_days: days,
    });
    if (error) throw error;
    return data;
  }

  async redistributePlan(planId: string, fromDate: string, startDate: string, capacity: number) {
    const { data, error } = await this.db.rpc("redistribute_plan_tasks", {
      p_plan_id: planId, p_from_date: fromDate, p_start_date: startDate,
      p_capacity: validateCapacity(capacity),
    });
    if (error) throw error;
    return data;
  }

  async removePlanTask(taskId: string) {
    const { data, error } = await this.db.rpc("remove_plan_task", { p_task_id: taskId });
    if (error) throw error;
    return data as "deleted" | "detached";
  }

  async deletePlan(planId: string) {
    const { error } = await this.db.rpc("delete_practice_plan", { p_plan_id: planId });
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
