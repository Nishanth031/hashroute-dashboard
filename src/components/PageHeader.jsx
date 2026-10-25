import { useClock } from "../utils/hooks.js";
import { useHashRoute } from "../utils/store.jsx";

function Clocks() {
  const now = useClock();
  const utc = now.toISOString().slice(11, 19), ist = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata" });
  return <div className="clocks mono"><span><i>UTC</i>{utc}</span><span><i>IST</i>{ist}</span></div>;
}

export default function PageHeader({ eyebrow, title, sub, children }) {
  const { summary } = useHashRoute();
  return (
    <header className="ph">
      <div className="ph-l">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="ph-r">
        {children}
        <span className={"health " + (summary.allOk ? "ok" : "bad")}>
          {summary.allOk ? "ALL CHAINS VERIFIED" : `${summary.held} CHAIN${summary.held > 1 ? "S" : ""} HELD`}
        </span>
        <Clocks />
      </div>
    </header>
  );
}
