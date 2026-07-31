import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";

/**
 * Request-scoped server loaders shared by layouts and pages.
 * React cache prevents the same navigation from repeating auth and data queries.
 */
export const getAppContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;

  return { supabase, user, profile };
});

export const getCurrentProblems = cache(async () => {
  const { supabase, user } = await getAppContext();
  if (!user) return [];
  return new SupabaseTrackerRepository(supabase).listProblems(user.id);
});

export const getCurrentTasks = cache(async () => {
  const { supabase, user } = await getAppContext();
  if (!user) return [];
  return new SupabaseTrackerRepository(supabase).listDailyTasks(user.id);
});

export const getCurrentTodos = cache(async () => {
  const { supabase, user } = await getAppContext();
  if (!user) return [];
  return new SupabaseTrackerRepository(supabase).listTodos(user.id);
});
