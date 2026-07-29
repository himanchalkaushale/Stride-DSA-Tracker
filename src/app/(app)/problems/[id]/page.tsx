import { notFound } from "next/navigation";
import { ProblemWorkspace } from "@/components/problem-workspace";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";
import { localDateKey } from "@/lib/planner";
import { getAppContext } from "@/lib/server-data";

export default async function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, profile } = await getAppContext();
  if (!user) return null;
  const repository = new SupabaseTrackerRepository(supabase);
  const [problem, attempts, revisions] = await Promise.all([
    repository.getProblem(user.id, id),
    repository.listAttempts(user.id, id),
    repository.listRevisions(user.id, id),
  ]);
  if (!problem) notFound();
  return <ProblemWorkspace
    userId={user.id}
    problem={problem}
    initialAttempts={attempts}
    initialRevisions={revisions}
    localDate={localDateKey(new Date(), profile?.timezone ?? "UTC")}
    preferredLanguage={profile?.preferred_languages[0] ?? "TypeScript"}
  />;
}
