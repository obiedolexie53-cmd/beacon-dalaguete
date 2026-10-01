/**
 * Default hazard types.
 *
 * Hazard types are stored in the database (`hazard_types` table) so the MDRRMO
 * can add new ones without a code change. This list is the initial seed and
 * mirrors backend/seeds/hazard_types.py. `other` covers incidents outside the
 * predefined categories.
 */
export interface HazardTypeSeed {
  code: string;
  name: string;
}

export const DEFAULT_HAZARD_TYPES: readonly HazardTypeSeed[] = [
  { code: 'flood', name: 'Flood' },
  { code: 'landslide', name: 'Landslide' },
  { code: 'earthquake', name: 'Earthquake' },
  { code: 'typhoon', name: 'Typhoon' },
  { code: 'storm_surge', name: 'Storm Surge' },
  { code: 'strong_winds', name: 'Strong Winds' },
  { code: 'heavy_rainfall', name: 'Heavy Rainfall' },
  { code: 'fire', name: 'Fire' },
  { code: 'other', name: 'Other Hazard' },
];

export const OTHER_HAZARD_CODE = 'other';
