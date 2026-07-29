import { ProblemLibrary } from "@/components/problem-library";
import { getAppContext, getCurrentProblems } from "@/lib/server-data";
import type { ProblemWithProgress } from "@/types/models";

export const metadata = { title: "Problems" };

export default async function ProblemsPage() {
  const { user } = await getAppContext();
  if (!user) return null;
  let problems: ProblemWithProgress[] = [];
  let loadError: string | undefined;
  try { problems = await getCurrentProblems(); }
  catch (cause) { loadError = cause instanceof Error ? cause.message : "Supabase could not load the problem library."; }
  return <ProblemLibrary userId={user.id} initialProblems={problems} loadError={loadError} />;
}
