import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { localDateKey } from "@/lib/planner";
import { getAppContext, getCurrentProblems, getCurrentTasks } from "@/lib/server-data";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const { supabase, user, profile } = await getAppContext();
  if (!user) return null;
  const [problems, tasks, attemptsResult] = await Promise.all([
    getCurrentProblems(),
    getCurrentTasks(),
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
