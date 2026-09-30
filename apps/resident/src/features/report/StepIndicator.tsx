import { REPORT_STEPS } from './steps';

export function StepIndicator({ current }: { current: number }) {
  const total = REPORT_STEPS.length;
  return (
    <div className="r-steps-progress">
      <div className="r-steps-progress__label">
        <span>
          Step {current + 1} of {total}
        </span>
        <span className="bcn-muted">{REPORT_STEPS[current]?.title}</span>
      </div>
      <div
        className="r-steps-progress__bar"
        role="progressbar"
        aria-label="Report progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current + 1}
        aria-valuetext={`Step ${current + 1} of ${total}: ${REPORT_STEPS[current]?.title}`}
      >
        {REPORT_STEPS.map((step, index) => (
          <span
            key={step.path}
            className={index <= current ? 'r-steps-progress__seg is-done' : 'r-steps-progress__seg'}
          />
        ))}
      </div>
    </div>
  );
}
