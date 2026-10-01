import { OTHER_HAZARD_CODE, type ReportCreateRequest } from '@beacon/shared';
import type { ReportDraft } from '../draft/draft';

/** Map a finished draft to the API request body. */
export function buildReportRequest(draft: ReportDraft): ReportCreateRequest {
  const hasPin = draft.latitude !== null && draft.longitude !== null;
  return {
    client_request_id: draft.clientRequestId,
    hazard_type_id: draft.hazardTypeId!,
    other_hazard_text:
      draft.hazardCode === OTHER_HAZARD_CODE ? draft.otherHazardText.trim() || null : null,
    description: draft.description.trim(),
    incident_date: draft.incidentDate,
    incident_time: draft.incidentTime || null,
    barangay_id: draft.barangayId!,
    landmark: draft.landmark.trim() || null,
    latitude: hasPin ? draft.latitude!.toFixed(6) : null,
    longitude: hasPin ? draft.longitude!.toFixed(6) : null,
    location_accuracy_m: hasPin ? draft.locationAccuracyM : null,
    location_source: hasPin ? draft.locationSource : null,
  };
}

/** Which wizard step owns an API field, so errors can link back to it. */
export const FIELD_STEPS: Record<string, { path: string; label: string }> = {
  hazard_type_id: { path: '/report/new/hazard', label: 'Hazard type' },
  other_hazard_text: { path: '/report/new/hazard', label: 'Hazard type' },
  description: { path: '/report/new/details', label: 'Incident details' },
  incident_date: { path: '/report/new/details', label: 'Incident details' },
  incident_time: { path: '/report/new/details', label: 'Incident details' },
  barangay_id: { path: '/report/new/location', label: 'Location' },
  landmark: { path: '/report/new/location', label: 'Location' },
  latitude: { path: '/report/new/location', label: 'Location' },
  longitude: { path: '/report/new/location', label: 'Location' },
  request: { path: '/report/new/location', label: 'Location' },
};
