/**
 * DEMO DATA: fictional sample content for the research prototype.
 * Not an actual incident. Replaced by real data in Phases 9–14.
 */
import type { ReportStatus } from '@beacon/shared';

export const DEMO_STAFF = { fullName: 'MDRRMO Officer', role: 'MDRRMO Personnel' } as const;

export interface DemoReportRow {
  referenceNo: string;
  hazardCode: string;
  hazardName: string;
  barangay: string;
  dateTime: string;
  status: ReportStatus;
}

export const DEMO_REPORT_ROWS: DemoReportRow[] = [
  {
    referenceNo: 'BEA-2026-000123',
    hazardCode: 'landslide',
    hazardName: 'Landslide',
    barangay: 'Mantalongon',
    dateTime: 'Sep 28, 2026 · 4:35 PM',
    status: 'under_verification',
  },
];
