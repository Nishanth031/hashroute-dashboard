import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import { HashRouteProvider } from "./utils/store.jsx";
import App from "./App.jsx";

/* No StrictMode: Leaflet maps are imperative and the double-mount in dev would build each map twice. */
createRoot(document.getElementById("root")).render(
  <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <HashRouteProvider>
      <App />
    </HashRouteProvider>
  </HashRouter>
);
