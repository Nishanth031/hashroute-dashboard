import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { BrandMark, IconChevron, IconGrid, IconKey, IconLedger } from "./Icons.jsx";
import { ALERT_SEV, TRUCKS } from "../utils/fleet.js";
import { keyFingerprint } from "../utils/crypto.js";
import { useHashRoute } from "../utils/store.jsx";
import { announceLayout } from "../utils/hooks.js";

const IND_SPRING = { type: "spring", stiffness: 520, damping: 42 };
const W_OPEN = 248, W_SHUT = 64;

function NavItem({ to, icon, label, sub, status, badge, collapsed, active }) {
  return (
    <Link to={to} className={"nav-i" + (active ? " on" : "")} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined}>
      {active && <motion.span layoutId="nav-active" className="nav-ind" transition={IND_SPRING} />}
      <span className="nav-ic">{icon}</span>
      {!collapsed && <span className="nav-tx"><b>{label}</b>{sub && <small>{sub}</small>}</span>}
      {status && <span className={"dot " + status} aria-label={status === "ok" ? "verified" : "breach"} />}
      {!collapsed && badge ? <span className="nav-badge">{badge}</span> : null}
    </Link>
  );
}

export default function Sidebar({ collapsed, canToggle, onToggle }) {
  const { pathname } = useLocation();
  const { audits, log, summary } = useHashRoute();
  const alerts = useMemo(() => log.filter(l => ALERT_SEV.has(l.sev)).length, [log]);
  const fp = keyFingerprint();

  return (
    <motion.aside className={"sb" + (collapsed ? " shut" : "")} initial={false}
      animate={{ width: collapsed ? W_SHUT : W_OPEN }} transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      onAnimationComplete={announceLayout} aria-label="Primary">
      <div className="sb-brand">
        <BrandMark ok={summary.allOk} />
        {!collapsed && <div className="sb-name"><b>HashRoute</b><span>Integrity Console</span></div>}
      </div>

      <nav className="sb-nav">
        <div className="sb-sec">{collapsed ? <hr /> : "Overview"}</div>
        <NavItem to="/" icon={<IconGrid />} label="Fleet Overview" collapsed={collapsed} active={pathname === "/"} />

        <div className="sb-sec">{collapsed ? <hr /> : "Corridors"}</div>
        {TRUCKS.map(t => (
          <NavItem key={t.id} to={`/truck/${t.id}`} icon={<span className="nav-code">{t.id.slice(4)}</span>}
            label={t.id} sub={t.cargo} status={audits[t.id].intact ? "ok" : "bad"}
            collapsed={collapsed} active={pathname === `/truck/${t.id}`} />
        ))}

        <div className="sb-sec">{collapsed ? <hr /> : "Forensics"}</div>
        <NavItem to="/ledger" icon={<IconLedger />} label="Global Ledger" sub={`${log.length} events`} badge={alerts || null}
          collapsed={collapsed} active={pathname === "/ledger"} />
      </nav>

      {canToggle && (
        <button className="sb-tog" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : undefined}>
          <span className="nav-ic"><IconChevron flip={collapsed} /></span>
          {!collapsed && <span>Collapse</span>}
        </button>
      )}

      <div className="sb-key" title={collapsed ? `Active HMAC key fingerprint ${fp}` : undefined}>
        <span className="nav-ic"><IconKey /></span>
        {!collapsed && (
          <div className="sb-key-tx">
            <span className="micro">Active key fingerprint</span>
            <b>{fp.slice(0, 4)} {fp.slice(4)}</b>
            <span className="micro dim">HMAC-SHA256 · {TRUCKS.length * 4} keys</span>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
