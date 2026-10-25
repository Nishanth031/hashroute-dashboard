/* System-wide feed of the latest verification findings. Static by design: no marquee —
   new entries arrive at the left with a single 1.2s background fade. */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FADE, flash, sevTone } from "./Flash.jsx";
import { ALERT_SEV } from "../utils/fleet.js";
import { useHashRoute } from "../utils/store.jsx";

export default function AlertTicker() {
  const { log, summary } = useHashRoute();
  const navigate = useNavigate();
  const items = useMemo(() => log.filter(l => l.sev !== "INFO").slice(-14).reverse(), [log]);
  const alerts = useMemo(() => log.filter(l => ALERT_SEV.has(l.sev)).length, [log]);

  return (
    <section className="panel ticker" aria-label="System alert feed">
      <div className="tk-lab">
        <span className={"dot " + (summary.allOk ? "ok" : "bad")} />
        <div>
          <div className="micro">System feed</div>
          <b>{summary.allOk ? "Nominal" : `${summary.breaches} breach${summary.breaches === 1 ? "" : "es"}`}</b>
          <div className="micro dim">{alerts} alert event{alerts === 1 ? "" : "s"}</div>
        </div>
      </div>
      <div className="tk-row" role="list" aria-live="polite">
        {items.map(l => {
          const f = flash(sevTone(l.sev)), fresh = Date.now() - l.at < 1500;
          return (
            <button key={l.id} role="listitem" className="tk-chip" onClick={() => navigate(l.truck ? `/truck/${l.truck}` : "/ledger")}>
              {/* overlay carries the fade so the chip keeps its opaque surface */}
              <motion.span className="tk-flash" aria-hidden="true"
                initial={fresh ? { backgroundColor: f.on } : false} animate={{ backgroundColor: f.off }} transition={FADE} />
              <span className="tk-top">
                <span className={"sev " + l.sev}>{l.sev}</span>
                <span className="mono dim">{l.ts.slice(0, 8)}</span>
                {l.truck && <span className="mono">{l.truck}{l.cp ? ` · ${l.cp}` : ""}</span>}
              </span>
              <span className="tk-msg">{l.msg}</span>
            </button>
          );
        })}
        {!items.length && <div className="empty">No verification events yet.</div>}
      </div>
    </section>
  );
}
