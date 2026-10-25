/* ---------- Leaflet map ----------
   focusId = null  → fleet mode: every corridor at equal weight, camera fits the whole network.
   focusId = "TRK-…" → truck mode: that corridor highlighted with live callout, others ghosted.
   Leaflet is driven imperatively; React only pushes new audit state through refresh()/tick(). */
import { useEffect, useRef } from "react";
import L from "leaflet";
import { BASEMAP } from "../utils/basemap.js";
import { STAGES, TRUCKS, deltaText, stCol, stLbl } from "../utils/fleet.js";
import { ALL_ROUTE_PTS, ROUTES, SIM, movementOf, posAt, telem } from "../utils/sim.js";
import { LAYOUT_EVENT, prefersReduced } from "../utils/hooks.js";

/* Esri Dark Gray Canvas needs no API key (CARTO's public tiles now return an "API key required" image) */
const TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const TILE_ATTR = 'Tiles © <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a> · HERE, Garmin, © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
const CITIES = [["Delhi", 28.61, 77.21], ["Mumbai", 19.08, 72.88], ["Kolkata", 22.57, 88.36], ["Chennai", 13.08, 80.27], ["Bengaluru", 12.97, 77.59], ["Hyderabad", 17.39, 78.49], ["Ahmedabad", 23.02, 72.57], ["Kochi", 9.93, 76.27]];
const TRUCK_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6h13v10H1zM14 9h5l3 4v3h-8zM6 19a2 2 0 100-.01M18 19a2 2 0 100-.01"/></svg>';
const MOVE_LABEL = { HELD: "HALTED · CRYPTOGRAPHIC BREACH", DELIVERED: "DELIVERED", "EN ROUTE": "EN ROUTE", PAUSED: "PAUSED" };

export default function GeoMap({ focusId = null, audits, ledger, follow = false, selCp = -1, onPin, onSelectTruck }) {
  const el = useRef(null), S = useRef(null);
  const P = useRef(null); P.current = { focusId, audits, ledger, follow, selCp, onPin, onSelectTruck };

  useEffect(() => {
    const reduce = prefersReduced();
    const map = L.map(el.current, {
      zoomControl: false, attributionControl: false, zoomSnap: 0.25, minZoom: 4, maxZoom: 12,
      worldCopyJump: false, scrollWheelZoom: false, inertia: !reduce,
      zoomAnimation: !reduce, fadeAnimation: !reduce, markerZoomAnimation: !reduce,
    });
    map.setView([22.5, 79], 5, { animate: false });
    L.control.zoom({ position: "topright" }).addTo(map);
    L.control.attribution({ position: "bottomright", prefix: false })
      .addAttribution(TILE_ATTR)
      .addTo(map);
    const tiles = L.tileLayer(TILE_URL, { maxZoom: 16 }).addTo(map);

    /* Vector fallback basemap, removed once a real tile loads. Rings are passed straight to L.polygon:
       wrapping each ring in another array makes Leaflet read a ring as a LatLng and throw "Invalid LatLng object". */
    const sil = [];
    const safe = (label, fn) => { try { fn(); } catch (err) { console.warn("[HashRoute] " + label + " skipped:", err); } };
    safe("neighbour-country fallback layer", () => sil.push(L.polygon(BASEMAP.OTH, { color: "rgba(255,255,255,.09)", weight: 0.8, fillColor: "#0B0C0F", fillOpacity: 1, interactive: false, smoothFactor: 1.2 }).addTo(map)));
    safe("India fallback layer", () => sil.push(L.polygon(BASEMAP.IND, { color: "rgba(255,255,255,.18)", weight: 1, fillColor: "#121419", fillOpacity: 1, interactive: false, smoothFactor: 1 }).addTo(map)));
    safe("graticule", () => {
      for (let la = 5; la <= 35; la += 5) sil.push(L.polyline([[la, 62], [la, 102]], { color: "rgba(255,255,255,.035)", weight: 0.7, interactive: false }).addTo(map));
      for (let lo = 65; lo <= 100; lo += 5) sil.push(L.polyline([[3, lo], [38, lo]], { color: "rgba(255,255,255,.035)", weight: 0.7, interactive: false }).addTo(map));
    });
    safe("city labels", () => CITIES.forEach(c => sil.push(L.marker([c[1], c[2]], { interactive: false, keyboard: false, icon: L.divIcon({ className: "cty", html: `<i></i><span>${c[0]}</span>`, iconSize: [0, 0] }) }).addTo(map))));
    let tilesOk = false;
    tiles.on("tileload", () => { if (!tilesOk) { tilesOk = true; sil.forEach(l => { try { l.remove(); } catch { /* already gone */ } }); } });

    const blank = L.divIcon({ className: "pnw", iconSize: [0, 0], html: "" });
    const objs = {};
    TRUCKS.forEach(t => {
      const R = ROUTES[t.id], o = { legs: [], pins: [] };
      R.legs.forEach(leg => {
        const core = L.polyline(leg, { weight: 2.2, opacity: 0.9, color: stCol("VALID"), interactive: false, lineCap: "round" });
        const fx = L.marker(leg[20], { interactive: false, keyboard: false, icon: blank });
        o.legs.push({ core, fx, fxKey: "" });
      });
      t.cps.forEach((c, i) => {
        const pin = L.marker(c, { keyboard: false, riseOnHover: true, icon: blank });
        pin.on("click", () => P.current.onPin && P.current.onPin(t.id, i));
        pin.bindTooltip("", { direction: "top", offset: [0, -14], className: "gt" });
        o.pins.push({ pin, key: "" });
      });
      o.marker = L.marker(posAt(R, SIM.p[t.id]), { zIndexOffset: 1000, keyboard: false,
        icon: L.divIcon({ className: "tm", iconSize: [0, 0], html: `<div class="tmi"><div class="co"></div><div class="bk">${TRUCK_SVG}<em>${t.id.slice(4)}</em></div></div>` }) });
      o.marker.on("click", () => P.current.onSelectTruck && P.current.onSelectTruck(t.id));
      o.marker.addTo(map);
      objs[t.id] = o;
    });
    const S_ = { map, objs, first: true, busy: 0, lastCam: undefined, touched: false, dead: false, raf: 0 };
    const toggle = (layer, on) => { const has = map.hasLayer(layer); if (on && !has) layer.addTo(map); else if (!on && has) map.removeLayer(layer); };

    S_.refresh = () => {
      const { focusId, audits, selCp } = P.current, fleet = !focusId;
      TRUCKS.forEach(t => {
        const o = objs[t.id], au = audits[t.id], isAct = fleet || t.id === focusId;
        o.legs.forEach((lg, j) => {
          const st = au.nodes[j].status;
          const dash = st === "VALID" ? null : st === "COMPROMISED_ORIGIN" ? "8 6" : "2 7";
          lg.core.setStyle({ color: stCol(st), dashArray: dash, opacity: fleet ? 0.85 : isAct ? 0.95 : 0.22, weight: fleet ? 2.4 : isAct ? 3 : 1.8 });
          toggle(lg.core, true);
          if (isAct && (!fleet || st !== "VALID")) lg.core.bringToFront();
          const showFx = isAct && st !== "VALID";
          const key = showFx ? st : "";
          if (lg.fxKey !== key) {
            lg.fx.setIcon(showFx ? L.divIcon({ className: "fx", iconSize: [0, 0], html: `<b class="${st === "COMPROMISED_ORIGIN" ? "" : "w"}">${st === "COMPROMISED_ORIGIN" ? "FRACTURE" : "BROKEN LINK"}</b>` }) : blank);
            lg.fxKey = key;
          }
          toggle(lg.fx, showFx);
        });
        o.pins.forEach((pp, i) => {
          const n = au.nodes[i], mini = fleet || !isAct;
          const cls = (n.status === "VALID" ? "ok" : n.status === "COMPROMISED_ORIGIN" ? "origin" : "down") + (mini ? " mini" : "") + (!fleet && isAct && selCp === i ? " sel" : "");
          if (pp.key !== cls) {
            pp.pin.setIcon(L.divIcon({ className: "pnw", iconSize: [0, 0], html: `<div class="pn ${cls}"><b>${i + 1}</b><u>${STAGES[i]}</u></div>` }));
            pp.key = cls;
          }
          toggle(pp.pin, true);
          pp.pin.setTooltipContent(`<b>${t.id} · CP${i + 1} ${STAGES[i]}</b><br>${t.places[i]}<br><span style="color:${stCol(n.status)}">${stLbl(n.status)}</span>`);
        });
        o.marker.setZIndexOffset(t.id === focusId ? 2000 : 1000);
      });
    };

    S_.camera = animate => {
      const id = P.current.focusId;
      S_.lastCam = id;
      try {
        const b = L.latLngBounds(id ? ROUTES[id].pts : ALL_ROUTE_PTS), opts = { padding: [40, 40], maxZoom: id ? 8 : 6.5 };
        if (S_.first || reduce || !animate) { map.fitBounds(b, { ...opts, animate: false }); S_.first = false; }
        else { S_.busy = Date.now() + 1400; map.flyToBounds(b, { ...opts, duration: 1.0, easeLinearity: 0.25 }); }
      } catch (err) { console.warn("[HashRoute] camera fit skipped:", err); }
    };

    S_.setFollow = on => {
      const id = P.current.focusId;
      if (!id) return;
      if (on) {
        const pos = posAt(ROUTES[id], SIM.p[id]), z = Math.max(map.getZoom(), 7);
        if (reduce) map.setView(pos, z, { animate: false }); else { S_.busy = Date.now() + 1300; map.flyTo(pos, z, { duration: 1.0 }); }
      } else { S_.camera(true); }
    };

    /* runs only when the simulation notifies (play / scrub / selection), never on a timer */
    const tick = () => {
      if (S_.dead) return;
      const { focusId, ledger, audits, follow } = P.current, fleet = !focusId;
      TRUCKS.forEach(t => {
        const o = objs[t.id], pos = posAt(ROUTES[t.id], SIM.p[t.id]);
        o.marker.setLatLng(pos);
        const e = o.marker.getElement(); if (!e) return;
        const au = audits[t.id], isFocus = t.id === focusId;
        e.classList.toggle("focus", isFocus);
        e.classList.toggle("halted", !au.intact);
        e.classList.toggle("dim", !fleet && !isFocus);
        if (!isFocus) return;
        const tm = telem(t, ledger[t.id], au), first = au.origins[0], mv = movementOf(t.id, au);
        const sCls = mv === "HELD" ? "bad" : mv === "PAUSED" ? "idle" : "ok";
        const h = `<div class="co-h"><b>${t.id}</b><span class="${sCls}">● ${MOVE_LABEL[mv]}</span></div>
          <div class="co-g"><span>SPEED</span><b>${tm.speed.toFixed(0)} km/h</b><span>TEMP</span><b>${tm.temp.toFixed(1)}°C</b><span>WEIGHT</span><b>${tm.weight} kg</b><span>NEXT</span><b>CP${tm.nextIdx + 1} · ${tm.eta}</b></div>
          <div class="co-x">LAST VERIFIED <b>${tm.hash ? tm.hash.slice(0, 6) + "…" + tm.hash.slice(-4) + " ✓" : "NONE YET"}</b></div>` +
          (first ? `<div class="co-a">FORENSIC ALERT · Handler ${t.handlers[first.i]} · CP${first.i + 1} ${STAGES[first.i]}<br>Δ ${deltaText(first)}</div>` : "");
        const c = e.querySelector(".co");
        if (c) {
          if (c.dataset.h !== h) { c.innerHTML = h; c.dataset.h = h; }
          e.classList.toggle("below", map.latLngToContainerPoint(pos).y < c.offsetHeight + 40);
        }
      });
      if (focusId && follow && Date.now() >= S_.busy) map.panTo(posAt(ROUTES[focusId], SIM.p[focusId]), { animate: false, noMoveStart: true });
    };
    S_.tick = tick;
    SIM.subs.add(tick);

    /* Keep Leaflet's pixel model in sync with the real layout. The ResizeObserver catches page
       transitions (the container mounts at its final size), sidebar collapse (the .main column
       resizes) and viewport changes; until the user touches the map it also re-fits the camera. */
    const fix = () => {
      cancelAnimationFrame(S_.raf);
      S_.raf = requestAnimationFrame(() => {
        if (S_.dead || !el.current) return;
        try {
          map.invalidateSize({ animate: false });
          if (!S_.touched && !P.current.follow && Date.now() >= S_.busy) S_.camera(false);
        } catch (err) { console.warn("[HashRoute] invalidateSize skipped:", err); }
      });
    };
    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(fix);
      ro.observe(el.current);
      if (el.current.parentElement) ro.observe(el.current.parentElement);
      const main = el.current.closest(".main");
      if (main) ro.observe(main);
    }
    window.addEventListener("resize", fix);
    window.addEventListener(LAYOUT_EVENT, fix);
    const touch = () => { S_.touched = true; };
    el.current.addEventListener("pointerdown", touch);
    el.current.addEventListener("wheel", touch, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fix);

    S.current = S_;
    S_.refresh(); S_.camera(false); tick();
    return () => {
      S_.dead = true; cancelAnimationFrame(S_.raf);
      SIM.subs.delete(tick);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", fix);
      window.removeEventListener(LAYOUT_EVENT, fix);
      try { map.remove(); } catch { /* already torn down */ }
      S.current = null;
    };
  }, []);

  useEffect(() => { const s = S.current; if (s) { s.refresh(); s.tick(); } }, [focusId, audits, ledger, selCp]);
  useEffect(() => { const s = S.current; if (s && s.lastCam !== focusId) { s.touched = false; s.camera(true); s.tick(); } }, [focusId]);
  const f0 = useRef(follow);
  useEffect(() => { if (f0.current === follow) return; f0.current = follow; S.current && S.current.setFollow(follow); }, [follow]);
  return <div ref={el} className="geomap" />;
}

export function MapLegend() {
  return (
    <div className="legend">
      <span><i className="lg-ok" />Verified</span>
      <span><i className="lg-bad" />Tampered origin</span>
      <span><i className="lg-warn" />Broken link</span>
    </div>
  );
}
