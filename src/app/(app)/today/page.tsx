import { redirect } from "next/navigation";
import { TodayDashboard } from "@/components/today-dashboard";
import { localDateKey } from "@/lib/planner";
import { getAppContext, getCurrentProblems, getCurrentTasks, getCurrentTodos } from "@/lib/server-data";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const { supabase, user, profile } = await getAppContext();
  if (!user) return null;
  if (!profile) redirect("/onboarding");

  const dateKey = localDateKey(new Date(), profile.timezone);
  const [problems, allTasks, todos, attemptsResult] = await Promise.all([
    getCurrentProblems(),
    getCurrentTasks(),
    getCurrentTodos(),
    supabase.from("attempts").select("*").eq("user_id", user.id).order("attempted_at", { ascending: false }).limit(8),
  ]);
  const todayTasks = allTasks.filter((task) => task.task_date === dateKey);

  return <TodayDashboard
    userId={user.id}
    profile={profile}
    dateKey={dateKey}
    initialTasks={todayTasks}
    allTasks={[...todayTasks, ...allTasks.filter((task) => task.task_date !== dateKey)]}
    problems={problems}
    recentAttempts={attemptsResult.data ?? []}
    initialTodos={todos}
  />;
}
