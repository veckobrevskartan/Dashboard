:root{
  --bg:#e9ecef;
  --panel:#fff;
  --fg:#1f2937;
  --muted:#6b7280;
  --border:#d0d7de;
  --shadow:0 10px 28px rgba(0,0,0,.10);
  --radius:16px;
  --accent:#0d6efd;
}

*{ box-sizing:border-box; }
html,body{ height:100%; margin:0; font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; color:var(--fg); background:var(--bg); }

.topbar{
  position:sticky; top:0; z-index:1000;
  display:grid;
  grid-template-columns: 1fr 2fr auto;
  gap:12px;
  align-items:end;
  padding:12px 14px;
  border-bottom:1px solid var(--border);
  background:var(--panel);
}

.brand .title{ font-weight:800; font-size:18px; }
.brand .subtitle{ color:var(--muted); font-size:12px; margin-top:2px; }

.filters{
  display:grid;
  grid-template-columns: 1.2fr .9fr .7fr .7fr 1.4fr auto;
  gap:10px;
  align-items:end;
}

.field label{ display:block; font-size:12px; color:var(--muted); margin:0 0 4px; }
.field input, .field select{
  width:100%;
  border:1px solid var(--border);
  border-radius:999px;
  padding:8px 10px;
  background:#fff;
}

.field select[multiple]{
  height:42px;
  border-radius:14px;
  padding:6px 10px;
}

.actions{ display:flex; gap:8px; }
.btn{
  border:1px solid var(--border);
  background:#fff;
  border-radius:999px;
  padding:8px 10px;
  cursor:pointer;
}
.btn:hover{ border-color:#b8c0c9; }
.btn.primary{
  background:var(--accent);
  border-color:var(--accent);
  color:#fff;
}
.btn.fs{ padding:6px 10px; font-size:12px; }

.meta{ white-space:nowrap; color:var(--muted); padding-bottom:6px; }
.meta .dot{ margin:0 8px; }

.grid{
  padding:14px;
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap:14px;
}

.card{
  background:var(--panel);
  border:1px solid var(--border);
  border-radius:var(--radius);
  box-shadow:var(--shadow);
  overflow:hidden;
  min-height:360px;
  display:flex;
  flex-direction:column;
}

.card.wide{ grid-column: 1 / -1; }

.cardhead{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:10px 12px;
  border-bottom:1px solid var(--border);
}

.cardhead h2{
  margin:0;
  font-size:14px;
  font-weight:800;
  color:#374151;
}

.chart{
  flex:1;
  min-height:310px;
  padding:6px;
}

/* Tabell */
.chart.table{
  padding:0;
  overflow:auto;
}
.tablewrap{
  width:100%;
  border-collapse:collapse;
  font-size:13px;
}
.tablewrap th, .tablewrap td{
  padding:10px 10px;
  border-bottom:1px solid #eef2f7;
  vertical-align:top;
}
.tablewrap th{ position:sticky; top:0; background:#fff; z-index:1; text-align:left; }
.tablewrap a{ color:var(--accent); text-decoration:none; }
.tablewrap .muted{ color:var(--muted); }

/* Fullscreen */
.module-fullscreen{
  position:fixed !important;
  inset:12px !important;
  z-index:2000 !important;
  margin:0 !important;
  max-width:none !important;
  max-height:none !important;
  width:auto !important;
  height:auto !important;
}
.module-fullscreen .chart{ min-height: calc(100vh - 92px); }

@media (max-width: 1100px){
  .topbar{ grid-template-columns: 1fr; align-items:start; }
  .filters{ grid-template-columns: 1fr 1fr; }
  .grid{ grid-template-columns: 1fr; }
  .card.wide{ grid-column:auto; }
}
