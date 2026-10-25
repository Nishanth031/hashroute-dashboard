import { useMemo, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import AuditTable from "../components/AuditTable.jsx";
import { ALL_HANDLERS, SEVERITIES, TRUCKS } from "../utils/fleet.js";
import { useHashRoute } from "../utils/store.jsx";

const matches = (l, q) => {
  if (!q) return true;
  const d = l.digest || {};
  return [l.msg, l.handler, l.truck, l.cp, l.stage, l.sev, d.algo, d.exp, d.got].some(v => v && String(v).toLowerCase().includes(q));
};

export default function GlobalLedger() {
  const { log } = useHashRoute();
  const [sev, setSev] = useState(() => new Set());
  const [truck, setTruck] = useState("ALL");
  const [handler, setHandler] = useState("ALL");
  const [q, setQ] = useState("");

  const counts = useMemo(() => Object.fromEntries(SEVERITIES.map(s => [s, log.filter(l => l.sev === s).length])), [log]);
  const handlers = useMemo(() => [...new Set([...ALL_HANDLERS, ...log.map(l => l.handler).filter(Boolean)])].sort(), [log]);
  const needle = q.trim().toLowerCase();
  const rows = useMemo(() => log.filter(l =>
    (!sev.size || sev.has(l.sev)) &&
    (truck === "ALL" || l.truck === truck) &&
    (handler === "ALL" || l.handler === handler) &&
    matches(l, needle)
  ).slice().reverse(), [log, sev, truck, handler, needle]);

  const toggleSev = s => setSev(prev => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n; });
  const dirty = sev.size > 0 || truck !== "ALL" || handler !== "ALL" || needle !== "";
  const clear = () => { setSev(new Set()); setTruck("ALL"); setHandler("ALL"); setQ(""); };

  return (
    <div className="page page-fill">
      <PageHeader eyebrow="Forensics · Ledger" title="Global Ledger"
        sub={`${log.length} forensic events across all corridors, newest first. Select a row to inspect its digests.`} />

      <section className="panel filters" aria-label="Ledger filters">
        <div className="fgrp">
          <span className="micro">Severity</span>
          <div className="chips" role="group" aria-label="Severity">
            {SEVERITIES.map(s => (
              <button key={s} className={"chip " + (sev.has(s) ? "on" : "")} aria-pressed={sev.has(s)} aria-label={`${s}, ${counts[s]} events`} onClick={() => toggleSev(s)}>
                <span className={"sev " + s}>{s}</span><span className="n mono">{counts[s]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="fgrp">
          <span className="micro">Corridor</span>
          <div className="seg-ctl sm" role="group" aria-label="Corridor">
            {["ALL", ...TRUCKS.map(t => t.id)].map(id => (
              <button key={id} className={"opt " + (truck === id ? "on" : "")} aria-pressed={truck === id} onClick={() => setTruck(id)}>{id === "ALL" ? "All" : id.slice(4)}</button>
            ))}
          </div>
        </div>
        <div className="fgrp">
          <label className="micro" htmlFor="f-h">Handler</label>
          <select id="f-h" className="sel" value={handler} onChange={e => setHandler(e.target.value)}>
            <option value="ALL">All handlers</option>
            {handlers.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div className="fgrp grow">
          <label className="micro" htmlFor="f-q">Search</label>
          <input id="f-q" className="inp wide" type="search" value={q} placeholder="message, digest, checkpoint…" spellCheck="false" onChange={e => setQ(e.target.value)} />
        </div>
        <button className="btn sm" disabled={!dirty} onClick={clear}>Clear filters</button>
      </section>

      <section className="panel grid-panel" aria-label="Forensic events">
        <div className="panel-h">
          <h2>Forensic events</h2>
          <span className="meta">{rows.length}/{log.length} shown</span>
        </div>
        <AuditTable rows={rows} variant="full" />
      </section>
    </div>
  );
}
