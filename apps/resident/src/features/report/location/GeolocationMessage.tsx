import { Alert } from '@beacon/ui';
import type { GeolocationState } from './useGeolocation';

const ERROR_TEXT = {
  denied: {
    title: 'Location permission denied',
    body: 'BEACON cannot access your location. Place a pin on the map or describe the place with a landmark. To allow location later, turn it on for this site in your browser settings.',
  },
  unavailable: {
    title: 'Could not find your location',
    body: 'Your phone could not determine its position. Try again outdoors, or place a pin on the map.',
  },
  timeout: {
    title: 'Finding your location took too long',
    body: 'Try again, or place a pin on the map.',
  },
  unsupported: {
    title: 'Location is not available',
    body: 'This browser cannot share your location. Place a pin on the map instead.',
  },
  insecure: {
    title: 'Location needs a secure connection',
    body: 'Your browser only shares GPS location over a secure (HTTPS) connection. Place a pin on the map instead.',
  },
} as const;

export function GeolocationMessage({
  state,
  lowAccuracy,
  accuracy,
  pinFromGps,
}: {
  state: GeolocationState;
  lowAccuracy: boolean;
  accuracy: number | null;
  /** False once the resident moves or removes the GPS pin. */
  pinFromGps: boolean;
}) {
  if (state.status === 'error') {
    const text = ERROR_TEXT[state.kind];
    return (
      <Alert tone={state.kind === 'denied' ? 'warning' : 'danger'} title={text.title}>
        {text.body}
      </Alert>
    );
  }
  if (state.status === 'success' && pinFromGps && accuracy !== null) {
    return lowAccuracy ? (
      <Alert tone="warning" title="Location is approximate">
        Accurate to about {accuracy} m. Drag the pin to the exact spot if you can.
      </Alert>
    ) : (
      <Alert tone="success" title="Location found">
        Accurate to about {accuracy} m. You can drag the pin to adjust it.
      </Alert>
    );
  }
  return null;
}
