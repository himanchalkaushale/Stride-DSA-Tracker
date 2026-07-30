import { notFound } from "next/navigation";
import { PlanDetail } from "@/components/plan-detail";
import { localDateKey } from "@/lib/planner";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";
import { getAppContext, getCurrentProblems, getCurrentTasks } from "@/lib/server-data";

export const metadata = { title: "Plan" };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile, supabase } = await getAppContext();
  if (!user || !profile) return null;
  const repository = new SupabaseTrackerRepository(supabase);
  const [plan, allTasks, problems] = await Promise.all([
    repository.getPlan(user.id, id), getCurrentTasks(), getCurrentProblems(),
  ]);
  if (!plan) notFound();
  return <PlanDetail userId={user.id} initialPlan={plan} initialAllTasks={allTasks}
    initialProblems={problems} defaultDate={localDateKey(new Date(), profile.timezone)} />;
}
