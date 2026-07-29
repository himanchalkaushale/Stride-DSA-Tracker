import Link from "next/link";
import { ArrowIcon, CheckIcon, LogoIcon, SparkIcon } from "@/components/icons";

const features = [
  "Your own daily question plan",
  "Code, notes, and solution history",
  "Topic mastery and streak analytics",
];

export default function LandingPage() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <Link href="/" className="brand"><span><LogoIcon /></span>stride</Link>
        <Link href="/auth" className="button button-quiet">Sign in</Link>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><SparkIcon /> Your interview practice, organized</span>
          <h1>Build the habit.<br /><em>Master the patterns.</em></h1>
          <p>Stride turns scattered problem solving into a focused daily system—so you always know what to solve, revisit, and improve next.</p>
          <div className="hero-actions">
            <Link href="/auth" className="button button-primary">Start tracking <ArrowIcon /></Link>
            <span>Free for personal use</span>
          </div>
          <ul>{features.map((feature) => <li key={feature}><CheckIcon />{feature}</li>)}</ul>
        </div>
        <div className="hero-preview" aria-label="Dashboard preview">
          <div className="preview-glow" />
          <div className="preview-window">
            <div className="preview-top"><span className="preview-brand"><LogoIcon /></span><span /><i /><i /><b>HK</b></div>
            <div className="preview-body">
              <aside><i /><i /><i /><i /></aside>
              <div className="preview-main">
                <small>TUESDAY, JULY 28</small>
                <h3>Good morning, Himanshu</h3>
                <div className="preview-focus"><span><b>2</b><small>problems today</small></span><span className="ring">75%</span></div>
                <div className="preview-cards">
                  <div><span className="difficulty easy">Easy</span><b>Two Sum</b><small>Arrays · Hashing</small></div>
                  <div><span className="difficulty medium">Medium</span><b>Longest Substring</b><small>Sliding Window</small></div>
                </div>
                <div className="preview-chart"><span style={{height:"32%"}}/><span style={{height:"55%"}}/><span style={{height:"42%"}}/><span style={{height:"72%"}}/><span style={{height:"60%"}}/><span style={{height:"88%"}}/><span style={{height:"74%"}}/></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
