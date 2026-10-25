/* ---------- Shared ledger state: DB rows, live audits and the forensic event log ---------- */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { STAGES, TRUCKS, audit, auditLines, buildLedger, mkLog, sh, truckById } from "./fleet.js";
import { SIM } from "./sim.js";

const Ctx = createContext(null);
const LOG_CAP = 600;

function seedLog() {
  const L0 = buildLedger();
  return [
    mkLog("INFO", "HashRoute verifier online. SHA-256 + HMAC-SHA256, 4 chains mounted from immutable backup."),
    ...TRUCKS.map(t => mkLog("OK", `${t.id} genesis anchored ${sh(L0[t.id].stored[0].hash)}. 4/4 blocks verified.`,
      { truck: t.id, cp: "CP1", stage: STAGES[0], handler: t.handlers[0], digest: { algo: "SHA-256", ok: true, got: L0[t.id].stored[0].hash } })),
  ];
}

export function HashRouteProvider({ children }) {
  const [ledger, setLedger] = useState(buildLedger);
  const [log, setLog] = useState(seedLog);
  const audits = useMemo(() => Object.fromEntries(TRUCKS.map(t => [t.id, audit(t, ledger[t.id])])), [ledger]);

  /* a broken chain halts its truck */
  useEffect(() => {
    TRUCKS.forEach(t => {
      const h = !audits[t.id].intact;
      SIM.halted[t.id] = h;
      if (h && SIM.playing[t.id]) { SIM.playing[t.id] = false; SIM.speed[t.id] = 0; }
    });
    SIM.notify();
  }, [audits]);

  const push = useCallback(lines => setLog(l => [...l, ...lines].slice(-LOG_CAP)), []);

  /* direct DB write that bypasses signing; returns false when nothing changed */
  const inject = useCallback((truckId, idx, vals, note) => {
    const truck = truckById(truckId), L = ledger[truckId], rec = L.db[idx];
    const next = { ...rec, ...vals };
    const changes = [];
    if (next.weightKg !== rec.weightKg) changes.push(`weight_kg ${rec.weightKg} → ${next.weightKg}`);
    if (next.tempC !== rec.tempC) changes.push(`temp_c ${rec.tempC} → ${next.tempC}`);
    if (next.handlerId !== rec.handlerId) changes.push(`handler_id ${rec.handlerId} → ${next.handlerId}`);
    const base = { truck: truckId, cp: "CP" + (idx + 1), stage: STAGES[idx] };
    if (!changes.length) {
      push([mkLog("WARN", `Injection ignored on ${truckId}/CP${idx + 1}: no field delta against current DB record.`, { ...base, handler: rec.handlerId })]);
      return false;
    }
    const nl = { ...ledger, [truckId]: { ...L, db: L.db.map((r, i) => (i === idx ? next : r)) } };
    setLedger(nl);
    push([mkLog("INJECT", `${note || "Direct DB write"} on ${truckId}/CP${idx + 1} (${STAGES[idx]}): ${changes.join(", ")}. Signing bypassed.`,
      { ...base, handler: next.handlerId }), ...auditLines(truck, audit(truck, nl[truckId]))]);
    return true;
  }, [ledger, push]);

  const reset = useCallback(() => {
    setLedger(buildLedger());
    push([mkLog("INFO", "Restoring immutable backup snapshot. All 4 chains rolled back."),
      ...TRUCKS.map(t => mkLog("OK", `${t.id} chain verified 4/4. Hashes and HMAC signatures match backup.`, { truck: t.id, digest: { algo: "CHAIN", ok: true } }))]);
  }, [push]);

  const summary = useMemo(() => {
    const verified = TRUCKS.reduce((s, t) => s + audits[t.id].verified, 0);
    const breaches = TRUCKS.reduce((s, t) => s + audits[t.id].origins.length, 0);
    const held = TRUCKS.filter(t => !audits[t.id].intact).length;
    const custody = TRUCKS.reduce((s, t) => s + (audits[t.id].intact ? t.weight : 0), 0);
    const hold = TRUCKS.reduce((s, t) => s + (audits[t.id].intact ? 0 : t.weight), 0);
    return { verified, total: TRUCKS.length * 4, breaches, held, custody, hold, allOk: held === 0 };
  }, [audits]);

  const value = useMemo(() => ({ ledger, audits, log, summary, push, inject, reset }), [ledger, audits, log, summary, push, inject, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useHashRoute = () => useContext(Ctx);
