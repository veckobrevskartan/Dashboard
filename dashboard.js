/* dashboard.js */
(function(){
  const $ = (s) => document.querySelector(s);

  // Kräver att events.js gör window.EVENTS = EVENTS;
  const RAW = Array.isArray(window.EVENTS) ? window.EVENTS : [];
  if (!RAW.length) {
    console.warn("window.EVENTS saknas eller är tom. Kontrollera att events.js ligger i /Dashboard/ och sätter window.EVENTS.");
  }

  // ---------- Helpers ----------
  const norm = (s) => (s ?? "").toString().toLowerCase().trim();
  const toDate = (s) => {
    // accepterar "YYYY-MM-DD" eller "YYYY.MM.DD" etc
    if (!s) return null;
    const m = String(s).match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
    if(!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const dt = new Date(Date.UTC(y, mo-1, d));
    if (isNaN(dt.getTime())) return null;
    return dt;
  };
  const ymd = (dt) => {
    const y=dt.getUTCFullYear();
    const m=String(dt.getUTCMonth()+1).padStart(2,'0');
    const d=String(dt.getUTCDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  };
  const clampStr = (s, n=70) => (s && s.length>n) ? s.slice(0,n-1)+"…" : (s||"");

  function uniq(arr){
    return Array.from(new Set(arr));
  }
  function countBy(list, keyFn){
    const m = new Map();
    for (const x of list){
      const k = keyFn(x) ?? "";
      m.set(k, (m.get(k)||0) + 1);
    }
    return m;
  }
  function topN(map, n){
    return Array.from(map.entries())
      .sort((a,b)=>b[1]-a[1])
      .slice(0,n);
  }

  // ---------- Category model (labels från din karta om du vill, annars code) ----------
  // Om du vill hämta labels från din karta: lägg window.CATS i events.js också.
  const CAT_LABEL = (code) => {
    const C = window.CATS && window.CATS[code];
    return C?.label || code || "OKÄND";
  };

  // ---------- Filter UI ----------
  const catsHost = $("#cats");
  const catsAllBtn = $("#catsAll");
  const catsNoneBtn = $("#catsNone");
  const statsLine = $("#statsLine");

  const dateFromEl = $("#dateFrom");
  const dateToEl = $("#dateTo");
  const qEl = $("#q");
  const btnReset = $("#btnReset");
  const btnApply = $("#btnApply");

  // default: alla kategorier som finns i datat
  const ALL_CATS = uniq(RAW.map(e => (e.cat||"").toUpperCase()).filter(Boolean)).sort();
  const ACTIVE_CATS = new Set(ALL_CATS);

  function renderCats(){
    catsHost.innerHTML = "";
    const counts = countBy(RAW, e => (e.cat||"").toUpperCase());
    for (const c of ALL_CATS){
      const row = document.createElement("div");
      row.className = "catrow";
      row.innerHTML = `
        <input type="checkbox" id="cat_${c}" ${ACTIVE_CATS.has(c) ? "checked": ""}>
        <div>
          <div class="tag">${CAT_LABEL(c)}</div>
          <div class="meta">${c}</div>
        </div>
        <div class="meta">${counts.get(c)||0}</div>
      `;
      row.querySelector("input").addEventListener("change", (ev)=>{
        if (ev.target.checked) ACTIVE_CATS.add(c); else ACTIVE_CATS.delete(c);
        update();
      });
      catsHost.appendChild(row);
    }
    statsLine.textContent = `${RAW.length} händelser • ${ALL_CATS.length} kategorier`;
  }

  catsAllBtn.addEventListener("click", ()=>{
    ALL_CATS.forEach(c => ACTIVE_CATS.add(c));
    renderCats();
    update();
  });
  catsNoneBtn.addEventListener("click", ()=>{
    ACTIVE_CATS.clear();
    renderCats();
    update();
  });

  btnApply.addEventListener("click", ()=> update());
  btnReset.addEventListener("click", ()=>{
    qEl.value = "";
    dateFromEl.value = "";
    dateToEl.value = "";
    ACTIVE_CATS.clear();
    ALL_CATS.forEach(c => ACTIVE_CATS.add(c));
    renderCats();
    update();
  });

  // ---------- Filtering ----------
  function applyFilters(){
    const q = norm(qEl.value);
    const df = dateFromEl.value ? toDate(dateFromEl.value) : null;
    const dt = dateToEl.value ? toDate(dateToEl.value) : null;

    const out = [];
    for (const e of RAW){
      const cat = (e.cat||"").toUpperCase();
      if (ACTIVE_CATS.size && !ACTIVE_CATS.has(cat)) continue;

      const d = toDate(e.date || e.start || e.end);
      if (df && d && d < df) continue;
      if (dt && d && d > dt) continue;

      if (q){
        const hay = norm([e.title,e.place,e.city,e.summary,e.source,e.country,e.cat].join(" "));
        if (!hay.includes(q)) continue;
      }

      out.push({...e, __dt:d});
    }
    return out;
  }

  // ---------- KPIs ----------
  function setKPIs(list){
    $("#kpiCount").textContent = String(list.length);
    $("#kpiCats").textContent = String(uniq(list.map(e => (e.cat||"").toUpperCase()).filter(Boolean)).length);
    $("#kpiCountries").textContent = String(uniq(list.map(e => (e.country||"").toUpperCase()).filter(Boolean)).length);

    const dates = list.map(e=>e.__dt).filter(Boolean).sort((a,b)=>a-b);
    if (dates.length){
      $("#kpiRange").textContent = `${ymd(dates[0])} – ${ymd(dates[dates.length-1])}`;
    } else {
      $("#kpiRange").textContent = "–";
    }
  }

  // ---------- Plotly base layout ----------
  const PLOT_BASE = {
    margin:{l:40,r:18,t:24,b:38},
    paper_bgcolor:"rgba(0,0,0,0)",
    plot_bgcolor:"rgba(0,0,0,0)",
    font:{family:"system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", size:12},
    showlegend:true
  };

  function pResizeAll(){
    const ids = [
      "pieCats","barCountries","lineTimeline","heatCalendar","barTopPlaces",
      "stackMonthCat","sankeyCountryCat","treemapCatCountry","scatterGeo","hist2dGeo","cumulative"
    ];
    for (const id of ids){
      const el = document.getElementById(id);
      if (el && el.data) {
        try{ Plotly.Plots.resize(el); }catch{}
      }
    }
  }

  // ---------- Charts ----------
  function drawPieCats(list){
    const m = countBy(list, e => (e.cat||"").toUpperCase() || "OKÄND");
    const entries = Array.from(m.entries()).sort((a,b)=>b[1]-a[1]);
    const labels = entries.map(([k]) => CAT_LABEL(k));
    const values = entries.map(([,v]) => v);

    Plotly.react("pieCats", [{
      type:"pie",
      labels, values,
      textinfo:"label+percent",
      hovertemplate:"%{label}<br>%{value} st (%{percent})<extra></extra>"
    }], {...PLOT_BASE, margin:{l:10,r:10,t:10,b:10}});
  }

  function drawBarCountries(list){
    const m = countBy(list, e => (e.country||"").toUpperCase() || "??");
    const entries = Array.from(m.entries()).sort((a,b)=>b[1]-a[1]);
    const x = entries.map(([k])=>k);
    const y = entries.map(([,v])=>v);

    Plotly.react("barCountries", [{
      type:"bar",
      x, y,
      hovertemplate:"%{x}: %{y}<extra></extra>"
    }], {...PLOT_BASE, showlegend:false});
  }

  function drawLineTimeline(list){
    const byDay = new Map();
    for (const e of list){
      const d = e.__dt;
      if (!d) continue;
      const k = ymd(d);
      byDay.set(k, (byDay.get(k)||0)+1);
    }
    const entries = Array.from(byDay.entries()).sort((a,b)=>a[0].localeCompare(b[0]));
    const x = entries.map(e=>e[0]);
    const y = entries.map(e=>e[1]);

    Plotly.react("lineTimeline", [{
      type:"scatter",
      mode:"lines+markers",
      x, y,
      hovertemplate:"%{x}: %{y}<extra></extra>"
    }], {...PLOT_BASE, showlegend:false});
  }

  function drawCumulative(list){
    const byDay = new Map();
    for (const e of list){
      const d = e.__dt;
      if (!d) continue;
      const k = ymd(d);
      byDay.set(k, (byDay.get(k)||0)+1);
    }
    const entries = Array.from(byDay.entries()).sort((a,b)=>a[0].localeCompare(b[0]));
    let acc = 0;
    const x = [];
    const y = [];
    for (const [k,v] of entries){
      acc += v;
      x.push(k); y.push(acc);
    }
    Plotly.react("cumulative", [{
      type:"scatter",
      mode:"lines",
      x, y,
      hovertemplate:"%{x}: %{y}<extra></extra>"
    }], {...PLOT_BASE, showlegend:false});
  }

  // Kalender-heatmap (enkelt: veckor x veckodag)
  function drawHeatCalendar(list){
    const days = list.map(e=>e.__dt).filter(Boolean);
    if (!days.length){
      Plotly.react("heatCalendar", [{z:[[0]] ,type:"heatmap"}], {...PLOT_BASE, showlegend:false});
      return;
    }
    // Bygg en kalendergrid: år-vecka -> [Mon..Sun]
    const toISOWeek = (dt) => {
      // ISO week calc i UTC
      const d = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
      const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
      d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday
      const firstThu = new Date(Date.UTC(d.getUTCFullYear(),0,4));
      const firstDayNum = (firstThu.getUTCDay()+6)%7;
      firstThu.setUTCDate(firstThu.getUTCDate()-firstDayNum+3);
      const week = 1 + Math.round((d - firstThu) / (7*24*3600*1000));
      const year = d.getUTCFullYear();
      return {year, week, dow: dayNum}; // dow: Mon=0..Sun=6
    };

    const grid = new Map(); // key year-week => [7]
    let minKey = null, maxKey = null;

    for (const d of days){
      const w = toISOWeek(d);
      const key = `${w.year}-W${String(w.week).padStart(2,'0')}`;
      if (!grid.has(key)) grid.set(key, new Array(7).fill(0));
      grid.get(key)[w.dow] += 1;

      if (!minKey || key < minKey) minKey = key;
      if (!maxKey || key > maxKey) maxKey = key;
    }

    const keys = Array.from(grid.keys()).sort();
    const z = keys.map(k => grid.get(k));
    const y = keys;
    const x = ["Mån","Tis","Ons","Tor","Fre","Lör","Sön"];

    Plotly.react("heatCalendar", [{
      type:"heatmap",
      x, y, z,
      hovertemplate:"%{y} %{x}: %{z}<extra></extra>"
    }], {...PLOT_BASE, margin:{l:70,r:18,t:10,b:38}, showlegend:false});
  }

  function drawBarTopPlaces(list){
    const pick = (e) => (e.city || e.place || "").toString().trim();
    const m = countBy(list, e => clampStr(pick(e), 60) || "—");
    const entries = topN(m, 15);
    const x = entries.map(([k])=>k).reverse();
    const y = entries.map(([,v])=>v).reverse();

    Plotly.react("barTopPlaces", [{
      type:"bar",
      x:y, y:x,
      orientation:"h",
      hovertemplate:"%{y}: %{x}<extra></extra>"
    }], {...PLOT_BASE, showlegend:false, margin:{l:160,r:18,t:24,b:38}});
  }

  function drawStackMonthCat(list){
    // month key YYYY-MM
    const months = new Set();
    const cats = uniq(list.map(e=>(e.cat||"").toUpperCase()||"OKÄND")).sort();
    const m = new Map(); // month => cat => count
    for (const e of list){
      if (!e.__dt) continue;
      const month = `${e.__dt.getUTCFullYear()}-${String(e.__dt.getUTCMonth()+1).padStart(2,'0')}`;
      months.add(month);
      const cat = (e.cat||"").toUpperCase()||"OKÄND";
      if (!m.has(month)) m.set(month, new Map());
      const mm = m.get(month);
      mm.set(cat, (mm.get(cat)||0)+1);
    }
    const x = Array.from(months).sort();
    const traces = cats.map(cat => ({
      type:"bar",
      name: CAT_LABEL(cat),
      x,
      y: x.map(mon => (m.get(mon)?.get(cat) || 0))
    }));
    Plotly.react("stackMonthCat", traces, {
      ...PLOT_BASE,
      barmode:"stack",
      margin:{l:40,r:18,t:24,b:50}
    });
  }

  function drawSankeyCountryCat(list){
    // begränsa lite så den inte blir oläsbar
    const topCountries = topN(countBy(list, e => (e.country||"").toUpperCase()||"??"), 10).map(([k])=>k);
    const topCats = topN(countBy(list, e => (e.cat||"").toUpperCase()||"OKÄND"), 10).map(([k])=>k);

    const nodes = [];
    const idx = new Map();
    function node(name){
      if (!idx.has(name)){
        idx.set(name, nodes.length);
        nodes.push(name);
      }
      return idx.get(name);
    }

    const links = new Map(); // "a|b" -> value
    for (const e of list){
      const ctry = (e.country||"").toUpperCase()||"??";
      const cat = (e.cat||"").toUpperCase()||"OKÄND";
      if (!topCountries.includes(ctry) || !topCats.includes(cat)) continue;
      const a = `Land: ${ctry}`;
      const b = `Kategori: ${CAT_LABEL(cat)}`;
      const k = `${a}|${b}`;
      links.set(k, (links.get(k)||0)+1);
      node(a); node(b);
    }

    const source = [];
    const target = [];
    const value = [];
    for (const [k,v] of links.entries()){
      const [a,b] = k.split("|");
      source.push(node(a));
      target.push(node(b));
      value.push(v);
    }

    Plotly.react("sankeyCountryCat", [{
      type:"sankey",
      node:{ label:nodes, pad:12, thickness:14 },
      link:{ source, target, value }
    }], {...PLOT_BASE, margin:{l:10,r:10,t:10,b:10}});
  }

  function drawTreemap(list){
    const labels = [];
    const parents = [];
    const values = [];

    const byCat = new Map();
    for (const e of list){
      const cat = (e.cat||"").toUpperCase() || "OKÄND";
      const ctry = (e.country||"").toUpperCase() || "??";
      if (!byCat.has(cat)) byCat.set(cat, new Map());
      const m = byCat.get(cat);
      m.set(ctry, (m.get(ctry)||0)+1);
    }

    labels.push("Allt"); parents.push(""); values.push(list.length);

    for (const [cat, m] of byCat.entries()){
      const catLabel = CAT_LABEL(cat);
      const catSum = Array.from(m.values()).reduce((a,b)=>a+b,0);
      labels.push(catLabel); parents.push("Allt"); values.push(catSum);

      // topp 12 länder per kategori för läsbarhet
      for (const [ctry,v] of topN(m, 12)){
        labels.push(`${ctry}`); parents.push(catLabel); values.push(v);
      }
    }

    Plotly.react("treemapCatCountry", [{
      type:"treemap",
      labels, parents, values,
      branchvalues:"total",
      hovertemplate:"%{label}: %{value}<extra></extra>"
    }], {...PLOT_BASE, margin:{l:10,r:10,t:10,b:10}, showlegend:false});
  }

  function drawScatterGeo(list){
    const pts = list.filter(e => typeof e.lat==="number" && typeof e.lng==="number" && isFinite(e.lat) && isFinite(e.lng));
    const x = pts.map(e=>e.lng);
    const y = pts.map(e=>e.lat);
    const text = pts.map(e => `${e.country||""} • ${e.cat||""}<br>${(e.title||"")}`);

    Plotly.react("scatterGeo", [{
      type:"scattergl",
      mode:"markers",
      x, y,
      text,
      hovertemplate:"%{text}<br>lat=%{y:.3f}, lng=%{x:.3f}<extra></extra>",
      marker:{ size:6, opacity:0.75 }
    }], {
      ...PLOT_BASE,
      showlegend:false,
      xaxis:{ title:"Longitude", zeroline:false },
      yaxis:{ title:"Latitude", zeroline:false }
    });
  }

  function drawHist2dGeo(list){
    const pts = list.filter(e => typeof e.lat==="number" && typeof e.lng==="number" && isFinite(e.lat) && isFinite(e.lng));
    const x = pts.map(e=>e.lng);
    const y = pts.map(e=>e.lat);

    Plotly.react("hist2dGeo", [{
      type:"histogram2d",
      x, y,
      hovertemplate:"densitet=%{z}<extra></extra>"
    }], {
      ...PLOT_BASE,
      showlegend:false,
      xaxis:{ title:"Longitude" },
      yaxis:{ title:"Latitude" }
    });
  }

  // ---------- Fullscreen per card ----------
  function setupFullscreen(){
    document.querySelectorAll(".card .fs").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const card = btn.closest(".card");
        if (!card) return;

        if (document.fullscreenElement) {
          await document.exitFullscreen().catch(()=>{});
        } else {
          await card.requestFullscreen().catch(()=>{});
        }
        // resize efter toggle
        setTimeout(pResizeAll, 120);
      });
    });

    document.addEventListener("fullscreenchange", ()=>{
      setTimeout(pResizeAll, 120);
    });
  }

  // ---------- Main update ----------
  function update(){
    const list = applyFilters();
    setKPIs(list);

    drawPieCats(list);
    drawBarCountries(list);
    drawLineTimeline(list);
    drawHeatCalendar(list);
    drawBarTopPlaces(list);
    drawStackMonthCat(list);
    drawSankeyCountryCat(list);
    drawTreemap(list);
    drawScatterGeo(list);
    drawHist2dGeo(list);
    drawCumulative(list);

    // säkerställ att plotly får rätt storlek efter DOM paint
    setTimeout(pResizeAll, 80);
  }

  // ---------- Init ----------
  function init(){
    renderCats();
    setupFullscreen();

    // init: sätt datum till min/max om du vill (valfritt)
    const dates = RAW.map(e=>toDate(e.date||e.start||e.end)).filter(Boolean).sort((a,b)=>a-b);
    if (dates.length){
      // kommentera bort om du inte vill auto-fylla
      // dateFromEl.value = ymd(dates[0]);
      // dateToEl.value = ymd(dates[dates.length-1]);
    }

    update();
    window.addEventListener("resize", ()=> setTimeout(pResizeAll, 60));
  }

  init();
})();
