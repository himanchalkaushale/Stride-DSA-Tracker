"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="empty-state page-error">
      <span>Couldn&apos;t load your workspace</span>
      <h2>Your data is safe.</h2>
      <p>Check your connection and try loading this page again.</p>
      <button className="button button-primary" onClick={reset}>Try again</button>
    </div>
  );
}
