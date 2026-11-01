import { Thresholds, Zone, ZONE_EMPFEHLUNG, ZONE_LABEL, zoneIcon } from './zones';
import { fmtDur, fmtTime } from './sim';

export type Size = '1x1' | '2x1' | '2x2';

const chip = (z: Zone) => `<span class="chip chip--${z}">${zoneIcon(z)}${ZONE_LABEL[z]}</span>`;

// ---------- Gauge (Schlupf) ----------
const CX = 60, CY = 60, R = 44, A0 = 135, SWEEP = 270;
const pt = (deg: number, r = R) => {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};
function arc(v0: number, v1: number, max: number): string {
  const a0 = A0 + (SWEEP * v0) / max, a1 = A0 + (SWEEP * v1) / max;
  const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function gauge(value: number, zone: Zone, t: Thresholds): string {
  const segs: [number, number, Zone][] = [
    [0, t.hinweisBis, 'hinweis'], [t.hinweisBis, t.normalBis, 'normal'],
    [t.normalBis, t.warnungBis, 'warnung'], [t.warnungBis, t.max, 'kritisch'],
  ];
  const v = Math.min(t.max, Math.max(0, value));
  const [mx, my] = pt(A0 + (SWEEP * v) / t.max);
  return `<svg class="gauge" viewBox="0 0 120 120" role="img" aria-label="Schlupf ${value.toFixed(0)} Prozent, ${ZONE_LABEL[zone]}">
    ${segs.map(([a, b, z]) => `<path d="${arc(a, b, t.max)}" stroke="var(--zone-${z}-dim)" class="gauge__zone"/>`).join('')}
    <path d="${arc(0, Math.max(0.01, v), t.max)}" stroke="var(--zone-${zone})" class="gauge__value"/>
    <circle cx="${mx.toFixed(2)}" cy="${my.toFixed(2)}" r="3.5" fill="var(--text-primary)"/>
    <text x="14" y="112" class="gauge__min">0</text><text x="106" y="112" text-anchor="end" class="gauge__min">${t.max}</text>
  </svg>`;
}

export function schlupfWidget(p: { size: '1x1' | '2x1'; value: number; zone: Zone; thresholds: Thresholds; speed: number }): string {
  const { size, value, zone, thresholds, speed } = p;
  return `<article class="widget widget--${size} zone-${zone}" aria-label="Widget Schlupf">
    <div class="widget__main">
      <header class="widget__head"><h3>Schlupf</h3><span class="muted">TK100 #2</span></header>
      <div class="gauge-wrap">${gauge(value, zone, thresholds)}
        <div class="gauge__num"><b>${value.toFixed(0)}</b><span>%</span></div></div>
      ${chip(zone)}
    </div>
    ${size === '2x1' ? `<div class="widget__side">
      <h3>Geschwindigkeit</h3>
      <div class="big">${speed.toFixed(1)}<small>km/h</small></div>
      <div class="muted">Soll 6–8 km/h</div>
      <div class="reco"><span class="muted">Empfehlung</span><b class="reco__val">${ZONE_EMPFEHLUNG[zone]}</b></div>
    </div>` : ''}
  </article>`;
}

// ---------- Fortschritt ----------
export function fortschrittWidget(p: { size: '2x1' | '2x2'; ist: number; soll: number; zone: Zone; t: number; in1h: number; finish: number; planFinish: number }): string {
  const { size, ist, soll, zone, t, in1h, finish, planFinish } = p;
  const delta = ist - soll;
  const rest = finish - t;
  const late = finish - planFinish;
  return `<article class="widget widget--${size} widget--fortschritt zone-${zone}" aria-label="Widget Fortschritt">
    <header class="widget__head"><h3>Fortschritt</h3><span class="muted">Saatbettvorbereitung #2</span></header>
    <div class="fortschritt__row">
      <div class="big big--xl">${ist.toFixed(0)}<small>%</small></div>
      <div class="rest"><span class="muted">Restzeit</span><b>${fmtDur(rest)}</b></div>
    </div>
    <div class="bar" role="img" aria-label="Ist ${ist.toFixed(0)} Prozent, Soll ${soll.toFixed(0)} Prozent">
      <div class="bar__ist" style="width:${ist}%"></div>
      ${size === '2x2' ? `<div class="bar__fc" style="left:${ist}%;width:${Math.max(0, in1h - ist)}%"></div>` : ''}
      <div class="bar__soll" style="left:${soll}%"><span>Soll ${soll.toFixed(0)} %</span></div>
    </div>
    <div class="fortschritt__foot">${chip(zone)}<span class="muted">Δ ${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(0)} %-Pkt. zum Soll</span></div>
    ${size === '2x2' ? `<div class="prognose"><h4>Prognose</h4><div class="tiles">
      <div class="tile"><span class="muted">In 1 h</span><b class="fc">${in1h.toFixed(0)} %</b><span class="muted">bei aktuellem Tempo</span></div>
      <div class="tile"><span class="muted">Bis Finish</span><b>${fmtTime(finish)} Uhr</b><span class="muted">Δ zum Plan: ${Math.abs(late) < 0.1 ? 'im Plan' : (late > 0 ? '+' : '−') + fmtDur(Math.abs(late))}</span></div>
    </div></div>` : ''}
  </article>`;
}
