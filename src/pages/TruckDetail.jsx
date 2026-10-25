import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import PageHeader from "../components/PageHeader.jsx";
import GeoMap, { MapLegend } from "../components/GeoMap.jsx";
import Scrubber from "../components/Scrubber.jsx";
import HashChain from "../components/HashChain.jsx";
import RedTeamConsole from "../components/RedTeamConsole.jsx";
import AuditTable from "../components/AuditTable.jsx";
import { keyFingerprint } from "../utils/crypto.js";
import { ALERT_SEV, STAGES, deltaText, mkLog, sh, sign, stTone, truckById } from "../utils/fleet.js";
import { prefersReduced } from "../utils/hooks.js";
import { useHashRoute } from "../utils/store.jsx";

export default function TruckDetail() {
  const { id } = useParams();
  const truck = truckById(id);
  if (!truck) return <Navigate to="/" replace />;
  return <TruckView truck={truck} />;
}

function IntegrityStrip({ truck, a }) {
  const first = a.origins[0], downstream = a.nodes.length - a.verified - a.origins.length;
  return (
    <section className={"strip " + (a.intact ? "ok" : "bad")} aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={a.intact ? "ok" : "bad" + first.i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {a.intact ? (
            <>
              <h2>All cryptographic signatures intact</h2>
              <p>{truck.id} · 4 of 4 blocks re-verified. Every SHA-256 link and HMAC-SHA256 handler signature matches the ledger.</p>
            </>
          ) : (
            <>
              <h2>Breach detected · Checkpoint {first.i + 1} ({STAGES[first.i]}) compromised
                {a.origins.length > 1 ? ` + ${a.origins.length - 1} more origin${a.origins.length > 2 ? "s" : ""}` : ""}</h2>
              <p>{truck.places[first.i]} · {downstream} downstream block{downstream === 1 ? "" : "s"} invalidated by the broken hash chain.</p>
              <div className="facts">
                <span className="fact">Handler {truck.handlers[first.i]}</span>
                <span className="fact bad">Δ {deltaText(first)}</span>
                <span className="fact">expected {sh(first.st.hash)}</span>
                <span className="fact">got {sh(first.recomputedHash)}</span>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function TruckView({ truck }) {
  const { audits, ledger, log, push } = useHashRoute();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const cp0 = params.has("cp") ? Number(params.get("cp")) : NaN;
  const [target, setTarget] = useState(() => (Number.isInteger(cp0) && cp0 >= 0 && cp0 < 4 ? cp0 : 1));
  const [follow, setFollow] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [hi, setHi] = useState(-1);
  const hiT = useRef(0);

  const a = audits[truck.id], L = ledger[truck.id];

  const focusCp = i => {
    setTarget(i); setHi(i);
    clearTimeout(hiT.current); hiT.current = setTimeout(() => setHi(-1), 2300);
    const c = document.getElementById("cp-card-" + i);
    if (c) c.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "center" });
  };

  useEffect(() => {
    push([mkLog("INFO", `Opened ${truck.id} (${truck.cargo}). Re-verified ${a.verified}/4 blocks.`, { truck: truck.id })]);
    /* arriving from a fleet-map pin: wait for the page transition, then bring that block into view */
    const k = Number.isInteger(cp0) ? setTimeout(() => focusCp(target), 260) : 0;
    return () => { clearTimeout(k); clearTimeout(hiT.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pinClick = (id, i) => {
    if (id !== truck.id) { navigate(`/truck/${id}?cp=${i}`); return; }
    focusCp(i);
    push([mkLog("INFO", `Map pin CP${i + 1} ${STAGES[i]} selected. Tamper console target synced.`, { truck: id, cp: "CP" + (i + 1), stage: STAGES[i] })]);
  };

  const rows = useMemo(() => log
    .filter(l => (!l.truck || l.truck === truck.id) && (filter === "ALL" || ALERT_SEV.has(l.sev)))
    .slice().reverse().slice(0, 200), [log, filter, truck.id]);
  const ownCount = useMemo(() => log.filter(l => !l.truck || l.truck === truck.id).length, [log, truck.id]);

  /* derived KPIs */
  const weights = L.db.map(r => r.weightKg), temps = L.db.map(r => r.tempC);
  const minW = Math.min(...weights);
  const spread = Math.max(...temps) - Math.min(...temps);
  const badSigs = a.nodes.filter(n => !n.hmacOk).length;

  return (
    <div className="page">
      <PageHeader eyebrow={`Corridor · ${truck.id}`} title={truck.cargo} sub={`${truck.cls} · ${truck.places[0]} → ${truck.places[3]}`}>
        <span className={"badge lg " + (a.intact ? "ok" : "bad")}>{a.intact ? "VERIFIED 4/4" : `BREACH · ${a.verified}/4`}</span>
      </PageHeader>

      <div className="detail-grid">
        <div className="col-main">
          <IntegrityStrip truck={truck} a={a} />

          <section className="panel kpis" aria-label="Telemetry">
            <div className={"kpi " + (minW < truck.weight ? "bad" : "")}>
              <div className="lb">Total cargo weight</div>
              <div className="v">{minW}<small>kg</small></div>
              <div className="sub">{minW < truck.weight ? `${sign(minW - truck.weight)} kg vs manifest ${truck.weight}` : `manifest ${truck.weight} kg · no loss`}</div>
            </div>
            <div className={"kpi " + (spread > truck.band * 1.5 ? "bad" : "")}>
              <div className="lb">Cold-chain temp variance</div>
              <div className="v">{spread.toFixed(1)}<small>°C spread</small></div>
              <div className="sub">safe band ±{truck.band.toFixed(1)}°C</div>
            </div>
            <div className={"kpi " + (a.intact ? "ok" : "bad")}>
              <div className="lb">Verified blocks</div>
              <div className="v">{a.verified}/4</div>
              <div className="segs">{a.nodes.map(n => <i key={n.i} className={"seg " + stTone(n.status)} />)}</div>
            </div>
            <div className={"kpi " + (badSigs ? "warn" : "ok")}>
              <div className="lb">Active HMAC key</div>
              <div className="v sm">fp {keyFingerprint()}</div>
              <div className="sub">{badSigs ? `${badSigs} signature${badSigs > 1 ? "s" : ""} failing` : "4 handler keys bound"}</div>
            </div>
          </section>

          <section className="panel map-panel" aria-label="Live route map">
            <div className="panel-h">
              <div><h3>Live route map · {truck.id}</h3><div className="meta">{truck.places[0]} → {truck.places[3]}</div></div>
              <div className="row gap-l">
                <MapLegend />
                <button className={"tgl " + (follow ? "on" : "")} onClick={() => setFollow(f => !f)} aria-pressed={follow}><i />Follow truck</button>
              </div>
            </div>
            <div className="mapbox">
              <GeoMap focusId={truck.id} audits={audits} ledger={ledger} follow={follow} selCp={target}
                onPin={pinClick} onSelectTruck={id => id !== truck.id && navigate(`/truck/${id}`)} />
            </div>
            <Scrubber truck={truck} au={a} />
          </section>

          <HashChain truck={truck} audit={a} hi={hi} />
        </div>

        <aside className="col-side">
          <RedTeamConsole truck={truck} target={target} onTarget={setTarget} />
          <section className="panel auditp" aria-label="Forensic audit log">
            <div className="panel-h">
              <h2>Audit · {truck.id}</h2>
              <div className="row">
                <span className="meta">{rows.length}/{ownCount}</span>
                <div className="seg-ctl sm" role="group" aria-label="Severity filter">
                  <button className={"opt " + (filter === "ALL" ? "on" : "")} aria-pressed={filter === "ALL"} onClick={() => setFilter("ALL")}>All</button>
                  <button className={"opt " + (filter === "ALERTS" ? "on" : "")} aria-pressed={filter === "ALERTS"} onClick={() => setFilter("ALERTS")}>Alerts</button>
                </div>
              </div>
            </div>
            <AuditTable rows={rows} variant="compact" />
          </section>
        </aside>
      </div>
    </div>
  );
}
