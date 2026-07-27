"use client";

import Link from "next/link";

export default function AuthError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="center-state">
      <span>Something went wrong</span>
      <h1>We couldn&apos;t complete sign in.</h1>
      <p>Try again, or return to the homepage and start a new session.</p>
      <div><button className="button button-primary" onClick={reset}>Try again</button><Link className="button button-quiet" href="/">Go home</Link></div>
    </main>
  );
}
