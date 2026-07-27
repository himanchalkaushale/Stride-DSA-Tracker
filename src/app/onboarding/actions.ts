"use server";

import { redirect } from "next/navigation";
import { TOPICS, LANGUAGES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";
import type { Difficulty } from "@/types/database";

export async function completeOnboarding(formData: FormData) {
  if (!isSupabaseConfigured) redirect("/auth?error=Supabase+is+not+configured");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 60);
  const dailyTarget = Math.min(8, Math.max(1, Number(formData.get("dailyTarget") ?? 2)));
  const timezone = String(formData.get("timezone") ?? "UTC").slice(0, 80);
  const preferredLanguages = formData.getAll("languages").map(String).filter((v) => LANGUAGES.includes(v as never));
  const activeTopics = formData.getAll("topics").map(String).filter((v) => TOPICS.includes(v as never));
  const validDifficulty = (value: FormDataEntryValue | null): Difficulty =>
    value === "easy" || value === "hard" ? value : "medium";

  if (displayName.length < 2 || activeTopics.length === 0 || preferredLanguages.length === 0) {
    redirect("/onboarding?error=Please+complete+all+required+fields");
  }

  const repository = new SupabaseTrackerRepository(supabase);
  await repository.saveOnboarding(user.id, {
    displayName,
    dailyTarget,
    timezone,
    preferredLanguages,
    activeTopics,
    difficultyMin: validDifficulty(formData.get("difficultyMin")),
    difficultyMax: validDifficulty(formData.get("difficultyMax")),
  });
  redirect("/today");
}
