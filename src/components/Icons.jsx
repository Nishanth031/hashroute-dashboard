const P = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

export const IconGrid = () => (
  <svg {...P}><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><rect x="13.5" y="13.5" width="7" height="7" rx="1" /></svg>
);
export const IconLedger = () => (
  <svg {...P}><rect x="3.5" y="3.5" width="17" height="17" rx="1.5" /><path d="M3.5 9h17M3.5 14.5h17M9 9v11.5" /></svg>
);
export const IconKey = () => (
  <svg {...P}><circle cx="8" cy="15.5" r="4" /><path d="M11 12.5l9-9M16.5 7l3 3M14 9.5l2 2" /></svg>
);
export const IconChevron = ({ flip }) => (
  <svg {...P} style={{ transform: flip ? "rotate(180deg)" : "none" }}><path d="M14.5 6l-6 6 6 6" /></svg>
);

export function BrandMark({ ok }) {
  return (
    <svg width="26" height="26" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="34" height="34" rx="7" fill="#14171C" stroke="rgba(197,168,128,.38)" />
      <path d="M9 12h6M21 12h6M9 24h6M21 24h6M15 12l3 6-3 6M21 12l-3 6 3 6"
        stroke={ok ? "#C5A880" : "#E11D48"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
