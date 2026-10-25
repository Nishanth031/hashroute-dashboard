import { motion } from "framer-motion";
import { useBump } from "../utils/hooks.js";

/* Ephemeral 1.2s background fades. Each tone fades to its own hue at zero alpha so it never passes through grey. */
const TONES = { bad: [225, 29, 72, 0.4], warn: [217, 119, 6, 0.32], accent: [197, 168, 128, 0.18] };
export const FADE = { duration: 1.2, ease: "easeOut" };
export function flash(tone) {
  const [r, g, b, a] = TONES[tone] || TONES.accent;
  return { on: `rgba(${r},${g},${b},${a})`, off: `rgba(${r},${g},${b},0)` };
}
export const sevTone = sev => (sev === "CRITICAL" || sev === "ALERT" ? "bad" : sev === "WARN" || sev === "INJECT" ? "warn" : "accent");

/* Plays once when `v` changes into a bad state; silent on first render. */
export function Flash({ v, bad, className, children }) {
  const k = useBump(v), f = flash("bad");
  return (
    <motion.span key={k} className={className}
      initial={k && bad ? { backgroundColor: f.on } : false}
      animate={{ backgroundColor: f.off }} transition={FADE}>
      {children}
    </motion.span>
  );
}
