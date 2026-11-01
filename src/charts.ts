import { Thresholds, Zone, schlupfZone } from './zones';
import { fmtTime, ist, PLAN_FINISH, prognose, SOLL_RATE, T_START } from './sim';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const zoneColor = (z: Zone) => `var(--zone-${z})`;

// ================= Karte: Schlupf entlang der Fahrspuren =================
const K = 17, S = 60;
const yk = (k: number) => 100 + k * 12;
const edges = (y: number): [number, number] => [
  52 + ((y - 90) * (44 - 52)) / (309 - 90) + 6,
  598 + ((y - 79) * (610 - 598)) / (300 - 79) - 6,
];
// Räumliches Schlupffeld: Normalniveau + "Nasse Senke" bei Spur 7, u = 0.62
const slipField = (u: number, k: number) =>
  11 + 14 * Math.exp(-(((u - 0.62) / 0.13) ** 2 + ((k - 7) / 2.6) ** 2) / 2) + 1.6 * Math.sin(u * 9 + k * 1.9);

export function karteSvg(t: number, th: Thresholds): string {
  const total = (ist(t) / 100) * K; // gefahrene Spuren
  let out = '';
  for (let k = 0; k < K; k++) {
    const y = yk(k);
    const [x0, x1] = edges(y);
    const W = x1 - x0;
    const drivenTo = clamp(total - k, 0, 1);
    if (drivenTo < 1) out += `<rect x="${(x0 + drivenTo * W).toFixed(1)}" y="${y}" width="${(W * (1 - drivenTo)).toFixed(1)}" height="7" rx="2" fill="var(--track-default)"/>`;
    const n = Math.round(S * drivenTo);
    let runStart = 0, runZone: Zone | null = null;
    for (let i = 0; i <= n; i++) {
      const z: Zone | null = i < n ? schlupfZone(slipField((i + 0.5) / S, k), th) : null;
      if (z !== runZone) {
        if (runZone) out += `<rect x="${(x0 + (runStart / S) * W).toFixed(1)}" y="${y}" width="${(((i - runStart) / S) * W + 0.4).toFixed(1)}" height="7" rx="2" fill="${zoneColor(runZone)}"/>`;
        runStart = i; runZone = z;
      }
    }
  }
  // Maschine
  const kc = Math.min(K - 1, Math.floor(total));
  const [mx0, mx1] = edges(yk(kc));
  const mx = mx0 + clamp(total - kc, 0, 1) * (mx1 - mx0), my = yk(kc) + 3.5;
  out += `<circle cx="${mx.toFixed(1)}" cy="${my}" r="8" fill="var(--text-primary)" stroke="var(--zone-normal)" stroke-width="3"/>`;
  out += `<g transform="translate(${(mx - 28).toFixed(1)},${my + 12})"><rect width="56" height="18" rx="6" fill="var(--bg-surface)"/><text x="28" y="13" text-anchor="middle" class="svgt">TK100 #2</text></g>`;
  // Ereignis-Marker "Nasse Senke" (erst sichtbar, wenn die Maschine dort war)
  if (total >= 7.62) {
    const [h0, h1] = edges(yk(7));
    const hx = h0 + 0.62 * (h1 - h0), hy = yk(7) + 3.5;
    out += `<line x1="${hx + 12}" y1="${hy - 8}" x2="${hx + 66}" y2="${hy - 62}" stroke="var(--zone-kritisch)" stroke-width="1.5"/>
      <circle cx="${hx}" cy="${hy}" r="12" fill="var(--bg-surface)" stroke="var(--zone-kritisch)" stroke-width="2"/>
      <polygon points="${hx},${hy - 6} ${hx + 6},${hy + 5} ${hx - 6},${hy + 5}" fill="var(--zone-kritisch)"/>
      <g transform="translate(${hx + 66},${hy - 87})"><rect width="143" height="50" rx="10" fill="var(--bg-raised)" stroke="var(--border-default)"/>
      <text x="12" y="22" class="svgt svgt--title" style="fill:var(--zone-kritisch)">Schlupf 24 %</text>
      <text x="12" y="39" class="svgt svgt--cap">Nasse Senke · 12:40 Uhr</text></g>`;
  }
  const legend: [Zone, string][] = [['hinweis', `Hinweis < ${th.hinweisBis} %`], ['normal', `Normal ${th.hinweisBis}–${th.normalBis} %`], ['warnung', `Warnung ${th.normalBis}–${th.warnungBis} %`], ['kritisch', `Kritisch > ${th.warnungBis} %`]];
  let lx = 16;
  const leg = legend.map(([z, txt]) => { const s = `<g transform="translate(${lx},0)">${zoneShape(z)}<text x="16" y="10" class="svgt svgt--cap">${txt}</text></g>`; lx += 30 + txt.length * 6.3; return s; }).join('');
  return `<svg viewBox="0 0 640 384" role="img" aria-label="Karte: Schlupf entlang der Fahrspuren">
    <text x="16" y="24" class="svgt svgt--title">Schlupf auf der Karte</text>
    <text x="16" y="42" class="svgt svgt--cap">Nordwald · Saatbettvorbereitung · TK100 #2</text>
    <g transform="translate(540,10)"><rect width="88" height="24" rx="12" fill="var(--bg-raised)"/><text x="12" y="16" class="svgt svgt--cap">Layer</text><text x="46" y="16" class="svgt">Schlupf</text></g>
    <path d="M36 76L612 64L626 316L28 324Z" fill="var(--bg-raised)" stroke="var(--text-secondary)" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M52 90L598 79L610 300L44 309Z" fill="none" stroke="var(--border-default)" stroke-dasharray="5 4"/>
    ${out}
    <g transform="translate(0,342)">${leg}<g transform="translate(${lx},0)"><rect y="3" width="14" height="5" rx="2" fill="var(--track-default)"/><text x="20" y="10" class="svgt svgt--cap">geplant</text></g></g>
  </svg>`;
}

function zoneShape(z: Zone): string {
  const c = zoneColor(z);
  if (z === 'normal') return `<circle cx="5" cy="6" r="5" fill="${c}"/>`;
  if (z === 'hinweis') return `<polygon points="5,1 10,6 5,11 0,6" fill="${c}"/>`;
  if (z === 'warnung') return `<polygon points="5,1 10,11 0,11" fill="${c}"/>`;
  return `<polygon points="3,1 7,1 10,4 10,8 7,11 3,11 0,8 0,4" fill="${c}"/>`;
}

// ================= Zeitleiste: Fortschritt =================
const X0 = 56, X1 = 616, Y0 = 300, Y1 = 64, T0 = 11, T1 = 17;
const X = (t: number) => X0 + ((t - T0) / (T1 - T0)) * (X1 - X0);
const Y = (p: number) => Y0 - (p / 100) * (Y0 - Y1);

export function zeitleisteSvg(t: number): string {
  const ts = T_START, te = ts + 100 / SOLL_RATE, d3 = 3 / SOLL_RATE;
  const pr = prognose(t);
  let grid = '';
  for (const p of [0, 25, 50, 75, 100]) grid += `<line x1="${X0}" x2="${X1}" y1="${Y(p)}" y2="${Y(p)}" stroke="var(--border-default)"/><text x="${X0 - 8}" y="${Y(p) + 4}" text-anchor="end" class="svgt svgt--cap">${p} %</text>`;
  for (let h = 11; h <= 17; h++) grid += `<text x="${X(h)}" y="${Y0 + 20}" text-anchor="middle" class="svgt svgt--cap">${h}:00</text>`;
  const band = `M${X(ts)} ${Y(0)}L${X(ts)} ${Y(3)}L${X(te - d3)} ${Y(100)}L${X(te)} ${Y(100)}L${X(te)} ${Y(97)}L${X(ts + d3)} ${Y(0)}Z`;
  let pts = '';
  for (let tt = ts; tt <= t; tt += 0.05) pts += `${pts ? 'L' : 'M'}${X(tt).toFixed(1)} ${Y(ist(tt)).toFixed(1)}`;
  pts += `L${X(t).toFixed(1)} ${Y(ist(t)).toFixed(1)}`;
  const events: [number, string][] = [[11.25, 'Start 11:15'], [12 + 40 / 60, 'Nasse Senke 12:40']];
  const ev = events.filter(([et]) => t >= et).map(([et, label]) =>
    `<line x1="${X(et)}" x2="${X(et)}" y1="${Y0}" y2="${Y0 + 6}" stroke="var(--text-secondary)"/><g transform="translate(${X(et) - 4},${Y0 + 26})"><rect width="${label.length * 6 + 16}" height="18" rx="9" fill="var(--bg-raised)"/><text x="8" y="13" class="svgt svgt--cap" style="fill:var(--text-primary)">${label}</text></g>`).join('');
  const fx = Math.min(T1, pr.finish);
  const tipX = Math.min(X(t) + 16, 640 - 16 - 190);
  return `<svg viewBox="0 0 640 368" role="img" aria-label="Zeitleiste Fortschritt">
    <text x="16" y="24" class="svgt svgt--title">Fortschritt über die Zeit</text>
    <text x="16" y="42" class="svgt svgt--cap">Saatbettvorbereitung · Soll vs. Ist · Prognose</text>
    ${grid}
    <path d="${band}" fill="var(--zone-normal-tint)"/>
    <line x1="${X(ts)}" y1="${Y(0)}" x2="${X(te)}" y2="${Y(100)}" stroke="var(--text-primary)" stroke-width="1.5"/>
    <path d="${pts}" fill="none" stroke="var(--zone-normal)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    <line x1="${X(t)}" y1="${Y(ist(t))}" x2="${X(fx)}" y2="${Y(100)}" stroke="var(--data-forecast)" stroke-width="2.5" stroke-dasharray="6 4"/>
    <line x1="${X(t)}" x2="${X(t)}" y1="${Y(100) - 8}" y2="${Y0}" stroke="var(--text-secondary)" stroke-dasharray="2 3"/>
    <g transform="translate(${X(t) - 36},${Y(100) - 30})"><rect width="72" height="18" rx="6" fill="var(--bg-raised)"/><text x="36" y="13" text-anchor="middle" class="svgt svgt--cap" style="fill:var(--text-primary)">Jetzt ${fmtTime(t)}</text></g>
    <circle cx="${X(t)}" cy="${Y(ist(t))}" r="6" fill="var(--text-primary)" stroke="var(--zone-normal)" stroke-width="3"/>
    <circle cx="${X(t + 1)}" cy="${Y(pr.in1h)}" r="5" fill="var(--bg-surface)" stroke="var(--data-forecast)" stroke-width="2.5"/>
    <circle cx="${X(fx)}" cy="${Y(100)}" r="5" fill="var(--data-forecast)"/>
    <g transform="translate(${tipX},${Y(ist(t)) + 36})"><rect width="190" height="50" rx="10" fill="var(--bg-raised)" stroke="var(--border-default)"/>
      <text x="12" y="22" class="svgt svgt--title">Ist ${ist(t).toFixed(0)} % · Soll ${Math.max(0, SOLL_RATE * (t - T_START)).toFixed(0)} %</text>
      <text x="12" y="39" class="svgt svgt--cap">Prognose Finish ${fmtTime(pr.finish)} Uhr (Plan ${fmtTime(PLAN_FINISH)})</text></g>
    ${ev}
    <g transform="translate(16,346)">
      <rect y="4" width="16" height="3" fill="var(--zone-normal)"/><text x="22" y="10" class="svgt svgt--cap">Ist</text>
      <rect x="60" y="5" width="16" height="2" fill="var(--text-primary)"/><text x="82" y="10" class="svgt svgt--cap">Soll</text>
      <rect x="124" y="4" width="16" height="3" fill="var(--data-forecast)"/><text x="146" y="10" class="svgt svgt--cap">Prognose</text>
      <rect x="214" y="1" width="16" height="9" fill="var(--zone-normal-tint)"/><text x="236" y="10" class="svgt svgt--cap">Toleranz ±3 %-Pkt.</text></g>
  </svg>`;
}
