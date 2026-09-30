import { useCallback, useEffect, useRef, useState } from 'react';
import { roundCoordinate } from '@beacon/shared';

export type GeolocationErrorKind =
  'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure';

export interface GeolocationFix {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export type GeolocationState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'success'; latitude: number; longitude: number; accuracy: number }
  | { status: 'error'; kind: GeolocationErrorKind };

const OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 };

/**
 * One-shot "use my current location" request with every failure mapped to a
 * clear state. `onFix` runs when a position arrives (from the browser callback,
 * never during render).
 */
export function useGeolocation(onFix?: (fix: GeolocationFix) => void) {
  const [state, setState] = useState<GeolocationState>({ status: 'idle' });
  const requestId = useRef(0);
  const onFixRef = useRef(onFix);
  useEffect(() => {
    onFixRef.current = onFix;
  });

  const request = useCallback(() => {
    // Browsers only allow GPS on HTTPS (or localhost).
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setState({ status: 'error', kind: 'insecure' });
      return;
    }
    if (!('geolocation' in navigator)) {
      setState({ status: 'error', kind: 'unsupported' });
      return;
    }
    const id = ++requestId.current;
    setState({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (id !== requestId.current) return;
        const fix: GeolocationFix = {
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude),
          accuracy: Math.round(position.coords.accuracy),
        };
        setState({ status: 'success', ...fix });
        onFixRef.current?.(fix);
      },
      (error) => {
        if (id !== requestId.current) return;
        const kind: GeolocationErrorKind =
          error.code === error.PERMISSION_DENIED
            ? 'denied'
            : error.code === error.TIMEOUT
              ? 'timeout'
              : 'unavailable';
        setState({ status: 'error', kind });
      },
      OPTIONS,
    );
  }, []);

  const reset = useCallback(() => {
    requestId.current += 1;
    setState({ status: 'idle' });
  }, []);

  return { state, request, reset };
}
