"use client";

import { useEffect } from "react";

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 3200);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  return <div className="toast" role="status" aria-live="polite">
    <span>✓</span>{message}<button onClick={onDismiss} aria-label="Dismiss notification">×</button>
  </div>;
}
