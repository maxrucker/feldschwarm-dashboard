// Reine Statuslogik: Ist-Wert + Grenzwerte -> Zone. Keine Seiteneffekte, leicht testbar.
export type Zone = 'hinweis' | 'normal' | 'warnung' | 'kritisch';

export interface Thresholds {
  hinweisBis: number; // < hinweisBis  -> Hinweis
  normalBis: number;  // <= normalBis  -> Normal
  warnungBis: number; // <= warnungBis -> Warnung, darüber Kritisch
  max: number;
}

export const defaultThresholds: Thresholds = { hinweisBis: 8, normalBis: 15, warnungBis: 20, max: 30 };

export function schlupfZone(v: number, t: Thresholds): Zone {
  if (v < t.hinweisBis) return 'hinweis';
  if (v <= t.normalBis) return 'normal';
  if (v <= t.warnungBis) return 'warnung';
  return 'kritisch';
}

/** Fortschritt: Abweichung zum Soll in %-Punkten (negativ = hinter Plan). */
export function fortschrittZone(delta: number): Zone {
  if (delta >= -3) return 'normal';
  if (delta >= -8) return 'hinweis';
  if (delta >= -15) return 'warnung';
  return 'kritisch';
}

export const ZONE_LABEL: Record<Zone, string> = { hinweis: 'Hinweis', normal: 'Normal', warnung: 'Warnung', kritisch: 'Kritisch' };
export const ZONE_EMPFEHLUNG: Record<Zone, string> = { hinweis: 'Last prüfen', normal: 'Halten', warnung: '−2 km/h', kritisch: '−4 km/h' };

// Redundante Kodierung: Farbe + Form + Text
const SHAPES: Record<Zone, string> = {
  normal: '<circle cx="6" cy="6" r="5"/>',
  hinweis: '<polygon points="6,0.5 11.5,6 6,11.5 0.5,6"/>',
  warnung: '<polygon points="6,1 11.5,11 0.5,11"/>',
  kritisch: '<polygon points="3.6,0.5 8.4,0.5 11.5,3.6 11.5,8.4 8.4,11.5 3.6,11.5 0.5,8.4 0.5,3.6"/>',
};
export const zoneIcon = (z: Zone, size = 12): string =>
  `<svg class="zone-icon" width="${size}" height="${size}" viewBox="0 0 12 12" aria-hidden="true" fill="var(--zone-${z})">${SHAPES[z]}</svg>`;
