/* ---------- Route geometry + transit simulation ----------
   Event-driven: nothing runs at idle. A requestAnimationFrame loop exists only while at least one
   truck is explicitly playing, and it tears itself down the moment none are. SIM is a module
   singleton, so truck positions survive page navigation. */
import { useEffect, useState } from "react";
import { TRUCKS } from "./fleet.js";

export const TIMELAPSE = 600; // 1 s of wall clock = 10 min of simulated transit (only while playing)
export const BASE_SPEED = { "TRK-101": 62, "TRK-204": 58, "TRK-309": 66, "TRK-412": 54 };
const BEND = { "TRK-101": 1, "TRK-204": -1, "TRK-309": 1, "TRK-412": -1 };

const _rad = d => d * Math.PI / 180;
function hav(a, b) {
  const x = Math.sin(_rad(b[0] - a[0]) / 2) ** 2 + Math.cos(_rad(a[0])) * Math.cos(_rad(b[0])) * Math.sin(_rad(b[1] - a[1]) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}
function buildRoute(t) {
  const legs = [], pts = [], cum = [], idxAt = [0], k = 0.09 * BEND[t.id];
  for (let j = 0; j < 3; j++) {
    const A = t.cps[j], B = t.cps[j + 1], dLa = B[0] - A[0], dLo = B[1] - A[1];
    const c = [(A[0] + B[0]) / 2 - dLo * k, (A[1] + B[1]) / 2 + dLa * k];
    const leg = [];
    for (let s = 0; s <= 40; s++) { const f = s / 40, u = 1 - f; leg.push([u * u * A[0] + 2 * u * f * c[0] + f * f * B[0], u * u * A[1] + 2 * u * f * c[1] + f * f * B[1]]); }
    legs.push(leg);
    (j === 0 ? leg : leg.slice(1)).forEach(p => { cum.push(pts.length ? cum[cum.length - 1] + hav(pts[pts.length - 1], p) : 0); pts.push(p); });
    idxAt.push(pts.length - 1);
  }
  const total = cum[cum.length - 1];
  return { legs, pts, cum, total, frac: idxAt.map(i => cum[i] / total) };
}
export const ROUTES = Object.fromEntries(TRUCKS.map(t => [t.id, buildRoute(t)]));
export const ALL_ROUTE_PTS = TRUCKS.flatMap(t => ROUTES[t.id].pts);

export function posAt(R, p) {
  const d = Math.min(1, Math.max(0, p)) * R.total;
  let lo = 0, hi = R.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (R.cum[m] <= d) lo = m; else hi = m; }
  const span = R.cum[hi] - R.cum[lo] || 1, f = (d - R.cum[lo]) / span;
  return [R.pts[lo][0] + (R.pts[hi][0] - R.pts[lo][0]) * f, R.pts[lo][1] + (R.pts[hi][1] - R.pts[lo][1]) * f];
}
export function legOf(R, p) {
  let j = 0; while (j < 2 && p >= R.frac[j + 1]) j++;
  return { j, f: Math.min(1, Math.max(0, (p - R.frac[j]) / (R.frac[j + 1] - R.frac[j]))) };
}

export const SIM = {
  p: { "TRK-101": 0.18, "TRK-204": 0.42, "TRK-309": 0.07, "TRK-412": 0.6 },
  playing: {}, halted: {}, arrived: {}, speed: {}, subs: new Set(), raf: 0, last: 0,
  notify() { this.subs.forEach(f => f()); },
  isGoing(id) { return !!(this.playing[id] && !this.halted[id] && !this.arrived[id]); },
  anyPlaying() { return TRUCKS.some(t => this.isGoing(t.id)); },
  start() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = now => { this.step(now); this.raf = this.anyPlaying() ? requestAnimationFrame(loop) : 0; };
    this.raf = requestAnimationFrame(loop);
  },
  step(now) {
    const dt = Math.min(0.25, (now - this.last) / 1000); this.last = now;
    TRUCKS.forEach(t => {
      const R = ROUTES[t.id], go = this.isGoing(t.id);
      this.speed[t.id] = go ? BASE_SPEED[t.id] : 0;
      if (!go) return;
      this.p[t.id] += BASE_SPEED[t.id] / R.total / 3600 * TIMELAPSE * dt;
      if (this.p[t.id] >= 1) { this.p[t.id] = 1; this.arrived[t.id] = true; this.playing[t.id] = false; this.speed[t.id] = 0; }
    });
    this.notify();
  },
  setPlaying(id, on) {
    if (on && this.halted[id]) return;
    if (on && this.arrived[id]) { this.p[id] = 0; this.arrived[id] = false; }
    this.playing[id] = on; this.speed[id] = on ? BASE_SPEED[id] : 0;
    if (on) this.start();
    this.notify();
  },
  setFleetPlaying(on) {
    TRUCKS.forEach(t => {
      if (on && this.halted[t.id]) return;
      if (on && this.arrived[t.id]) { this.p[t.id] = 0; this.arrived[t.id] = false; }
      this.playing[t.id] = on; this.speed[t.id] = on ? BASE_SPEED[t.id] : 0;
    });
    if (on) this.start();
    this.notify();
  },
  scrub(id, p) { this.p[id] = p; this.arrived[id] = p >= 1; this.playing[id] = false; this.speed[id] = 0; this.notify(); },
};

/* subscribe a component to SIM changes; throttled with a trailing call so the last value always lands */
export function useSimTick(ms) {
  const [, f] = useState(0);
  useEffect(() => {
    let last = 0, timer = 0;
    const fn = () => {
      const n = performance.now(), wait = ms - (n - last);
      if (wait <= 0) { last = n; clearTimeout(timer); timer = 0; f(x => x + 1); }
      else if (!timer) timer = setTimeout(() => { timer = 0; last = performance.now(); f(x => x + 1); }, wait);
    };
    SIM.subs.add(fn);
    return () => { SIM.subs.delete(fn); clearTimeout(timer); };
  }, [ms]);
}

/* live telemetry for one truck at its current simulated position */
export function telem(t, Lr, au) {
  const R = ROUTES[t.id], p = SIM.p[t.id], { j, f } = legOf(R, p);
  const a = Lr.db[j], b = Lr.db[j + 1];
  const temp = a.tempC + (b.tempC - a.tempC) * f;
  const halted = !au.intact, arrived = !!SIM.arrived[t.id], playing = !!SIM.playing[t.id];
  let lv = -1; for (let k = 0; k <= j; k++) if (au.nodes[k].status === "VALID") lv = k;
  const next = Math.min(3, j + 1), kmLeft = Math.max(0, (R.frac[next] - p) * R.total);
  const h = kmLeft / BASE_SPEED[t.id];
  const eta = arrived ? "DELIVERED" : halted ? "HELD" : `${Math.floor(h)}h ${String(Math.round((h % 1) * 60) % 60).padStart(2, "0")}m`;
  return { pos: posAt(R, p), p, speed: SIM.speed[t.id] || 0, temp, weight: a.weightKg, halted, arrived, playing, nextIdx: next, eta,
    hash: lv >= 0 ? au.nodes[lv].st.hash : null };
}

/* single status word used by the roster, sidebar and map callout */
export function movementOf(id, au) {
  if (!au.intact) return "HELD";
  if (SIM.arrived[id]) return "DELIVERED";
  return SIM.playing[id] ? "EN ROUTE" : "PAUSED";
}
