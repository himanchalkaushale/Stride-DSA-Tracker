import { redirect } from "next/navigation";
import { PlannerSettings } from "@/components/planner-settings";
import { getAppContext } from "@/lib/server-data";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, profile } = await getAppContext();
  if (!user) return null;
  if (!profile) redirect("/onboarding");
  return (
    <div className="page-shell settings-page">
      <header className="page-heading"><div><span className="page-kicker">PREFERENCES</span><h1>Settings</h1><p>Set your practice preferences and daily target.</p></div></header>
      <PlannerSettings userId={user.id} email={user.email ?? ""} initialProfile={profile} />
    </div>
  );
}
