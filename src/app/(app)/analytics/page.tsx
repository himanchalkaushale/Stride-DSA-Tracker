import { AnalyticsIcon } from "@/components/icons";

export const metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <div className="page-shell">
      <header className="page-heading"><div><span className="page-kicker">INSIGHTS</span><h1>Analytics</h1><p>Your practice patterns will become visible here.</p></div><button className="button button-quiet" disabled>Last 30 days</button></header>
      <section className="analytics-preview">
        <article className="panel chart-panel">
          <div className="panel-heading"><div><span>ACTIVITY</span><h2>Practice consistency</h2></div></div>
          <div className="empty-chart"><div className="chart-axis"><i/><i/><i/><i/></div><span><AnalyticsIcon /></span><b>Complete your first problem</b><small>Your weekly trend will appear here.</small></div>
        </article>
        <article className="panel coming-panel"><span>PHASE 4</span><h2>Balanced insights,<br />without the noise.</h2><p>Topic mastery, difficulty mix, solve time, review retention, and streaks will all live here.</p><div className="insight-list"><span>Activity heatmap <i>Planned</i></span><span>Topic mastery <i>Planned</i></span><span>Review retention <i>Planned</i></span></div></article>
      </section>
    </div>
  );
}
