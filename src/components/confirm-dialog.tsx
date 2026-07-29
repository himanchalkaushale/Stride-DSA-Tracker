"use client";

import { useEffect } from "react";

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Remove",
  busy = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [busy, onCancel]);

  return (
    <div className="modal-backdrop confirm-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
      <section className="panel confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
        <span className="confirm-icon" aria-hidden="true">!</span>
        <div className="confirm-copy">
          <span className="page-kicker">PLEASE CONFIRM</span>
          <h2 id="confirm-title">{title}</h2>
          <p id="confirm-description">{description}</p>
        </div>
        <div className="confirm-actions">
          <button className="button button-quiet" type="button" disabled={busy} onClick={onCancel}>Cancel</button>
          <button className="button button-danger" type="button" disabled={busy} onClick={onConfirm}>{busy ? "Removing…" : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
