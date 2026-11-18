// Gerador v4 do dashboard "Monitoramento de Câmeras" — TV ATALAIA
// HTML Graphics em 100% dos painéis (regra fixa do projeto — ver STANDARDS.md).
// v4 corrige o design abaixo do nível do Fronius apontado pelo usuário:
//   - cabeçalho global (igual ao padrão TV ATALAIA, só muda o título)
//   - 1 card unificado por NVR (online/offline/download/upload/cpu/mem juntos,
//     em vez de 4 mini-painéis fragmentados)
//   - tabela de câmeras com contraste mais forte (badge sólido, não fundo
//     translúcido na linha inteira)
//   - gráfico de quedas virou uma série temporal agregada (nº de câmeras
//     offline ao longo do tempo), não mais barras horizontais por câmera
// Ver dashboards/monitoramento-de-cameras.md (changelog v4) e STANDARDS.md.

const fs = require('fs');
const path = require('path');

const BACKUP_PATH = process.argv[2];
if (!BACKUP_PATH) {
  console.error('Uso: node generate_dashboard.js <backup.json> [saida.json]');
  process.exit(1);
}
const OUT_PATH = process.argv[3] || path.join(__dirname, 'dashboard_payload.json');

const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
const dashboard = backup.dashboard;

const templates = JSON.parse(fs.readFileSync(path.join(__dirname, 'query_templates.json'), 'utf8'));

const ZABBIX_DS = { type: 'alexanderzobnin-zabbix-datasource', uid: 'fdfjaoiye7im8a' };
const MYSQL_DS = { type: 'mysql', uid: 'de834v5wv8flsd' };
const MIXED_DS = { type: 'datasource', uid: '-- Mixed --' };

const GRID_COLS = 24;
const GRID_ROWS = 29;

const NVRS = [
  { n: 1, host: 'NVR 01', x: 0, w: 5 },
  { n: 2, host: 'NVR 02', x: 5, w: 5 },
  { n: 3, host: 'NVR 03', x: 10, w: 5 },
  { n: 4, host: 'NVR 04', x: 15, w: 5 },
  { n: 5, host: 'NVR 05', x: 20, w: 4 },
];

const Y_HEADER = 0, H_HEADER = 2;
const Y_NVRCARD = Y_HEADER + H_HEADER, H_NVRCARD = 6;
const Y_TABLE = Y_NVRCARD + H_NVRCARD, H_TABLE = 15;
const Y_CHART = Y_TABLE + H_TABLE, H_CHART = 6;
const TOTAL_H = H_HEADER + H_NVRCARD + H_TABLE + H_CHART;

function sqlFor(templateKey, nvr) {
  return templates[templateKey].replace('NVR 01', nvr.host);
}

function mysqlTarget(refId, rawSql) {
  return { refId, datasource: MYSQL_DS, editorMode: 'code', format: 'table', rawQuery: true, rawSql, dataset: 'performance_schema' };
}

function zabbixTarget(refId, itemFilter, hostFilter) {
  return {
    refId, datasource: ZABBIX_DS,
    application: { filter: '' }, countTriggersBy: '', evaltype: '0', functions: [],
    group: { filter: 'NVR' }, host: { filter: hostFilter }, item: { filter: itemFilter },
    itemTag: { filter: '' }, macro: { filter: '' },
    options: { count: false, disableDataAlignment: false, showDisabledItems: false, skipEmptyValues: false, useTrends: 'default', useZabbixValueMapping: false },
    proxy: { filter: '' }, queryType: '0', resultFormat: 'time_series', schema: 12,
    table: { skipEmptyValues: false }, tags: { filter: '' }, textFilter: '', trigger: { filter: '' },
  };
}

let nextId = 100;
const id = () => nextId++;

function htmlPanel(gridPos, datasource, targets, opts) {
  const panel = {
    id: id(), gridPos, type: 'gapit-htmlgraphics-panel', title: '', transparent: true,
    datasource, targets,
    fieldConfig: { defaults: { mappings: [], thresholds: { mode: 'absolute', steps: [{ color: 'green' }] } }, overrides: [] },
    options: {
      add100Percentage: true, centerAlignContent: false, overflow: 'hidden', useGrafanaScrollbar: false, SVGBaseFix: true,
      rootCSS: '', css: opts.css, html: opts.html, renderOnMount: true, onRender: opts.onRender, panelupdateOnMount: true,
      dynamicHtmlGraphics: false, dynamicData: false, dynamicFieldDisplayValues: false, dynamicProps: false, onInitOnResize: false,
      onInit: opts.onInit, codeData: JSON.stringify(opts.customProperties || {}), calcsMutation: 'standard',
      reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false },
    },
    pluginVersion: '2.2.3',
  };
  if (opts.timeFrom) panel.timeFrom = opts.timeFrom;
  return panel;
}

/* ------------------------------------------------------------------ */
/* Helpers + fundo global (ver STANDARDS.md)                           */
/* ------------------------------------------------------------------ */

const HELPERS = `
function hg_values(f){
  if(!f) return [];
  var v = f.values;
  if (v && typeof v.get === 'function') { var out = []; for (var i=0;i<v.length;i++) out.push(v.get(i)); return out; }
  return Array.isArray(v) ? v : Array.from(v || []);
}
function hg_allFieldsOfType(t){
  var out = [];
  (data.series || []).forEach(function(fr){ (fr.fields || []).forEach(function(f){ if (f.type === t) out.push(f); }); });
  return out;
}
function hg_allNumericFields(){ return hg_allFieldsOfType('number'); }
function hg_allTimeFields(){ return hg_allFieldsOfType('time'); }
function hg_allStringFields(){ return hg_allFieldsOfType('string'); }
function hg_lastNonNull(arr){
  for (var i = arr.length - 1; i >= 0; i--) { if (arr[i] !== null && arr[i] !== undefined && !isNaN(arr[i])) return arr[i]; }
  return null;
}
function hg_sig3(n){
  if (n === 0) return { v: 0, d: 0 };
  var abs = Math.abs(n), d;
  if (abs >= 1) { var intDigits = Math.floor(Math.log10(abs)) + 1; d = Math.max(0, 3 - intDigits); }
  else { var mag = Math.floor(Math.log10(abs)); d = Math.max(0, 2 - mag); }
  var f = Math.pow(10, d);
  return { v: Math.round(n * f) / f, d: d };
}
function hg_fmtScaled(n, units, step){
  step = step || 1000;
  var v = Math.abs(n), i = 0;
  while (v >= step && i < units.length - 1) { v /= step; i++; }
  var s = hg_sig3(v);
  return { text: (n < 0 ? '-' : '') + s.v.toFixed(s.d), unit: units[i] };
}
function hg_fmtBits(bps){ return hg_fmtScaled(Math.abs(bps), ['b/s','Kb/s','Mb/s','Gb/s']); }
function hg_paintBar(track, pct){
  if (!track) return;
  var mask = track.querySelector('.mask');
  if (!mask) { mask = document.createElement('div'); mask.className = 'mask'; track.appendChild(mask); }
  mask.style.width = (100 - Math.max(0, Math.min(100, pct))) + '%';
}
function hg_niceTicks(t0, t1, target){
  target = target || 7;
  if (t0 == null || t1 == null || isNaN(t0) || isNaN(t1) || t1 <= t0) return [t0, t1].filter(function (v) { return v != null && !isNaN(v); });
  var totalMin = (t1 - t0) / 60000;
  var niceSteps = [1, 2, 5, 10, 15, 20, 30, 60, 120, 180, 240, 360, 720, 1440, 2880];
  var rawStep = totalMin / target;
  var step = niceSteps[niceSteps.length - 1];
  for (var si = 0; si < niceSteps.length; si++) { if (niceSteps[si] >= rawStep) { step = niceSteps[si]; break; } }
  var stepMs = step * 60000, ticks = [];
  var maxTicks = 50;
  for (var tt = t0; tt <= t1 + stepMs * 0.3 && ticks.length < maxTicks; tt += stepMs) { ticks.push(tt); }
  if (ticks.length < 2) ticks = [t0, t1];
  return ticks;
}
function hg_fmtHM(ms){
  var d = new Date(ms);
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}
`;

const GLOBAL_BG_JS = `
(function(){
  try {
    var grad = 'linear-gradient(120deg,#02050a 0%,#050b16 25%,#0a1526 50%,#050b16 75%,#02050a 100%)';
    function applyBase(el){
      if (!el) return;
      el.style.setProperty('background-image', grad, 'important');
      el.style.setProperty('background-color', '#02050a', 'important');
      el.style.setProperty('background-size', '280% 280%', 'important');
      el.style.setProperty('background-repeat', 'no-repeat', 'important');
    }
    applyBase(document.documentElement);
    applyBase(document.body);
    if (!window.__hgBgAnim) {
      window.__hgBgAnim = true;
      var start = Date.now();
      setInterval(function(){
        var t = (Date.now() - start) / 1000;
        var pct = (50 + 50 * Math.sin(t / 14)).toFixed(1) + '% 50%';
        if (document.documentElement) document.documentElement.style.setProperty('background-position', pct, 'important');
        if (document.body) document.body.style.setProperty('background-position', pct, 'important');
      }, 200);
    }
    var el = htmlNode.host, depth = 0;
    while (el && el.parentElement && depth < 14 && el !== document.body) {
      el = el.parentElement;
      if (el === document.body) break;
      el.style.setProperty('background', 'transparent', 'important');
      el.style.setProperty('background-color', 'transparent', 'important');
      el.style.setProperty('background-image', 'none', 'important');
      el.style.setProperty('box-shadow', 'none', 'important');
      depth++;
    }
  } catch (e) {}
})();
`;

/* ------------------------------------------------------------------ */
/* Cabeçalho global (padrão TV ATALAIA, idêntico ao Fronius)           */
/* ------------------------------------------------------------------ */

const HEADER_CSS = `
*{box-sizing:border-box;}
.bar{
  position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;
  padding:0 26px;overflow:hidden;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#eaf2ff;
  background:linear-gradient(90deg,#060c18 0%,#0a1529 100%);
  border:1px solid rgba(96,165,250,0.18);border-radius:10px;
}
.left{display:flex;align-items:center;gap:18px;z-index:1;min-width:0;}
.logo{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 0 12px rgba(59,130,246,.5);}
.brand{font-size:21px;font-weight:800;letter-spacing:.5px;color:#fff;white-space:nowrap;}
.hdivider{width:1px;height:32px;background:rgba(96,165,250,0.25);flex:none;}
.titleblock{line-height:1.3;white-space:nowrap;}
.t1{font-size:21px;font-weight:800;letter-spacing:.6px;color:#fff;}
.t2{font-size:14.5px;font-weight:600;letter-spacing:1.1px;color:#8fb0da;}
.right{display:flex;align-items:center;gap:18px;z-index:1;flex:none;}
.item{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600;letter-spacing:.4px;color:#bcd4ff;white-space:nowrap;}
.livedot{width:9px;height:9px;border-radius:50%;background:#34d399;box-shadow:0 0 8px #34d399;animation:pulse 1.8s infinite;flex:none;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.35;}}
.ic{flex:none;}
`;

const HEADER_HTML = `
<div class="bar">
  <div class="left">
    <div class="logo"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 5v14l11-7z" fill="#fff"/></svg></div>
    <span class="brand">TV ATALAIA</span>
    <div class="hdivider"></div>
    <div class="titleblock"><div class="t1">MONITORAMENTO DE CAMERAS</div><div class="t2">NVRs E CAMERAS</div></div>
  </div>
  <div class="right">
    <div class="item"><span class="livedot"></span>DADOS EM TEMPO REAL</div>
    <div class="hdivider"></div>
    <div class="item"><svg class="ic" viewBox="0 0 24 24" width="16" height="16"><path d="M12 7v5l4 2" stroke="#9fc3ff" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="#9fc3ff" stroke-width="2" fill="none"/></svg><span id="rangeText">--</span></div>
    <div class="hdivider"></div>
    <div class="item"><svg class="ic" viewBox="0 0 24 24" width="16" height="16"><path d="M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5" stroke="#9fc3ff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>ATUALIZACAO 1m</div>
  </div>
</div>
`;

const RANGE_CALC = `
try {
  var rangeEl = htmlNode.getElementById('rangeText');
  var tr = (typeof data !== 'undefined' && data && data.timeRange) ? data.timeRange : (typeof props !== 'undefined' && props ? props.timeRange : null);
  if (rangeEl && tr && tr.from && tr.to) {
    var from = tr.from, to = tr.to;
    var fromMs = from.valueOf ? from.valueOf() : +from;
    var toMs = to.valueOf ? to.valueOf() : +to;
    var hours = (toMs - fromMs) / 3600000;
    var text;
    if (hours < 1) { text = 'ULTIMOS ' + Math.max(1, Math.round(hours * 60)) + ' MIN'; }
    else if (Math.abs(hours - Math.round(hours)) < 0.05) { text = 'ULTIMAS ' + Math.round(hours) + (Math.round(hours) === 1 ? ' HORA' : ' HORAS'); }
    else { text = 'ULTIMAS ' + hours.toFixed(1) + 'H'; }
    rangeEl.textContent = text;
  }
} catch (e) {}
`;

const HEADER_ONINIT = GLOBAL_BG_JS + RANGE_CALC;
const HEADER_ONRENDER = RANGE_CALC;

/* ------------------------------------------------------------------ */
/* Card unificado por NVR (online/offline/download/upload/cpu/mem)     */
/* ------------------------------------------------------------------ */

function nvrCardComponent(nvr) {
  const css = `
*{box-sizing:border-box;}
.nvr{
  width:100%;height:100%;display:flex;flex-direction:column;gap:10px;
  font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#e8f1ff;
  background:linear-gradient(160deg,#0b1830 0%,#0a1428 55%,#081022 100%);
  border:1px solid rgba(96,165,250,0.2);border-radius:12px;padding:12px 16px 14px 16px;overflow:hidden;
}
.nvr-head{display:flex;align-items:center;gap:10px;flex:none;}
.nvr-dot{width:9px;height:9px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399;flex:none;animation:pulse 1.8s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.35;}}
.nvr-title{font-size:22px;font-weight:800;letter-spacing:.6px;color:#fff;}
.nvr-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;flex:none;}
.nvr-stat{padding:0 6px;border-left:1px solid rgba(96,165,250,0.15);display:flex;flex-direction:column;gap:2px;min-width:0;}
.nvr-stat:first-child{border-left:none;padding-left:0;}
.nvr-lbl{font-size:10px;font-weight:800;letter-spacing:.4px;color:#89a0c4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.nvr-val{font-size:17px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.nvr-val.online{color:#34d399;}
.nvr-val.offline{color:#f87171;}
.nvr-val.down{color:#60a5fa;}
.nvr-val.up{color:#fbbf24;}
.nvr-bars{display:flex;gap:14px;flex:1;align-items:center;}
.nvr-barcell{flex:1;display:flex;flex-direction:column;gap:5px;}
.nvr-bar-row{display:flex;justify-content:space-between;align-items:baseline;}
.nvr-bar-lbl{font-size:11px;font-weight:800;color:#89a0c4;letter-spacing:.4px;}
.nvr-bar-pct{font-size:15px;font-weight:800;color:#bcd4ff;}
.track{position:relative;height:11px;border-radius:6px;overflow:hidden;
  background:linear-gradient(90deg,#34d399 0%,#fbbf24 50%,#f87171 100%);}
.track .mask{position:absolute;top:0;right:0;bottom:0;background:rgba(5,10,20,0.85);transition:width .4s ease;}
`;
  const html = `
<div class="nvr">
  <div class="nvr-head"><span class="nvr-dot"></span><span class="nvr-title">${nvr.host}</span></div>
  <div class="nvr-stats">
    <div class="nvr-stat"><div class="nvr-lbl">ONLINE</div><div class="nvr-val online" id="v-online">--</div></div>
    <div class="nvr-stat"><div class="nvr-lbl">OFFLINE</div><div class="nvr-val offline" id="v-offline">--</div></div>
    <div class="nvr-stat"><div class="nvr-lbl">DOWNLOAD</div><div class="nvr-val down" id="v-down">--</div></div>
    <div class="nvr-stat"><div class="nvr-lbl">UPLOAD</div><div class="nvr-val up" id="v-up">--</div></div>
  </div>
  <div class="nvr-bars">
    <div class="nvr-barcell"><div class="nvr-bar-row"><span class="nvr-bar-lbl">CPU</span><span class="nvr-bar-pct" id="v-cpu">--%</span></div><div class="track" id="track-cpu"></div></div>
    <div class="nvr-barcell"><div class="nvr-bar-row"><span class="nvr-bar-lbl">MEM</span><span class="nvr-bar-pct" id="v-mem">--%</span></div><div class="track" id="track-mem"></div></div>
  </div>
</div>`;
  const onRender = HELPERS + `
try {
  var nums = hg_allNumericFields();
  var online = hg_lastNonNull(hg_values(nums[0]));
  var offline = hg_lastNonNull(hg_values(nums[1]));
  var down = hg_lastNonNull(hg_values(nums[2]));
  var up = hg_lastNonNull(hg_values(nums[3]));
  var cpu = hg_lastNonNull(hg_values(nums[4]));
  var mem = hg_lastNonNull(hg_values(nums[5]));

  var elOn = htmlNode.getElementById('v-online'); if (elOn) elOn.textContent = online != null ? Math.round(online) : '--';
  var elOff = htmlNode.getElementById('v-offline'); if (elOff) elOff.textContent = offline != null ? Math.round(offline) : '--';
  var elDown = htmlNode.getElementById('v-down'); if (elDown) { if (down == null) elDown.textContent = '--'; else { var fd = hg_fmtBits(down); elDown.textContent = fd.text + ' ' + fd.unit; } }
  var elUp = htmlNode.getElementById('v-up'); if (elUp) { if (up == null) elUp.textContent = '--'; else { var fu = hg_fmtBits(up); elUp.textContent = fu.text + ' ' + fu.unit; } }
  var elCpu = htmlNode.getElementById('v-cpu'); if (elCpu) elCpu.textContent = (cpu != null ? Math.round(cpu) : '--') + '%';
  var elMem = htmlNode.getElementById('v-mem'); if (elMem) elMem.textContent = (mem != null ? Math.round(mem) : '--') + '%';
  if (cpu != null) hg_paintBar(htmlNode.getElementById('track-cpu'), cpu);
  if (mem != null) hg_paintBar(htmlNode.getElementById('track-mem'), mem);
} catch (e) {}
`;
  return { css, html, onInit: GLOBAL_BG_JS, onRender, customProperties: {} };
}

/* ------------------------------------------------------------------ */
/* Tabela de câmeras (contraste forte: badge sólido, não fundo tintado) */
/* ------------------------------------------------------------------ */

function cameraTableComponent() {
  const css = `
*{box-sizing:border-box;}
.camtable{width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;
  font-family:'Segoe UI',Roboto,Arial,sans-serif;
  background:linear-gradient(160deg,#0b1830 0%,#0a1428 55%,#081022 100%);
  border:1px solid rgba(96,165,250,0.18);border-radius:10px;padding:6px 8px;}
.cam-row{flex:1;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:0;
  border-bottom:1px solid rgba(96,165,250,0.08);}
.cam-row:last-child{border-bottom:none;}
.cam-row:nth-child(even){background:rgba(255,255,255,0.02);}
.cam-name{font-size:12px;font-weight:700;color:#e8f1ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-left:4px;}
.cam-badge{font-size:9.5px;font-weight:800;letter-spacing:.4px;flex:none;padding:2px 8px;border-radius:999px;color:#061018;}
.cam-badge.online{background:#34d399;}
.cam-badge.offline{background:#f87171;}
.cam-badge.empty{background:#8595ab;}
`;
  const html = `<div class="camtable" id="camtable"></div>`;
  const onRender = HELPERS + `
try {
  var strs = hg_allStringFields();
  var names = hg_values(strs[0]);
  var statuses = hg_values(strs[1]);
  var wrap = htmlNode.getElementById('camtable');
  if (wrap) {
    wrap.innerHTML = '';
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      if (name == null) continue;
      var st = statuses[i];
      var cls = 'empty', label = 'EMPTY';
      if (st === 'Connected') { cls = 'online'; label = 'ONLINE'; }
      else if (st === 'Unconnect') { cls = 'offline'; label = 'OFFLINE'; }
      var row = document.createElement('div'); row.className = 'cam-row';
      var nameEl = document.createElement('span'); nameEl.className = 'cam-name'; nameEl.textContent = name;
      var badgeEl = document.createElement('span'); badgeEl.className = 'cam-badge ' + cls; badgeEl.textContent = label;
      row.appendChild(nameEl); row.appendChild(badgeEl);
      wrap.appendChild(row);
    }
  }
} catch (e) {}
`;
  return { css, html, onInit: GLOBAL_BG_JS, onRender, customProperties: {} };
}

/* ------------------------------------------------------------------ */
/* Gráfico de quedas: série temporal agregada (nº offline), não barras */
/* ------------------------------------------------------------------ */

function dropsChartComponent() {
  const css = `
*{box-sizing:border-box;}
.dc{width:100%;height:100%;display:flex;flex-direction:column;
  font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#e8f1ff;
  background:linear-gradient(160deg,#0b1830 0%,#0a1428 55%,#081022 100%);
  border:1px solid rgba(96,165,250,0.18);border-radius:10px;padding:8px 14px 8px 14px;overflow:hidden;}
.dc-head{display:flex;align-items:baseline;gap:8px;margin-bottom:5px;flex:none;}
.dc-dot{width:8px;height:8px;border-radius:50%;background:#f87171;box-shadow:0 0 6px #f87171;flex:none;align-self:center;}
.dc-title{font-size:12.5px;font-weight:800;letter-spacing:.5px;color:#dce9ff;text-transform:uppercase;}
.dc-sparkwrap{position:relative;flex:1;min-height:0;}
.dc-spark{width:100%;height:100%;display:block;}
.dc-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#34d399;font-size:12px;font-weight:700;}
.dc-vline{position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.4);display:none;pointer-events:none;}
.dc-tip{position:absolute;top:2px;transform:translateX(-50%);background:rgba(4,9,18,0.96);border:1px solid rgba(96,165,250,0.35);border-radius:6px;padding:4px 9px;font-size:10.5px;font-weight:700;color:#fff;white-space:nowrap;display:none;pointer-events:none;z-index:2;max-width:220px;overflow:hidden;text-overflow:ellipsis;}
.dc-axis{display:flex;justify-content:space-between;font-size:10px;color:#6f84a8;margin-top:4px;flex:none;font-weight:600;}
`;
  const html = `
<div class="dc">
  <div class="dc-head"><span class="dc-dot"></span><span class="dc-title">Cameras Offline &mdash; Ultimas 3H</span></div>
  <div class="dc-sparkwrap" id="dc-sparkwrap">
    <svg class="dc-spark" id="dc-spark" viewBox="0 0 1200 160" preserveAspectRatio="none">
      <defs>
        <linearGradient id="dcFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f87171" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#f87171" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path id="dc-area" fill="url(#dcFill)" stroke="none"></path>
      <path id="dc-line" fill="none" stroke="#f87171" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>
    </svg>
    <div class="dc-vline" id="dc-vline"></div>
    <div class="dc-tip" id="dc-tip"></div>
  </div>
  <div class="dc-axis" id="dc-axis"></div>
</div>`;
  const onInit = GLOBAL_BG_JS + `
var sparkwrap = htmlNode.getElementById('dc-sparkwrap');
var vline = htmlNode.getElementById('dc-vline');
var tip = htmlNode.getElementById('dc-tip');
var svgEl = htmlNode.getElementById('dc-spark');
if (sparkwrap && !sparkwrap.__hgBound) {
  sparkwrap.__hgBound = true;
  sparkwrap.addEventListener('mousemove', function (evt) {
    var pts = svgEl && svgEl.__hgPoints;
    if (!pts || pts.length < 1) return;
    var rect = sparkwrap.getBoundingClientRect();
    if (!rect.width) return;
    var relX = Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width));
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    var hoverT = t0 + relX * (t1 - t0);
    var idx = 0, best = Infinity;
    for (var i = 0; i < pts.length; i++) { var d = Math.abs(pts[i].t - hoverT); if (d < best) { best = d; idx = i; } }
    var p = pts[idx];
    var xPct = t1 > t0 ? ((p.t - t0) / (t1 - t0)) * 100 : 0;
    if (vline) { vline.style.left = xPct + '%'; vline.style.display = 'block'; }
    if (tip) {
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var d2 = new Date(p.t);
      var timeStr = pad(d2.getHours()) + ':' + pad(d2.getMinutes());
      var txt = timeStr + ' — ' + p.v + ' offline';
      if (p.cams && p.cams.length) txt += ': ' + p.cams.slice(0, 3).join(', ') + (p.cams.length > 3 ? ' +' + (p.cams.length - 3) : '');
      tip.textContent = txt;
      tip.style.left = Math.max(10, Math.min(90, xPct)) + '%';
      tip.style.display = 'block';
    }
  });
  sparkwrap.addEventListener('mouseleave', function () {
    if (vline) vline.style.display = 'none';
    if (tip) tip.style.display = 'none';
  });
}
`;
  const onRender = HELPERS + `
try {
  var timeFields = hg_allTimeFields();
  var strs = hg_allStringFields();
  var nums = hg_allNumericFields();
  var tVals = hg_values(timeFields[0]);
  var camVals = hg_values(strs[0]);
  var statusVals = hg_values(nums[0]);

  var raw = [];
  for (var i = 0; i < tVals.length; i++) {
    if (camVals[i] == null || tVals[i] == null || isNaN(tVals[i])) continue;
    raw.push({ t: tVals[i], cam: camVals[i], v: statusVals[i] });
  }
  raw.sort(function (a, b) { return a.t - b.t; });

  var state = {};
  var points = [];
  raw.forEach(function (p) {
    state[p.cam] = p.v;
    var offlineCams = [];
    Object.keys(state).forEach(function (c) { if (state[c] === 0) offlineCams.push(c); });
    points.push({ t: p.t, v: offlineCams.length, cams: offlineCams });
  });

  var svgNode = htmlNode.getElementById('dc-spark');
  var sparkwrap = htmlNode.getElementById('dc-sparkwrap');
  var pathLine = htmlNode.getElementById('dc-line');
  var pathArea = htmlNode.getElementById('dc-area');
  var oldEmpty = sparkwrap.querySelector('.dc-empty');
  if (oldEmpty) oldEmpty.remove();

  if (svgNode) svgNode.__hgPoints = points;

  if (points.length === 0) {
    pathLine.setAttribute('d', '');
    pathArea.setAttribute('d', '');
    var empty = document.createElement('div');
    empty.className = 'dc-empty';
    empty.textContent = 'Nenhuma queda registrada nas ultimas 3h';
    sparkwrap.appendChild(empty);
  } else {
    var W = 1200, H = 160, pad2 = 10;
    var t0 = points[0].t, t1 = points[points.length - 1].t;
    var vs = points.map(function (p) { return p.v; });
    var maxV = Math.max.apply(null, vs.concat([1]));
    var totalT = t1 - t0 || 1;
    function xOf(t) { return ((t - t0) / totalT) * W; }
    function yOf(v) { return H - pad2 - (v / maxV) * (H - pad2 * 2); }
    var d = 'M ' + xOf(points[0].t).toFixed(1) + ',' + yOf(points[0].v).toFixed(1);
    for (var pi = 1; pi < points.length; pi++) {
      d += ' L ' + xOf(points[pi].t).toFixed(1) + ',' + yOf(points[pi - 1].v).toFixed(1);
      d += ' L ' + xOf(points[pi].t).toFixed(1) + ',' + yOf(points[pi].v).toFixed(1);
    }
    d += ' L ' + xOf(t1).toFixed(1) + ',' + yOf(points[points.length - 1].v).toFixed(1);
    pathLine.setAttribute('d', d);
    pathArea.setAttribute('d', d + ' L ' + W + ',' + H + ' L 0,' + H + ' Z');
  }

  var axisEl = htmlNode.getElementById('dc-axis');
  if (axisEl) {
    axisEl.innerHTML = '';
    if (points.length > 0) {
      var ticks = hg_niceTicks(points[0].t, points[points.length - 1].t, 5);
      ticks.forEach(function (tms) {
        var span = document.createElement('span');
        span.textContent = hg_fmtHM(tms);
        axisEl.appendChild(span);
      });
    }
  }
} catch (e) {}
`;
  return { css, html, onInit, onRender, customProperties: {}, timeFrom: '3h' };
}

/* ------------------------------------------------------------------ */
/* Montagem                                                             */
/* ------------------------------------------------------------------ */

const panels = [];

panels.push(htmlPanel(
  { x: 0, y: Y_HEADER, w: GRID_COLS, h: H_HEADER },
  ZABBIX_DS, [],
  { html: HEADER_HTML, css: HEADER_CSS, onInit: HEADER_ONINIT, onRender: HEADER_ONRENDER, customProperties: {} }
));

for (const nvr of NVRS) {
  // card unificado (datasource mista: MySQL + Zabbix)
  panels.push(htmlPanel(
    { x: nvr.x, y: Y_NVRCARD, w: nvr.w, h: H_NVRCARD },
    MIXED_DS,
    [
      mysqlTarget('A', sqlFor('onlineSql', nvr)),
      mysqlTarget('B', sqlFor('offlineSql', nvr)),
      zabbixTarget('C', 'Interface eth0: Bits received', nvr.host),
      zabbixTarget('D', 'Interface eth0: Bits sent', nvr.host),
      zabbixTarget('E', 'CPU Usage', nvr.host),
      zabbixTarget('F', 'Memory Utilization', nvr.host),
    ],
    nvrCardComponent(nvr)
  ));

  // tabela de câmeras (MySQL)
  panels.push(htmlPanel(
    { x: nvr.x, y: Y_TABLE, w: nvr.w, h: H_TABLE },
    MYSQL_DS,
    [mysqlTarget('A', sqlFor('tableSql', nvr))],
    cameraTableComponent()
  ));

  // gráfico de quedas: série temporal agregada (MySQL, 3h)
  panels.push(htmlPanel(
    { x: nvr.x, y: Y_CHART, w: nvr.w, h: H_CHART },
    MYSQL_DS,
    [mysqlTarget('A', sqlFor('timelineSql', nvr))],
    dropsChartComponent()
  ));
}

// --- checagem obrigatória do teto de grid (ver STANDARDS.md) ---
let maxY = 0;
for (const p of panels) maxY = Math.max(maxY, p.gridPos.y + p.gridPos.h);
console.log(`Bounding box: ${GRID_COLS} colunas x ${maxY} linhas (teto documentado: ${GRID_COLS}x${GRID_ROWS})`);
if (maxY > GRID_ROWS) {
  console.error(`ERRO: altura total (${maxY}) excede o teto de ${GRID_ROWS} linhas.`);
  process.exit(1);
}
console.log(`Linhas por seção -> header:${H_HEADER} card-nvr:${H_NVRCARD} tabela:${H_TABLE} grafico:${H_CHART} (soma=${TOTAL_H})`);
console.log('Painéis gerados:', panels.length);

const newDashboard = Object.assign({}, dashboard, { panels });

const payload = {
  dashboard: newDashboard,
  folderId: backup.meta.folderId,
  folderUid: backup.meta.folderUid,
  overwrite: true,
  message: 'v4: cabeçalho global, card unificado por NVR, tabela com contraste maior, gráfico de quedas como série temporal agregada.',
};

fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
console.log('Payload salvo em', OUT_PATH);
