/** Primary geographic context for BEACON. */
export const MUNICIPALITY = 'Dalaguete';
export const PROVINCE = 'Cebu';

/**
 * DEMO map centre for Dalaguete (approximate town centre). Used only as the
 * default map view; never stored as a resident's location.
 */
export const DALAGUETE_DEMO_CENTER = { latitude: 9.7612, longitude: 123.5349 } as const;

/**
 * Generous box around Dalaguete, wider than the official boundary because GPS
 * near the border can drift. Mirrors SERVICE_AREA in backend/app/reports/validation.py.
 */
export const SERVICE_AREA = { minLat: 9.6, maxLat: 10.0, minLng: 123.3, maxLng: 123.7 } as const;

export function inServiceArea(latitude: number, longitude: number): boolean {
  return (
    latitude >= SERVICE_AREA.minLat &&
    latitude <= SERVICE_AREA.maxLat &&
    longitude >= SERVICE_AREA.minLng &&
    longitude <= SERVICE_AREA.maxLng
  );
}

/** OpenStreetMap tiles: no API key. Attribution must stay visible on every map. */
export const OSM_TILES = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
  maxZoom: 19,
} as const;

/** GPS readings less precise than this are flagged so the resident can adjust the pin. */
export const LOW_ACCURACY_METERS = 100;

/** Round to 6 decimal places (~0.1 m), matching the API's storage precision. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
