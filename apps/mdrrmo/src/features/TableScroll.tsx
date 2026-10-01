import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Horizontal scroll area for wide tables. When the table is wider than the
 * screen, the area becomes a labelled, focusable region so keyboard users can
 * scroll it with the arrow keys (WCAG 2.1.1).
 */
export function TableScroll({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const check = () => setScrollable(el.scrollWidth > el.clientWidth + 1);
    const observer = new ResizeObserver(check);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    check();
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="m-table-wrap"
      {...(scrollable
        ? { tabIndex: 0, role: 'region', 'aria-label': `${label} (scrolls sideways)` }
        : {})}
    >
      {children}
    </div>
  );
}
