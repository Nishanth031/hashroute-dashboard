import { Link, useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import AlertTicker from "../components/AlertTicker.jsx";
import GeoMap, { MapLegend } from "../components/GeoMap.jsx";
import { TRUCKS, stTone } from "../utils/fleet.js";
import { SIM, movementOf, useSimTick } from "../utils/sim.js";
import { useHashRoute } from "../utils/store.jsx";

function Kpi({ label, value, sub, tone = "", children }) {
  return (
    <div className={"kcard " + tone}>
      <div className="lb">{label}</div>
      <div className="v">{value}</div>
      {children}
      <div className="sub">{sub}</div>
    </div>
  );
}

function RosterRow({ t, au }) {
  const mv = movementOf(t.id, au), p = SIM.p[t.id];
  return (
    <Link to={`/truck/${t.id}`} className="ro">
      <span className="ro-id mono">{t.id}</span>
      <span className="ro-tx"><b>{t.cargo}</b><small>{t.cls} · {t.short}</small></span>
      <span className="ro-segs" aria-label={`${au.verified} of 4 blocks verified`}>
        {au.nodes.map(n => <i key={n.i} className={"seg " + stTone(n.status)} />)}
      </span>
      <span className="ro-prog">
        <span className="bar"><i style={{ width: (p * 100).toFixed(1) + "%" }} /></span>
        <span className="mono dim">{(p * 100).toFixed(0)}%</span>
      </span>
      <span className={"badge " + (mv === "HELD" ? "bad" : mv === "PAUSED" ? "" : "ok")}>{mv}</span>
    </Link>
  );
}

export default function FleetOverview() {
  const { audits, ledger, summary } = useHashRoute();
  const navigate = useNavigate();
  useSimTick(250);

  const moving = TRUCKS.filter(t => SIM.isGoing(t.id)).length;
  const delivered = TRUCKS.filter(t => movementOf(t.id, audits[t.id]) === "DELIVERED").length;
  const paused = TRUCKS.filter(t => movementOf(t.id, audits[t.id]) === "PAUSED").length;
  const playable = TRUCKS.some(t => !SIM.halted[t.id]);
  const segs = TRUCKS.flatMap(t => audits[t.id].nodes.map(n => ({ k: t.id + n.i, tone: stTone(n.status) })));

  return (
    <div className="page">
      <PageHeader eyebrow="Operations · Fleet" title="Fleet Overview"
        sub="Four cold-chain corridors across India, each sealed by a SHA-256 hash chain and per-handler HMAC signatures." />

      <AlertTicker />

      <section className="kpi-matrix" aria-label="Fleet KPIs">
        <Kpi label="Chain integrity" tone={summary.verified === summary.total ? "ok" : "warn"}
          value={<>{summary.verified}<small>/{summary.total} blocks</small></>} sub="SHA-256 links + HMAC-SHA256 signatures">
          <div className="segs">{segs.map(s => <i key={s.k} className={"seg " + s.tone} />)}</div>
        </Kpi>
        <Kpi label="Integrity breaches" tone={summary.breaches ? "bad" : "ok"} value={summary.breaches}
          sub={summary.held ? `${summary.held} chain${summary.held > 1 ? "s" : ""} held at tampered origin` : "No tampered origins detected"} />
        <Kpi label="Cargo in verified custody" tone={summary.hold ? "warn" : ""}
          value={<>{summary.custody.toLocaleString("en-IN")}<small>kg</small></>}
          sub={summary.hold ? `${summary.hold.toLocaleString("en-IN")} kg on forensic hold` : "All cargo under verified custody"} />
        <Kpi label="Fleet movement" value={<>{moving}<small>/{TRUCKS.length} en route</small></>}
          sub={`${delivered} delivered · ${summary.held} held · ${paused} paused`} />
      </section>

      <section className="panel map-panel" aria-label="Live fleet map">
        <div className="panel-h">
          <div><h2>Live fleet map</h2><div className="meta">All corridors · select a truck or pin to open its chain</div></div>
          <div className="row gap-l">
            <MapLegend />
            <button className="btn sm" disabled={!moving && !playable} onClick={() => SIM.setFleetPlaying(!moving)}>
              {moving ? "❚❚ Pause fleet" : "▶ Play fleet"}
            </button>
          </div>
        </div>
        <div className="mapbox tall">
          <GeoMap audits={audits} ledger={ledger}
            onSelectTruck={id => navigate(`/truck/${id}`)} onPin={(id, i) => navigate(`/truck/${id}?cp=${i}`)} />
        </div>
        <div className="roster" aria-label="Corridor roster">
          {TRUCKS.map(t => <RosterRow key={t.id} t={t} au={audits[t.id]} />)}
        </div>
      </section>
    </div>
  );
}
