/* ---------- Fleet seed data, ledger construction and live chain audit ---------- */
import { GENESIS, sha256Hex, hmacHex, handlerKey } from "./crypto.js";

export const STAGES = ["Factory", "Port", "Customs", "Warehouse"];
export const SPOOF = "HND-XXX-66";

const _iso = (start, min) => new Date(Date.parse(start) + min * 60000).toISOString().slice(0, 19) + "Z";
export const TRUCKS = [
  { id: "TRK-101", cargo: "BioVax mRNA Batch", cls: "Ultra-Cold Pharma", short: "Hyderabad → Pune", weight: 500, band: 2,
    places: ["Hyderabad Pharma City", "Shamshabad Air Cargo", "JNPT Cold Terminal (Mumbai)", "Pune Central Depot"],
    temps: [-70.2, -69.8, -70.1, -70.0], handlers: ["HND-HYD-09", "HND-SHM-14", "HND-JNP-22", "HND-PUN-04"],
    start: "2026-10-11T04:30:00Z", tempRange: [-80, 10], spike: -15 },
  { id: "TRK-204", cargo: "Insulin Glargine Biologics", cls: "Chilled Meds", short: "Baddi → Ahmedabad", weight: 1200, band: 2,
    places: ["Baddi Mfg Plant", "ICD Tughlakabad (Delhi)", "Mundra Port Cold Zone", "Ahmedabad Hub"],
    temps: [4.1, 4.3, 3.9, 4.0], handlers: ["HND-BDD-02", "HND-DEL-19", "HND-MUN-31", "HND-AMD-07"],
    start: "2026-10-12T02:10:00Z", tempRange: [-5, 30], spike: 19.5 },
  { id: "TRK-309", cargo: "Litho-Grade Silicon Wafers", cls: "Precision Cargo", short: "Sriperumbudur → Bengaluru", weight: 850, band: 1,
    places: ["Sriperumbudur Fab", "Chennai Port Customs", "Hosur Logistics Park", "Bengaluru Tech Vault"],
    temps: [18.0, 18.2, 18.1, 18.0], handlers: ["HND-SRI-11", "HND-MAA-05", "HND-HOS-17", "HND-BLR-88"],
    start: "2026-10-12T09:45:00Z", tempRange: [10, 40], spike: 31.0 },
  { id: "TRK-412", cargo: "Export-Grade Sashimi Tuna", cls: "Deep Freeze", short: "Kochi → Goa", weight: 2400, band: 2,
    places: ["Kochi Harbour Facility", "Coimbatore Chiller Hub", "Mangaluru Port Customs", "Goa Cold Storage"],
    temps: [-22.4, -22.1, -21.9, -22.2], handlers: ["HND-COK-03", "HND-CJB-12", "HND-IXE-27", "HND-GOI-15"],
    start: "2026-10-13T01:20:00Z", tempRange: [-40, 10], spike: -4.0 },
];

const GEO = {
  "TRK-101": [[17.1056, 78.4731], [17.2403, 78.4294], [18.9499, 72.9512], [18.5204, 73.8567]],
  "TRK-204": [[30.9578, 76.7914], [28.5020, 77.2847], [22.7469, 69.7042], [23.0225, 72.5714]],
  "TRK-309": [[12.9675, 79.9419], [13.0844, 80.2899], [12.7409, 77.8253], [12.9716, 77.5946]],
  "TRK-412": [[9.9674, 76.2673], [11.0168, 76.9558], [12.9279, 74.8124], [15.4021, 73.8080]],
};
TRUCKS.forEach(t => {
  t.times = [0, 460, 1145, 1820].map(m => _iso(t.start, m));
  t.cps = GEO[t.id];
});
export const truckById = id => TRUCKS.find(t => t.id === id);
export const ALL_HANDLERS = TRUCKS.flatMap(t => t.handlers);

const fmtW = v => String(Math.round(Number(v)));
const fmtT = v => Number(v).toFixed(1);
export function payloadOf(t, i, db, prev) {
  return [`${t.id}-CP${i + 1}`, t.id, STAGES[i], fmtW(db.weightKg), fmtT(db.tempC), db.handlerId, t.times[i], prev].join("|");
}

export function buildLedger() {
  const L = {};
  TRUCKS.forEach(t => {
    const db = t.places.map((_, i) => ({ weightKg: t.weight, tempC: t.temps[i], handlerId: t.handlers[i] }));
    const stored = []; let prev = GENESIS;
    db.forEach((r, i) => {
      const hash = sha256Hex(payloadOf(t, i, r, prev));
      const hmac = hmacHex(handlerKey(r.handlerId), hash);
      stored.push({ prev, hash, hmac }); prev = hash;
    });
    L[t.id] = { db, stored };
  });
  return L;
}

/* Re-verifies one chain against its live DB rows. */
export function audit(t, L) {
  const nodes = []; let prevRec = GENESIS;
  L.db.forEach((db, i) => {
    const st = L.stored[i];
    const recomputedPrev = prevRec;
    const recomputedHash = sha256Hex(payloadOf(t, i, db, recomputedPrev));
    const expectedHmac = hmacHex(handlerKey(db.handlerId), recomputedHash);
    const ownHash = sha256Hex(payloadOf(t, i, db, st.prev));
    const linkOk = st.prev === (i === 0 ? GENESIS : L.stored[i - 1].hash);
    const hashOk = st.hash === recomputedHash;
    const hmacOk = st.hmac === expectedHmac;
    let status;
    if (ownHash !== st.hash) status = "COMPROMISED_ORIGIN";
    else if (hashOk && linkOk && hmacOk) status = "VALID";
    else status = "DOWNSTREAM_BROKEN";
    const dW = db.weightKg - t.weight, dT = db.tempC - t.temps[i], hChanged = db.handlerId !== t.handlers[i];
    nodes.push({ i, status, db, st, recomputedPrev, recomputedHash, expectedHmac, hashOk, linkOk, hmacOk,
      dW, dT, hChanged, payload: payloadOf(t, i, db, recomputedPrev) });
    prevRec = recomputedHash;
  });
  const verified = nodes.filter(n => n.status === "VALID").length;
  const origins = nodes.filter(n => n.status === "COMPROMISED_ORIGIN");
  return { nodes, verified, origins, intact: verified === nodes.length };
}

/* ---------- formatting ---------- */
export const sh = h => h.slice(0, 4) + "..." + h.slice(-4);
export const shT = h => h.slice(0, 10) + "…" + h.slice(-8);
export const sign = (v, d = 0) => (v > 0 ? "+" : v < 0 ? "-" : "") + Math.abs(v).toFixed(d);
export const utcStamp = () => new Date().toISOString().slice(11, 23) + "Z";

export const STATUS_COLOR = { VALID: "#10B981", COMPROMISED_ORIGIN: "#E11D48", DOWNSTREAM_BROKEN: "#D97706" };
export const stCol = s => STATUS_COLOR[s] || STATUS_COLOR.DOWNSTREAM_BROKEN;
export const stLbl = s => (s === "VALID" ? "VERIFIED" : s === "COMPROMISED_ORIGIN" ? "TAMPERED ORIGIN" : "CHAIN BROKEN");
export const stTone = s => (s === "VALID" ? "ok" : s === "COMPROMISED_ORIGIN" ? "bad" : "warn");

/* ---------- forensic log ---------- */
export const SEVERITIES = ["INFO", "OK", "WARN", "INJECT", "CRITICAL", "ALERT"];
export const ALERT_SEV = new Set(["WARN", "CRITICAL", "ALERT", "INJECT"]);
let _id = 0;
export const mkLog = (sev, msg, x = {}) => ({
  id: ++_id, at: Date.now(), ts: utcStamp(), sev, msg,
  truck: x.truck || null, cp: x.cp || null, stage: x.stage || null, handler: x.handler || null, digest: x.digest || null,
});

export function deltaText(n) {
  const p = [];
  if (n.dW) p.push(sign(n.dW) + " kg");
  if (n.dT) p.push(sign(n.dT, 1) + "°C");
  if (n.hChanged) p.push("handler " + n.db.handlerId);
  return p.join(" · ");
}

/* structured forensic rows: one per verification finding */
export function auditLines(t, a) {
  const out = [];
  a.nodes.forEach(n => {
    const num = n.i + 1, signer = t.handlers[n.i], base = { truck: t.id, cp: "CP" + num, stage: STAGES[n.i] };
    if (n.status === "COMPROMISED_ORIGIN") {
      out.push(mkLog("CRITICAL", `${t.id} Block #${num}: SHA-256 mismatch. Ledger holds ${sh(n.st.hash)}, recomputed ${sh(n.recomputedHash)}. Handler ${signer} flagged.`,
        { ...base, handler: signer, digest: { algo: "SHA-256", ok: false, exp: n.st.hash, got: n.recomputedHash } }));
      out.push(mkLog("CRITICAL", `${t.id} Block #${num}: HMAC-SHA256 verification failed. Stored signature does not match the recomputed digest.`,
        { ...base, handler: signer, digest: { algo: "HMAC", ok: false, exp: n.st.hmac, got: n.expectedHmac } }));
      if (n.hChanged) out.push(mkLog("CRITICAL", `${t.id} Block #${num}: signer identity mismatch. Ledger signed by ${signer}, record now claims ${n.db.handlerId}.`,
        { ...base, handler: n.db.handlerId }));
    } else if (n.status === "DOWNSTREAM_BROKEN") {
      out.push(mkLog("WARN", `${t.id} Block #${num}: prev_hash link broken. Expected ${sh(n.recomputedPrev)}, ledger holds ${sh(n.st.prev)}. Upstream tamper cascade.`,
        { ...base, handler: signer, digest: { algo: "LINK", ok: false, exp: n.recomputedPrev, got: n.st.prev } }));
    }
  });
  if (a.intact) out.push(mkLog("OK", `${t.id} chain verified ${a.verified}/4. All SHA-256 links and HMAC signatures intact.`, { truck: t.id, digest: { algo: "CHAIN", ok: true } }));
  else out.push(mkLog("ALERT", `${t.id} integrity ${a.verified}/${a.nodes.length} blocks verified. First break at Block #${a.nodes.findIndex(n => n.status !== "VALID") + 1}.`, { truck: t.id, digest: { algo: "CHAIN", ok: false } }));
  return out;
}
