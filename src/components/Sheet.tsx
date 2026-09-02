import { useEffect, useRef, type ReactNode } from "react";

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const previous = document.activeElement as HTMLElement | null;
    const firstField = panel.current?.querySelector<HTMLElement>(
      "input, select, textarea, button",
    );
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
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={panel}>
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
      </div>
    </div>
  );
}
