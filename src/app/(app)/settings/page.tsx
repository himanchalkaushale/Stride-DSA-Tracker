import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
  if (!profile) redirect("/onboarding");
  return (
    <div className="page-shell settings-page">
      <header className="page-heading"><div><span className="page-kicker">PREFERENCES</span><h1>Settings</h1><p>Shape Stride around the way you practice.</p></div></header>
      <section className="panel settings-panel">
        <div className="settings-section"><div><h2>Profile</h2><p>Your personal workspace identity.</p></div><div className="settings-fields"><label><span>Display name</span><input value={profile.display_name} readOnly /></label><label><span>Email</span><input value={user!.email ?? ""} readOnly /></label></div></div>
        <div className="settings-section"><div><h2>Practice plan</h2><p>Used by the adaptive planner in Phase 3.</p></div><div className="settings-fields two"><label><span>Daily target</span><input value={`${profile.daily_target} problems`} readOnly /></label><label><span>Timezone</span><input value={profile.timezone} readOnly /></label></div></div>
        <div className="settings-section"><div><h2>Focus topics</h2><p>Your current learning priorities.</p></div><div className="tag-list">{profile.active_topics.map((topic) => <span key={topic}>{topic}</span>)}</div></div>
        <div className="settings-notice">Editing preferences will be enabled alongside the adaptive planner in Phase 3.</div>
      </section>
    </div>
  );
}
