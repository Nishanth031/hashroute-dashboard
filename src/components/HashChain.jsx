import { Fragment, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { Flash } from "./Flash.jsx";
import { GENESIS } from "../utils/crypto.js";
import { STAGES, sh, shT, sign, stTone } from "../utils/fleet.js";

/* ---------- hash display ---------- */
function HashText({ val, against, full }) {
  if (!full) return shT(val);
  const rows = [val.slice(0, 32), val.slice(32)];
  return rows.map((r, ri) => (
    <div key={ri}>{Array.from(r).map((ch, ci) => (against && against[ri * 32 + ci] !== ch ? <i key={ci}>{ch}</i> : ch))}</div>
  ));
}
function HashCell({ label, val, against, tone, full, tag }) {
  return (
    <div className={"hc " + tone}>
      <div className="lb"><span>{label}</span><span>{tag}</span></div>
      <Flash v={val} bad={tone !== "ok"} className="hx"><HashText val={val} against={against} full={full} /></Flash>
    </div>
  );
}

/* ---------- connector between checkpoint cards (static) ---------- */
function Connector({ status }) {
  const tone = stTone(status);
  const label = tone === "ok" ? "hash link intact" : tone === "bad" ? "fracture · sha-256 mismatch propagates" : "prev_hash mismatch · cascade";
  return <div className={"conn " + tone} aria-hidden="true"><i /><span>{label}</span></div>;
}

/* ---------- checkpoint card ---------- */
function Checkpoint({ truck, n, hi }) {
  const [open, setOpen] = useState(false);
  const controls = useAnimationControls();
  const { status, db, st, i } = n;
  const tone = stTone(status), ok = tone === "ok", origin = tone === "bad";
  const cls = ok ? "ok" : origin ? "origin" : "down";
  const wBad = n.dW !== 0, tBad = n.dT !== 0;
  const spoil = Math.abs(n.dT) > truck.band;
  const wDiff = wBad ? `${truck.weight} kg → ${db.weightKg} kg (${sign(n.dW)} kg ${n.dW < 0 ? "STOLEN" : "UNMANIFESTED"})` : null;
  const tDiff = tBad ? `${truck.temps[i]}°C → ${db.tempC}°C (${spoil ? "THERMAL SPOILAGE" : "TEMP DRIFT " + sign(n.dT, 1) + "°C"})` : null;
  const statLabel = ok ? "SEALED" : origin ? "TAMPERED ORIGIN" : "CHAIN BROKEN";

  /* directional shake, only when this block transitions into a tampered state */
  const prev = useRef(status);
  useEffect(() => {
    if (prev.current !== "COMPROMISED_ORIGIN" && status === "COMPROMISED_ORIGIN") {
      controls.start({ x: [0, -6, 6, -3, 3, 0], transition: { duration: 0.45, ease: "easeInOut" } });
    }
    prev.current = status;
  }, [status, controls]);

  return (
    <div id={"cp-card-" + i} className="cpw">
      <motion.div className={"cp " + cls + (hi ? " hi" : "")} animate={controls}>
        <div className="cp-h">
          <div className="cp-idx">{String(i + 1).padStart(2, "0")}</div>
          <div className="cp-t">
            <div className="st">CP{i + 1} · {STAGES[i]} · Block #{i + 1}</div>
            <div className="pl">{truck.places[i]}</div>
          </div>
          <span className={"badge " + tone}>{statLabel}</span>
        </div>
        <div className="row">
          <span className="pill">{db.handlerId}</span>
          <span className={"pill " + (n.hmacOk ? "ok" : origin ? "bad" : "warn")}>{n.hmacOk ? "✓ HMAC-SHA256 VALID" : "✕ INVALID SIGNATURE"}</span>
          {n.hChanged && <span className="diff">{truck.handlers[i]} → {db.handlerId} · HANDLER SPOOFED</span>}
          <span className="ts">{truck.times[i]}</span>
        </div>
        <div className="metrics">
          <div className={"met " + (wBad ? "bad" : "")}>
            <div className="lb">Cargo weight</div>
            <Flash v={db.weightKg} bad={wBad} className="val">{db.weightKg}<small>kg</small></Flash>
            {wDiff && <div className="diff">{wDiff}</div>}
          </div>
          <div className={"met " + (tBad ? "bad" : "")}>
            <div className="lb">Temperature</div>
            <Flash v={db.tempC} bad={tBad} className="val">{Number(db.tempC).toFixed(1)}<small>°C</small></Flash>
            {tDiff && <div className={"diff " + (spoil ? "" : "amb")}>{tDiff}</div>}
          </div>
        </div>
        <div className="foot">
          <div className="hashes">
            <HashCell label="prev_hash" tag={n.linkOk && st.prev === n.recomputedPrev ? "MATCH" : "LINK"} val={st.prev} against={n.recomputedPrev} full={open} tone={st.prev === n.recomputedPrev ? "ok" : "warn"} />
            <HashCell label="stored_hash" tag="LEDGER" val={st.hash} against={n.recomputedHash} full={open} tone={n.hashOk ? "ok" : tone} />
            <HashCell label="recomputed_hash" tag={n.hashOk ? "MATCH" : "DIFF"} val={n.recomputedHash} against={st.hash} full={open} tone={n.hashOk ? "ok" : tone} />
          </div>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div key="x" className="xpand" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <div className="hc"><div className="lb"><span>stored hmac_signature</span></div><div className="hx">{st.hmac}</div></div>
                <div className={"hc " + (n.hmacOk ? "ok" : tone)}><div className="lb"><span>expected hmac (recomputed)</span></div><div className="hx">{n.expectedHmac}</div></div>
                <div className="payload">payload = {n.payload}</div>
              </motion.div>
            )}
          </AnimatePresence>
          <button className="xbtn" onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? "− collapse full hashes" : "+ expand full hashes"}</button>
        </div>
      </motion.div>
    </div>
  );
}

export default function HashChain({ truck, audit, hi }) {
  return (
    <section aria-label={`Hash chain ${truck.id}`}>
      <div className="sec-h"><h3>Hash chain · {truck.id}</h3><span>genesis {sh(GENESIS)} → block #4</span></div>
      <div className="pipe">
        {audit.nodes.map((n, i) => (
          <Fragment key={n.i}>
            <Checkpoint truck={truck} n={n} hi={hi === i} />
            {i < 3 && <Connector status={n.status} />}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
