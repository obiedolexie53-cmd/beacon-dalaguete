import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DALAGUETE_DEMO_CENTER, OSM_TILES, type PatternAnalysis } from '@beacon/shared';

type Hotspot = PatternAnalysis['hotspots'][number];

function textElement(text: string): HTMLElement {
  const span = document.createElement('span');
  span.textContent = text;
  return span;
}

/** Hotspots never draw smaller than this, so a tight cluster stays visible. */
const MIN_RADIUS_M = 120;

const STYLE = {
  normal: { color: '#1a62c0', weight: 2, fillColor: '#1a62c0', fillOpacity: 0.12 },
  selected: { color: '#0b2545', weight: 3, fillColor: '#1a62c0', fillOpacity: 0.3 },
};

/**
 * Hotspot circles on the map: centre of each DBSCAN cluster, radius to its farthest
 * record. One hue for every hotspot; the hazard is named in the label, list and
 * table (never by colour). Circles mark where records clustered, not hazard zones.
 */
export function HotspotMap({
  hotspots,
  selected,
  onSelect,
}: {
  hotspots: Hotspot[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const circlesRef = useRef(new Map<string, L.Circle>());
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
    const circles = circlesRef.current;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      circles.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    circlesRef.current.clear();
    for (const h of hotspots) {
      const circle = L.circle([h.center_latitude, h.center_longitude], {
        radius: Math.max(MIN_RADIUS_M, h.radius_m),
        ...STYLE.normal,
      })
        // Leaflet inserts string tooltips as HTML; a text node keeps names as plain text.
        .bindTooltip(textElement(`${h.id} · ${h.hazard.name} · ${h.count}`), {
          permanent: true,
          direction: 'center',
          className: 'm-hotspot-label',
        })
        .on('click', () => onSelectRef.current(h.id));
      circle.addTo(layer);
      circlesRef.current.set(h.id, circle);
    }
    if (hotspots.length > 0) {
      const bounds = L.latLngBounds(
        hotspots.map((h) => [h.center_latitude, h.center_longitude] as [number, number]),
      );
      map.fitBounds(bounds.pad(0.15), { maxZoom: 15 });
    }
  }, [hotspots]);

  useEffect(() => {
    for (const [id, circle] of circlesRef.current) {
      const isSelected = id === selected;
      circle.setStyle(isSelected ? STYLE.selected : STYLE.normal);
      if (isSelected) circle.bringToFront();
    }
    const circle = selected ? circlesRef.current.get(selected) : undefined;
    if (circle && mapRef.current) {
      mapRef.current.fitBounds(circle.getBounds().pad(1.5), { maxZoom: 15 });
    }
  }, [selected, hotspots]);

  return (
    <div
      ref={containerRef}
      className="m-hotspot-map"
      role="region"
      aria-label={`Map of ${hotspots.length} hotspots. The same hotspots are listed beside the map.`}
    />
  );
}
