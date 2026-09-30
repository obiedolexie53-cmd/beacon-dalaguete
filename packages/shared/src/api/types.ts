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
  /** 'resident': submitted in the app. 'import': from MDRRMO records. */
  source: ReportSource;
}

export type ReportSource = 'resident' | 'import';

export interface StaffDashboard {
  counts: StaffStatusCounts;
  recent_reports: StaffReportRow[];
  include_demo: boolean;
  generated_at: string;
}

export interface StaffReportPage {
  items: StaffReportRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReporterInfo {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  barangay: Barangay | null;
}

export interface StaffTimelineEntry {
  status: ReportStatus;
  changed_at: string;
  by_role: 'resident' | 'mdrrmo';
  actor_name: string | null;
  note: string | null;
}

export interface StaffReportDetail extends StaffReportRow {
  description: string;
  municipality: string;
  province: string;
  landmark: string | null;
  latitude: string | null;
  longitude: string | null;
  location_accuracy_m: number | null;
  location_source: 'gps' | 'map_pin' | 'manual' | null;
  /** Null for records imported from MDRRMO files (they have no BEACON reporter). */
  reporter: ReporterInfo | null;
  external_ref: string | null;
  import_filename: string | null;
  timeline: StaffTimelineEntry[];
  media: MediaItem[];
  verified_at: string | null;
  verified_by: string | null;
  verification_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  allowed_actions: ReportStatus[];
}

export interface MapPoint {
  reference_no: string;
  latitude: string;
  longitude: string;
  location_accuracy_m: number | null;
  hazard_type: HazardType;
  other_hazard_text: string | null;
  barangay: Barangay | null;
  landmark: string | null;
  incident_date: string;
  incident_time: string | null;
  status: ReportStatus;
  is_demo: boolean;
  source: ReportSource;
}

export interface MapData {
  points: MapPoint[];
  without_location: number;
  truncated: boolean;
}

/** 4.1 Incident Data Analysis: descriptive counts of recorded incidents. */
export type AnalysisScope = 'confirmed' | 'all';

export interface IndexedCount {
  /** Month of year 1–12, hour 0–23, or ISO weekday 1 (Monday)–7 (Sunday). */
  key: number;
  count: number;
}

export interface IncidentAnalysis {
  filters: {
    scope: AnalysisScope;
    statuses: ReportStatus[];
    hazard: string | null;
    barangay_id: number | null;
    source: ReportSource | null;
    date_from: string | null;
    date_to: string | null;
    include_demo: boolean;
  };
  dataset: {
    total: number;
    from_app: number;
    imported: number;
    demo: number;
    with_coordinates: number;
    with_time: number;
    first_incident: string | null;
    last_incident: string | null;
  };
  by_hazard: Array<{ code: string; name: string; count: number; share: number }>;
  by_barangay: Array<{
    id: number;
    name: string;
    count: number;
    share: number;
    top_hazard: string;
    top_hazard_count: number;
  }>;
  without_barangay: number;
  /** Every month in the period ("YYYY-MM"), including months with no records. */
  by_month: Array<{ month: string; count: number }>;
  by_month_of_year: IndexedCount[];
  by_hour: IndexedCount[];
  unknown_time: number;
  by_weekday: IndexedCount[];
  hazard_by_barangay: Array<{ hazard: string; barangay_id: number; count: number }>;
  hazard_by_month_of_year: Array<{ hazard: string; month_of_year: number; count: number }>;
  generated_at: string;
}
