import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { OnboardingPreferences, Problem, Profile } from "@/types/models";

export interface TrackerRepository {
  getProfile(userId: string): Promise<Profile | null>;
  saveOnboarding(userId: string, preferences: OnboardingPreferences): Promise<Profile>;
  listCuratedProblems(limit?: number): Promise<Problem[]>;
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
}
