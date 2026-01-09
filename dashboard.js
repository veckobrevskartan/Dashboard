(function () {
  // ---------- Guardrails ----------
  if (typeof Plotly === "undefined") {
    console.error("Plotly saknas (cdn.plot.ly laddades inte).");
    return;
  }

  // Använd din events.js (som nu fungerar)
  const RAW = Array.isArray(window.EVENTS) ? window.EVENTS : [];
  if (!RAW.length) {
    console.error("window.EVENTS saknas eller är tom. events.js laddades inte eller kraschade.");
    showTopError("EVENTS saknas (window.EVENTS är tom/undefined). Kontrollera events.js i Network/Console.");
    return;
  }

  // ---------- DOM ----------
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

  const KPI = {
    count: $("kpiCount"),
    cats: $("kpiCats"),
    countries: $("kpiCountries"),
    range: $("kpiRange"),
  };

  // ---------- Helpers ----------
  const norm = (s) => (s ?? "").toString().trim();
  const normU = (s) => norm(s).toUpperCase();

  function toDate(s) {
    // accepterar "YYYY-MM-DD" (din standard)
    const x = norm(s);
    const m = x.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (isNaN(dt.getTime())) return null;
    return dt;
  }

  function ymd(dt) {
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function uniq(arr) {
    return Array.from(new Set(arr));
  }

  function countBy(list, keyFn) {
    const m = new Map();
    for (const x of list) {
      const k = keyFn(x);
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }

  function topN(map, n) {
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  }

  function safeNum(v) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // ---------- Category UI ----------
  const ALL_CATS = uniq(RAW.map((e) => normU(e.cat)).filter(Boolean)).sort();
  const ACTIVE_CATS = new Set(ALL_CATS);

  function renderCats() {
    if (!catsHost) return;
    catsHost.innerHTML = "";
    const counts = countBy(RAW, (e) => normU(e.cat) || "—");

    for (const c of ALL_CATS) {
      const row = document.createElement("div");
      row.className = "catrow";
      row.innerHTML = `
        <input type="checkbox" ${ACTIVE_CATS.has(c) ? "checked" : ""}>
        <div class="tag">${c}</div>
        <div class="meta">${counts.get(c) || 0}</div>
      `;
      row.querySelector("input").addEventListener("change", (ev) => {
        if (ev.target.checked) ACTIVE_CATS.add(c);
        else ACTIVE_CATS.delete(c);
        update();
      });
      catsHost.appendChild(row);
    }
    if (statsLine) statsLine.textContent = `${RAW.length} händelser • ${ALL_CATS.length} kategorier`;
  }

  if (catsAllBtn) {
    catsAllBtn.addEventListener("click", () => {
      ALL_CATS.forEach((c) => ACTIVE_CATS.add(c));
      renderCats();
      update();
    });
  }
  if (catsNoneBtn) {
    catsNoneBtn.addEventListener("click", () => {
      ACTIVE_CATS.clear();
      renderCats();
      update();
    });
  }

  // ---------- Filters ----------
  function applyFilters() {
    const q = norm(qEl?.value).toLowerCase();
    const df = dateFromEl?.value ? toDate(dateFromEl.value) : null;
    const dt = dateToEl?.value ? toDate(dateToEl.value) : null;

    const out = [];
    for (const e of RAW) {
      const cat = normU(e.cat);
      if (ACTIVE_CATS.size && cat && !ACTIVE_CATS.has(cat)) continue;

      const d = toDate(e.date);
      if (df && d && d < df) continue;
      if (dt && d && d > dt) continue;

      if (q) {
        const hay = [
          e.title, e.place, e.summary, e.source, e.country, e.cat, e.url
        ].map(norm).join(" ").toLowerCase();
        if (!hay.includes(q)) continue;
      }

      out.push({ ...e, __dt: d });
    }
    return out;
  }

  function setKPIs(list) {
    if (KPI.count) KPI.count.textContent = String(list.length);
    if (KPI.cats) KPI.cats.textContent = String(uniq(list.map((e) => normU(e.cat)).filter(Boolean)).length);
    if (KPI.countries) KPI.countries.textContent = String(uniq(list.map((e) => normU(e.country)).filter(Boolean)).length);

    const dates = list.map((e) => e.__dt).filter(Boolean).sort((a, b) => a - b);
    if (KPI.range) KPI.range.textContent = dates.length ? `${ymd(dates[0])} – ${ymd(dates[dates.length - 1])}` : "–";
  }

  if (btnApply) btnApply.addEventListener("click", update);
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      if (qEl) qEl.value = "";
      if (dateFromEl) dateFromEl.value = "";
      if (dateToEl) dateToEl.value = "";
      ACTIVE_CATS.clear();
      ALL_CATS.forEach((c) => ACTIVE_CATS.add(c));
      renderCats();
      update();
    });
  }

  // ---------- Fullscreen per card ----------
  function setupFullscreen() {
    document.querySelectorAll(".card .fs").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const card = btn.closest(".card");
        if (!card) return;
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        else await card.requestFullscreen().catch(() => {});
        setTimeout(resizeAll, 120);
      });
    });
    document.addEventListener("fullscreenchange", () => setTimeout(resizeAll, 120));
  }

  function resizeAll() {
    const ids = [
      "pieCats", "barCountries", "lineTimeline", "heatCalendar",
      "barTopPlaces", "stackMonthCat", "sankeyCountryCat", "treemapCatCountry",
      "scatterGeo", "hist2dGeo", "cumulative"
    ];
    for (const id of ids) {
      const el = $(id);
      if (el && el.data) {
        try { Plotly.Plots.resize(el); } catch {}
      }
    }
  }

  // ---------- Chart wrappers (so one failure doesn't kill all) ----------
  function draw(id, fn) {
    try { fn(); }
    catch (e) { console.error("Chart error:", id, e); }
  }

  // ---------- Charts ----------
  const BASE = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", size: 12 }
  };

  function update() {
    const list = applyFilters();
    setKPIs(list);

    // 1 Pie: categories
    draw("pieCats", () => {
      const m = countBy(list, (e) => normU(e.cat) || "—");
      const labels = Array.from(m.keys());
      const values = Array.from(m.values());
      Plotly.react("pieCats", [{
        type: "pie",
        labels, values,
        textinfo: "label+percent"
      }], { ...BASE, margin: { l: 10, r: 10, t: 10, b: 10 } }, { responsive: true });
    });

    // 2 Bar: countries
    draw("barCountries", () => {
      const m = countBy(list, (e) => normU(e.country) || "—");
      const entries = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
      Plotly.react("barCountries", [{
        type: "bar",
        x: entries.map(([k]) => k),
        y: entries.map(([, v]) => v)
      }], { ...BASE, margin: { t: 20, l: 40, r: 20, b: 70 } }, { responsive: true });
    });

    // 3 Line: per day
    draw("lineTimeline", () => {
      const m = new Map();
      for (const e of list) {
        if (!e.__dt) continue;
        const k = ymd(e.__dt);
        m.set(k, (m.get(k) || 0) + 1);
      }
      const xs = Array.from(m.keys()).sort();
      const ys = xs.map((x) => m.get(x));
      Plotly.react("lineTimeline", [{
        type: "scatter",
        mode: "lines+markers",
        x: xs, y: ys
      }], { ...BASE, margin: { t: 20, l: 40, r: 20, b: 40 }, showlegend: false }, { responsive: true });
    });

    // 4 Calendar heatmap (week rows)
    draw("heatCalendar", () => {
      const days = list.map((e) => e.__dt).filter(Boolean);
      if (!days.length) {
        Plotly.react("heatCalendar", [], { ...BASE, margin: { t: 10 } }, { responsive: true });
        return;
      }

      function isoWeek(dt) {
        const d = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
        const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
        d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thu
        const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
        const firstDayNum = (firstThu.getUTCDay() + 6) % 7;
        firstThu.setUTCDate(firstThu.getUTCDate() - firstDayNum + 3);
        const week = 1 + Math.round((d - firstThu) / (7 * 24 * 3600 * 1000));
        return { year: d.getUTCFullYear(), week, dow: dayNum };
      }

      const grid = new Map(); // key => [7]
      for (const d of days) {
        const w = isoWeek(d);
        const key = `${w.year}-W${String(w.week).padStart(2, "0")}`;
        if (!grid.has(key)) grid.set(key, new Array(7).fill(0));
        grid.get(key)[w.dow] += 1;
      }
      const keys = Array.from(grid.keys()).sort();
      const z = keys.map((k) => grid.get(k));
      const x = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

      Plotly.react("heatCalendar", [{
        type: "heatmap",
        x, y: keys, z,
        hovertemplate: "%{y} %{x}: %{z}<extra></extra>"
      }], { ...BASE, margin: { t: 10, l: 70, r: 20, b: 40 }, showlegend: false }, { responsive: true });
    });

    // 5 Top places bar
    draw("barTopPlaces", () => {
      const m = countBy(list, (e) => norm(e.city || e.place) || "—");
      const top = topN(m, 15).reverse();
      Plotly.react("barTopPlaces", [{
        type: "bar",
        x: top.map(([, v]) => v),
        y: top.map(([k]) => k),
        orientation: "h"
      }], { ...BASE, margin: { t: 20, l: 180, r: 20, b: 40 }, showlegend: false }, { responsive: true });
    });

    // 6 Month x category stacked
    draw("stackMonthCat", () => {
      const months = uniq(list.map((e) => (e.__dt ? `${e.__dt.getUTCFullYear()}-${String(e.__dt.getUTCMonth() + 1).padStart(2, "0")}` : null)).filter(Boolean)).sort();
      const cats = uniq(list.map((e) => normU(e.cat) || "—")).sort();
      const bucket = new Map(); // month -> cat -> count
      for (const e of list) {
        if (!e.__dt) continue;
        const mon = `${e.__dt.getUTCFullYear()}-${String(e.__dt.getUTCMonth() + 1).padStart(2, "0")}`;
        const cat = normU(e.cat) || "—";
        if (!bucket.has(mon)) bucket.set(mon, new Map());
        const mm = bucket.get(mon);
        mm.set(cat, (mm.get(cat) || 0) + 1);
      }
      const traces = cats.map((cat) => ({
        type: "bar",
        name: cat,
        x: months,
        y: months.map((m) => bucket.get(m)?.get(cat) || 0)
      }));
      Plotly.react("stackMonthCat", traces, { ...BASE, barmode: "stack", margin: { t: 20, l: 40, r: 20, b: 60 } }, { responsive: true });
    });

    // 7 Sankey country -> category
    draw("sankeyCountryCat", () => {
      const topCountries = topN(countBy(list, (e) => normU(e.country) || "—"), 12).map(([k]) => k);
      const topCats = topN(countBy(list, (e) => normU(e.cat) || "—"), 12).map(([k]) => k);

      const nodes = [];
      const idx = new Map();
      const node = (name) => {
        if (!idx.has(name)) { idx.set(name, nodes.length); nodes.push(name); }
        return idx.get(name);
      };

      const links = new Map();
      for (const e of list) {
        const ctry = normU(e.country) || "—";
        const cat = normU(e.cat) || "—";
        if (!topCountries.includes(ctry) || !topCats.includes(cat)) continue;
        const a = `Land: ${ctry}`;
        const b = `Kategori: ${cat}`;
        const k = `${a}|${b}`;
        links.set(k, (links.get(k) || 0) + 1);
        node(a); node(b);
      }

      const source = [], target = [], value = [];
      for (const [k, v] of links.entries()) {
        const [a, b] = k.split("|");
        source.push(node(a));
        target.push(node(b));
        value.push(v);
      }

      Plotly.react("sankeyCountryCat", [{
        type: "sankey",
        node: { label: nodes, pad: 12, thickness: 14 },
        link: { source, target, value }
      }], { ...BASE, margin: { l: 10, r: 10, t: 10, b: 10 } }, { responsive: true });
    });

    // 8 Treemap category -> country
    draw("treemapCatCountry", () => {
      const labels = ["Allt"];
      const parents = [""];
      const values = [list.length];

      const byCat = new Map();
      for (const e of list) {
        const cat = normU(e.cat) || "—";
        const ctry = normU(e.country) || "—";
        if (!byCat.has(cat)) byCat.set(cat, new Map());
        const m = byCat.get(cat);
        m.set(ctry, (m.get(ctry) || 0) + 1);
      }

      for (const [cat, m] of byCat.entries()) {
        const sum = Array.from(m.values()).reduce((a, b) => a + b, 0);
        labels.push(cat); parents.push("Allt"); values.push(sum);

        for (const [ctry, v] of topN(m, 12)) {
          labels.push(ctry); parents.push(cat); values.push(v);
        }
      }

      Plotly.react("treemapCatCountry", [{
        type: "treemap",
        labels, parents, values,
        branchvalues: "total"
      }], { ...BASE, margin: { l: 10, r: 10, t: 10, b: 10 }, showlegend: false }, { responsive: true });
    });

    // 9 Scatter geo (lat/lng)
    draw("scatterGeo", () => {
      const pts = list
        .map((e) => ({ lat: safeNum(e.lat), lng: safeNum(e.lng), title: norm(e.title), cat: normU(e.cat), country: normU(e.country) }))
        .filter((p) => p.lat != null && p.lng != null);

      if (!pts.length) {
        Plotly.react("scatterGeo", [], { ...BASE, margin: { t: 10 } }, { responsive: true });
        return;
      }

      Plotly.react("scatterGeo", [{
        type: "scattergl",
        mode: "markers",
        x: pts.map((p) => p.lng),
        y: pts.map((p) => p.lat),
        text: pts.map((p) => `${p.country} • ${p.cat}<br>${p.title}`),
        hovertemplate: "%{text}<br>lat=%{y:.3f}, lng=%{x:.3f}<extra></extra>",
        marker: { size: 6, opacity: 0.75 }
      }], {
        ...BASE,
        showlegend: false,
        margin: { t: 20, l: 50, r: 20, b: 50 },
        xaxis: { title: "Longitude" },
        yaxis: { title: "Latitude" }
      }, { responsive: true });
    });

    // 10 Geo density histogram2d
    draw("hist2dGeo", () => {
      const pts = list
        .map((e) => ({ lat: safeNum(e.lat), lng: safeNum(e.lng) }))
        .filter((p) => p.lat != null && p.lng != null);

      if (!pts.length) {
        Plotly.react("hist2dGeo", [], { ...BASE, margin: { t: 10 } }, { responsive: true });
        return;
      }

      Plotly.react("hist2dGeo", [{
        type: "histogram2d",
        x: pts.map((p) => p.lng),
        y: pts.map((p) => p.lat)
      }], {
        ...BASE,
        showlegend: false,
        margin: { t: 20, l: 50, r: 20, b: 50 },
        xaxis: { title: "Longitude" },
        yaxis: { title: "Latitude" }
      }, { responsive: true });
    });

    // 11 Cumulative
    draw("cumulative", () => {
      const m = new Map();
      for (const e of list) {
        if (!e.__dt) continue;
        const k = ymd(e.__dt);
        m.set(k, (m.get(k) || 0) + 1);
      }
      const xs = Array.from(m.keys()).sort();
      let acc = 0;
      const ys = xs.map((x) => (acc += m.get(x)));
      Plotly.react("cumulative", [{
        type: "scatter",
        mode: "lines",
        x: xs, y: ys
      }], { ...BASE, margin: { t: 20, l: 40, r: 20, b: 40 }, showlegend: false }, { responsive: true });
    });

    setTimeout(resizeAll, 80);
  }

  // ---------- Tiny UI helper ----------
  function showTopError(msg) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div style="margin:12px;padding:12px;border:1px solid #ff8182;background:#ffebe9;border-radius:12px;font-family:system-ui">
        <b>Dashboard-fel:</b> ${escapeHtml(msg)}
      </div>`
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- Init ----------
  renderCats();
  setupFullscreen();
  update();
  window.addEventListener("resize", () => setTimeout(resizeAll, 60));
})();
