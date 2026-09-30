import {
  Activity,
  CloudRain,
  Droplets,
  Flame,
  Mountain,
  Tornado,
  TriangleAlert,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react';

const HAZARD_ICONS: Record<string, LucideIcon> = {
  flood: Droplets,
  landslide: Mountain,
  earthquake: Activity,
  typhoon: Tornado,
  storm_surge: Waves,
  strong_winds: Wind,
  heavy_rainfall: CloudRain,
  fire: Flame,
  other: TriangleAlert,
};

/** Icon component for a hazard type code. Unknown codes (e.g. hazards added later) get the generic icon. */
export function hazardIconFor(code: string): LucideIcon {
  return HAZARD_ICONS[code] ?? TriangleAlert;
}

/** Icon for a hazard type code. Unknown codes (e.g. hazards added later) use the generic icon. */
export function HazardIcon({ code, size = 40 }: { code: string; size?: number }) {
  const Icon = HAZARD_ICONS[code] ?? TriangleAlert;
  return (
    <span className="bcn-hazard-icon" style={{ width: size, height: size }} aria-hidden="true">
      <Icon size={Math.round(size * 0.55)} />
    </span>
  );
}
