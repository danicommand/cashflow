import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

const FOCUSABLE = "a[href], button, input, select, textarea, [tabindex]";

function focusableElements(panel: HTMLDivElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.hasAttribute("disabled") &&
      !element.classList.contains("focus-guard"),
  );
}

function focusEdge(panel: HTMLDivElement | null, edge: "first" | "last") {
  const focusable = panel ? focusableElements(panel) : [];
  if (!focusable.length) {
    panel?.focus();
    return;
  }
  focusable[edge === "first" ? 0 : focusable.length - 1].focus();
}

interface SheetProps {
  title: string;
  /** Accessible name for the close control, in the reader's language. */
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * The one dialog shell: a centred card on a wide screen, a sheet rising from
 * the bottom edge on a phone. Escape closes it, a click on the backdrop closes
 * it, and focus moves inside on open so a keyboard is not left behind the
 * overlay.
 */
export function Sheet({ title, closeLabel, onClose, children, footer }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);

  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !panel.current) return;
    const focusable = focusableElements(panel.current);
    if (!focusable.length) {
      event.preventDefault();
      panel.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && event.target === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && event.target === last) {
      event.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const previous = document.activeElement as HTMLElement | null;
    const firstField =
      panel.current?.querySelector<HTMLElement>("input, select, textarea") ??
      panel.current?.querySelector<HTMLElement>("button");
    firstField?.focus();

    // The page behind must not scroll while a sheet is open, or a phone
    // scrolls the list instead of the form. Hiding the overflow also removes
    // the scrollbar, and on a desktop with classic scrollbars that widens the
    // viewport and shunts the whole page sideways as the sheet opens — so the
    // width it took back is handed straight to the padding.
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (gutter > 0) document.body.style.paddingRight = `${gutter}px`;

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panel}
        tabIndex={-1}
        onKeyDown={trapFocus}
      >
        <span
          className="focus-guard"
          tabIndex={0}
          onFocus={() => focusEdge(panel.current, "last")}
        />
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={closeLabel}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer ? <footer className="sheet-foot">{footer}</footer> : null}
        <span
          className="focus-guard"
          tabIndex={0}
          onFocus={() => focusEdge(panel.current, "first")}
        />
      </div>
    </div>
  );
}
