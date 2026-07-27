import { notFound } from "next/navigation";
import { ProblemWorkspace } from "@/components/problem-workspace";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";
import { localDateKey } from "@/lib/planner";
import { createClient } from "@/lib/supabase/server";

export default async function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const repository = new SupabaseTrackerRepository(supabase);
  const problem = await repository.getProblem(user.id, id);
  if (!problem) notFound();
  const [attempts, revisions, profile] = await Promise.all([
    repository.listAttempts(user.id, id),
    repository.listRevisions(user.id, id),
    repository.getProfile(user.id),
  ]);
  return <ProblemWorkspace
    userId={user.id}
    problem={problem}
    initialAttempts={attempts}
    initialRevisions={revisions}
    localDate={localDateKey(new Date(), profile?.timezone ?? "UTC")}
    preferredLanguage={profile?.preferred_languages[0] ?? "TypeScript"}
  />;
}
