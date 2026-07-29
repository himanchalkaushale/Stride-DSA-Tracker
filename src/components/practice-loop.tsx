import Link from "next/link";
import { ArrowIcon } from "@/components/icons";

const practiceSteps = [
  {
    number: "01",
    label: "Plan",
    detail: "Build a focused practice queue.",
    icon: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M22 12h-3" /></>,
  },
  {
    number: "02",
    label: "Solve",
    detail: "Work through problems in context.",
    icon: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /></>,
  },
  {
    number: "03",
    label: "Reflect",
    detail: "Capture patterns and mistakes.",
    icon: <><path d="M9 18h6M10 22h4M8.5 15.5A7 7 0 1 1 15.5 15.5c-1 .7-1.5 1.3-1.5 2.5h-4c0-1.2-.5-1.8-1.5-2.5Z" /></>,
  },
  {
    number: "04",
    label: "Review",
    detail: "Revisit ideas before they fade.",
    icon: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 8a7 7 0 0 1 11.7-2.1L20 8M4 16l2.2 2.1A7 7 0 0 0 17.9 16" /></>,
  },
  {
    number: "05",
    label: "Improve",
    detail: "Adapt the next practice cycle.",
    icon: <><path d="m4 17 5-5 4 4 7-9" /><path d="M15 7h5v5" /></>,
  },
];

export function PracticeLoop() {
  return (
    <section className="lp-loop" id="workflow" aria-labelledby="loop-title">
      <div className="lp-section-heading">
        <div className="lp-loop-visual-column">
          <p className="lp-kicker">The practice loop</p>
          <div className="lp-loop-orbit" aria-hidden="true">
            <svg className="lp-orbit-paths" viewBox="0 0 360 350">
              <defs>
                <marker id="loop-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" />
                </marker>
              </defs>
              <path d="M205 48 Q277 65 307 113" />
              <path d="M327 164 Q322 236 283 276" />
              <path d="M240 310 Q180 336 120 310" />
              <path d="M77 276 Q38 236 33 164" />
              <path d="M53 113 Q83 65 155 48" />
            </svg>
            <span className="lp-orbit-pulse" />
            <span className="lp-orbit-core"><b>5</b><small>STAGES<br />ONE LOOP</small></span>
            {practiceSteps.map((step, index) => (
              <span className={`lp-orbit-node lp-orbit-node-${index + 1}`} key={step.number}>
                <i>{step.number}</i>
                <strong>{step.label}</strong>
              </span>
            ))}
          </div>
        </div>
        <div className="lp-loop-intro">
          <h2 id="loop-title">
            More than a problem counter.<br />
            A system for <span>getting better.</span>
          </h2>
          <Link href="/auth/create-account" className="lp-loop-cta">
            Build your practice loop <ArrowIcon />
          </Link>
        </div>
      </div>

      <ol
        className="lp-loop-grid"
        aria-label="The five stages of deliberate practice"
      >
        {practiceSteps.map((step, index) => (
            <li key={step.number}>
              <input
                className="lp-step-control"
                type="radio"
                id={`practice-step-${index + 1}`}
                name="practice-step"
                defaultChecked={index === 0}
                aria-label={`${step.number}, ${step.label}: ${step.detail}`}
              />
              <label htmlFor={`practice-step-${index + 1}`}>
                <span className="lp-step-dot" aria-hidden="true" />
                <span className="lp-step-number">{step.number}</span>
                <span className="lp-step-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    {step.icon}
                  </svg>
                </span>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </label>
            </li>
          ))}
      </ol>
    </section>
  );
}
