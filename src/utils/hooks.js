import { useEffect, useRef, useState } from "react";

export const prefersReduced = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

export function useMediaQuery(q) {
  const [on, setOn] = useState(() => !!(window.matchMedia && window.matchMedia(q).matches));
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(q), fn = () => setOn(mq.matches);
    fn(); mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [q]);
  return on;
}

/* Bumps a counter whenever `v` changes after first render, so a keyed child remounts and plays its flash once. */
export function useBump(v) {
  const r = useRef({ v, k: 0 });
  if (r.current.v !== v) r.current = { v, k: r.current.k + 1 };
  return r.current.k;
}

/* fired after page transitions and sidebar resizes; maps listen for it alongside their ResizeObserver */
export const LAYOUT_EVENT = "hashroute:layout";
export const announceLayout = () => window.dispatchEvent(new Event(LAYOUT_EVENT));

export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const k = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(k); }, []);
  return now;
}
