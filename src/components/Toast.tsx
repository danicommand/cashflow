interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  /** Accessible name for the dismiss control, in the reader's language. */
  closeLabel: string;
  durationMs: number;
}

/**
 * A brief, undoable acknowledgment of something that just happened.
 *
 * It exists so deleting a bill can be instant and reversible instead of
 * gated behind a native confirm dialog — the record is already a tombstone
 * the moment this appears, and "Undo" just clears it. The shrinking bar is
 * the only clock in the app that a person is meant to race; every other
 * timing in here is feedback, not a deadline.
 */
export function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
  closeLabel,
  durationMs,
}: ToastProps) {
  return (
    <div className="toast" role="status">
      <span className="toast-message">{message}</span>
      {actionLabel && onAction ? (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            onAction();
            onDismiss();
          }}
        >
          {actionLabel}
        </button>
      ) : null}
      <button type="button" className="toast-close" onClick={onDismiss} aria-label={closeLabel}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <span className="toast-timer" style={{ animationDuration: `${durationMs}ms` }} />
    </div>
  );
}
