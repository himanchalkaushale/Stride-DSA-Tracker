import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowIcon, CheckIcon, ClockIcon, FlameIcon, SparkIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("display_name,daily_target,active_topics").eq("id", user!.id).single();
  if (!profile) redirect("/onboarding");
  const firstName = profile.display_name.split(" ")[0];
  const date = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  return (
    <div className="page-shell today-page">
      <header className="page-heading">
        <div><span className="page-date">{date.toUpperCase()}</span><h1>Good morning, {firstName}.</h1><p>Your workspace is ready. The adaptive daily planner arrives in Phase 3.</p></div>
        <Link className="button button-quiet" href="/problems">Explore roadmap <ArrowIcon /></Link>
      </header>
      <section className="welcome-banner">
        <div className="welcome-icon"><SparkIcon /></div>
        <div><span>FOUNDATION COMPLETE</span><h2>Your DSA system starts here.</h2><p>Choose a roadmap problem to begin building your backlog in the next phase.</p></div>
        <span className="readiness"><b>1</b><small>of 4 phases</small></span>
      </section>
      <section className="metric-grid">
        <article><span className="metric-icon green"><CheckIcon /></span><div><small>Today&apos;s goal</small><strong>0 <em>/ {profile.daily_target}</em></strong></div><span className="metric-trend">Ready</span></article>
        <article><span className="metric-icon orange"><FlameIcon /></span><div><small>Current streak</small><strong>0 <em>days</em></strong></div><span className="metric-trend neutral">Fresh start</span></article>
        <article><span className="metric-icon blue"><ClockIcon /></span><div><small>Study time</small><strong>0 <em>min</em></strong></div><span className="metric-trend neutral">This week</span></article>
      </section>
      <div className="dashboard-grid">
        <section className="panel today-queue">
          <div className="panel-heading"><div><span>TODAY&apos;S QUEUE</span><h2>Build your momentum</h2></div><small>0 of {profile.daily_target} complete</small></div>
          <div className="empty-state compact">
            <span className="empty-orbit"><SparkIcon /></span>
            <h3>Your first queue is coming soon</h3>
            <p>For now, explore the curated roadmap and get familiar with your workspace.</p>
            <Link className="button button-primary" href="/problems">Browse problems <ArrowIcon /></Link>
          </div>
        </section>
        <aside className="panel focus-card">
          <span>YOUR FOCUS</span>
          <h2>{profile.active_topics.slice(0, 3).join(" · ")}</h2>
          <p>Your selected topics will guide adaptive recommendations and mastery insights.</p>
          <div className="focus-bars">{profile.active_topics.slice(0, 4).map((topic, i) => <div key={topic}><span>{topic}</span><i><b style={{width: `${18 + i * 5}%`}} /></i><small>New</small></div>)}</div>
        </aside>
      </div>
    </div>
  );
}
