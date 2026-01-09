(async function () {
  // --------- 1) Försök använda window.EVENTS om det redan finns ---------
  let events = (Array.isArray(window.EVENTS) && window.EVENTS.length) ? window.EVENTS : null;

  // --------- 2) Om EVENTS saknas: hämta från kartans index.html ---------
  if (!events) {
    // Ändra dessa om din karta ligger på annan path.
    // Jag lägger flera kandidater – första som fungerar används.
    const candidateUrls = [
      "https://veckobrevskartan.github.io/index.html",
      "https://veckobrevskartan.github.io/",
      // om din karta ligger i en mapp, lägg till t.ex:
      // "https://veckobrevskartan.github.io/vecko-brev/index.html",
    ];

    let lastErr = null;

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status} från ${url}`);
        const html = await res.text();

        const extracted = extractEventsArrayFromText(html);
        if (!extracted) throw new Error(`Hittade ingen EVENTS-array i ${url}`);

        // Kör array-literal som JS och få tillbaka en riktig array
        // (formatet med single quotes funkar i JS)
        const parsed = (new Function(`"use strict"; return (${extracted});`))();

        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error(`EVENTS parsad men tom från ${url}`);
        }

        events = parsed;
        window.EVENTS = events;
        console.log("✅ EVENTS laddade från:", url, "Antal:", events.length);
        break;
      } catch (e) {
        lastErr = e;
        console.warn("Fallback misslyckades:", e.message);
      }
    }

    if (!events) {
      console.error("❌ Kunde inte ladda EVENTS från kartan.", lastErr);
      showFatal("Kunde inte ladda data (EVENTS). Kontrollera att kartans index.html innehåller const EVENTS = [ ... ];");
      return;
    }
  } else {
    console.log("✅ EVENTS fanns redan. Antal:", events.length);
  }

  // --------- 3) Verifiera Plotly ---------
  if (typeof Plotly === "undefined") {
    showFatal("Plotly laddades inte. Kontrollera script-taggen i index.html.");
    return;
  }

  // --------- 4) Rita 3 grafer (bevis på liv) ---------
  renderCharts(events);

  // --------- Helpers ---------

  function renderCharts(data) {
    // Kategorier pie
    const catCounts = countBy(data, e => (e.cat || "—"));
    Plotly.newPlot("chart_categories", [{
      type: "pie",
      labels: Object.keys(catCounts),
      values: Object.values(catCounts),
      textinfo: "label+percent",
      hovertemplate: "%{label}<br>%{value}<extra></extra>"
    }], { margin: { t: 10, l: 10, r: 10, b: 10 } }, { responsive: true });

    // Länder bar
    const countryCounts = countBy(data, e => (e.country || "—"));
    Plotly.newPlot("chart_countries", [{
      type: "bar",
      x: Object.keys(countryCounts),
      y: Object.values(countryCounts),
      hovertemplate: "%{x}: %{y}<extra></extra>"
    }], { margin: { t: 20 } }, { responsive: true });

    // Tidsserie line (per dag)
    const byDate = countBy(data, e => (e.date || ""));
    const dates = Object.keys(byDate).filter(Boolean).sort();
    const counts = dates.map(d => byDate[d]);

    Plotly.newPlot("chart_timeline", [{
      type: "scatter",
      mode: "lines+markers",
      x: dates,
      y: counts,
      hovertemplate: "%{x}: %{y}<extra></extra>"
    }], { margin: { t: 20 } }, { responsive: true });

    // snabb info i DOM om du vill:
    console.log("Kategorier:", Object.keys(catCounts).length, "Länder:", Object.keys(countryCounts).length);
  }

  function countBy(arr, keyFn) {
    const m = Object.create(null);
    for (const x of arr) {
      const k = String(keyFn(x) ?? "");
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  }

  function showFatal(msg) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div style="margin:12px;padding:12px;border:1px solid #ff5a5f;background:#ffecec;border-radius:12px;font-family:system-ui">
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

  /**
   * Extraherar array-literalet från en sida som innehåller:
   *   const EVENTS = [ ... ];
   *
   * Returnerar texten "[ ... ]" (hela array-literalet) eller null.
   *
   * Klarar:
   * - single quotes i data
   * - escapes \'
   * - // och /* */ kommentarer
   */
  function extractEventsArrayFromText(text) {
    const idx = text.indexOf("const EVENTS");
    if (idx < 0) return null;

    // hitta första '[' efter "const EVENTS"
    const start = text.indexOf("[", idx);
    if (start < 0) return null;

    let i = start;
    let depth = 0;
    let inS = false;   // single-quoted string
    let inD = false;   // double-quoted string
    let inLineC = false;
    let inBlockC = false;
    let esc = false;

    for (; i < text.length; i++) {
      const ch = text[i];
      const nxt = text[i + 1];

      // Kommentarer
      if (inLineC) {
        if (ch === "\n") inLineC = false;
        continue;
      }
      if (inBlockC) {
        if (ch === "*" && nxt === "/") { inBlockC = false; i++; }
        continue;
      }

      // Strings
      if (inS) {
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === "'") inS = false;
        continue;
      }
      if (inD) {
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === '"') inD = false;
        continue;
      }

      // Start på kommentar
      if (ch === "/" && nxt === "/") { inLineC = true; i++; continue; }
      if (ch === "/" && nxt === "*") { inBlockC = true; i++; continue; }

      // Start på string
      if (ch === "'") { inS = true; continue; }
      if (ch === '"') { inD = true; continue; }

      // Bracket matching
      if (ch === "[") depth++;
      if (ch === "]") {
        depth--;
        if (depth === 0) {
          // returnera från start till denna ']'
          return text.slice(start, i + 1);
        }
      }
    }
    return null;
  }

})();
