import Image from "next/image";
import Link from "next/link";
import {
  ArrowIcon,
  CheckIcon,
  ClockIcon,
  LogoIcon,
  ProblemsIcon,
  SparkIcon,
  TodayIcon,
} from "@/components/icons";
import { PracticeLoop } from "@/components/practice-loop";
import analyticsImage from "../../docs/images/stride-analytics.png";

function Brand() {
  return (
    <Link href="/" className="lp-brand" aria-label="Stride home">
      <span><LogoIcon /></span>stride
    </Link>
  );
}

function AccountLink({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Link href="/auth/create-account" className={`lp-button lp-button-primary ${className}`}>
      {children}<ArrowIcon />
    </Link>
  );
}

export default function LandingPage() {
  return (
    <main className="lp">
      <header className="lp-header">
        <nav className="lp-nav" aria-label="Main navigation">
          <Brand />
          <div className="lp-nav-links">
            <a href="#product">Product</a>
            <a href="#workflow">Workflow</a>
          </div>
          <div className="lp-nav-actions"><Link href="/auth" className="lp-sign-in">Sign in <ArrowIcon /></Link></div>
        </nav>
      </header>

      <section className="lp-hero" id="product">
        <div className="lp-hero-copy">
          <p className="lp-kicker"><SparkIcon /> A practice system for serious candidates</p>
          <h1>Practice that<span>compounds.</span></h1>
          <p className="lp-hero-intro">
            Stride turns interview prep into a deliberate daily loop—so every problem
            you solve makes the next session sharper.
          </p>
          <div className="lp-hero-actions">
            <AccountLink>Create your workspace</AccountLink>
            <a href="#workflow" className="lp-text-link">See how it works <span>↓</span></a>
          </div>
          <div className="lp-hero-note"><span>Free for personal use</span><span>No credit card</span></div>
        </div>

        <div className="lp-hero-visual" aria-label="Stride analytics dashboard preview">
          <div className="lp-window">
            <div className="lp-window-bar"><i /><i /><i /><span>stride / analytics</span></div>
            <div className="lp-window-image">
              <Image
                src={analyticsImage}
                alt="Stride analytics dashboard showing daily momentum, consistency, topic mastery, and confidence"
                priority
                sizes="(max-width: 760px) 92vw, (max-width: 1100px) 82vw, 760px"
              />
            </div>
          </div>
          <div className="lp-float-card lp-float-card-top" aria-hidden="true">
            <small>REVIEW RETENTION</small><strong>100%</strong><span><i /> On schedule</span>
          </div>
          <div className="lp-float-card lp-float-card-bottom" aria-hidden="true">
            <small>DAILY MOMENTUM</small>
            <div className="lp-mini-bars">
              {[45, 72, 51, 88, 67, 96, 79].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
            </div>
          </div>
        </div>
        <div className="lp-scroll-cue" aria-hidden="true"><span /> Scroll to explore</div>
      </section>

      <PracticeLoop />

      <section className="lp-feature lp-feature-plan" aria-labelledby="plan-title">
        <div className="lp-feature-copy">
          <p className="lp-index">01 / DAILY DIRECTION</p>
          <h2 id="plan-title">Open Stride.<br />Know what’s next.</h2>
          <p>
            Your daily queue balances new problems with reviews that are actually due.
            Change the pace, choose your topics, and keep the plan realistic.
          </p>
          <ul className="lp-check-list">
            <li><CheckIcon /> Adaptive daily question queue</li>
            <li><CheckIcon /> Difficulty and topic controls</li>
            <li><CheckIcon /> CSV plan import when you need it</li>
          </ul>
        </div>
        <div className="lp-plan-ui" aria-label="Example daily practice queue">
          <div className="lp-ui-top"><span><TodayIcon /> Today’s plan</span><small>TUESDAY · 28 JUL</small></div>
          <div className="lp-plan-summary">
            <div><small>READY TO PRACTICE</small><strong>3 questions</strong></div>
            <div className="lp-plan-ring"><span>68%</span></div>
          </div>
          <div className="lp-queue">
            <article><span className="lp-status lp-status-new">NEW</span><div><strong>Longest Substring</strong><small>Sliding window · Medium</small></div><ArrowIcon /></article>
            <article><span className="lp-status lp-status-review">REVIEW</span><div><strong>Two Sum</strong><small>Hash map · 2 days ago</small></div><ArrowIcon /></article>
            <article><span className="lp-status lp-status-review">REVIEW</span><div><strong>Merge Intervals</strong><small>Intervals · 5 days ago</small></div><ArrowIcon /></article>
          </div>
        </div>
      </section>

      <section className="lp-feature lp-feature-workspace" aria-labelledby="workspace-title">
        <div className="lp-code-ui" aria-label="Example coding and reflection workspace">
          <div className="lp-code-head">
            <span><ProblemsIcon /> Longest Substring Without Repeating Characters</span>
            <span className="lp-saved"><i /> Saved to cloud</span>
          </div>
          <div className="lp-code-body">
            <div className="lp-code-lines" aria-hidden="true">
              <code><b>01</b><span><em>function</em> lengthOfLongestSubstring(s) {"{"}</span></code>
              <code><b>02</b><span>  <em>let</em> left = 0;</span></code>
              <code><b>03</b><span>  <em>let</em> best = 0;</span></code>
              <code><b>04</b><span>  <em>const</em> seen = <i>new</i> Map();</span></code>
              <code><b>05</b><span> </span></code>
              <code><b>06</b><span>  <em>for</em> (<em>let</em> right = 0; right &lt; s.length; right++) {"{"}</span></code>
              <code><b>07</b><span>    <i>{"// move the window, not the work"}</i></span></code>
              <code><b>08</b><span>  {"}"}</span></code>
              <code><b>09</b><span>{"}"}</span></code>
            </div>
            <div className="lp-reflection">
              <small>CORE IDEA</small>
              <p>Maintain a window with unique characters. When a duplicate appears, advance the left edge past its last index.</p>
              <div><ClockIcon /><span><small>TIME SPENT</small><strong>24 min</strong></span></div>
            </div>
          </div>
        </div>
        <div className="lp-feature-copy">
          <p className="lp-index">02 / DEEPER PRACTICE</p>
          <h2 id="workspace-title">Keep the code.<br />Capture the thinking.</h2>
          <p>
            A solution is useful. The idea behind it is what transfers. Work in one
            focused space, then record the insight you want to remember next time.
          </p>
          <blockquote>“The reflection is where a solved problem becomes a reusable pattern.”</blockquote>
        </div>
      </section>

      <section className="lp-review" aria-labelledby="review-title">
        <div className="lp-review-heading">
          <p className="lp-index">03 / SPACED REVIEW</p>
          <h2 id="review-title">Don’t just solve it.<br /><span>Make it stick.</span></h2>
          <p>Stride schedules the return while the solution is still fresh. Confidence and performance shape what comes back next.</p>
        </div>
        <div className="lp-review-track" aria-label="Example spaced review timeline">
          <div className="lp-review-line" />
          <article className="is-complete"><span><CheckIcon /></span><small>DAY 0</small><strong>Solved</strong></article>
          <article className="is-complete"><span><CheckIcon /></span><small>DAY 2</small><strong>First review</strong></article>
          <article className="is-current"><span>3</span><small>DAY 7</small><strong>Recall check</strong></article>
          <article><span>4</span><small>DAY 21</small><strong>Mastery review</strong></article>
        </div>
      </section>

      <section className="lp-closing" aria-labelledby="closing-title">
        <LogoIcon />
        <p>YOUR NEXT SESSION STARTS HERE</p>
        <h2 id="closing-title">Stop collecting problems.<br /><span>Start building mastery.</span></h2>
        <AccountLink className="lp-button-large">Create your free workspace</AccountLink>
        <small>Free for personal use · Set up in under two minutes</small>
      </section>

      <footer className="lp-footer">
        <Brand />
        <p>A deliberate practice system for technical interviews.</p>
        <div><a href="#product">Product</a><a href="#workflow">Workflow</a><Link href="/auth">Sign in</Link></div>
        <small>© {new Date().getFullYear()} Stride</small>
      </footer>
    </main>
  );
}
