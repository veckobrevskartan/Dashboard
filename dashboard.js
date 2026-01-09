// dashboard.js (robust version: inga hårda krascher)
(() => {
  try {
    if (typeof Plotly === "undefined") throw new Error("Plotly saknas (cdn.plot.ly laddades inte).");

    // ========= 1) EXAKT dina 11 kategorier =========
    const CATS = {
      DRONE:   { label:'Drönare / UAV',             emoji:'🛩️',  color:'#b9e3ff', desc:'Incidenter med UAV/drönare.', iconUrl:'' },
      INFRA:   { label:'Infrastruktur / sabotage',  emoji:'⚡',   color:'#ffe08a', desc:'Kritisk infrastruktur, sabotage, störningar.', iconUrl:'' },
      NUCLEAR: { label:'Kärnenergi / farligt gods', emoji:'☢️',  color:'#ffd0d0', desc:'Kärntekniskt/farligt gods.', iconUrl:'' },
      TERROR:  { label:'Terror / våld',             emoji:'💣',   color:'#ffc4b6', desc:'Terrorism och våldsbrott med hög påverkan.', iconUrl:'' },
      INTEL:   { label:'Spionage / underrättelse',  emoji:'🕵️‍♂️', color:'#e6e6e6', desc:'Spioneri, underrättelse, säkerhet.', iconUrl:'' },
      LEGAL:   { label:'Rättsfall / domar',         emoji:'⚖️',   color:'#c8ffcb', desc:'Juridik, domar och rättsfall.', iconUrl:'' },
      MIL:     { label:'Militär / försvar',         emoji:'🪖',   color:'#b8efe6', desc:'Militär aktivitet och försvar.', iconUrl:'' },
      HYBRID:  { label:'Påverkan / hybrid',         emoji:'🧠',   color:'#dfcffc', desc:'Informationspåverkan/hybridaktiviteter.', iconUrl:'' },
      MAR:     { label:'Maritimt / skuggflotta',    emoji:'⚓',   color:'#cfe3ff', desc:'Händelser till sjöss/skuggflotta.', iconUrl:'' },
      GPS:     { label:'GPS-störning / signal',     emoji:'📡',   color:'#eed9ff', desc:'GNSS-störningar och signalpåverkan.', iconUrl:'' },
      POLICY:  { label:'Politik / policy',          emoji:'🏛️',  color:'#e9ffd4', desc:'Policy, myndigheter, styrdokument.', iconUrl:'' }
    };
    const CAT_KEYS = Object.keys(CATS);

    // ========= 2) Data =========
    const RAW = Array.isArray(window.EVENTS) ? window.EVENTS : [];
    if (!RAW.length) throw new Error("window.EVENTS saknas eller är tom (events.js laddades inte eller kraschade).");

    // ========= 3) DOM =========
    const $ = (id) => document.getElementById(id);

    const catsHost = $("cats");
    const statsLine = $("statsLine");
    const dateFromEl = $("dateFrom");
    const dateToEl = $("dateTo");
    const qEl = $("q");

    const btnApply = $("btnApply");
    const btnReset = $("btnReset");
    const catsAllBtn = $("catsAll");
    const catsNoneBtn = $("catsNone");

    const kpiCount = $("kpiCount");
    const kpiCats = $("kpiCats");
    const kpiCountries = $("kpiCountries");
    const kpiRange = $("kpiRange");

    // ========= 4) Göm “flöde” (Sankey) =========
    hideCardByChartId("sankeyCountryCat");

    function hideCardByChartId(chartId) {
      const el = $(chartId);
      if (!el) return;
      const card = el.closest(".card");
      if (card) card.style.display = "none";
    }

    // ========= 5) State =========
    const ACTIVE = {
      cats: new Set(CAT_KEYS),
      q: "",
      from: "",
      to: ""
    };

    // ========= 6) Utils =========
    const pad2 = (n) => String(n).padStart(2, "0");

    function norm(s) {
      return (s ?? "")
        .toString()
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    }

    function safeCat(x) {
      const k = (x ?? "").toString().toUpperCase().trim();
      return CATS[k] ? k : null;
    }

    function parseYMD(s) {
      if (!s || typeof s !== "string") return null;
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return null;
      const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function ymdUTC(dt) {
      return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
    }

    function countBy(arr, keyFn) {
      const m = new Map();
      for (const x of arr) {
        const k = keyFn(x);
        if (k == null || k === "") continue;
        m.set(k, (m.get(k) || 0) + 1);
      }
      return m;
    }

    function topN(map, n) {
      return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
    }

    function safeNum(v) {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    }

    // ========= 7) UI: cats =========
    function renderCatsUI() {
      if (!catsHost) return;
      catsHost.innerHTML = "";

      for (const key of CAT_KEYS) {
        const meta = CATS[key];
        const row = document.createElement("div");
        row.className = "catrow";
        row.innerHTML = `
          <input type="checkbox" id="cat_${key}" ${ACTIVE.cats.has(key) ? "checked" : ""}>
          <label for="cat_${key}" style="display:flex;gap:10px;align-items:center;width:100%">
            <span style="font-size:16px">${meta.emoji}</span>
            <span style="font-weight:700">${meta.label}</span>
            <span class="meta" style="margin-left:auto">${key}</span>
          </label>
        `;
        row.querySelector("input").addEventListener("change", (ev) => {
          if (ev.target.checked) ACTIVE.cats.add(key);
          else ACTIVE.cats.delete(key);
          update();
        });
        catsHost.appendChild(row);
      }

      if (statsLine) statsLine.textContent = `${RAW.length} händelser • ${CAT_KEYS.length} kategorier`;
    }

    catsAllBtn?.addEventListener("click", () => {
      ACTIVE.cats = new Set(CAT_KEYS);
      renderCatsUI();
      update();
    });

    catsNoneBtn?.addEventListener("click", () => {
      ACTIVE.cats.clear();
      renderCatsUI();
      update();
    });

    btnApply?.addEventListener("click", () => {
      ACTIVE.from = dateFromEl?.value || "";
      ACTIVE.to = dateToEl?.value || "";
      ACTIVE.q = qEl?.value || "";
      update();
    });

    btnReset?.addEventListener("click", () => {
      if (dateFromEl) dateFromEl.value = "";
      if (dateToEl) dateToEl.value = "";
      if (qEl) qEl.value = "";
      ACTIVE.from = "";
      ACTIVE.to = "";
      ACTIVE.q = "";
      ACTIVE.cats = new Set(CAT_KEYS);
      renderCatsUI();
      update();
    });

    // ========= 8) Filter =========
    function getFiltered() {
      const q = norm(ACTIVE.q);
      const fromDt = parseYMD(ACTIVE.from);
      const toDt = parseYMD(ACTIVE.to);

      const out = [];
      for (const e of RAW) {
        const cat = safeCat(e.cat);
        if (!cat) continue;
        if (!ACTIVE.cats.has(cat)) continue;

        const dt = parseYMD(e.date);
        if (fromDt && (!dt || dt < fromDt)) continue;
        if (toDt && (!dt || dt > toDt)) continue;

        if (q) {
          const hay = norm([e.title, e.place, e.summary, e.source, e.country, e.cat, e.url].join(" "));
          const terms = q.split(/\s+/).filter(Boolean);
          let ok = true;
          for (const t of terms) if (!hay.includes(t)) { ok = false; break; }
          if (!ok) continue;
        }

        out.push({ ...e, cat, __dt: dt });
      }
      return out;
    }

    // ========= 9) KPI =========
    function setKPIs(list) {
      if (kpiCount) kpiCount.textContent = String(list.length);
      // Visa antal valda kategorier (max 11)
      if (kpiCats) kpiCats.textContent = String(ACTIVE.cats.size);

      const countries = new Set(list.map(e => (e.country || "").toUpperCase()).filter(Boolean));
      if (kpiCountries) kpiCountries.textContent = String(countries.size);

      const dates = list.map(e => e.__dt).filter(Boolean).sort((a,b)=>a-b);
      if (kpiRange) kpiRange.textContent = dates.length ? `${ymdUTC(dates[0])} – ${ymdUTC(dates[dates.length-1])}` : "–";
    }

    // ========= 10) Fail-safe draw wrapper =========
    function drawSafe(id, fn) {
      try {
        if (!$(id)) return;
        fn();
      } catch (e) {
        console.error("Chart failed:", id, e);
        // låt rutan vara tom, men krascha inte hela sidan
        try { Plotly.purge(id); } catch {}
      }
    }

    const BASE = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", size: 12 }
    };

    // ========= 11) Charts =========

    function drawPieCats(list) {
      drawSafe("pieCats", () => {
        const counts = countBy(list, e => e.cat);
        const labels = [];
        const values = [];
        const colors = [];

        for (const k of CAT_KEYS) {
          const v = counts.get(k) || 0;
          if (!v) continue;
          labels.push(`${CATS[k].emoji} ${CATS[k].label}`);
          values.push(v);
          colors.push(CATS[k].color);
        }

        Plotly.react("pieCats", [{
          type: "pie",
          labels, values,
          textinfo: "label+percent",
          marker: { colors }
        }], {
          ...BASE,
          margin: { l: 10, r: 10, t: 10, b: 10 }
        }, { responsive: true });
      });
    }

    function drawBarCountries(list) {
      drawSafe("barCountries", () => {
        const counts = countBy(list, e => (e.country || "").toUpperCase());
        const top = topN(counts, 40);
        Plotly.react("barCountries", [{
          type: "bar",
          x: top.map(([k]) => k),
          y: top.map(([,v]) => v)
        }], {
          ...BASE,
          margin: { t: 20, l: 50, r: 10, b: 60 },
          xaxis: { tickangle: 90 }
        }, { responsive: true });
      });
    }

    function drawLineTimeline(list) {
      drawSafe("lineTimeline", () => {
        const counts = new Map();
        for (const e of list) {
          if (!e.__dt) continue;
          const k = ymdUTC(e.__dt);
          counts.set(k, (counts.get(k) || 0) + 1);
        }
        const x = [...counts.keys()].sort();
        const y = x.map(d => counts.get(d));
        Plotly.react("lineTimeline", [{
          type: "scatter", mode: "lines+markers",
          x, y
        }], {
          ...BASE,
          margin: { t: 20, l: 50, r: 10, b: 50 },
          showlegend: false
        }, { responsive: true });
      });
    }

    // --- MAPBOX: försök, annars fallback till scattergeo / histogram2d ---
    function drawScatterMapOrGeo(list) {
      const lats = [], lons = [], texts = [], colors = [];
      for (const e of list) {
        const lat = safeNum(e.lat);
        const lon = safeNum(e.lng);
        if (lat == null || lon == null) continue;
        lats.push(lat); lons.push(lon);
        const meta = CATS[e.cat];
        texts.push(`${meta.emoji} ${meta.label}<br>${e.title || ""}<br>${e.place || ""}<br>${e.date || ""}`);
        colors.push(meta.color);
      }

      // 1) mapbox
      drawSafe("scatterGeo", () => {
        Plotly.react("scatterGeo", [{
          type: "scattermapbox",
          lat: lats, lon: lons,
          mode: "markers",
          text: texts,
          hovertemplate: "%{text}<extra></extra>",
          marker: { size: 7, opacity: 0.75, color: colors }
        }], {
          ...BASE,
          margin: { l: 10, r: 10, t: 10, b: 10 },
          mapbox: { style: "open-street-map", center: { lat: 20, lon: 0 }, zoom: 1 }
        }, { responsive: true });
      });

      // fallback om mapbox ej stöds: scattergeo
      // (kör bara om scatterGeo fortfarande saknar data efter react)
      const el = $("scatterGeo");
      const hasMapbox = el && el.data && el.data[0] && (el.data[0].type === "scattermapbox");
      if (!hasMapbox) {
        drawSafe("scatterGeo", () => {
          Plotly.react("scatterGeo", [{
            type: "scattergeo",
            lat: lats, lon: lons,
            mode: "markers",
            text: texts,
            hovertemplate: "%{text}<extra></extra>",
            marker: { size: 6, opacity: 0.75 }
          }], {
            ...BASE,
            margin: { l: 10, r: 10, t: 10, b: 10 },
            geo: { showland: true }
          }, { responsive: true });
        });
      }
    }

    function drawDensityMapOrHist(list, targetId, radius) {
      const lats = [], lons = [];
      for (const e of list) {
        const lat = safeNum(e.lat);
        const lon = safeNum(e.lng);
        if (lat == null || lon == null) continue;
        lats.push(lat); lons.push(lon);
      }

      // 1) densitymapbox
      drawSafe(targetId, () => {
        Plotly.react(targetId, [{
          type: "densitymapbox",
          lat: lats, lon: lons,
          z: lats.map(() => 1),
          radius: radius,
          hoverinfo: "skip"
        }], {
          ...BASE,
          margin: { l: 10, r: 10, t: 10, b: 10 },
          mapbox: { style: "open-street-map", center: { lat: 20, lon: 0 }, zoom: 1 }
        }, { responsive: true });
      });

      // fallback om densitymapbox ej stöds: histogram2d (lat/lng)
      const el = $(targetId);
      const hasMapbox = el && el.data && el.data[0] && (el.data[0].type === "densitymapbox");
      if (!hasMapbox) {
        drawSafe(targetId, () => {
          Plotly.react(targetId, [{
            type: "histogram2d",
            x: lons,
            y: lats
          }], {
            ...BASE,
            margin: { t: 20, l: 50, r: 10, b: 40 },
            xaxis: { title: "Longitude" },
            yaxis: { title: "Latitude" }
          }, { responsive: true });
        });
      }
    }

    function drawBarTopPlaces(list) {
      drawSafe("barTopPlaces", () => {
        const counts = countBy(list, e => (e.place || "").trim());
        const top = topN(counts, 15).reverse();
        Plotly.react("barTopPlaces", [{
          type: "bar",
          x: top.map(([,v]) => v),
          y: top.map(([k]) => k),
          orientation: "h"
        }], {
          ...BASE,
          margin: { l: 200, r: 20, t: 20, b: 40 }
        }, { responsive: true });
      });
    }

    function drawStackMonthCat(list) {
      drawSafe("stackMonthCat", () => {
        const months = new Set();
        const byMonthCat = new Map();

        for (const e of list) {
          if (!e.__dt) continue;
          const m = `${e.__dt.getUTCFullYear()}-${pad2(e.__dt.getUTCMonth()+1)}`;
          months.add(m);
          const key = `${m}__${e.cat}`;
          byMonthCat.set(key, (byMonthCat.get(key) || 0) + 1);
        }

        const x = [...months].sort();
        const traces = [];
        for (const cat of CAT_KEYS) {
          const y = x.map(m => byMonthCat.get(`${m}__${cat}`) || 0);
          const sum = y.reduce((a,b)=>a+b,0);
          if (!sum) continue;
          traces.push({
            type: "bar",
            name: `${CATS[cat].emoji} ${cat}`,
            x, y,
            marker: { color: CATS[cat].color }
          });
        }

        Plotly.react("stackMonthCat", traces, {
          ...BASE,
          barmode: "stack",
          margin: { t: 20, l: 50, r: 10, b: 80 },
          xaxis: { tickangle: 90 }
        }, { responsive: true });
      });
    }

   function drawTreemap(list) {
  // Nodgraf i rutan "treemapCatCountry": Kategori-noder + land-noder kopplade till kategori
  drawSafe("treemapCatCountry", () => {
    const MAX_COUNTRIES_PER_CAT = 18;

    // 1) Räkna totals per kategori
    const catTotals = countBy(list, (e) => e.cat);

    // 2) Räkna cat->country
    const catCountry = new Map(); // "CAT|SE" -> count
    for (const e of list) {
      const ctry = (e.country || "").toUpperCase().trim();
      if (!ctry) continue;
      const key = `${e.cat}|${ctry}`;
      catCountry.set(key, (catCountry.get(key) || 0) + 1);
    }

    // 3) Top-länder per kategori
    const perCatCountries = new Map(); // cat -> Array<[ctry,count]>
    for (const cat of CAT_KEYS) {
      const m = new Map();
      for (const [k, v] of catCountry.entries()) {
        const [kCat, kCtry] = k.split("|");
        if (kCat !== cat) continue;
        m.set(kCtry, (m.get(kCtry) || 0) + v);
      }
      perCatCountries.set(cat, topN(m, MAX_COUNTRIES_PER_CAT));
    }

    // 4) Layout: kategorier i en cirkel, deras länder i mindre ringar runt respektive kategori
    const nodes = []; // {id,label,x,y,size,color,kind,value,cat?}
    const links = []; // {x0,y0,x1,y1}

    const R = 1.65; // radie för kategori-cirkel
    const step = (2 * Math.PI) / CAT_KEYS.length;

    for (let i = 0; i < CAT_KEYS.length; i++) {
      const cat = CAT_KEYS[i];
      const total = catTotals.get(cat) || 0;
      if (!total) continue;

      const a = i * step - Math.PI / 2;
      const cx = R * Math.cos(a);
      const cy = R * Math.sin(a);

      // kategori-nod
      nodes.push({
        id: `cat:${cat}`,
        label: `${CATS[cat].emoji} ${cat}`,
        x: cx,
        y: cy,
        size: Math.max(20, Math.min(70, 12 + Math.sqrt(total) * 2.4)),
        color: CATS[cat].color,
        kind: "cat",
        value: total
      });

      // land-noder runt kategorin
      const countries = perCatCountries.get(cat) || [];
      const r2 = 0.62; // liten ring runt kategorin
      const step2 = countries.length ? (2 * Math.PI) / countries.length : 0;

      for (let j = 0; j < countries.length; j++) {
        const [ctry, cnt] = countries[j];
        const a2 = j * step2;

        const x2 = cx + r2 * Math.cos(a2);
        const y2 = cy + r2 * Math.sin(a2);

        nodes.push({
          id: `ctry:${cat}:${ctry}`,
          label: `${ctry} (${cnt})`,
          x: x2,
          y: y2,
          size: Math.max(8, Math.min(26, 6 + Math.sqrt(cnt) * 1.8)),
          color: CATS[cat].color,
          kind: "country",
          value: cnt,
          cat
        });

        links.push({ x0: cx, y0: cy, x1: x2, y1: y2 });
      }
    }

    // 5) Edge trace (linjer)
    const edgeX = [];
    const edgeY = [];
    for (const L of links) {
      edgeX.push(L.x0, L.x1, null);
      edgeY.push(L.y0, L.y1, null);
    }

    const edges = {
      type: "scatter",
      mode: "lines",
      x: edgeX,
      y: edgeY,
      hoverinfo: "skip",
      line: { width: 1 },
      opacity: 0.35
    };

    // 6) Node trace
    const nodeTrace = {
      type: "scattergl",
      mode: "markers+text",
      x: nodes.map((n) => n.x),
      y: nodes.map((n) => n.y),
      text: nodes.map((n) => (n.kind === "cat" ? n.label : "")), // visa text främst för kategorier
      textposition: "bottom center",
      hovertext: nodes.map((n) =>
        n.kind === "cat"
          ? `${n.label}<br>${CATS[n.id.split(":")[1]]?.label || ""}<br>Antal: ${n.value}`
          : `${n.label}<br>Kategori: ${n.cat}`
      ),
      hoverinfo: "text",
      marker: {
        size: nodes.map((n) => n.size),
        color: nodes.map((n) => n.color),
        opacity: 0.9,
        line: { width: 1 }
      }
    };

    Plotly.react(
      "treemapCatCountry",
      [edges, nodeTrace],
      {
        ...BASE,
        margin: { l: 10, r: 10, t: 10, b: 10 },
        xaxis: { visible: false },
        yaxis: { visible: false },
        showlegend: false
      },
      { responsive: true }
    );
  });
}

    // ========= 12) Fullscreen-resize =========
    function resizeAll() {
      const ids = [
        "pieCats","barCountries","lineTimeline","heatCalendar",
        "barTopPlaces","stackMonthCat","treemapCatCountry",
        "scatterGeo","hist2dGeo","cumulative"
      ];
      for (const id of ids) {
        const el = $(id);
        if (el && el.data) { try { Plotly.Plots.resize(el); } catch {} }
      }
    }

    function setupFullscreen() {
      document.querySelectorAll(".card .fs").forEach(btn => {
        btn.addEventListener("click", async () => {
          const card = btn.closest(".card");
          if (!card) return;
          if (document.fullscreenElement) await document.exitFullscreen().catch(()=>{});
          else await card.requestFullscreen().catch(()=>{});
          setTimeout(resizeAll, 120);
        });
      });
      document.addEventListener("fullscreenchange", () => setTimeout(resizeAll, 120));
      window.addEventListener("resize", () => setTimeout(resizeAll, 80));
    }

    // ========= 13) Main update =========
    function update() {
      const list = getFiltered();
      setKPIs(list);

      drawPieCats(list);
      drawBarCountries(list);
      drawLineTimeline(list);

      // “Kalender-heatmap” blir karta-heat (density) – med fallback
      drawDensityMapOrHist(list, "heatCalendar", 18);

      drawBarTopPlaces(list);
      drawStackMonthCat(list);

      drawTreemap(list);

      // Geo spridning + geo densitet som karta (fallback om mapbox blockas)
      drawScatterMapOrGeo(list);
      drawDensityMapOrHist(list, "hist2dGeo", 28);

      drawCumulative(list);

      setTimeout(resizeAll, 60);
    }

    // ========= init =========
    renderCatsUI();
    setupFullscreen();

    ACTIVE.from = dateFromEl?.value || "";
    ACTIVE.to = dateToEl?.value || "";
    ACTIVE.q = qEl?.value || "";

    update();

  } catch (e) {
    console.error(e);
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div style="margin:12px;padding:12px;border:1px solid #ff8182;background:#ffebe9;border-radius:12px;font-family:system-ui">
        <b>Dashboard-krasch:</b> ${String(e && e.message ? e.message : e)}
      </div>`
    );
  }
})();
