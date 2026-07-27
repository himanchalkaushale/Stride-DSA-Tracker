import { ProblemLibrary } from "@/components/problem-library";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";
import { createClient } from "@/lib/supabase/server";
import type { ProblemWithProgress } from "@/types/models";

export const metadata = { title: "Problems" };

export default async function ProblemsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  let problems: ProblemWithProgress[] = [];
  let loadError: string | undefined;
  try { problems = await new SupabaseTrackerRepository(supabase).listProblems(user.id); }
  catch (cause) { loadError = cause instanceof Error ? cause.message : "Supabase could not load the problem library."; }
  return <ProblemLibrary userId={user.id} initialProblems={problems} loadError={loadError} />;
}
