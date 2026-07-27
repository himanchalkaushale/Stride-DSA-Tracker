import { ProblemsIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Problems" };

export default async function ProblemsPage() {
  const supabase = await createClient();
  const { data: problems } = await supabase.from("problems").select("*").eq("is_curated", true).limit(12);
  return (
    <div className="page-shell">
      <header className="page-heading">
        <div><span className="page-kicker">CURATED ROADMAP</span><h1>Problem library</h1><p>A balanced path through the patterns that matter most.</p></div>
        <button className="button button-primary" disabled>+ Add problem <small>Phase 2</small></button>
      </header>
      <div className="library-toolbar"><div className="search-placeholder">⌕ Search problems…</div><button>All topics</button><button>All difficulties</button><button>Status</button></div>
      {!problems?.length ? (
        <div className="panel empty-state"><span className="empty-orbit"><ProblemsIcon /></span><h2>Run the seed migration</h2><p>The curated roadmap appears here after applying <code>supabase/migrations/0001_phase_one.sql</code>.</p></div>
      ) : (
        <section className="problem-table panel">
          <div className="problem-row table-head"><span>Problem</span><span>Topic</span><span>Difficulty</span><span>Est. time</span></div>
          {problems.map((problem) => <div className="problem-row" key={problem.id}><span><i>○</i><b>{problem.title}</b></span><span>{problem.topics.slice(0,2).join(" · ")}</span><span><em className={`difficulty ${problem.difficulty}`}>{problem.difficulty}</em></span><span>{problem.estimated_minutes} min</span></div>)}
        </section>
      )}
    </div>
  );
}
