// dashboard.js
(() => {
  if (typeof Plotly === "undefined") {
    console.error("Plotly saknas");
    return;
  }

  // ========= 1) EXAKT dina 11 kategorier =========
  const CATS = {
    DRONE:   { label:'Drönare / UAV',             emoji:'🛩️', color:'#b9e3ff', desc:'Incidenter med UAV/drönare.', iconUrl:'' },
    INFRA:   { label:'Infrastruktur / sabotage',  emoji:'⚡',  color:'#ffe08a', desc:'Kritisk infrastruktur, sabotage, störningar.', iconUrl:'' },
    NUCLEAR: { label:'Kärnenergi / farligt gods', emoji:'☢️',  color:'#ffd0d0', desc:'Kärntekniskt/farligt gods.', iconUrl:'' },
    TERROR:  { label:'Terror / våld',             emoji:'💣',  color:'#ffc4b6', desc:'Terrorism och våldsbrott med hög påverkan.', iconUrl:'' },
    INTEL:   { label:'Spionage / underrättelse',  emoji:'🕵️‍♂️', color:'#e6e6e6', desc:'Spioneri, underrättelse, säkerhet.', iconUrl:'' },
    LEGAL:   { label:'Rättsfall / domar',         emoji:'⚖️',  color:'#c8ffcb', desc:'Juridik, domar och rättsfall.', iconUrl:'' },
    MIL:     { label:'Militär / försvar',         emoji:'🪖',  color:'#b8efe6', desc:'Militär aktivitet och försvar.', iconUrl:'' },
    HYBRID:  { label:'Påverkan / hybrid',         emoji:'🧠',  color:'#dfcffc', desc:'Informationspåverkan/hybridaktiviteter.', iconUrl:'' },
    MAR:     { label:'Maritimt / skuggflotta',    emoji:'⚓',  color:'#cfe3ff', desc:'Händelser till sjöss/skuggflotta.', iconUrl:'' },
    GPS:     { label:'GPS-störning / signal',     emoji:'📡',  color:'#eed9ff', desc:'GNSS-störningar och signalpåverkan.', iconUrl:'' },
    POLICY:  { label:'Politik / policy',          emoji:'🏛️',  color:'#e9ffd4', desc:'Policy, myndigheter, styrdokument.', iconUrl:'' }
  };

  const CAT_KEYS = Object.keys(CATS);

  // ========= 2) Data =========
  const RAW = Array.isArray(window.EVENTS) ? window.EVENTS : [];
  if (!RAW.length) {
    console.error("window.EVENTS saknas eller är tom. Kontrollera events.js.");
    return;
  }

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

  // ========= 4) Göm Sankey-modulen =========
  hideCardByChartId("sankeyCountryCat");

  function hideCardByChartId(chartId) {
    const el = $(chartId);
    if (!el) return;
    const card = el.closest(".card");
    if (card) card.style.display = "none";
  }

  // ========= 5) Filterstate =========
  const ACTIVE = {
    cats: new Set(CAT_KEYS), // max 11
    q: "",
    from: "",
    to: ""
  };

  // ========= 6) Helpers =========
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
    return CATS[k] ? k : null; // släng allt som inte matchar dina 11
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

  // ========= 7) Bygg kategorilista (emoji/label/desc) =========
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

  // ========= 8) Filtera data (endast dina 11 cats) =========
  function getFiltered() {
    const q = norm(ACTIVE.q);
    const fromDt = parseYMD(ACTIVE.from);
    const toDt = parseYMD(ACTIVE.to);

    const out = [];
    for (const e of RAW) {
      const cat = safeCat(e.cat);
      if (!cat) continue;                 // <- tar bort “okända” kategorier
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

    // VIKTIGT: “Kategorier” ska aldrig bli 14 -> vi visar antal valda (max 11)
    if (kpiCats) kpiCats.textContent = String(ACTIVE.cats.size);

    const countries = new Set(list.map(e => (e.country || "").toUpperCase()).filter(Boolean));
    if (kpiCountries) kpiCountries.textContent = String(countries.size);

    const dates = list.map(e => e.__dt).filter(Boolean).sort((a,b)=>a-b);
    if (kpiRange) {
      kpiRange.textContent = dates.length ? `${ymdUTC(dates[0])} – ${ymdUTC(dates[dates.length-1])}` : "–";
    }
  }

  // ========= 10) Plotly base =========
  const BASE = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: { l: 40, r: 20, t: 20, b: 50 },
    font: { family: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", size: 12 }
  };

  // ========= 11) Charts =========
  function drawPieCats(list) {
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
      labels,
      values,
      textinfo: "label+percent",
      marker: { colors }
    }], {
      ...BASE,
      margin: { l: 10, r: 10, t: 10, b: 10 },
      showlegend: true
    }, { responsive: true });
  }

  function drawBarCountries(list) {
    const counts = countBy(list, e => (e.country || "").toUpperCase());
    const top = topN(counts, 40);
    Plotly.react("barCountries", [{
      type: "bar",
      x: top.map(([k]) => k),
      y: top.map(([,v]) => v)
    }], {
      ...BASE,
      xaxis: { tickangle: 90 }
    }, { responsive: true });
  }

  function drawLineTimeline(list) {
    const counts = new Map();
    for (const e of list) {
      if (!e.__dt) continue;
      const k = ymdUTC(e.__dt);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const x = [...counts.keys()].sort();
    const y = x.map(d => counts.get(d));
    Plotly.react("lineTimeline", [{
      type: "scatter",
      mode: "lines+markers",
      x, y
    }], {
      ...BASE,
      showlegend: false
    }, { responsive: true });
  }

  // Byter din “kalender-heatmap” till KARTA-heatmap (som du vill)
  function drawMapHeat(list, targetId, radius) {
    const lats = [];
    const lons = [];
    for (const e of list) {
      const lat = safeNum(e.lat);
      const lon = safeNum(e.lng);
      if (lat == null || lon == null) continue;
      lats.push(lat);
      lons.push(lon);
    }

    Plotly.react(targetId, [{
      type: "densitymapbox",
      lat: lats,
      lon: lons,
      z: lats.map(() => 1),
      radius: radius,
      hoverinfo: "skip"
    }], {
      ...BASE,
      margin: { l: 10, r: 10, t: 10, b: 10 },
      mapbox: {
        style: "open-street-map",
        center: { lat: 20, lon: 0 },
        zoom: 1
      }
    }, { responsive: true });
  }

  function drawScatterMap(list) {
    const lats = [];
    const lons = [];
    const texts = [];
    const colors = [];

    for (const e of list) {
      const lat = safeNum(e.lat);
      const lon = safeNum(e.lng);
      if (lat == null || lon == null) continue;

      lats.push(lat);
      lons.push(lon);

      const meta = CATS[e.cat];
      texts.push(`${meta.emoji} ${meta.label}<br>${e.title || ""}<br>${e.place || ""}<br>${e.date || ""}`);
      colors.push(meta.color);
    }

    Plotly.react("scatterGeo", [{
      type: "scattermapbox",
      lat: lats,
      lon: lons,
      mode: "markers",
      text: texts,
      hovertemplate: "%{text}<extra></extra>",
      marker: { size: 7, opacity: 0.75, color: colors }
    }], {
      ...BASE,
      margin: { l: 10, r: 10, t: 10, b: 10 },
      mapbox: {
        style: "open-street-map",
        center: { lat: 20, lon: 0 },
        zoom: 1
      }
    }, { responsive: true });
  }

  function drawBarTopPlaces(list) {
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
  }

  function drawStackMonthCat(list) {
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
      xaxis: { tickangle: 90 }
    }, { responsive: true });
  }

  // Riktig treemap: Allt -> kategori -> land (med stabila ids)
  function drawTreemap(list) {
    const rootId = "root";

    const catTotals = countBy(list, e => e.cat);
    const catCountry = new Map(); // "cat|country" => count

    for (const e of list) {
      const ctry = (e.country || "").toUpperCase();
      if (!ctry) continue;
      const key = `${e.cat}|${ctry}`;
      catCountry.set(key, (catCountry.get(key) || 0) + 1);
    }

    const ids = [rootId];
    const labels = ["Allt"];
    const parents = [""];
    const values = [list.length];

    // kategori-noder
    for (const cat of CAT_KEYS) {
      const v = catTotals.get(cat) || 0;
      if (!v) continue;

      const catId = `cat:${cat}`;
      ids.push(catId);
      labels.push(`${CATS[cat].emoji} ${CATS[cat].label}`);
      parents.push(rootId);
      values.push(v);

      // land under kategori (top 25 per kategori för läsbarhet)
      const perCountry = new Map();
      for (const [k, cnt] of catCountry.entries()) {
        const [kCat, kCtry] = k.split("|");
        if (kCat !== cat) continue;
        perCountry.set(kCtry, (perCountry.get(kCtry) || 0) + cnt);
      }

      for (const [ctry, cnt] of topN(perCountry, 25)) {
        const id = `cat:${cat}|ctry:${ctry}`;
        ids.push(id);
        labels.push(ctry);
        parents.push(catId);
        values.push(cnt);
      }
    }

    Plotly.react("treemapCatCountry", [{
      type: "treemap",
      ids, labels, parents, values,
      branchvalues: "total",
      hovertemplate: "%{label}: %{value}<extra></extra>"
    }], {
      ...BASE,
      margin: { l: 10, r: 10, t: 10, b: 10 }
    }, { responsive: true });
  }

  function drawCumulative(list) {
    const m = new Map();
    for (const e of list) {
      if (!e.__dt) continue;
      const k = ymdUTC(e.__dt);
      m.set(k, (m.get(k) || 0) + 1);
    }
    const x = [...m.keys()].sort();
    let acc = 0;
    const y = x.map(d => (acc += m.get(d)));

    Plotly.react("cumulative", [{
      type: "scatter",
      mode: "lines",
      x, y
    }], {
      ...BASE,
      showlegend: false
    }, { responsive: true });
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

    // 1–3
    drawPieCats(list);
    drawBarCountries(list);
    drawLineTimeline(list);

    // “Heatmap” ska vara karta: använd densitymapbox i heatCalendar
    drawMapHeat(list, "heatCalendar", 18);

    // Top places + stacked month
    drawBarTopPlaces(list);
    drawStackMonthCat(list);

    // Treemap som träd
    drawTreemap(list);

    // Geo spridning + geo densitet med karta
    drawScatterMap(list);
    drawMapHeat(list, "hist2dGeo", 28); // geo-densitet (karta-heat), lite större radie

    // Kumulativ
    drawCumulative(list);

    setTimeout(resizeAll, 60);
  }

  // ========= init =========
  renderCatsUI();
  setupFullscreen();

  // plocka upp eventuella redan-ifyllda filter i UI
  ACTIVE.from = dateFromEl?.value || "";
  ACTIVE.to = dateToEl?.value || "";
  ACTIVE.q = qEl?.value || "";

  update();
})();
