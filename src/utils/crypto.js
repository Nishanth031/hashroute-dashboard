/* ---------- HashRoute cryptographic engine (sync SHA-256 + HMAC-SHA256) ----------
   Synchronous on purpose: the chain audit runs inside render/useMemo, which WebCrypto's async API can't do. */
export const GENESIS = "0".repeat(64);
export const MASTER = "HASHROUTE-MASTER-KEY-v3::cold-chain";

const _primes = (() => { const p = []; for (let n = 2; p.length < 64; n++) { if (p.every(q => n % q)) p.push(n); } return p; })();
const _frac = x => x - Math.floor(x);
const _K = _primes.map(p => Math.floor(_frac(Math.cbrt(p)) * 4294967296) >>> 0);
const _H = _primes.slice(0, 8).map(p => Math.floor(_frac(Math.sqrt(p)) * 4294967296) >>> 0);
const _ror = (x, n) => (x >>> n) | (x << (32 - n));
const _enc = new TextEncoder();

export function sha256Bytes(bytes) {
  const l = bytes.length, bits = l * 8;
  const padLen = ((l + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(padLen); m.set(bytes); m[l] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(padLen - 8, Math.floor(bits / 4294967296));
  dv.setUint32(padLen - 4, bits >>> 0);
  const h = _H.slice(), w = new Uint32Array(64);
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15], b = w[i - 2];
      const s0 = _ror(a, 7) ^ _ror(a, 18) ^ (a >>> 3);
      const s1 = _ror(b, 17) ^ _ror(b, 19) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = _ror(e, 6) ^ _ror(e, 11) ^ _ror(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + _K[i] + w[i]) | 0;
      const S0 = _ror(a, 2) ^ _ror(a, 13) ^ _ror(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }
  const out = new Uint8Array(32), odv = new DataView(out.buffer);
  h.forEach((v, i) => odv.setUint32(i * 4, v >>> 0));
  return out;
}

export const toHex = u8 => Array.from(u8, b => b.toString(16).padStart(2, "0")).join("");
export const sha256Hex = s => toHex(sha256Bytes(_enc.encode(s)));

export function hmacHex(key, msg) {
  let k = _enc.encode(key);
  if (k.length > 64) k = sha256Bytes(k);
  const kp = new Uint8Array(64); kp.set(k);
  const ipad = kp.map(b => b ^ 0x36), opad = kp.map(b => b ^ 0x5c);
  const m = _enc.encode(msg);
  const inner = new Uint8Array(64 + m.length); inner.set(ipad); inner.set(m, 64);
  const ih = sha256Bytes(inner);
  const outer = new Uint8Array(96); outer.set(opad); outer.set(ih, 64);
  return toHex(sha256Bytes(outer));
}

/* per-handler signing key, derived from the master key */
export const handlerKey = h => "HSK|" + h + "|" + MASTER;

let _fp = null;
export const keyFingerprint = () => (_fp ??= sha256Hex(MASTER).slice(0, 8));
