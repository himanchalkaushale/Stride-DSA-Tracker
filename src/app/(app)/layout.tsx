import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { buildReminders } from "@/lib/analytics";
import { localDateKey } from "@/lib/planner";
import { SetupRequired } from "@/components/setup-required";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAppContext, getCurrentProblems, getCurrentTasks } from "@/lib/server-data";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) return <SetupRequired />;

  const { user, profile } = await getAppContext();
  if (!user) redirect("/auth");
  if (!profile?.onboarding_complete) redirect("/onboarding");
  const [tasks, problems] = await Promise.all([
    getCurrentTasks(),
    getCurrentProblems(),
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
