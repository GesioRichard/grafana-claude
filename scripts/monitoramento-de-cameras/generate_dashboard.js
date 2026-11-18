// Gerador v3 do dashboard "Monitoramento de Câmeras" — TV ATALAIA
// Reconstrução 100% em HTML Graphics (gapit-htmlgraphics-panel), substituindo
// a v2 (painéis nativos). Ver dashboards/monitoramento-de-cameras.md e
// STANDARDS.md ("HTML Graphics é obrigatório em todo dashboard novo").
//
// Reaproveita as MESMAS queries SQL/Zabbix da v2 (extraídas do dashboard ao
// vivo em query_templates.json) e a MESMA disposição de grid (24x29) — só a
// renderização de cada painel muda de nativo pra HTML/CSS/JS customizado.

const fs = require('fs');
const path = require('path');

const BACKUP_PATH = process.argv[2];
if (!BACKUP_PATH) {
  console.error('Uso: node generate_dashboard_v3.js <backup.json> [saida.json]');
  process.exit(1);
}
const OUT_PATH = process.argv[3] || path.join(__dirname, 'dashboard_v3_payload.json');

const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
const dashboard = backup.dashboard;

const templates = JSON.parse(fs.readFileSync(path.join(__dirname, 'query_templates.json'), 'utf8'));

const ZABBIX_DS = { type: 'alexanderzobnin-zabbix-datasource', uid: 'fdfjaoiye7im8a' };
const MYSQL_DS = { type: 'mysql', uid: 'de834v5wv8flsd' };

const GRID_COLS = 24;
const GRID_ROWS = 29;

const NVRS = [
  { n: 1, host: 'NVR 01', x: 0, w: 5, onlineW: 2 },
  { n: 2, host: 'NVR 02', x: 5, w: 5, onlineW: 2 },
  { n: 3, host: 'NVR 03', x: 10, w: 5, onlineW: 2 },
  { n: 4, host: 'NVR 04', x: 15, w: 5, onlineW: 2 },
  { n: 5, host: 'NVR 05', x: 20, w: 4, onlineW: 2 },
];

const Y_HEADER = 0, H_HEADER = 2;
const Y_CARDS = Y_HEADER + H_HEADER, H_CARDS = 2;
const Y_BARGAUGE = Y_CARDS + H_CARDS, H_BARGAUGE = 2;
const Y_TABLE = Y_BARGAUGE + H_BARGAUGE, H_TABLE = 17;
const Y_GRAPH = Y_TABLE + H_TABLE, H_GRAPH = 6;
const TOTAL_H = H_HEADER + H_CARDS + H_BARGAUGE + H_TABLE + H_GRAPH;

function sqlFor(templateKey, nvr) {
  return templates[templateKey].replace('NVR 01', nvr.host);
}

function mysqlTarget(refId, rawSql) {
  return {
    refId,
    datasource: MYSQL_DS,
    editorMode: 'code',
    format: 'table',
    rawQuery: true,
    rawSql,
    dataset: 'performance_schema',
  };
}

function zabbixTarget(refId, itemFilter, hostFilter) {
  return {
    refId,
    datasource: ZABBIX_DS,
    application: { filter: '' },
    countTriggersBy: '',
    evaltype: '0',
    functions: [],
    group: { filter: 'NVR' },
    host: { filter: hostFilter },
    item: { filter: itemFilter },
    itemTag: { filter: '' },
    macro: { filter: '' },
    options: { count: false, disableDataAlignment: false, showDisabledItems: false, skipEmptyValues: false, useTrends: 'default', useZabbixValueMapping: false },
    proxy: { filter: '' },
    queryType: '0',
    resultFormat: 'time_series',
    schema: 12,
    table: { skipEmptyValues: false },
    tags: { filter: '' },
    textFilter: '',
    trigger: { filter: '' },
  };
}

let nextId = 100;
const id = () => nextId++;

function htmlPanel(gridPos, datasource, targets, opts) {
  const panel = {
    id: id(),
    gridPos,
    type: 'gapit-htmlgraphics-panel',
    title: '',
    transparent: true,
    datasource,
    targets,
    fieldConfig: { defaults: { mappings: [], thresholds: { mode: 'absolute', steps: [{ color: 'green' }] } }, overrides: [] },
    options: {
      add100Percentage: true,
      centerAlignContent: false,
      overflow: 'hidden',
      useGrafanaScrollbar: false,
      SVGBaseFix: true,
      rootCSS: '',
      css: opts.css,
      html: opts.html,
      renderOnMount: true,
      onRender: opts.onRender,
      panelupdateOnMount: true,
      dynamicHtmlGraphics: false,
      dynamicData: false,
      dynamicFieldDisplayValues: false,
      dynamicProps: false,
      onInitOnResize: false,
      onInit: opts.onInit,
      codeData: JSON.stringify(opts.customProperties || {}),
      calcsMutation: 'standard',
      reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false },
    },
    pluginVersion: '2.2.3',
  };
  if (opts.timeFrom) panel.timeFrom = opts.timeFrom;
  return panel;
}

/* ------------------------------------------------------------------ */
/* Shared helpers + background trick (ver STANDARDS.md)                */
/* ------------------------------------------------------------------ */

const HELPERS = `
function hg_values(f){
  if(!f) return [];
  var v = f.values;
  if (v && typeof v.get === 'function') {
    var out = [];
    for (var i=0;i<v.length;i++) out.push(v.get(i));
    return out;
  }
  return Array.isArray(v) ? v : Array.from(v || []);
}
function hg_allFieldsOfType(t){
  var out = [];
  (data.series || []).forEach(function(fr){
    (fr.fields || []).forEach(function(f){ if (f.type === t) out.push(f); });
  });
  return out;
}
function hg_allNumericFields(){ return hg_allFieldsOfType('number'); }
function hg_allTimeFields(){ return hg_allFieldsOfType('time'); }
function hg_allStringFields(){ return hg_allFieldsOfType('string'); }
function hg_lastNonNull(arr){
  for (var i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined && !isNaN(arr[i])) return arr[i];
  }
  return null;
}
function hg_sig3(n){
  if (n === 0) return { v: 0, d: 0 };
  var abs = Math.abs(n);
  var d;
  if (abs >= 1) { var intDigits = Math.floor(Math.log10(abs)) + 1; d = Math.max(0, 3 - intDigits); }
  else { var mag = Math.floor(Math.log10(abs)); d = Math.max(0, 2 - mag); }
  var f = Math.pow(10, d);
  return { v: Math.round(n * f) / f, d: d };
}
function hg_fmtScaled(n, units, step){
  step = step || 1000;
  var v = Math.abs(n);
  var i = 0;
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
  var totalMin = (t1 - t0) / 60000;
  var niceSteps = [1, 2, 5, 10, 15, 20, 30, 60, 120, 180, 240, 360, 720, 1440, 2880];
  var rawStep = totalMin / target;
  var step = niceSteps[niceSteps.length - 1];
  for (var si = 0; si < niceSteps.length; si++) { if (niceSteps[si] >= rawStep) { step = niceSteps[si]; break; } }
  var stepMs = step * 60000;
  var ticks = [];
  for (var tt = t0; tt <= t1 + stepMs * 0.3; tt += stepMs) { ticks.push(tt); }
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
/* Component: header (NVR 0X title bar)                                 */
/* ------------------------------------------------------------------ */

function headerComponent(nvr) {
  const css = `
*{box-sizing:border-box;}
.nvrhead{width:100%;height:100%;display:flex;align-items:center;justify-content:center;
  font-family:'Segoe UI',Roboto,Arial,sans-serif;
  background:linear-gradient(160deg,#0b1830 0%,#0a1428 55%,#081022 100%);
  border:1px solid rgba(96,165,250,0.25);border-radius:10px;}
.nvrhead-title{font-size:26px;font-weight:800;letter-spacing:1px;color:#fff;}
`;
  const html = `<div class="nvrhead"><span class="nvrhead-title">${nvr.host}</span></div>`;
  return { css, html, onInit: GLOBAL_BG_JS, onRender: '', customProperties: {} };
}

/* ------------------------------------------------------------------ */
/* Component: online/offline cameras count                             */
/* ------------------------------------------------------------------ */

function onlineOfflineComponent() {
  const css = `
*{box-sizing:border-box;}
.oo{width:100%;height:100%;display:flex;gap:6px;font-family:'Segoe UI',Roboto,Arial,sans-serif;}
.oo-cell{flex:1;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;}
.oo-cell.online{background:linear-gradient(160deg,#123d2c 0%,#0a2219 100%);border:1px solid rgba(52,211,153,0.4);}
.oo-cell.offline{background:linear-gradient(160deg,#3d1414 0%,#220a0a 100%);border:1px solid rgba(248,113,113,0.4);}
.oo-lbl{font-size:10px;font-weight:800;letter-spacing:.5px;color:#aebfd0;}
.oo-val{font-size:22px;font-weight:800;}
.oo-cell.online .oo-val{color:#34d399;}
.oo-cell.offline .oo-val{color:#f87171;}
`;
  const html = `
<div class="oo">
  <div class="oo-cell online"><div class="oo-lbl">ONLINE</div><div class="oo-val" id="v-online">--</div></div>
  <div class="oo-cell offline"><div class="oo-lbl">OFFLINE</div><div class="oo-val" id="v-offline">--</div></div>
</div>`;
  const onRender = HELPERS + `
try {
  var nums = hg_allNumericFields();
  var onlineVal = hg_lastNonNull(hg_values(nums[0]));
  var offlineVal = hg_lastNonNull(hg_values(nums[1]));
  var elOn = htmlNode.getElementById('v-online');
  var elOff = htmlNode.getElementById('v-offline');
  if (elOn) elOn.textContent = onlineVal != null ? Math.round(onlineVal) : '--';
  if (elOff) elOff.textContent = offlineVal != null ? Math.round(offlineVal) : '--';
} catch (e) {}
`;
  return { css, html, onInit: GLOBAL_BG_JS, onRender, customProperties: {} };
}

/* ------------------------------------------------------------------ */
/* Component: download/upload                                          */
/* ------------------------------------------------------------------ */

function downloadUploadComponent() {
  const css = `
*{box-sizing:border-box;}
.du{width:100%;height:100%;display:flex;gap:6px;font-family:'Segoe UI',Roboto,Arial,sans-serif;
  background:linear-gradient(160deg,#0b1830 0%,#0a1428 55%,#081022 100%);
  border:1px solid rgba(96,165,250,0.2);border-radius:8px;padding:4px;}
.du-cell{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;}
.du-lbl{font-size:9px;font-weight:800;letter-spacing:.4px;color:#89a0c4;}
.du-val{font-size:15px;font-weight:800;white-space:nowrap;}
.du-val.down{color:#60a5fa;}
.du-val.up{color:#fbbf24;}
`;
  const html = `
<div class="du">
  <div class="du-cell"><div class="du-lbl">DOWNLOAD</div><div class="du-val down" id="v-down">--</div></div>
  <div class="du-cell"><div class="du-lbl">UPLOAD</div><div class="du-val up" id="v-up">--</div></div>
</div>`;
  const onRender = HELPERS + `
try {
  var nums = hg_allNumericFields();
  var down = hg_lastNonNull(hg_values(nums[0]));
  var up = hg_lastNonNull(hg_values(nums[1]));
  var elDown = htmlNode.getElementById('v-down');
  var elUp = htmlNode.getElementById('v-up');
  if (elDown) { if (down == null) { elDown.textContent = '--'; } else { var f = hg_fmtBits(down); elDown.textContent = f.text + ' ' + f.unit; } }
  if (elUp) { if (up == null) { elUp.textContent = '--'; } else { var f2 = hg_fmtBits(up); elUp.textContent = f2.text + ' ' + f2.unit; } }
} catch (e) {}
`;
  return { css, html, onInit: GLOBAL_BG_JS, onRender, customProperties: {} };
}

/* ------------------------------------------------------------------ */
/* Component: CPU / Memory (barra em gradiente invertido: alto = ruim) */
/* ------------------------------------------------------------------ */

function cpuMemComponent() {
  const css = `
*{box-sizing:border-box;}
.cm{width:100%;height:100%;display:flex;gap:10px;align-items:center;font-family:'Segoe UI',Roboto,Arial,sans-serif;
  background:linear-gradient(160deg,#0b1830 0%,#0a1428 55%,#081022 100%);
  border:1px solid rgba(96,165,250,0.2);border-radius:8px;padding:6px 10px;}
.cm-cell{flex:1;display:flex;flex-direction:column;gap:4px;min-width:0;}
.cm-row{display:flex;justify-content:space-between;align-items:baseline;}
.cm-lbl{font-size:10px;font-weight:800;color:#89a0c4;letter-spacing:.4px;}
.cm-pct{font-size:13px;font-weight:800;color:#bcd4ff;}
.track{position:relative;height:9px;border-radius:5px;overflow:hidden;
  background:linear-gradient(90deg,#34d399 0%,#fbbf24 50%,#f87171 100%);}
.track .mask{position:absolute;top:0;right:0;bottom:0;background:rgba(5,10,20,0.85);transition:width .4s ease;}
`;
  const html = `
<div class="cm">
  <div class="cm-cell"><div class="cm-row"><span class="cm-lbl">CPU</span><span class="cm-pct" id="v-cpu">--%</span></div><div class="track" id="track-cpu"></div></div>
  <div class="cm-cell"><div class="cm-row"><span class="cm-lbl">MEM</span><span class="cm-pct" id="v-mem">--%</span></div><div class="track" id="track-mem"></div></div>
</div>`;
  const onRender = HELPERS + `
try {
  var nums = hg_allNumericFields();
  var cpu = hg_lastNonNull(hg_values(nums[0]));
  var mem = hg_lastNonNull(hg_values(nums[1]));
  var elCpu = htmlNode.getElementById('v-cpu');
  var elMem = htmlNode.getElementById('v-mem');
  if (elCpu) elCpu.textContent = (cpu != null ? Math.round(cpu) : '--') + '%';
  if (elMem) elMem.textContent = (mem != null ? Math.round(mem) : '--') + '%';
  if (cpu != null) hg_paintBar(htmlNode.getElementById('track-cpu'), cpu);
  if (mem != null) hg_paintBar(htmlNode.getElementById('track-mem'), mem);
} catch (e) {}
`;
  return { css, html, onInit: GLOBAL_BG_JS, onRender, customProperties: {} };
}

/* ------------------------------------------------------------------ */
/* Component: tabela de câmeras (nome + status, colorido)               */
/* ------------------------------------------------------------------ */

function cameraTableComponent() {
  const css = `
*{box-sizing:border-box;}
.camtable{width:100%;height:100%;display:flex;flex-direction:column;gap:2px;overflow:hidden;
  font-family:'Segoe UI',Roboto,Arial,sans-serif;
  background:linear-gradient(160deg,#0b1830 0%,#0a1428 55%,#081022 100%);
  border:1px solid rgba(96,165,250,0.18);border-radius:8px;padding:4px;}
.cam-row{flex:1;display:flex;align-items:center;justify-content:space-between;padding:0 8px;border-radius:4px;min-height:0;}
.cam-row.online{background:rgba(52,211,153,0.14);}
.cam-row.offline{background:rgba(248,113,113,0.14);}
.cam-row.empty{background:rgba(148,163,184,0.08);}
.cam-name{font-size:11px;font-weight:600;color:#dce9ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.cam-status{font-size:10px;font-weight:800;letter-spacing:.3px;flex:none;padding-left:8px;}
.cam-status.online{color:#34d399;}
.cam-status.offline{color:#f87171;}
.cam-status.empty{color:#94a3b8;}
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
      var row = document.createElement('div'); row.className = 'cam-row ' + cls;
      var nameEl = document.createElement('span'); nameEl.className = 'cam-name'; nameEl.textContent = name;
      var statusEl = document.createElement('span'); statusEl.className = 'cam-status ' + cls; statusEl.textContent = label;
      row.appendChild(nameEl); row.appendChild(statusEl);
      wrap.appendChild(row);
    }
  }
} catch (e) {}
`;
  return { css, html, onInit: GLOBAL_BG_JS, onRender, customProperties: {} };
}

/* ------------------------------------------------------------------ */
/* Component: state-timeline customizado (câmeras que caíram, 3h)       */
/* ------------------------------------------------------------------ */

function dropsTimelineComponent() {
  const css = `
*{box-sizing:border-box;}
.dt-wrap{width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;
  font-family:'Segoe UI',Roboto,Arial,sans-serif;
  background:linear-gradient(160deg,#0b1830 0%,#0a1428 55%,#081022 100%);
  border:1px solid rgba(96,165,250,0.18);border-radius:8px;padding:6px 10px;}
.dt-empty{flex:1;display:flex;align-items:center;justify-content:center;color:#34d399;font-size:13px;font-weight:700;}
.dt-rows{flex:1;display:flex;flex-direction:column;gap:1px;min-height:0;}
.dt-row{flex:1;display:flex;align-items:center;gap:6px;min-height:0;}
.dt-name{width:72px;flex:none;font-size:9px;font-weight:600;color:#9fb6c8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dt-track{position:relative;flex:1;height:60%;border-radius:2px;overflow:hidden;background:rgba(255,255,255,0.06);}
.dt-seg{position:absolute;top:0;bottom:0;}
.dt-seg.on{background:#34d399;}
.dt-seg.off{background:#f87171;}
.dt-axis{display:flex;justify-content:space-between;font-size:9px;color:#6f84a8;margin-top:4px;flex:none;font-weight:600;}
`;
  const html = `
<div class="dt-wrap">
  <div class="dt-rows" id="dt-rows"></div>
  <div class="dt-axis" id="dt-axis"></div>
</div>`;
  const onRender = HELPERS + `
try {
  var timeFields = hg_allTimeFields();
  var strs = hg_allStringFields();
  var nums = hg_allNumericFields();
  var tVals = hg_values(timeFields[0]);
  var camVals = hg_values(strs[0]);
  var statusVals = hg_values(nums[0]);

  var byCam = {};
  for (var i = 0; i < tVals.length; i++) {
    var cam = camVals[i];
    if (cam == null) continue;
    if (!byCam[cam]) byCam[cam] = [];
    byCam[cam].push({ t: tVals[i], v: statusVals[i] });
  }
  var camNames = Object.keys(byCam).sort();

  var rowsEl = htmlNode.getElementById('dt-rows');
  var axisEl = htmlNode.getElementById('dt-axis');
  var wrapEl = rowsEl ? rowsEl.parentElement : null;

  var tr = data && data.timeRange;
  var t0 = tr && tr.from ? (tr.from.valueOf ? tr.from.valueOf() : +tr.from) : null;
  var t1 = tr && tr.to ? (tr.to.valueOf ? tr.to.valueOf() : +tr.to) : null;
  if (t0 == null || t1 == null || !(t1 > t0)) {
    var allT = tVals.filter(function (v) { return v != null; });
    t0 = allT.length ? Math.min.apply(null, allT) : Date.now() - 3 * 3600000;
    t1 = allT.length ? Math.max.apply(null, allT) : Date.now();
  }

  if (rowsEl) {
    rowsEl.innerHTML = '';
    if (camNames.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'dt-empty';
      empty.textContent = 'Nenhuma queda registrada nas últimas 3h';
      rowsEl.appendChild(empty);
    } else {
      camNames.forEach(function (cam) {
        var pts = byCam[cam];
        var row = document.createElement('div'); row.className = 'dt-row';
        var nameEl = document.createElement('span'); nameEl.className = 'dt-name'; nameEl.textContent = cam; nameEl.title = cam;
        var track = document.createElement('div'); track.className = 'dt-track';
        var total = t1 - t0;
        for (var pi = 0; pi < pts.length; pi++) {
          var segStart = pts[pi].t;
          var segEnd = (pi < pts.length - 1) ? pts[pi + 1].t : t1;
          var leftPct = total > 0 ? ((segStart - t0) / total) * 100 : 0;
          var widthPct = total > 0 ? ((segEnd - segStart) / total) * 100 : 100;
          var seg = document.createElement('div');
          seg.className = 'dt-seg ' + (pts[pi].v === 1 ? 'on' : 'off');
          seg.style.left = Math.max(0, leftPct) + '%';
          seg.style.width = Math.max(widthPct, 0.3) + '%';
          seg.title = cam + ' — ' + (pts[pi].v === 1 ? 'Online' : 'Offline') + ' às ' + hg_fmtHM(segStart);
          track.appendChild(seg);
        }
        row.appendChild(nameEl); row.appendChild(track);
        rowsEl.appendChild(row);
      });
    }
  }

  if (axisEl) {
    axisEl.innerHTML = '';
    if (camNames.length > 0) {
      var ticks = hg_niceTicks(t0, t1, 5);
      ticks.forEach(function (tms) {
        var span = document.createElement('span');
        span.textContent = hg_fmtHM(tms);
        axisEl.appendChild(span);
      });
    }
  }
} catch (e) {}
`;
  return { css, html, onInit: GLOBAL_BG_JS, onRender, customProperties: {}, timeFrom: '3h' };
}

/* ------------------------------------------------------------------ */
/* Montagem                                                             */
/* ------------------------------------------------------------------ */

const panels = [];

for (const nvr of NVRS) {
  // header
  panels.push(htmlPanel(
    { x: nvr.x, y: Y_HEADER, w: nvr.w, h: H_HEADER },
    ZABBIX_DS, [],
    headerComponent(nvr)
  ));

  // online/offline (MySQL)
  panels.push(htmlPanel(
    { x: nvr.x, y: Y_CARDS, w: nvr.onlineW, h: H_CARDS },
    MYSQL_DS,
    [mysqlTarget('A', sqlFor('onlineSql', nvr)), mysqlTarget('B', sqlFor('offlineSql', nvr))],
    onlineOfflineComponent()
  ));

  // download/upload (Zabbix)
  const duW = nvr.w - nvr.onlineW;
  panels.push(htmlPanel(
    { x: nvr.x + nvr.onlineW, y: Y_CARDS, w: duW, h: H_CARDS },
    ZABBIX_DS,
    [zabbixTarget('A', 'Interface eth0: Bits received', nvr.host), zabbixTarget('B', 'Interface eth0: Bits sent', nvr.host)],
    downloadUploadComponent()
  ));

  // CPU / Memory (Zabbix)
  panels.push(htmlPanel(
    { x: nvr.x, y: Y_BARGAUGE, w: nvr.w, h: H_BARGAUGE },
    ZABBIX_DS,
    [zabbixTarget('A', 'CPU Usage', nvr.host), zabbixTarget('B', 'Memory Utilization', nvr.host)],
    cpuMemComponent()
  ));

  // tabela de câmeras (MySQL)
  panels.push(htmlPanel(
    { x: nvr.x, y: Y_TABLE, w: nvr.w, h: H_TABLE },
    MYSQL_DS,
    [mysqlTarget('A', sqlFor('tableSql', nvr))],
    cameraTableComponent()
  ));

  // state-timeline customizado: câmeras que caíram (MySQL, 3h)
  panels.push(htmlPanel(
    { x: nvr.x, y: Y_GRAPH, w: nvr.w, h: H_GRAPH },
    MYSQL_DS,
    [mysqlTarget('A', sqlFor('timelineSql', nvr))],
    dropsTimelineComponent()
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
console.log(`Linhas por seção -> header:${H_HEADER} cards:${H_CARDS} bargauge:${H_BARGAUGE} tabela:${H_TABLE} grafico:${H_GRAPH} (soma=${TOTAL_H})`);
console.log('Painéis gerados:', panels.length);

const newDashboard = Object.assign({}, dashboard, { panels });

const payload = {
  dashboard: newDashboard,
  folderId: backup.meta.folderId,
  folderUid: backup.meta.folderUid,
  overwrite: true,
  message: 'v3: reconstrução 100% em HTML Graphics (gapit-htmlgraphics-panel), substituindo os painéis nativos da v2.',
};

fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
console.log('Payload salvo em', OUT_PATH);
