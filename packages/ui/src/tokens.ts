/** Token values for TypeScript consumers (charts, map markers). Keep in sync with styles/tokens.css. */
export const colors = {
  primary: '#0b2545',
  secondary: '#1a62c0',
  accent: '#f2a900',
  success: '#1a7431',
  warning: '#a34c00',
  danger: '#c62828',
  background: '#f3f6fa',
  surface: '#ffffff',
  text: '#172033',
  textMuted: '#4a5568',
} as const;

/**
 * Map marker fill per report status. Checked with the dataviz palette validator:
 * every pair passes for normal colour vision. For colour-blind viewers no five-hue
 * set separates every pair on a map, so markers always carry the status icon too,
 * and the legend, marker labels, status filter and list view give the status in words.
 * Resolved is a deliberate neutral grey: finished reports recede.
 */
export const statusMarkerColors = {
  submitted: '#b8860b',
  under_verification: '#2563eb',
  needs_clarification: '#d23a2a',
  verified: '#15924a',
  resolved: '#6b7280',
} as const;
