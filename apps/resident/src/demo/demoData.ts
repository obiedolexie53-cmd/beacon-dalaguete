/**
 * DEMO DATA: fictional sample content for the research prototype.
 * Leona Legaspi and report BEA-2026-000123 are not real people or incidents.
 * Removed from screens once real data flows in (Phases 3–8).
 */
import type { ReportStatus } from '@beacon/shared';

export const DEMO_RESIDENT = {
  fullName: 'Leona Legaspi',
  firstName: 'Leona',
  role: 'Resident',
  municipality: 'Dalaguete',
  province: 'Cebu',
} as const;

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
