/**
 * DEMO DATA: fictional sample content for the research prototype.
 * Report BEA-2026-000123 is not a real incident. Shown until real reports
 * flow in (Phases 5–8).
 */
import type { ReportStatus } from '@beacon/shared';

export interface DemoReportSummary {
  referenceNo: string;
  hazardCode: string;
  hazardName: string;
  barangay: string;
  incidentDate: string;
  incidentTime: string;
  status: ReportStatus;
}

export const DEMO_REPORT: DemoReportSummary = {
  referenceNo: 'BEA-2026-000123',
  hazardCode: 'landslide',
  hazardName: 'Landslide',
  barangay: 'Mantalongon',
  incidentDate: 'September 28, 2026',
  incidentTime: '4:35 PM',
  status: 'under_verification',
};
