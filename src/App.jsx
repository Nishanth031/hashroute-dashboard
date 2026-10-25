import { useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import Sidebar from "./components/Sidebar.jsx";
import FleetOverview from "./pages/FleetOverview.jsx";
import TruckDetail from "./pages/TruckDetail.jsx";
import GlobalLedger from "./pages/GlobalLedger.jsx";
import { announceLayout, useMediaQuery } from "./utils/hooks.js";

const PAGE = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: "easeIn" } },
};
const SB_KEY = "hashroute.sidebar.collapsed";

export default function App() {
  const location = useLocation();
  const mainRef = useRef(null);
  const narrow = useMediaQuery("(max-width: 860px)");
  const [pref, setPref] = useState(() => { try { return localStorage.getItem(SB_KEY) === "1"; } catch { return false; } });
  const collapsed = narrow || pref;
  const toggle = () => setPref(v => {
    try { localStorage.setItem(SB_KEY, v ? "0" : "1"); } catch { /* storage unavailable */ }
    return !v;
  });

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <Sidebar collapsed={collapsed} canToggle={!narrow} onToggle={toggle} />
        <main className="main" ref={mainRef}>
          <AnimatePresence mode="wait" initial={false} onExitComplete={() => mainRef.current && mainRef.current.scrollTo(0, 0)}>
            <motion.div key={location.pathname} className="page-wrap" {...PAGE} onAnimationComplete={announceLayout}>
              <Routes location={location}>
                <Route path="/" element={<FleetOverview />} />
                <Route path="/truck/:id" element={<TruckDetail />} />
                <Route path="/ledger" element={<GlobalLedger />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </MotionConfig>
  );
}
