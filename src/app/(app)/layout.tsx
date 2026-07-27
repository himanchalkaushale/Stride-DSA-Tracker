import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { buildReminders } from "@/lib/analytics";
import { localDateKey } from "@/lib/planner";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";
import { SetupRequired } from "@/components/setup-required";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) return <SetupRequired />;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile?.onboarding_complete) redirect("/onboarding");
  const repository = new SupabaseTrackerRepository(supabase);
  const [tasks, problems] = await Promise.all([
    repository.listDailyTasks(user.id),
    repository.listProblems(user.id),
  ]);
  const todayKey = localDateKey(new Date(), profile.timezone);
  const reminders = buildReminders(profile, tasks, problems, todayKey, new Date());

  return (
    <AppShell
      displayName={profile.display_name || user.user_metadata.full_name || "DSA Learner"}
      email={user.email ?? ""}
      reminders={reminders}
    >
      {children}
    </AppShell>
  );
}
