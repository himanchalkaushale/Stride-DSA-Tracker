import { PlansDashboard } from "@/components/plans-dashboard";
import { localDateKey } from "@/lib/planner";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";
import { getAppContext, getCurrentProblems, getCurrentTasks } from "@/lib/server-data";

export const metadata = { title: "Plans" };

export default async function PlansPage() {
  const { user, profile, supabase } = await getAppContext();
  if (!user || !profile) return null;
  const repository = new SupabaseTrackerRepository(supabase);
  let loadError: string | undefined;
  let plans: Awaited<ReturnType<typeof repository.listPlans>> = [];
  let tasks: Awaited<ReturnType<typeof getCurrentTasks>> = [];
  let problems: Awaited<ReturnType<typeof getCurrentProblems>> = [];
  try { [plans, tasks, problems] = await Promise.all([repository.listPlans(user.id), getCurrentTasks(), getCurrentProblems()]); }
  catch (cause) { loadError = cause instanceof Error ? cause.message : "Plans could not be loaded."; }
  return <PlansDashboard userId={user.id} initialPlans={plans} tasks={tasks} problems={problems}
    defaultDate={localDateKey(new Date(), profile.timezone)} defaultCapacity={profile.daily_target} loadError={loadError} />;
}
