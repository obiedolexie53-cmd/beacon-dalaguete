import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OSM_TILES } from '@beacon/shared';
import { colors } from '@beacon/ui';

const PIN_ICON = L.divIcon({
  className: 'm-map-pin',
  html: `<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true">
    <path d="M17 43s15-14.6 15-26A15 15 0 0 0 2 17c0 11.4 15 26 15 26z" fill="${colors.primary}" stroke="#fff" stroke-width="2"/>
    <circle cx="17" cy="17" r="6" fill="${colors.accent}"/>
  </svg>`,
  iconSize: [34, 44],
  iconAnchor: [17, 43],
});

/** Read-only OpenStreetMap view of one incident location, with the GPS accuracy circle. */
export function ReportLocationMap({
  latitude,
  longitude,
  accuracy,
}: {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const map = L.map(ref.current!, { center: [latitude, longitude], zoom: 16 });
    L.tileLayer(OSM_TILES.url, {
      attribution: OSM_TILES.attribution,
      maxZoom: OSM_TILES.maxZoom,
    }).addTo(map);
    L.marker([latitude, longitude], {
      icon: PIN_ICON,
      title: 'Incident location',
      alt: 'Incident location',
    }).addTo(map);
    if (accuracy) {
      L.circle([latitude, longitude], {
        radius: accuracy,
        color: colors.secondary,
        weight: 1,
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(map);
    }
    return () => {
      map.remove();
    };
  }, [latitude, longitude, accuracy]);

  return (
    <div
      ref={ref}
      className="m-map"
      role="img"
      aria-label={`Map of the incident location at ${latitude}, ${longitude}`}
    />
  );
}
