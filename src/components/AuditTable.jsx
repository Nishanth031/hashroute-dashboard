/* ---------- forensic audit data grid ----------
   variant "compact" → 5-column grid for the truck page side rail.
   variant "full"    → 7-column ledger grid with the event message inline. */
import { Fragment, useState } from "react";
import { motion } from "framer-motion";
import { FADE, flash, sevTone } from "./Flash.jsx";

const COLS = {
  compact: [
    { k: "ts", label: "Timestamp (UTC)", w: "24%" }, { k: "sev", label: "Severity", w: "17%" }, { k: "cpShort", label: "Checkpoint", w: "15%" },
    { k: "handler", label: "Handler ID", w: "20%" }, { k: "digest", label: "Digest", w: "24%" },
  ],
  full: [
    { k: "ts", label: "Timestamp (UTC)", w: "128px" }, { k: "sev", label: "Severity", w: "92px" }, { k: "truck", label: "Corridor", w: "86px" },
    { k: "cp", label: "Checkpoint", w: "128px" }, { k: "handler", label: "Handler ID", w: "116px" }, { k: "digest", label: "Digest", w: "158px" },
    { k: "msg", label: "Event", w: "auto" },
  ],
};
const dash = <span className="dim">—</span>;

function DigestCell({ d, sev }) {
  if (!d) return dash;
  const tone = d.ok ? "ok" : sev === "WARN" ? "warn" : "bad";
  return <><span className={"vc " + tone}>{d.algo} {d.ok ? "PASS" : "FAIL"}</span>{d.got ? <span className="dim"> {d.got.slice(0, 6)}…</span> : null}</>;
}

function cell(k, l) {
  switch (k) {
    case "ts": return <td key={k} className="ts">{l.ts}</td>;
    case "sev": return <td key={k}><span className={"sev " + l.sev}>{l.sev}</span></td>;
    case "cpShort": return (
      <td key={k} title={l.stage ? `${l.truck} · ${l.cp} ${l.stage}` : l.truck || ""}>
        {l.cp ? <><b>{l.cp}</b><span className="dim">·{l.truck.slice(4)}</span></> : <span className="dim">{l.truck ? l.truck.slice(4) : "—"}</span>}
      </td>
    );
    case "truck": return <td key={k}>{l.truck ? <b>{l.truck}</b> : <span className="dim">SYSTEM</span>}</td>;
    case "cp": return <td key={k}>{l.cp ? <><b>{l.cp}</b> <span className="dim">{l.stage}</span></> : dash}</td>;
    case "handler": return <td key={k}>{l.handler || dash}</td>;
    case "digest": return <td key={k}><DigestCell d={l.digest} sev={l.sev} /></td>;
    case "msg": return <td key={k} className="msg" title={l.msg}>{l.msg}</td>;
    default: return <td key={k} />;
  }
}

export default function AuditTable({ rows, variant = "compact", empty = "No events match this filter." }) {
  const [open, setOpen] = useState(null);
  const cols = COLS[variant];
  const flip = id => setOpen(o => (o === id ? null : id));
  return (
    <div className="dg-wrap" role="region" aria-label="Audit events" tabIndex={0}>
      <table className={"dg " + variant}>
        <colgroup>{cols.map(c => <col key={c.k} style={c.w === "auto" ? undefined : { width: c.w }} />)}</colgroup>
        <thead><tr>{cols.map(c => <th key={c.k} scope="col">{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map(l => {
            const isOpen = open === l.id;
            const f = flash(sevTone(l.sev)), fresh = Date.now() - l.at < 1500;
            return (
              <Fragment key={l.id}>
                <motion.tr className={"row-i" + (isOpen ? " open" : "")} tabIndex={0} aria-expanded={isOpen}
                  onClick={() => flip(l.id)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(l.id); } }}
                  initial={fresh ? { backgroundColor: f.on } : false} animate={{ backgroundColor: f.off }} transition={FADE}>
                  {cols.map(c => cell(c.k, l))}
                </motion.tr>
                {isOpen && (
                  <tr className="detail"><td colSpan={cols.length}>
                    <div className="dmsg">{l.msg}</div>
                    {l.digest && l.digest.exp ? (
                      <div className="dh mono"><span>ledger</span><code>{l.digest.exp}</code><span>recomputed</span><code>{l.digest.got}</code></div>
                    ) : null}
                  </td></tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty">{empty}</div>}
    </div>
  );
}
