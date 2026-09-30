import type { ReportStatus } from '../reportStatus';

export type UserRole = 'resident' | 'mdrrmo' | 'admin';

export interface Barangay {
  id: number;
  name: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  barangay: Barangay | null;
  is_demo: boolean;
}

export interface SessionResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: UserProfile;
}

export interface RegisterRequest {
  full_name: string;
  email: string | null;
  phone: string | null;
  barangay_id: number;
  password: string;
  privacy_consent: boolean;
}

export interface HazardType {
  id: number;
  code: string;
  name: string;
}

export interface ReportSummary {
  id: string;
  reference_no: string;
  hazard_type: HazardType;
  other_hazard_text: string | null;
  barangay: Barangay | null;
  /** Local incident date, YYYY-MM-DD */
  incident_date: string;
  /** Local incident time, HH:MM:SS */
  incident_time: string | null;
  status: ReportStatus;
  submitted_at: string;
  is_demo: boolean;
}

export interface StatusCounts {
  total: number;
  submitted: number;
  under_verification: number;
  needs_clarification: number;
  verified: number;
  resolved: number;
}

export interface ResidentDashboard {
  counts: StatusCounts;
  recent_reports: ReportSummary[];
}

export interface ReportPage {
  items: ReportSummary[];
  total: number;
}
