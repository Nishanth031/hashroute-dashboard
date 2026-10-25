import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SPOOF, STAGES, TRUCKS, mkLog, sign } from "../utils/fleet.js";
import { useHashRoute } from "../utils/store.jsx";

/* Insider-threat simulator: writes straight to the checkpoint DB row, bypassing handler signing. */
export default function RedTeamConsole({ truck, target, onTarget }) {
  const { ledger, inject, reset, push } = useHashRoute();
  const navigate = useNavigate();
  const rec = ledger[truck.id].db[target];
  const [draft, setDraft] = useState({ w: rec.weightKg, t: rec.tempC, h: rec.handlerId });
  useEffect(() => { setDraft({ w: rec.weightKg, t: rec.tempC, h: rec.handlerId }); }, [truck.id, target, rec]);

  const run = (vals, idx, note) => { inject(truck.id, idx, vals, note); onTarget(idx); };
  const injectDraft = () => {
    const w = Number(draft.w), t = Number(draft.t);
    if (draft.w === "" || draft.t === "" || !Number.isFinite(w) || !Number.isFinite(t) || !String(draft.h).trim()) {
      push([mkLog("WARN", "Injection rejected: weight, temperature and handler must hold valid values.", { truck: truck.id })]);
      return;
    }
    inject(truck.id, target, { weightKg: Math.round(w), tempC: Math.round(t * 10) / 10, handlerId: String(draft.h).trim() });
  };

  const pend = [];
  if (Number(draft.w) !== rec.weightKg) pend.push(`weight_kg = ${Math.round(Number(draft.w))}`);
  if (Number(draft.t) !== rec.tempC) pend.push(`temp_c = ${Number(draft.t).toFixed(1)}`);
  if (draft.h !== rec.handlerId) pend.push(`handler_id = '${draft.h}'`);
  const dW = Number(draft.w) - truck.weight, dT = Number(draft.t) - truck.temps[target];
  const wMax = Math.round(truck.weight * 1.25);

  const presets = [
    { label: "Simulate 80 kg cargo theft at port", sub: "CP2", run: () => run({ weightKg: truck.weight - 80 }, 1, "Insider cargo theft") },
    { label: "Simulate freezer-failure cover-up", sub: "CP3", run: () => run({ tempC: truck.spike }, 2, "Telemetry cover-up of reefer failure") },
    { label: "Simulate unauthorized handler spoof", sub: "CP2", run: () => run({ handlerId: SPOOF }, 1, "Handler identity spoof") },
  ];

  return (
    <section className="panel console" aria-label="Insider threat and tamper simulator">
      <div className="panel-h"><h2>Red-team · DB injection console</h2><span className="tag">SIMULATION</span></div>
      <div className="console-b">
        <div className="blk">
          <div className="lb">Target</div>
          <div className="seg-ctl" role="group" aria-label="Truck">
            {TRUCKS.map(t => (
              <button key={t.id} className={"opt " + (t.id === truck.id ? "on" : "")} aria-pressed={t.id === truck.id}
                onClick={() => t.id !== truck.id && navigate(`/truck/${t.id}`)}>{t.id}</button>
            ))}
          </div>
          <div className="seg-ctl" role="group" aria-label="Checkpoint">
            {STAGES.map((s, i) => (
              <button key={s} className={"opt " + (i === target ? "on" : "")} aria-pressed={i === target} onClick={() => onTarget(i)}>CP{i + 1} {s}</button>
            ))}
          </div>
          <div className="tgt">Checkpoint {target + 1} — {STAGES[target]} / {truck.places[target]}</div>
        </div>

        <div className="blk">
          <div className="lb">Live database fields</div>
          <div className="flds">
            <div className="fld">
              <div className="top">
                <label htmlFor="in-w">recorded_weight_kg</label>
                <input id="in-w" className="inp" type="number" value={draft.w} min="0" max={wMax}
                  onChange={e => setDraft(d => ({ ...d, w: e.target.value === "" ? "" : Number(e.target.value) }))} />
              </div>
              <input type="range" aria-label="Weight slider" min="0" max={wMax} step="1" value={draft.w === "" ? 0 : draft.w}
                onChange={e => setDraft(d => ({ ...d, w: Number(e.target.value) }))} />
              <div className={"dl " + (dW ? "bad" : "")}>baseline {truck.weight} kg {dW ? `· Δ ${sign(dW)} kg` : ""}</div>
            </div>
            <div className="fld">
              <div className="top">
                <label htmlFor="in-t">recorded_temp_c</label>
                <input id="in-t" className="inp" type="number" step="0.1" value={draft.t} min={truck.tempRange[0]} max={truck.tempRange[1]}
                  onChange={e => setDraft(d => ({ ...d, t: e.target.value === "" ? "" : Number(e.target.value) }))} />
              </div>
              <input type="range" aria-label="Temperature slider" min={truck.tempRange[0]} max={truck.tempRange[1]} step="0.1"
                value={draft.t === "" ? truck.tempRange[0] : draft.t} onChange={e => setDraft(d => ({ ...d, t: Number(e.target.value) }))} />
              <div className={"dl " + (dT ? "bad" : "")}>baseline {truck.temps[target]}°C {dT ? `· Δ ${sign(dT, 1)}°C` : ""}</div>
            </div>
            <div className="fld full">
              <div className="top"><label htmlFor="in-h">handler_id</label></div>
              <input id="in-h" className="inp wide" type="text" value={draft.h} spellCheck="false" onChange={e => setDraft(d => ({ ...d, h: e.target.value }))} />
            </div>
          </div>
          <div className="sql">
            {pend.length
              ? <><b>UPDATE</b> checkpoints <b>SET</b> {pend.join(", ")} <b>WHERE</b> id = '{truck.id}-CP{target + 1}'; -- signature bypassed</>
              : "-- no pending delta. edit a field above."}
          </div>
        </div>

        <div className="blk">
          <div className="lb">Quick-attack presets</div>
          <div className="presets">
            {presets.map(p => <button key={p.label} className="pre" onClick={p.run}>{p.label}<span>{p.sub} · 1-click</span></button>)}
          </div>
        </div>

        <div className="cta-row">
          <motion.button whileTap={{ scale: 0.98 }} className="btn primary block" onClick={injectDraft}>Inject unauthorised DB edit (bypass signing)</motion.button>
          <motion.button whileTap={{ scale: 0.98 }} className="btn block" onClick={reset}>Restore immutable backup / reset ledger</motion.button>
        </div>
      </div>
    </section>
  );
}
