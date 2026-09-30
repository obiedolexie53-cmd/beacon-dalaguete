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

export interface MediaItem {
  id: string;
  kind: 'photo' | 'video';
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  uploaded_at: string;
  /** Short-lived signed link; fetch the report again for a fresh one. */
  url: string;
}

export interface TimelineEntry {
  status: ReportStatus;
  changed_at: string;
  by: 'you' | 'mdrrmo';
  note: string | null;
}

export interface ReportDetail extends ReportSummary {
  description: string;
  municipality: string;
  province: string;
  landmark: string | null;
  latitude: string | null;
  longitude: string | null;
  location_accuracy_m: number | null;
  location_source: 'gps' | 'map_pin' | 'manual' | null;
  timeline: TimelineEntry[];
  media: MediaItem[];
  evidence_open: boolean;
}

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  report_reference_no: string | null;
  read: boolean;
  created_at: string;
}

export interface NotificationList {
  items: NotificationItem[];
  unread: number;
}

export interface ReportCreateRequest {
  client_request_id: string;
  hazard_type_id: number;
  other_hazard_text: string | null;
  description: string;
  incident_date: string;
  incident_time: string | null;
  barangay_id: number;
  landmark: string | null;
  latitude: string | null;
  longitude: string | null;
  location_accuracy_m: number | null;
  location_source: 'gps' | 'map_pin' | null;
}

/** MDRRMO console */
export interface StaffStatusCounts {
  total: number;
  new: number;
  under_verification: number;
  needs_clarification: number;
  verified: number;
  resolved: number;
}

export interface StaffReportRow {
  id: string;
  reference_no: string;
  hazard_type: HazardType;
  other_hazard_text: string | null;
  barangay: Barangay | null;
  incident_date: string;
  incident_time: string | null;
  submitted_at: string;
  status: ReportStatus;
  is_demo: boolean;
}

export interface StaffDashboard {
  counts: StaffStatusCounts;
  recent_reports: StaffReportRow[];
  include_demo: boolean;
  generated_at: string;
}
