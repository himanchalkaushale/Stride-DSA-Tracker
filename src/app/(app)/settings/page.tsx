import { redirect } from "next/navigation";
import { PlannerSettings } from "@/components/planner-settings";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/onboarding");
  return (
    <div className="page-shell settings-page">
      <header className="page-heading"><div><span className="page-kicker">PREFERENCES</span><h1>Settings</h1><p>Shape the adaptive plan around the way you practice.</p></div></header>
      <PlannerSettings userId={user.id} email={user.email ?? ""} initialProfile={profile} />
    </div>
  );
}
