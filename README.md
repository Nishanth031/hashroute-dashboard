# HashRoute · Integrity Console

Multi-page React rebuild of `HashRoute-console.html` (Vite + React Router + Framer Motion + Leaflet).

```
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/ (relative paths, hash routing)
```

## Routes

| Route          | View |
| -------------- | ---- |
| `#/`           | Fleet Overview: alert feed, 4-card KPI matrix, all-corridor map, corridor roster |
| `#/truck/:id`  | Truck detail: integrity strip, telemetry KPIs, route map + scrubber, hash chain; sticky red-team console and audit grid |
| `#/ledger`     | Global Ledger: every forensic event, filterable by severity, corridor, handler and free text |

`#/truck/:id?cp=N` opens a truck with checkpoint N (0–3) targeted and scrolled into view (used by fleet-map pins).

## Layout

```
src/
  main.jsx, App.jsx          router, provider, sidebar shell, page transitions
  components/                Sidebar, PageHeader, GeoMap, HashChain, RedTeamConsole,
                             AuditTable, AlertTicker, Scrubber, Flash, Icons
  pages/                     FleetOverview, TruckDetail, GlobalLedger
  utils/
    crypto.js                synchronous SHA-256 + HMAC-SHA256
    fleet.js                 seed trucks, ledger build, chain audit, forensic log rows
    sim.js                   route geometry + event-driven transit simulation
    store.jsx                shared ledger / audits / log context
    basemap.js               offline vector fallback for the map
    hooks.js                 media query, clock, layout event
  styles/                    tokens, base, layout, components
```

The basemap tiles come from CARTO; when they can't load, the vector fallback in `basemap.js` is drawn instead.
## Authors & Contributors
* **G Nishanth** - *Initial Work & Development*
* **Haneef Muhammad** - *Co-Developer / Contributor / Reseacher*
