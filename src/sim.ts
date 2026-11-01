// Deterministische Simulation: gleicher Zeitpunkt -> gleiche Werte (gut für Doku-Screenshots).
export const T_START = 11.25; // 11:15
export const T_NOW_MAX = 14.0; // 14:00
export const SOLL_RATE = 22.6; // %/h
export const PLAN_FINISH = T_START + 100 / SOLL_RATE; // ≈ 15:40

const IST = [0, 5.5, 11, 15.5, 19, 22, 27, 33.5, 40, 47.5, 55.5, 64]; // alle 15 min ab 11:15

export const soll = (t: number) => Math.max(0, Math.min(100, SOLL_RATE * (t - T_START)));

export function ist(t: number): number {
  const x = Math.max(0, (t - T_START) / 0.25);
  const i = Math.min(IST.length - 2, Math.floor(x));
  return IST[i] + (IST[i + 1] - IST[i]) * Math.min(1, x - i);
}

/** Schlupf in %: Grundniveau 11 %, "Nasse Senke" um 12:40 (Spitze ~24 %). */
export function schlupf(t: number): number {
  const bump = 13.5 * Math.exp(-Math.pow((t - 12.67) / 0.3, 2));
  return 11 + bump + 1.2 * Math.sin(t * 40);
}

/** Geschwindigkeit sinkt mit steigendem Schlupf (Kausalkette). */
export const geschwindigkeit = (t: number) => 7.6 - Math.max(0, schlupf(t) - 12) * 0.1;

/** Prognose: Fortschritt in 1 h bei aktuellem Tempo + Finish-Zeit. */
export function prognose(t: number) {
  const rate = Math.max(1, (ist(t) - ist(t - 0.25)) / 0.25); // %/h
  const in1h = Math.min(100, ist(t) + rate);
  const finish = t + (100 - ist(t)) / rate;
  return { in1h, finish, rate };
}

export const fmtTime = (h: number) => {
  const m = Math.round(h * 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
export const fmtDur = (h: number) => {
  const m = Math.max(0, Math.round(h * 60));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`;
};
