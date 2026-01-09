(async function(){
  if (typeof Plotly === "undefined") {
    console.error("Plotly saknas");
    return;
  }

  // 1) Försök först använda events.js i dashboard-repot
  let events = (Array.isArray(window.EVENTS) && window.EVENTS.length) ? window.EVENTS : null;

  // 2) Om saknas: hämta EVENTS från kartans sida (som redan fungerar)
  if (!events) {
    const candidateUrls = [
      "https://veckobrevskartan.github.io/index.html",
      "https://veckobrevskartan.github.io/"
    ];

    let loadedFrom = null;
    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();

        const arrayLiteral = extractEventsArrayFromText(html);
        if (!arrayLiteral) throw new Error("Hittade ingen const EVENTS = [ ... ]");

        // eval-safe-ish: vi kör bara array-literalet som redan är JS
        const parsed = (new Function(`"use strict"; return (${arrayLiteral});`))();
        if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Parsade EVENTS men fick tom array");

        events = parsed;
        window.EVENTS = events;
        loadedFrom = url;
        break;
      } catch (e) {
        console.warn("Misslyckades ladda från", url, e.message);
      }
    }

    if (!events) {
      showFatal("Kunde inte ladda EVENTS varken från dashboard/events.js eller från kartans sida.");
      return;
    }

    console.log("✅ EVENTS laddade från karta:", loadedFrom, "Antal:", events.length);
  } else {
    console.log("✅ EVENTS laddade från dashboard/events.js. Antal:", events.length);
  }

  // --------- Här anropar du din befintliga renderlogik ---------
  // För att inte skriva om allt du redan har: jag lägger en minimal “livstest” + dina KPI/filters kan du behålla efter.
  // Byt senare tillbaka till din fulla renderAll(...) om du vill.

  renderSimple(events);

  function renderSimple(data){
    // Kategori pie
    const cat = countBy(data, e => (e.cat || "—"));
    Plotly.react("pieCats", [{
      type:"pie",
      labels:Object.keys(cat),
      values:Object.values(cat),
      textinfo:"label+percent"
    }], {margin:{l:10,r:10,t:10,b:10}}, {responsive:true});

    // Länder bar
    const ctry = countBy(data, e => (e.country || "—"));
    Plotly.react("barCountries", [{
      type:"bar",
      x:Object.keys(ctry),
      y:Object.values(ctry)
    }], {margin:{t:20,l:40,r:20,b:40}}, {responsive:true});

    // Tidsserie
    const byDate = countBy(data, e => (e.date || ""));
    const dates = Object.keys(byDate).filter(Boolean).sort();
    const vals = dates.map(d => byDate[d]);
    Plotly.react("lineTimeline", [{
      type:"scatter", mode:"lines+markers",
      x:dates, y:vals
    }], {margin:{t:20,l:40,r:20,b:40}}, {responsive:true});

    // KPI snabb
    const kpiCount = document.getElementById("kpiCount");
    const kpiCats = document.getElementById("kpiCats");
    const kpiCountries = document.getElementById("kpiCountries");
    if (kpiCount) kpiCount.textContent = String(data.length);
    if (kpiCats) kpiCats.textContent = String(Object.keys(cat).length);
    if (kpiCountries) kpiCountries.textContent = String(Object.keys(ctry).length);
  }

  function countBy(arr, keyFn){
    const m = Object.create(null);
    for (const x of arr){
      const k = String(keyFn(x) ?? "");
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  }

  function showFatal(msg){
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div style="margin:12px;padding:12px;border:1px solid #ff8182;background:#ffebe9;border-radius:12px;font-family:system-ui">
        <b>Dashboard-fel:</b> ${escapeHtml(msg)}
      </div>`
    );
  }

  function escapeHtml(s){
    return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  // Extraherar array-literalet från: const EVENTS = [ ... ];
  function extractEventsArrayFromText(text){
    const idx = text.indexOf("const EVENTS");
    if (idx < 0) return null;
    const start = text.indexOf("[", idx);
    if (start < 0) return null;

    let depth = 0, inS=false, inD=false, inLineC=false, inBlockC=false, esc=false;
    for (let i=start; i<text.length; i++){
      const ch = text[i], nxt = text[i+1];

      if (inLineC){ if (ch === "\n") inLineC=false; continue; }
      if (inBlockC){ if (ch==="*" && nxt==="/"){ inBlockC=false; i++; } continue; }

      if (inS){
        if (esc){ esc=false; continue; }
        if (ch==="\\"){ esc=true; continue; }
        if (ch==="\'") inS=false;
        continue;
      }
      if (inD){
        if (esc){ esc=false; continue; }
        if (ch==="\\"){ esc=true; continue; }
        if (ch==="\"") inD=false;
        continue;
      }

      if (ch==="/" && nxt==="/"){ inLineC=true; i++; continue; }
      if (ch==="/" && nxt==="*"){ inBlockC=true; i++; continue; }

      if (ch==="\'"){ inS=true; continue; }
      if (ch==="\""){ inD=true; continue; }

      if (ch==="[") depth++;
      if (ch==="]"){
        depth--;
        if (depth===0) return text.slice(start, i+1);
      }
    }
    return null;
  }
})();
