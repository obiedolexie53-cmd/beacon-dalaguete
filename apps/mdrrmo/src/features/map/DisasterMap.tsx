import { createElement, useEffect, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  DALAGUETE_DEMO_CENTER,
  OSM_TILES,
  REPORT_STATUS_LABELS,
  hazardLabel,
  type MapPoint,
} from '@beacon/shared';
import { hazardIconFor, statusIconFor, statusMarkerColors } from '@beacon/ui';

/** Accessible name for a marker: the same facts the colour and icons show. */
export function markerLabel(point: MapPoint): string {
  const place = point.barangay ? `, ${point.barangay.name}` : '';
  return `${point.reference_no}: ${hazardLabel(point)}, ${REPORT_STATUS_LABELS[point.status]}${place}`;
}

const iconCache = new Map<string, L.DivIcon>();

/**
 * Pin in the status colour, with the hazard icon inside and the status icon in a
 * small badge, so status is never shown by colour alone.
 */
function markerIcon(point: MapPoint, selected: boolean): L.DivIcon {
  const key = `${point.hazard_type.code}|${point.status}|${selected}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const fill = statusMarkerColors[point.status];
  const hazard = renderToStaticMarkup(
    createElement(hazardIconFor(point.hazard_type.code), {
      size: 16,
      color: '#ffffff',
      strokeWidth: 2.5,
      'aria-hidden': true,
    }),
  );
  const status = renderToStaticMarkup(
    createElement(statusIconFor(point.status), {
      size: 11,
      color: fill,
      strokeWidth: 3,
      'aria-hidden': true,
    }),
  );
  const icon = L.divIcon({
    className: selected ? 'm-marker is-selected' : 'm-marker',
    html: `<span class="m-marker__pin" style="--marker:${fill}">${hazard}</span><span class="m-marker__status">${status}</span>`,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
  });
  iconCache.set(key, icon);
  return icon;
}

export interface DisasterMapProps {
  points: MapPoint[];
  selected: string | null;
  onSelect: (referenceNo: string) => void;
}

/** OpenStreetMap of Dalaguete with one marker per located report. */
export function DisasterMap({ points, selected, onSelect }: DisasterMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    const map = L.map(containerRef.current!, {
      center: [DALAGUETE_DEMO_CENTER.latitude, DALAGUETE_DEMO_CENTER.longitude],
      zoom: 12,
    });
    L.tileLayer(OSM_TILES.url, {
      attribution: OSM_TILES.attribution,
      maxZoom: OSM_TILES.maxZoom,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const markers = markersRef.current;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markers.clear();
    };
  }, []);

  // Redraw markers and fit the view whenever the filtered set changes.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markersRef.current.clear();
    for (const point of points) {
      const marker = L.marker([Number(point.latitude), Number(point.longitude)], {
        icon: markerIcon(point, false),
        title: markerLabel(point),
        alt: markerLabel(point),
        keyboard: true,
        riseOnHover: true,
      })
        .on('click', () => onSelectRef.current(point.reference_no))
        // Leaflet's own Enter handling only opens popups; this map uses a side panel.
        .on('keypress', (event) => {
          const key = (event as L.LeafletKeyboardEvent).originalEvent.key;
          if (key === 'Enter' || key === ' ') onSelectRef.current(point.reference_no);
        });
      marker.addTo(layer);
      markersRef.current.set(point.reference_no, marker);
    }
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [Number(p.latitude), Number(p.longitude)]));
      // Extra room at the top: pins extend upwards from their location.
      map.fitBounds(bounds, {
        paddingTopLeft: [40, 70],
        paddingBottomRight: [40, 30],
        maxZoom: 15,
      });
    } else {
      map.setView([DALAGUETE_DEMO_CENTER.latitude, DALAGUETE_DEMO_CENTER.longitude], 12);
    }
  }, [points]);

  // Highlight the selected marker.
  useEffect(() => {
    for (const point of points) {
      const marker = markersRef.current.get(point.reference_no);
      const isSelected = point.reference_no === selected;
      marker?.setIcon(markerIcon(point, isSelected));
      marker?.setZIndexOffset(isSelected ? 1000 : 0);
    }
  }, [points, selected]);

  return (
    <div
      ref={containerRef}
      className="m-disaster-map"
      role="application"
      aria-label="Disaster map of Dalaguete. Use Tab to move between report markers and Enter to open one."
    />
  );
}
