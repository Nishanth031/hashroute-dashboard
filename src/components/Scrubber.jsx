import { STAGES } from "../utils/fleet.js";
import { ROUTES, SIM, TIMELAPSE, useSimTick } from "../utils/sim.js";

/* route progress scrubber: play/pause one truck, or drag to any point on the corridor */
export default function Scrubber({ truck, au }) {
  useSimTick(0);
  const R = ROUTES[truck.id], p = SIM.p[truck.id], playing = !!SIM.playing[truck.id], halted = !au.intact;
  return (
    <div className="scr">
      <div className="scr-top">
        <button className="btn sm" disabled={halted} onClick={() => SIM.setPlaying(truck.id, !playing)} aria-label={playing ? "Pause truck" : "Play truck"}>
          {playing ? "❚❚ Pause" : p >= 1 ? "↺ Replay" : "▶ Play"}
        </button>
        <div className="scr-t mono">{truck.id} · route progress <b>{(p * 100).toFixed(1)}%</b>{halted ? " · held by integrity breach" : ""}</div>
      </div>
      <div className="track">
        <input type="range" min="0" max="1000" value={Math.round(p * 1000)} onChange={e => SIM.scrub(truck.id, Number(e.target.value) / 1000)} aria-label="Route progress scrubber" />
        {STAGES.map((s, i) => (
          <span key={s} className={"tk t" + i + (i > 0 && R.frac[i] - R.frac[i - 1] < 0.2 ? " low" : "")} style={{ left: R.frac[i] * 100 + "%" }}><i />{s}</span>
        ))}
      </div>
      <div className="scr-n mono">time-lapse ×{TIMELAPSE} while playing · dragging the slider pauses the truck</div>
    </div>
  );
}
