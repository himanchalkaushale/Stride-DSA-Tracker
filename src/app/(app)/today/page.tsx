import { redirect } from "next/navigation";
import { TodayDashboard } from "@/components/today-dashboard";
import { buildDailyPlan, localDateKey } from "@/lib/planner";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const repository = new SupabaseTrackerRepository(supabase);
  const profile = await repository.getProfile(user.id);
  if (!profile) redirect("/onboarding");

  const dateKey = localDateKey(new Date(), profile.timezone);
  const [problems, allTasks, attemptsResult] = await Promise.all([
    repository.listProblems(user.id),
    repository.listDailyTasks(user.id),
    supabase.from("attempts").select("*").eq("user_id", user.id).order("attempted_at", { ascending: false }).limit(8),
  ]);
  let todayTasks = allTasks.filter((task) => task.task_date === dateKey);
  if (profile.planner_last_generated_date !== dateKey) {
    const plan = buildDailyPlan({
      problems,
      target: profile.daily_target,
      activeTopics: profile.active_topics,
      difficultyMin: profile.difficulty_min,
      difficultyMax: profile.difficulty_max,
      now: new Date(),
    });
    await repository.createDailyTasks(plan.map((item, position) => ({
      user_id: user.id,
      problem_id: item.problemId,
      task_date: dateKey,
      position,
      status: item.source === "review" ? "review_due" : "planned",
      source: item.source,
    })));
    await repository.updateProfile(user.id, { planner_last_generated_date: dateKey });
    todayTasks = await repository.listDailyTasks(user.id, dateKey);
  }

  return <TodayDashboard
    userId={user.id}
    profile={profile}
    dateKey={dateKey}
    initialTasks={todayTasks}
    allTasks={[...todayTasks, ...allTasks.filter((task) => task.task_date !== dateKey)]}
    problems={problems}
    recentAttempts={attemptsResult.data ?? []}
  />;
}
