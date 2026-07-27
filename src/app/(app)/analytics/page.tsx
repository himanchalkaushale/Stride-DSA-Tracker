import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { localDateKey } from "@/lib/planner";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const repository = new SupabaseTrackerRepository(supabase);
  const [profile, problems, tasks, attemptsResult] = await Promise.all([
    repository.getProfile(user.id),
    repository.listProblems(user.id),
    repository.listDailyTasks(user.id),
    supabase.from("attempts").select("*").eq("user_id", user.id).order("attempted_at", { ascending: true }),
  ]);
  return <AnalyticsDashboard
    attempts={attemptsResult.data ?? []}
    tasks={tasks}
    problems={problems}
    todayKey={localDateKey(new Date(), profile?.timezone ?? "UTC")}
    timezone={profile?.timezone ?? "UTC"}
  />;
}
