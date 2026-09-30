import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair } from 'lucide-react';
import { DALAGUETE_DEMO_CENTER, OSM_TILES, roundCoordinate } from '@beacon/shared';
import { colors } from '@beacon/ui';

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface MapPickerProps {
  /** Current pin, or null for no pin. */
  position: MapPoint | null;
  /** GPS accuracy in metres, drawn as a circle around the pin. */
  accuracy?: number | null;
  /** Change this number to move the map view to the current pin (e.g. after GPS). */
  focusKey?: number;
  /** Called when the resident taps the map, drags the pin or places it at the centre. */
  onPick: (point: MapPoint) => void;
}

const PIN_ICON = L.divIcon({
  className: 'r-map-pin',
  html: `<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true">
    <path d="M17 43s15-14.6 15-26A15 15 0 0 0 2 17c0 11.4 15 26 15 26z" fill="${colors.primary}" stroke="#fff" stroke-width="2"/>
    <circle cx="17" cy="17" r="6" fill="${colors.accent}"/>
  </svg>`,
  iconSize: [34, 44],
  iconAnchor: [17, 43],
});

function toPoint(latlng: L.LatLng): MapPoint {
  return { latitude: roundCoordinate(latlng.lat), longitude: roundCoordinate(latlng.lng) };
}

const PIN_ZOOM = 17;
const DEFAULT_ZOOM = 13;

/** OpenStreetMap map where the resident marks the incident location. */
export function MapPicker({ position, accuracy, focusKey = 0, onPick }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onPickRef = useRef(onPick);
  const initialPosition = useRef(position);

  useEffect(() => {
    onPickRef.current = onPick;
  });

  // Create the map once.
  useEffect(() => {
    const start = initialPosition.current;
    const map = L.map(containerRef.current!, {
      center: start
        ? [start.latitude, start.longitude]
        : [DALAGUETE_DEMO_CENTER.latitude, DALAGUETE_DEMO_CENTER.longitude],
      zoom: start ? PIN_ZOOM : DEFAULT_ZOOM,
    });
    L.tileLayer(OSM_TILES.url, {
      attribution: OSM_TILES.attribution,
      maxZoom: OSM_TILES.maxZoom,
    }).addTo(map);
    map.on('click', (event: L.LeafletMouseEvent) => onPickRef.current(toPoint(event.latlng)));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []);

  // Keep the pin and accuracy circle in sync with props.
  const lat = position?.latitude;
  const lng = position?.longitude;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lat === undefined || lng === undefined) {
      markerRef.current?.remove();
      circleRef.current?.remove();
      markerRef.current = null;
      circleRef.current = null;
      return;
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], {
        icon: PIN_ICON,
        draggable: true,
        title: 'Incident location',
        alt: 'Incident location pin',
      })
        .on('dragend', (event) =>
          onPickRef.current(toPoint((event.target as L.Marker).getLatLng())),
        )
        .addTo(map);
    }
    circleRef.current?.remove();
    circleRef.current = accuracy
      ? L.circle([lat, lng], {
          radius: accuracy,
          color: colors.secondary,
          weight: 1,
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(map)
      : null;
  }, [lat, lng, accuracy]);

  // Move the view to the pin when asked (e.g. after "Use my current location").
  useEffect(() => {
    if (focusKey === 0 || lat === undefined || lng === undefined) return;
    mapRef.current?.setView([lat, lng], PIN_ZOOM);
    // Only on request: re-centring whenever the pin moves would fight the resident's dragging.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  return (
    <div className="r-map">
      <div
        ref={containerRef}
        className="r-map__canvas"
        role="application"
        aria-label="Map of Dalaguete. Tap to place the incident pin. Use arrow keys to move the map."
      />
      <button
        type="button"
        className="bcn-button bcn-button--secondary bcn-button--sm r-map__center-button"
        onClick={() => mapRef.current && onPickRef.current(toPoint(mapRef.current.getCenter()))}
      >
        <Crosshair size={18} aria-hidden="true" />
        Place pin at map centre
      </button>
    </div>
  );
}
