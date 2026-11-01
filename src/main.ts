import './style.css';
import { defaultThresholds, fortschrittZone, schlupfZone, Thresholds, Zone, zoneIcon } from './zones';
import { fmtTime, geschwindigkeit, ist, PLAN_FINISH, prognose, schlupf, soll, T_NOW_MAX, T_START } from './sim';
import { fortschrittWidget, schlupfWidget } from './widgets';
import { karteSvg, zeitleisteSvg } from './charts';

const state = {
  t: 12.3, playing: false, theme: 'dark' as 'dark' | 'light',
  th: { ...defaultThresholds } as Thresholds,
  eingriff: null as number | null, // Zeitpunkt, ab dem der Fahrer "−4 km/h" übernommen hat
  dismissed: false,                // Modal "Später" gedrückt
};
const app = document.getElementById('app')!;

app.innerHTML = `<main>
  <div class="topbar">
    <div><h1>Feldschwarm® Dashboard</h1><div class="muted">Schlupf &amp; Fortschritt · TK100 #2 · Nordwald</div></div>
    <div class="controls">
      <button id="scenario">Szenario starten</button>
      <button id="play" aria-label="Abspielen/Pause">▶︎</button>
      <input id="scrub" type="range" min="${T_START}" max="${T_NOW_MAX}" step="0.0083" aria-label="Zeit">
      <span id="clock" class="clock"></span>
      <button id="theme">Hell/Dunkel</button>
    </div>
  </div>
  <section><h2>Live</h2><div class="row" id="liveRow"><div id="live"></div><div id="panel" class="panel" role="status" aria-live="polite"></div></div></section>
  <section><h2>Visualisierungen</h2><div class="row"><article class="viz" id="karte"></article><article class="viz" id="zeit"></article></div></section>
  <section><h2>Grenzwerte ändern</h2>
    <div class="editor">
      <div class="scale" id="scale"></div>
      <div class="steppers">
        <label><span class="muted">Hinweis bis (%)</span><input type="number" step="0.5" id="th-h"></label>
        <label><span class="muted">Normal bis (%)</span><input type="number" step="0.5" id="th-n"></label>
        <label><span class="muted">Warnung bis (%)</span><input type="number" step="0.5" id="th-w"></label>
      </div>
      <div class="toast" id="toast" role="status"></div>
    </div>
  </section>
  <section><h2>Kartenset – alle Zonen</h2><div id="catalog" class="row"></div></section>
</main>
<div id="modal" class="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-title" hidden></div>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function values() {
  const { t } = state;
  const eg = state.eingriff !== null && t >= state.eingriff;
  const raw = schlupf(t);
  const sch = eg ? 11 + 0.3 * (raw - 11) : raw; // Eingriff dämpft Schlupf
  const speed = eg ? geschwindigkeit(t) - 4 : geschwindigkeit(t);
  return { sch, speed, eg };
}

function panelHtml(sz: Zone, sch: number, eg: boolean): string {
  if (eg && sz === 'normal') return `<div class="msg msg--normal">${zoneIcon('normal', 16)}<b>Eingriff wirksam</b><span class="muted">Schlupf ${sch.toFixed(0)} % (Normal). Prognose-Finish ${fmtTime(prognose(state.t).finish)} Uhr.</span></div>`;
  if (sz === 'normal') return `<div class="msg"><b>Alles im Soll</b><span class="muted">Schlupf ${sch.toFixed(0)} % liegt im Normalbereich. Keine Aktion nötig.</span></div>`;
  if (sz === 'hinweis') return `<div class="msg msg--hinweis">${zoneIcon('hinweis', 16)}<b>Hinweis: Last prüfen</b><span class="muted">Schlupf ${sch.toFixed(0)} % – Traktion wird nicht ausgenutzt.</span></div>`;
  if (sz === 'warnung') return `<div class="msg msg--warnung">${zoneIcon('warnung', 16)}<b>Schlupf ${sch.toFixed(0)} % – Warnung</b><span class="muted">Traktion lässt nach. Empfehlung: Geschwindigkeit um 2 km/h senken.</span><div class="actions"><button class="btn-primary" data-act="eingriff2">−2 km/h übernehmen</button><button data-act="ignore">Ignorieren</button></div></div>`;
  return `<div class="msg msg--kritisch">${zoneIcon('kritisch', 16)}<b>Schlupf ${sch.toFixed(0)} % – Kritisch</b><span class="muted">Sofort eingreifen.</span></div>`;
}

function renderLive() {
  const { t, th } = state;
  const { sch, speed, eg } = values();
  const i = ist(t), s = soll(t), pr = prognose(t);
  const sz = schlupfZone(sch, th), fz = fortschrittZone(i - s);
  $('live').innerHTML =
    schlupfWidget({ size: '1x1', value: sch, zone: sz, thresholds: th, speed }) +
    schlupfWidget({ size: '2x1', value: sch, zone: sz, thresholds: th, speed }) +
    fortschrittWidget({ size: '2x1', ist: i, soll: s, zone: fz, t, in1h: pr.in1h, finish: pr.finish, planFinish: PLAN_FINISH }) +
    fortschrittWidget({ size: '2x2', ist: i, soll: s, zone: fz, t, in1h: pr.in1h, finish: pr.finish, planFinish: PLAN_FINISH });
  $('panel').innerHTML = panelHtml(sz, sch, eg);
  $('karte').innerHTML = karteSvg(t, th);
  $('zeit').innerHTML = zeitleisteSvg(t);
  $('clock').textContent = fmtTime(t);
  ($('scrub') as HTMLInputElement).value = String(t);
  const { hinweisBis: a, normalBis: b, warnungBis: c, max } = th;
  $('scale').innerHTML = [[a, 'hinweis'], [b - a, 'normal'], [c - b, 'warnung'], [max - c, 'kritisch']]
    .map(([w, z]) => `<i class="z-${z}" style="width:${(Number(w) / max) * 100}%"></i>`).join('');
  // Modal bei Kritisch
  if (sz !== 'kritisch') state.dismissed = false;
  const modal = $('modal');
  const show = sz === 'kritisch' && !state.dismissed;
  if (show && modal.hidden) {
    state.playing = false; $('play').textContent = '▶︎';
    modal.innerHTML = `<div class="modal__box">
      <h2 id="modal-title">${zoneIcon('kritisch', 20)} Schlupf kritisch: ${sch.toFixed(0)} %</h2>
      <p>Empfehlung: Geschwindigkeit auf ${Math.max(0, speed - 4).toFixed(1)} km/h senken (−4 km/h). Bei Ignorieren verschiebt sich das Finish auf ${fmtTime(pr.finish)} Uhr.</p>
      <div class="actions"><button class="btn-primary btn-kritisch" data-act="eingriff4" autofocus>−4 km/h übernehmen</button><button data-act="stop">Stopp</button><button data-act="later">Später</button></div></div>`;
    modal.hidden = false;
    (modal.querySelector('[data-act="eingriff4"]') as HTMLElement).focus();
  }
  if (!show) modal.hidden = true;
}

function renderCatalog() {
  const zones: [Zone, number, number][] = [['hinweis', 5, 57], ['normal', 11, 64], ['warnung', 17, 51], ['kritisch', 24, 44]];
  $('catalog').innerHTML = zones.map(([z, v, f]) =>
    `<div class="row">${schlupfWidget({ size: '2x1', value: v, zone: z, thresholds: state.th, speed: 7.4 })}` +
    fortschrittWidget({ size: '2x1', ist: f, soll: 62, zone: z, t: 14, in1h: f + 22, finish: 14 + (100 - f) / 22, planFinish: PLAN_FINISH }) + '</div>').join('');
}

function render() { renderLive(); renderCatalog(); }

// Aktionen (Event-Delegation für Panel + Modal)
document.addEventListener('click', (e) => {
  const act = (e.target as HTMLElement).closest('[data-act]')?.getAttribute('data-act');
  if (!act) return;
  if (act === 'eingriff4' || act === 'eingriff2') { state.eingriff = state.t; state.playing = true; $('play').textContent = '❚❚'; }
  if (act === 'later' || act === 'ignore') state.dismissed = true;
  if (act === 'stop') { state.playing = false; state.dismissed = true; $('play').textContent = '▶︎'; }
  renderLive();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('modal').hidden) { state.dismissed = true; renderLive(); } });

$('play').onclick = () => { state.playing = !state.playing; $('play').textContent = state.playing ? '❚❚' : '▶︎'; };
$('scenario').onclick = () => { state.t = 12.2; state.eingriff = null; state.dismissed = false; state.playing = true; $('play').textContent = '❚❚'; renderLive(); };
($('scrub') as HTMLInputElement).oninput = (e) => { state.t = Number((e.target as HTMLInputElement).value); renderLive(); };
$('theme').onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = state.theme; };

const inputs: [string, keyof Thresholds][] = [['th-h', 'hinweisBis'], ['th-n', 'normalBis'], ['th-w', 'warnungBis']];
for (const [id, key] of inputs) {
  const el = $(id) as HTMLInputElement; el.value = String(state.th[key]);
  el.onchange = () => {
    const next = { ...state.th, [key]: Number(el.value) };
    if (!(next.hinweisBis < next.normalBis && next.normalBis < next.warnungBis && next.warnungBis < next.max)) {
      $('toast').textContent = 'Ungültig: Grenzwerte müssen aufsteigend sein.'; el.value = String(state.th[key]); return;
    }
    state.th = next; $('toast').textContent = 'Gespeichert – gilt ab sofort für alle Widgets.'; render();
  };
}

let last = performance.now();
const tick = (now: number) => {
  const dt = (now - last) / 1000; last = now;
  if (state.playing) { state.t += dt * 0.05; if (state.t > T_NOW_MAX) { state.t = T_START; state.eingriff = null; } renderLive(); }
  requestAnimationFrame(tick);
};
render(); requestAnimationFrame(tick);
