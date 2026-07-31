import { redirect } from "next/navigation";
import { CheckIcon, LogoIcon } from "@/components/icons";
import { TOPICS, LANGUAGES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { completeOnboarding } from "./actions";
import { ThemeMenu } from "@/components/theme-control";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!isSupabaseConfigured) redirect("/auth?error=Supabase+is+not+configured");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("onboarding_complete").eq("id", user.id).maybeSingle();
  if (profile?.onboarding_complete) redirect("/today");
  const { error } = await searchParams;
  const setupError = profileError?.code === "PGRST205"
    ? "Database setup is incomplete. Apply the Supabase migrations before creating your workspace."
    : undefined;

  return (
    <main className="onboarding-page">
      <header><span className="brand"><span><LogoIcon /></span>stride</span><div className="onboarding-top-actions"><small>SET UP YOUR WORKSPACE</small><ThemeMenu /></div></header>
      <form action={completeOnboarding} className="onboarding-card">
        <div className="step-label">01 <span /> 03</div>
        <h1>Make it yours.</h1>
        <p>We&apos;ll use these preferences to shape your daily practice plan.</p>
        {(error || setupError) && <p className="form-message error">{error ?? setupError}</p>}
        <div className="form-grid">
          <label className="field"><span>What should we call you?</span><input name="displayName" defaultValue={user.user_metadata.full_name ?? ""} placeholder="Your name" required minLength={2} /></label>
          <label className="field"><span>Daily problem target</span><select name="dailyTarget" defaultValue="2"><option value="1">1 problem</option><option value="2">2 problems</option><option value="3">3 problems</option><option value="4">4 problems</option><option value="5">5 problems</option></select></label>
          <input type="hidden" name="timezone" value="Asia/Calcutta" />
        </div>
        <fieldset>
          <legend>Preferred coding languages</legend>
          <div className="choice-grid small">{LANGUAGES.map((language, index) => <label key={language}><input type="checkbox" name="languages" value={language} defaultChecked={index < 2} /><span><CheckIcon />{language}</span></label>)}</div>
        </fieldset>
        <fieldset>
          <legend>Topics to focus on</legend>
          <div className="choice-grid">{TOPICS.map((topic, index) => <label key={topic}><input type="checkbox" name="topics" value={topic} defaultChecked={index < 8} /><span><CheckIcon />{topic}</span></label>)}</div>
        </fieldset>
        <div className="form-grid">
          <label className="field"><span>Starting difficulty</span><select name="difficultyMin" defaultValue="easy"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
          <label className="field"><span>Maximum difficulty</span><select name="difficultyMax" defaultValue="hard"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
        </div>
        <button className="button button-primary onboarding-submit" disabled={Boolean(setupError)}>Create my workspace</button>
      </form>
    </main>
  );
}
