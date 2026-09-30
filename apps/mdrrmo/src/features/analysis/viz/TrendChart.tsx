import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { niceTicks } from './scale';

export interface TrendSeries {
  key: string;
  label: string;
  counts: number[];
  /** "accent" is the series the chart is about; "context" is drawn in gray behind it. */
  role: 'accent' | 'context';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HEIGHT = 260;
const PAD = { top: 16, right: 44, bottom: 30, left: 36 };

export function monthLabel(month: string, long = false): string {
  const [year, m] = month.split('-').map(Number);
  return `${MONTHS[m! - 1]}${long ? ` ${year}` : ''}`;
}

function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(320, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/**
 * Monthly recorded counts as lines on one axis, with an optional Sen's slope line
 * drawn over the data range only (never extended past the last month).
 * Pointer: a crosshair snaps to the nearest month. Keyboard: focus the chart and
 * use the arrow keys; the readout is announced.
 */
export function TrendChart({
  months,
  series,
  fit,
  caption,
}: {
  months: string[];
  series: TrendSeries[];
  fit: { start: number; end: number; label: string } | null;
  caption: string;
}) {
  const { ref, width } = useWidth(720);
  const [active, setActive] = useState<number | null>(null);
  const n = months.length;
  const max = Math.max(1, ...series.flatMap((s) => s.counts), fit?.start ?? 0, fit?.end ?? 0);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1]!;
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const labelEvery = n > 36 ? 6 : n > 18 ? 3 : n > 9 ? 2 : 1;
  // Context lines first so the accent line is drawn on top.
  const rank = (s: TrendSeries) => (s.role === 'context' ? 0 : 1);
  const ordered = [...series].sort((a, b) => rank(a) - rank(b));

  function nearest(event: PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * plotW;
    setActive(Math.max(0, Math.min(n - 1, Math.round((px / plotW) * (n - 1)))));
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
    if (event.key in moves) {
      event.preventDefault();
      setActive((i) => Math.max(0, Math.min(n - 1, (i ?? n) + moves[event.key]!)));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActive(event.key === 'Home' ? 0 : n - 1);
    } else if (event.key === 'Escape') {
      setActive(null);
    }
  }

  const readout =
    active === null
      ? ''
      : `${monthLabel(months[active]!, true)}: ${series
          .map((s) => `${s.label} ${s.counts[active]}`)
          .join(', ')}`;

  return (
    <div className="m-trend-chart">
      {series.length > 1 || fit ? (
        <ul className="m-chart-legend" aria-hidden="true">
          {series.map((s) => (
            <li key={s.key}>
              <span className="m-line-key" data-role={s.role} />
              {s.label}
            </li>
          ))}
          {fit && (
            <li>
              <span className="m-line-key" data-role="fit" />
              {fit.label}
            </li>
          )}
        </ul>
      ) : null}
      <div
        ref={ref}
        className="m-trend-chart__frame"
        tabIndex={0}
        role="group"
        aria-label={`${caption}. Use the left and right arrow keys to read each month.`}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <svg width={width} height={HEIGHT} aria-hidden="true" className="m-trend-chart__svg">
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className={t === 0 ? 'm-axis' : 'm-grid'}
              />
              <text x={PAD.left - 8} y={y(t)} className="m-tick" textAnchor="end" dy="0.32em">
                {t.toLocaleString('en-PH')}
              </text>
            </g>
          ))}
          {months.map((month, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text key={month} x={x(i)} y={HEIGHT - 8} className="m-tick" textAnchor="middle">
                {month.endsWith('-01') || i === 0 ? monthLabel(month, true) : monthLabel(month)}
              </text>
            ) : null,
          )}
          {fit && n > 1 && (
            <line
              x1={x(0)}
              x2={x(n - 1)}
              y1={y(fit.start)}
              y2={y(fit.end)}
              className="m-fit-line"
            />
          )}
          {ordered.map((s) => (
            <polyline
              key={s.key}
              points={s.counts.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              className="m-series-line"
              data-role={s.role}
            />
          ))}
          {ordered.map((s) => {
            const last = s.counts[n - 1] ?? 0;
            return (
              <g key={s.key}>
                <circle cx={x(n - 1)} cy={y(last)} r={4} className="m-dot" data-role={s.role} />
                {s.role === 'accent' && (
                  <text x={x(n - 1) + 10} y={y(last)} dy="0.32em" className="m-end-label">
                    {last}
                  </text>
                )}
              </g>
            );
          })}
          {active !== null && (
            <g>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                className="m-crosshair"
              />
              {ordered.map((s) => (
                <circle
                  key={s.key}
                  cx={x(active)}
                  cy={y(s.counts[active] ?? 0)}
                  r={4}
                  className="m-dot"
                  data-role={s.role}
                />
              ))}
            </g>
          )}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={nearest}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
        {active !== null && (
          <div
            className="m-tooltip"
            style={{
              left: Math.min(Math.max(x(active), 90), width - 90),
              top: PAD.top,
            }}
          >
            <div className="m-tooltip__title">{monthLabel(months[active]!, true)}</div>
            {[...series].reverse().map((s) => (
              <div key={s.key} className="m-tooltip__row">
                <span className="m-line-key" data-role={s.role} />
                <strong>{s.counts[active]}</strong>
                <span className="bcn-muted">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="bcn-visually-hidden" aria-live="polite">
        {readout}
      </p>
    </div>
  );
}
