import { REPORT_STATUS_LABELS, type ReportStatus } from '@beacon/shared';
import {
  CircleCheckBig,
  CircleHelp,
  Search,
  Send,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { Badge, type BadgeTone } from './Badge';

/** Each status has its own colour and icon, so it is never conveyed by colour alone. */
const STATUS_STYLE: Record<ReportStatus, { tone: BadgeTone; Icon: LucideIcon }> = {
  submitted: { tone: 'neutral', Icon: Send },
  under_verification: { tone: 'info', Icon: Search },
  needs_clarification: { tone: 'warning', Icon: CircleHelp },
  verified: { tone: 'success', Icon: ShieldCheck },
  resolved: { tone: 'resolved', Icon: CircleCheckBig },
};

/** The icon that stands for each status (badges, map markers, legends). */
export function statusIconFor(status: ReportStatus): LucideIcon {
  return STATUS_STYLE[status].Icon;
}

export function StatusBadge({ status }: { status: ReportStatus }) {
  const { tone, Icon } = STATUS_STYLE[status];
  return (
    <Badge tone={tone} icon={<Icon size={14} aria-hidden="true" />}>
      {REPORT_STATUS_LABELS[status]}
    </Badge>
  );
}
