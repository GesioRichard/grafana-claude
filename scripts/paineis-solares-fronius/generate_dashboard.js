const fs = require('fs');

const SRC_PATH = process.argv[2];
const OUT_PATH = process.argv[3];

const raw = JSON.parse(fs.readFileSync(SRC_PATH, 'utf8'));
const baseDash = { ...raw.dashboard };
delete baseDash.panels;

const DS = { type: 'alexanderzobnin-zabbix-datasource', uid: 'fdfjaoiye7im8a' };

function zabbixTarget(refId, itemFilter, hostFilter, opts) {
  opts = opts || {};
  return {
    application: { filter: '' },
    countTriggersBy: '',
    datasource: DS,
    evaltype: '0',
    functions: opts.sumSeries
      ? [{ added: true, def: { category: 'Aggregate', defaultParams: [], name: 'sumSeries', params: [] }, params: [], text: 'sumSeries()' }]
      : [],
    group: { filter: 'Fronius' },
    host: { filter: hostFilter },
    item: { filter: itemFilter },
    itemTag: { filter: '' },
    macro: { filter: '' },
    options: { count: false, disableDataAlignment: false, showDisabledItems: false, skipEmptyValues: false, useTrends: 'default', useZabbixValueMapping: false },
    proxy: { filter: '' },
    queryType: '0',
    refId,
    resultFormat: 'time_series',
    schema: 12,
    table: { skipEmptyValues: false },
    tags: { filter: '' },
    textFilter: '',
    trigger: { filter: '' },
  };
}

function htmlPanel(id, gridPos, targets, opts) {
  const panel = {
    id,
    gridPos,
    type: 'gapit-htmlgraphics-panel',
    title: '',
    transparent: true,
    datasource: DS,
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
/* Shared JS helpers (inlined as text into each panel's onRender)      */
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
function hg_allNumericFields(){
  var out = [];
  (data.series || []).forEach(function(fr){
    (fr.fields || []).forEach(function(f){ if (f.type === 'number') out.push(f); });
  });
  return out;
}
function hg_allTimeFields(){
  var out = [];
  (data.series || []).forEach(function(fr){
    (fr.fields || []).forEach(function(f){ if (f.type === 'time') out.push(f); });
  });
  return out;
}
function hg_lastNonNull(arr){
  for (var i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined && !isNaN(arr[i])) return arr[i];
  }
  return null;
}
function hg_firstNonNull(arr){
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] !== null && arr[i] !== undefined && !isNaN(arr[i])) return arr[i];
  }
  return null;
}
function hg_sig3(n){
  if (n === 0) return { v: 0, d: 0 };
  var abs = Math.abs(n);
  var d;
  if (abs >= 1) {
    var intDigits = Math.floor(Math.log10(abs)) + 1;
    d = Math.max(0, 3 - intDigits);
  } else {
    var mag = Math.floor(Math.log10(abs));
    d = Math.max(0, 2 - mag);
  }
  var f = Math.pow(10, d);
  return { v: Math.round(n * f) / f, d: d };
}
function hg_fmtScaled(n, units, step){
  step = step || 1000;
  var v = Math.abs(n);
  var i = 0;
  while (v >= step && i < units.length - 1) { v /= step; i++; }
  var s = hg_sig3(v);
  var text = (n < 0 ? '-' : '') + s.v.toFixed(s.d);
  return { text: text, unit: units[i] };
}
function hg_fmtPower(w){ return hg_fmtScaled(Math.abs(w), ['W','kW','MW','GW']); }
function hg_fmtEnergy(wh){ return hg_fmtScaled(Math.abs(wh), ['Wh','kWh','MWh','GWh']); }
function hg_fmtPctNumber(n){
  var s = hg_sig3(Math.abs(n));
  return s.v.toLocaleString('pt-BR', { minimumFractionDigits: s.d, maximumFractionDigits: s.d });
}
function hg_setDelta(el, last, first){
  if (el == null) return;
  if (first == null || last == null || first === 0) { el.textContent = ''; return; }
  var pct = ((last - first) / Math.abs(first)) * 100;
  if (!isFinite(pct)) { el.textContent = ''; return; }
  var up = pct >= 0;
  el.innerHTML = (up ? '&#9650; ' : '&#9660; ') + hg_fmtPctNumber(pct) + '%';
  el.className = 'delta ' + (up ? 'up' : 'down');
}
function hg_paintBar(track, pct){
  if (!track) return;
  var mask = track.querySelector('.mask');
  if (!mask) {
    mask = document.createElement('div');
    mask.className = 'mask';
    track.appendChild(mask);
  }
  var clamped = Math.max(0, Math.min(100, pct));
  mask.style.width = (100 - clamped) + '%';
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
/* CARD (per inverter) panel                                          */
/* ------------------------------------------------------------------ */

const CARD_CSS = `
*{box-sizing:border-box;}
.wrap{
  width:100%;height:100%;display:flex;flex-direction:column;
  font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#e8f1ff;
  background:linear-gradient(160deg,#0b1830 0%,#0a1428 55%,#081022 100%);
  border:1px solid rgba(96,165,250,0.18);border-radius:10px;
  padding:10px 16px 12px 16px;overflow:hidden;
}
.head{display:flex;align-items:center;gap:10px;margin-bottom:8px;flex:none;}
.dot{width:9px;height:9px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399;flex:none;animation:pulse 1.8s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.35;}}
.title{font-size:21px;font-weight:800;letter-spacing:.2px;color:#dce9ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:8px;flex:none;}
.stat{padding:0 7px;border-left:1px solid rgba(96,165,250,0.12);}
.stat:first-child{border-left:none;padding-left:0;}
.lbl{font-size:11px;color:#93aad0;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px;font-weight:700;}
.val{font-size:21px;font-weight:800;color:#f3f7ff;white-space:nowrap;}
.delta{font-size:11px;font-weight:700;margin-top:2px;}
.delta.up{color:#34d399;}
.delta.down{color:#f87171;}
.loadrow{display:flex;align-items:center;gap:8px;margin-bottom:7px;flex:none;}
.track{position:relative;flex:1;height:11px;border-radius:6px;overflow:hidden;
  background:linear-gradient(90deg,#f87171 0%,#fbbf24 50%,#34d399 100%);}
.track .mask{position:absolute;top:0;right:0;bottom:0;background:rgba(5,10,20,0.85);transition:width .4s ease;}
.pct{font-size:14px;font-weight:700;color:#bcd4ff;width:50px;text-align:right;flex:none;}
.sparkwrap{position:relative;flex:1;min-height:0;}
.spark{width:100%;height:100%;display:block;}
.vline{position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.45);display:none;pointer-events:none;}
.sparktip{position:absolute;top:2px;transform:translateX(-50%);background:rgba(4,9,18,0.95);border:1px solid rgba(96,165,250,0.35);border-radius:6px;padding:4px 10px;font-size:12.5px;font-weight:700;color:#fff;white-space:nowrap;display:none;pointer-events:none;z-index:2;}
.sparkaxis{display:flex;justify-content:space-between;font-size:11.5px;color:#6f84a8;margin-top:5px;flex:none;font-weight:600;}
`;

const CARD_HTML = `
<div class="wrap">
  <div class="head"><span class="dot"></span><span class="title" id="title">&mdash;</span></div>
  <div class="stats">
    <div class="stat"><div class="lbl">Potencia</div><div class="val" id="v-power">--</div><div class="delta" id="d-power"></div></div>
    <div class="stat"><div class="lbl">Hoje</div><div class="val" id="v-day">--</div><div class="delta" id="d-day"></div></div>
    <div class="stat"><div class="lbl">Total</div><div class="val" id="v-total">--</div><div class="delta" id="d-total"></div></div>
  </div>
  <div class="loadrow"><div class="track" id="track"></div><span class="pct" id="pct">--%</span></div>
  <div class="sparkwrap" id="sparkwrap">
    <svg class="spark" id="spark" viewBox="0 0 300 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffb648" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#ffb648" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path id="area" fill="url(#sparkFill)" stroke="none"></path>
      <path id="line" fill="none" stroke="#ffb648" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>
    </svg>
    <div class="vline" id="vline"></div>
    <div class="sparktip" id="sparktip"></div>
  </div>
  <div class="sparkaxis" id="sparkaxis"></div>
</div>
`;

const CARD_ONINIT = GLOBAL_BG_JS + HELPERS + `
var titleEl = htmlNode.getElementById('title');
if (titleEl) titleEl.textContent = (customProperties && customProperties.title) || '';

var sparkwrap = htmlNode.getElementById('sparkwrap');
var vline = htmlNode.getElementById('vline');
var tip = htmlNode.getElementById('sparktip');
var svgEl = htmlNode.getElementById('spark');
if (sparkwrap && !sparkwrap.__hgBound) {
  sparkwrap.__hgBound = true;
  sparkwrap.addEventListener('mousemove', function (evt) {
    var pts = svgEl && svgEl.__hgPoints;
    if (!pts || pts.length < 2) return;
    var rect = sparkwrap.getBoundingClientRect();
    if (!rect.width) return;
    var relX = (evt.clientX - rect.left) / rect.width;
    relX = Math.max(0, Math.min(1, relX));
    var idx = Math.round(relX * (pts.length - 1));
    var p = pts[idx];
    var xPct = (idx / (pts.length - 1)) * 100;
    if (vline) { vline.style.left = xPct + '%'; vline.style.display = 'block'; }
    if (tip && p) {
      var d = new Date(p.t);
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var timeStr = pad(d.getHours()) + ':' + pad(d.getMinutes());
      var f = hg_fmtPower(p.v);
      tip.textContent = timeStr + '  ' + f.text + ' ' + f.unit;
      tip.style.left = Math.max(8, Math.min(92, xPct)) + '%';
      tip.style.display = 'block';
    }
  });
  sparkwrap.addEventListener('mouseleave', function () {
    if (vline) vline.style.display = 'none';
    if (tip) tip.style.display = 'none';
  });
}
`;

const CARD_ONRENDER = HELPERS + `
try {
var numFields = hg_allNumericFields();
var timeFields = hg_allTimeFields();
var fieldA = numFields[0], fieldB = numFields[1], fieldC = numFields[2];
var aVals = hg_values(fieldA), bVals = hg_values(fieldB), cVals = hg_values(fieldC);
var tVals = hg_values(timeFields[0]);
var aLast = hg_lastNonNull(aVals), aFirst = hg_firstNonNull(aVals);
var bLast = hg_lastNonNull(bVals), bFirst = hg_firstNonNull(bVals);
var cLast = hg_lastNonNull(cVals), cFirst = hg_firstNonNull(cVals);

var titleEl = htmlNode.getElementById('title');
if (titleEl) titleEl.textContent = (customProperties && customProperties.title) || '';

var vp = htmlNode.getElementById('v-power');
if (vp) { if (aLast == null) { vp.textContent = '--'; } else { var fp = hg_fmtPower(aLast); vp.textContent = fp.text + ' ' + fp.unit; } }
hg_setDelta(htmlNode.getElementById('d-power'), aLast, aFirst);

var vd = htmlNode.getElementById('v-day');
if (vd) { if (bLast == null) { vd.textContent = '--'; } else { var fd = hg_fmtEnergy(bLast); vd.textContent = fd.text + ' ' + fd.unit; } }
hg_setDelta(htmlNode.getElementById('d-day'), bLast, bFirst);

var vt = htmlNode.getElementById('v-total');
if (vt) { if (cLast == null) { vt.textContent = '--'; } else { var ft = hg_fmtEnergy(cLast); vt.textContent = ft.text + ' ' + ft.unit; } }
hg_setDelta(htmlNode.getElementById('d-total'), cLast, cFirst);

var pct = aLast != null ? (aLast / 273) : 0;
hg_paintBar(htmlNode.getElementById('track'), pct);
var pctEl = htmlNode.getElementById('pct');
if (pctEl) pctEl.textContent = (Math.round(Math.max(0, Math.min(100, pct)) * 10) / 10).toLocaleString('pt-BR') + '%';

var points = [];
for (var i = 0; i < aVals.length; i++) {
  if (aVals[i] != null && !isNaN(aVals[i])) points.push({ t: tVals[i], v: aVals[i] });
}
var pathLine = htmlNode.getElementById('line');
var pathArea = htmlNode.getElementById('area');
var svgNode = htmlNode.getElementById('spark');
if (svgNode) svgNode.__hgPoints = points;
if (pathLine && pathArea) {
  if (points.length >= 2) {
    var W = 300, H = 100, pad2 = 6;
    var vs = points.map(function (p) { return p.v; });
    var min = Math.min.apply(null, vs), max = Math.max.apply(null, vs);
    if (min === max) { max = min + 1; }
    var n = points.length;
    var coords = points.map(function (p, i) {
      var x = (i / (n - 1)) * W;
      var y = H - pad2 - ((p.v - min) / (max - min)) * (H - pad2 * 2);
      return [x, y];
    });
    var d = 'M ' + coords.map(function (c) { return c[0].toFixed(1) + ',' + c[1].toFixed(1); }).join(' L ');
    pathLine.setAttribute('d', d);
    pathArea.setAttribute('d', d + ' L ' + W + ',' + H + ' L 0,' + H + ' Z');
  } else {
    pathLine.setAttribute('d', '');
    pathArea.setAttribute('d', '');
  }
}
var axisEl = htmlNode.getElementById('sparkaxis');
function hg_fmtTime(ms) {
  var d = new Date(ms);
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}
if (axisEl) {
  axisEl.innerHTML = '';
  if (points.length >= 2) {
    var t0 = points[0].t, t1 = points[points.length - 1].t;
    var totalMin = (t1 - t0) / 60000;
    var niceSteps = [1, 2, 5, 10, 15, 20, 30, 60, 120, 180, 240, 360, 720, 1440, 2880];
    var target = 7;
    var rawStep = totalMin / target;
    var step = niceSteps[niceSteps.length - 1];
    for (var si = 0; si < niceSteps.length; si++) { if (niceSteps[si] >= rawStep) { step = niceSteps[si]; break; } }
    var stepMs = step * 60000;
    var ticks = [];
    for (var tt = t0; tt <= t1 + stepMs * 0.3; tt += stepMs) { ticks.push(tt); }
    if (ticks.length < 2) { ticks = [t0, t1]; }
    ticks.forEach(function (tms) {
      var span = document.createElement('span');
      span.textContent = hg_fmtTime(tms);
      axisEl.appendChild(span);
    });
  }
}
} catch (e) {}
`;

/* ------------------------------------------------------------------ */
/* KPI panel                                                           */
/* ------------------------------------------------------------------ */

const KPI_CSS = `
*{box-sizing:border-box;}
.kpi{
  width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;gap:4px;
  font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#e8f1ff;
  background:linear-gradient(160deg,#0d1b32 0%,#0a1428 60%,#081022 100%);
  border:1px solid rgba(96,165,250,0.2);border-radius:12px;
  padding:7px 20px;overflow:hidden;
}
.kpi-top{display:flex;align-items:center;gap:9px;}
.icon{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex:none;}
.label{font-size:15px;font-weight:800;letter-spacing:.5px;color:#aec3e6;text-transform:uppercase;}
.kpi-mid{display:flex;align-items:baseline;gap:10px;}
.value{font-size:36px;font-weight:800;color:#ffffff;}
.delta{font-size:14px;font-weight:700;}
.delta.up{color:#34d399;}
.delta.down{color:#f87171;}
.kpi-bar{display:flex;align-items:center;gap:9px;}
.track{position:relative;flex:1;height:10px;border-radius:6px;overflow:hidden;
  background:linear-gradient(90deg,#f87171 0%,#fbbf24 50%,#34d399 100%);}
.track .mask{position:absolute;top:0;right:0;bottom:0;background:rgba(5,10,20,0.85);transition:width .4s ease;}
.pct{font-size:13px;font-weight:700;color:#bcd4ff;width:46px;text-align:right;flex:none;}
`;

const KPI_HTML = `
<div class="kpi">
  <div class="kpi-top"><div class="icon" id="icon"></div><div class="label" id="label"></div></div>
  <div class="kpi-mid"><span class="value" id="value">--</span><span class="delta" id="delta"></span></div>
  <div class="kpi-bar" id="barRow"><div class="track" id="track"></div><span class="pct" id="pct"></span></div>
</div>
`;

const ICONS = {
  bolt: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M13 2 3 14h7l-1 8 10-12h-7z" fill="#fbbf24"/></svg>',
  sun: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="4.5" fill="#fbbf24"/><g stroke="#fbbf24" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></g></svg>',
  leaf: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M20 4C9 4 4 9 4 16c0 1.5.3 2.8.9 4C11 19 17 14 20 8c0-1.4-.3-2.8 0-4z" fill="#34d399"/></svg>',
};
const ICON_BG = { bolt: 'rgba(251,191,36,0.14)', sun: 'rgba(251,191,36,0.14)', leaf: 'rgba(52,211,153,0.14)' };

const KPI_ONINIT = GLOBAL_BG_JS + `
var iconEl = htmlNode.getElementById('icon');
var icons = ${JSON.stringify(ICONS)};
var bgs = ${JSON.stringify(ICON_BG)};
var key = (customProperties && customProperties.icon) || 'bolt';
if (iconEl) { iconEl.innerHTML = icons[key] || icons.bolt; iconEl.style.background = bgs[key] || bgs.bolt; }
var labelEl = htmlNode.getElementById('label');
if (labelEl) labelEl.textContent = (customProperties && customProperties.label) || '';
if (!(customProperties && customProperties.showBar)) {
  var barRow = htmlNode.getElementById('barRow');
  if (barRow) barRow.style.display = 'none';
}
`;

const KPI_ONRENDER = HELPERS + `
try {
var vals = hg_values(hg_allNumericFields()[0]);
var last = hg_lastNonNull(vals), first = hg_firstNonNull(vals);

var valueEl = htmlNode.getElementById('value');
if (valueEl) {
  if (last == null) { valueEl.textContent = '--'; }
  else {
    var unitKind = (customProperties && customProperties.unit) || 'power';
    var f = unitKind === 'energy' ? hg_fmtEnergy(last) : hg_fmtPower(last);
    valueEl.textContent = f.text + ' ' + f.unit;
  }
}
hg_setDelta(htmlNode.getElementById('delta'), last, first);

if (customProperties && customProperties.showBar && last != null) {
  var scale = customProperties.scale || 2730;
  var pct = last / scale;
  hg_paintBar(htmlNode.getElementById('track'), pct);
  var pctEl = htmlNode.getElementById('pct');
  if (pctEl) pctEl.textContent = (Math.round(Math.max(0, Math.min(100, pct)) * 10) / 10).toLocaleString('pt-BR') + '%';
}
} catch (e) {}
`;

/* ------------------------------------------------------------------ */
/* HEADER panel                                                        */
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
    <div class="titleblock"><div class="t1">MONITORAMENTO SOLAR</div><div class="t2">PAINEIS FRONIUS</div></div>
  </div>
  <div class="right">
    <div class="item"><span class="livedot"></span>DADOS EM TEMPO REAL</div>
    <div class="hdivider"></div>
    <div class="item"><svg class="ic" viewBox="0 0 24 24" width="16" height="16"><path d="M12 7v5l4 2" stroke="#9fc3ff" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="#9fc3ff" stroke-width="2" fill="none"/></svg><span id="rangeText">ULTIMAS 3 HORAS</span></div>
    <div class="hdivider"></div>
    <div class="item"><svg class="ic" viewBox="0 0 24 24" width="16" height="16"><path d="M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5" stroke="#9fc3ff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>ATUALIZACAO 5s</div>
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
/* WEEKLY chart panel (fixed 7-day window, full width)                 */
/* ------------------------------------------------------------------ */

const WEEKLY_CSS = `
*{box-sizing:border-box;}
.wk{
  width:100%;height:100%;display:flex;flex-direction:column;
  font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#e8f1ff;
  background:linear-gradient(160deg,#0b1830 0%,#0a1428 55%,#081022 100%);
  border:1px solid rgba(96,165,250,0.18);border-radius:10px;
  padding:10px 22px 10px 22px;overflow:hidden;
}
.wkhead{display:flex;align-items:baseline;gap:10px;margin-bottom:6px;flex:none;}
.wkdot{width:9px;height:9px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399;flex:none;align-self:center;animation:pulse 1.8s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.35;}}
.wktitle{font-size:16px;font-weight:800;letter-spacing:.6px;color:#dce9ff;text-transform:uppercase;}
.wksub{font-size:12px;font-weight:600;color:#7f93b3;letter-spacing:.4px;}
.wkbars{display:flex;align-items:flex-end;gap:10px;height:60px;flex:none;margin-bottom:6px;}
.wkbarcol{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:2px;}
.wkbarval{font-size:10.5px;font-weight:700;color:#ffd98a;white-space:nowrap;}
.wkbar{width:56%;border-radius:4px 4px 0 0;background:linear-gradient(180deg,#fbbf24,#9a6417);min-height:3px;transition:height .4s ease;}
.wkbarlbl{font-size:9.5px;font-weight:700;color:#7f93b3;letter-spacing:.3px;white-space:nowrap;}
.wksparkwrap{position:relative;flex:1;min-height:0;}
.wkspark{width:100%;height:100%;display:block;}
.wkvline{position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.4);display:none;pointer-events:none;}
.wktip{position:absolute;top:4px;transform:translateX(-50%);background:rgba(4,9,18,0.95);border:1px solid rgba(96,165,250,0.35);border-radius:6px;padding:5px 11px;font-size:13px;font-weight:700;color:#fff;white-space:nowrap;display:none;pointer-events:none;z-index:2;}
.wkaxis{display:flex;justify-content:space-between;font-size:12px;color:#6f84a8;margin-top:5px;flex:none;font-weight:600;}
`;

const WEEKLY_HTML = `
<div class="wk">
  <div class="wkhead"><span class="wkdot"></span><span class="wktitle">Total Power Generated</span><span class="wksub">&mdash; ULTIMOS 7 DIAS</span></div>
  <div class="wkbars" id="wk-bars"></div>
  <div class="wksparkwrap" id="wk-sparkwrap">
    <svg class="wkspark" id="wk-spark" viewBox="0 0 1600 220" preserveAspectRatio="none">
      <defs>
        <linearGradient id="wkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffb648" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="#ffb648" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path id="wk-area" fill="url(#wkFill)" stroke="none"></path>
      <path id="wk-line" fill="none" stroke="#ffb648" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>
    </svg>
    <div class="wkvline" id="wk-vline"></div>
    <div class="wktip" id="wk-tip"></div>
  </div>
  <div class="wkaxis" id="wk-axis"></div>
</div>
`;

const WEEKLY_ONINIT = GLOBAL_BG_JS + HELPERS + `
var sparkwrap = htmlNode.getElementById('wk-sparkwrap');
var vline = htmlNode.getElementById('wk-vline');
var tip = htmlNode.getElementById('wk-tip');
var svgEl = htmlNode.getElementById('wk-spark');
if (sparkwrap && !sparkwrap.__hgBound) {
  sparkwrap.__hgBound = true;
  sparkwrap.addEventListener('mousemove', function (evt) {
    var pts = svgEl && svgEl.__hgPoints;
    if (!pts || pts.length < 2) return;
    var rect = sparkwrap.getBoundingClientRect();
    if (!rect.width) return;
    var relX = (evt.clientX - rect.left) / rect.width;
    relX = Math.max(0, Math.min(1, relX));
    var idx = Math.round(relX * (pts.length - 1));
    var p = pts[idx];
    var xPct = (idx / (pts.length - 1)) * 100;
    if (vline) { vline.style.left = xPct + '%'; vline.style.display = 'block'; }
    if (tip && p) {
      var d = new Date(p.t);
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var dateStr = pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      var f = hg_fmtPower(p.v);
      tip.textContent = dateStr + '  ' + f.text + ' ' + f.unit;
      tip.style.left = Math.max(6, Math.min(94, xPct)) + '%';
      tip.style.display = 'block';
    }
  });
  sparkwrap.addEventListener('mouseleave', function () {
    if (vline) vline.style.display = 'none';
    if (tip) tip.style.display = 'none';
  });
}
`;

const WEEKLY_ONRENDER = HELPERS + `
try {
var numFields = hg_allNumericFields();
var timeFields = hg_allTimeFields();
var vals = hg_values(numFields[0]);
var dayVals = hg_values(numFields[1]);
var tVals = hg_values(timeFields[0]);
var points = [];
for (var i = 0; i < vals.length; i++) {
  if (vals[i] != null && !isNaN(vals[i])) points.push({ t: tVals[i], v: vals[i] });
}

var barsEl = htmlNode.getElementById('wk-bars');
if (barsEl) {
  barsEl.innerHTML = '';
  var byDay = {};
  for (var bi = 0; bi < dayVals.length; bi++) {
    if (dayVals[bi] == null || isNaN(dayVals[bi])) continue;
    var tms = tVals[bi];
    var dte = new Date(tms);
    var key = dte.getFullYear() + '-' + dte.getMonth() + '-' + dte.getDate();
    if (!byDay[key]) { byDay[key] = { max: dayVals[bi], t: tms }; }
    else {
      if (dayVals[bi] > byDay[key].max) byDay[key].max = dayVals[bi];
      if (tms > byDay[key].t) byDay[key].t = tms;
    }
  }
  var dayKeys = Object.keys(byDay).sort(function (a, b) { return byDay[a].t - byDay[b].t; });
  dayKeys = dayKeys.slice(-7);
  var maxDay = 0;
  dayKeys.forEach(function (k) { if (byDay[k].max > maxDay) maxDay = byDay[k].max; });
  var now = new Date();
  var todayKey = now.getFullYear() + '-' + now.getMonth() + '-' + now.getDate();
  var pad0 = function (n) { return (n < 10 ? '0' : '') + n; };
  dayKeys.forEach(function (k) {
    var day = byDay[k];
    var pct = maxDay > 0 ? (day.max / maxDay) * 100 : 0;
    var col = document.createElement('div'); col.className = 'wkbarcol';
    var valEl = document.createElement('div'); valEl.className = 'wkbarval';
    var fmt = hg_fmtEnergy(day.max);
    valEl.textContent = fmt.text + ' ' + fmt.unit;
    var barEl = document.createElement('div'); barEl.className = 'wkbar';
    barEl.style.height = Math.max(3, pct) + '%';
    var lblEl = document.createElement('div'); lblEl.className = 'wkbarlbl';
    var dd = new Date(day.t);
    lblEl.textContent = (k === todayKey) ? 'HOJE' : (pad0(dd.getDate()) + '/' + pad0(dd.getMonth() + 1));
    col.appendChild(valEl);
    col.appendChild(barEl);
    col.appendChild(lblEl);
    barsEl.appendChild(col);
  });
}

var pathLine = htmlNode.getElementById('wk-line');
var pathArea = htmlNode.getElementById('wk-area');
var svgNode = htmlNode.getElementById('wk-spark');
if (svgNode) svgNode.__hgPoints = points;
if (pathLine && pathArea) {
  if (points.length >= 2) {
    var W = 1600, H = 220, pad2 = 10;
    var vs = points.map(function (p) { return p.v; });
    var min = Math.min.apply(null, vs), max = Math.max.apply(null, vs);
    if (min === max) { max = min + 1; }
    var n = points.length;
    var coords = points.map(function (p, i) {
      var x = (i / (n - 1)) * W;
      var y = H - pad2 - ((p.v - min) / (max - min)) * (H - pad2 * 2);
      return [x, y];
    });
    var d = 'M ' + coords.map(function (c) { return c[0].toFixed(1) + ',' + c[1].toFixed(1); }).join(' L ');
    pathLine.setAttribute('d', d);
    pathArea.setAttribute('d', d + ' L ' + W + ',' + H + ' L 0,' + H + ' Z');
  } else {
    pathLine.setAttribute('d', '');
    pathArea.setAttribute('d', '');
  }
}
var axisEl = htmlNode.getElementById('wk-axis');
if (axisEl) {
  axisEl.innerHTML = '';
  if (points.length >= 2) {
    var t0 = points[0].t, t1 = points[points.length - 1].t;
    var totalMin = (t1 - t0) / 60000;
    var niceSteps = [1, 2, 5, 10, 15, 20, 30, 60, 120, 180, 240, 360, 720, 1440, 2880];
    var target = 7;
    var rawStep = totalMin / target;
    var step = niceSteps[niceSteps.length - 1];
    for (var si = 0; si < niceSteps.length; si++) { if (niceSteps[si] >= rawStep) { step = niceSteps[si]; break; } }
    var stepMs = step * 60000;
    var ticks = [];
    for (var tt = t0; tt <= t1 + stepMs * 0.3; tt += stepMs) { ticks.push(tt); }
    if (ticks.length < 2) { ticks = [t0, t1]; }
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    ticks.forEach(function (tms) {
      var span = document.createElement('span');
      var dd = new Date(tms);
      span.textContent = totalMin > 2160
        ? (pad(dd.getDate()) + '/' + pad(dd.getMonth() + 1))
        : (pad(dd.getHours()) + ':' + pad(dd.getMinutes()));
      axisEl.appendChild(span);
    });
  }
}
} catch (e) {}
`;

/* ------------------------------------------------------------------ */
/* Panel assembly                                                      */
/* ------------------------------------------------------------------ */

const inverters = [
  { host: 'SUB - 30348758 - 240.893958', label: 'SUB-30348758-240.893958' },
  { host: 'SUB - 30348760 - 240.893963', label: 'SUB-30348760-240.893963' },
  { host: 'SUB - 30348759 - 240.893959', label: 'SUB-30348759-240.893959' },
  { host: 'SUB - 30348810 - 240.908225', label: 'SUB-30348810-240.908225' },
  { host: 'SUB - 30486496 - 240.902002', label: 'SUB-30486496-240.902002' },
  { host: 'EXP - 30486497 - 240.901960', label: 'EXP-30486497-240.901960' },
  { host: 'EXP - 30486498 - 240.902207', label: 'EXP-30486498-240.902207' },
  { host: 'EXP - 30486499 - 240.908985', label: 'EXP-30486499-240.908985' },
  { host: 'EXP - 30486503 - 240.924236', label: 'EXP-30486503-240.924236' },
  { host: 'EXP - 30486504 - 240.924230', label: 'EXP-30486504-240.924230' },
];

const panels = [];
let id = 100;

// Header
panels.push(htmlPanel(++id, { x: 0, y: 0, w: 24, h: 3 }, [], {
  html: HEADER_HTML, css: HEADER_CSS, onInit: HEADER_ONINIT, onRender: HEADER_ONRENDER, customProperties: {},
}));

// KPIs: Power -> Day -> All Inverters
panels.push(htmlPanel(++id, { x: 0, y: 3, w: 8, h: 4 }, [
  zabbixTarget('A', 'Power Generated', '/.*/', { sumSeries: true }),
], {
  html: KPI_HTML, css: KPI_CSS, onInit: KPI_ONINIT, onRender: KPI_ONRENDER,
  customProperties: { label: 'Total Power Generated', icon: 'bolt', unit: 'power', showBar: true, scale: 2730 },
}));

panels.push(htmlPanel(++id, { x: 8, y: 3, w: 8, h: 4 }, [
  zabbixTarget('A', 'Energy Generated Day', '/.*/', { sumSeries: true }),
], {
  html: KPI_HTML, css: KPI_CSS, onInit: KPI_ONINIT, onRender: KPI_ONRENDER,
  customProperties: { label: 'Total Energy Generated Day', icon: 'sun', unit: 'energy', showBar: true, scale: 18000 },
}));

panels.push(htmlPanel(++id, { x: 16, y: 3, w: 8, h: 4 }, [
  zabbixTarget('A', 'Energy Generated Total', '/.*/', { sumSeries: true }),
], {
  html: KPI_HTML, css: KPI_CSS, onInit: KPI_ONINIT, onRender: KPI_ONRENDER,
  customProperties: { label: 'Total Energy Generated by All Inverters', icon: 'leaf', unit: 'energy', showBar: false },
}));

// Inverter cards: 5 per row x 2 rows
const rowWidths = [5, 5, 5, 5, 4];
const rowYs = [7, 15];
let inv = 0;
for (const y of rowYs) {
  let x = 0;
  for (let c = 0; c < 5; c++) {
    const w = rowWidths[c];
    const data = inverters[inv++];
    panels.push(htmlPanel(++id, { x, y, w, h: 8 }, [
      zabbixTarget('A', 'Power Generated', data.host),
      zabbixTarget('B', 'Energy Generated Day', data.host),
      zabbixTarget('C', 'Energy Generated Total', data.host),
    ], {
      html: CARD_HTML, css: CARD_CSS, onInit: CARD_ONINIT, onRender: CARD_ONRENDER,
      customProperties: { title: data.label },
    }));
    x += w;
  }
}

// Weekly chart: Total Power Generated (line) + daily totals (bars), fixed 7-day window, full width
panels.push(htmlPanel(++id, { x: 0, y: 23, w: 24, h: 6 }, [
  zabbixTarget('A', 'Power Generated', '/.*/', { sumSeries: true }),
  zabbixTarget('B', 'Energy Generated Day', '/.*/', { sumSeries: true }),
], {
  html: WEEKLY_HTML, css: WEEKLY_CSS, onInit: WEEKLY_ONINIT, onRender: WEEKLY_ONRENDER,
  customProperties: {}, timeFrom: '7d',
}));

const newDash = { ...baseDash, panels };
const payload = {
  dashboard: newDash,
  folderId: raw.meta.folderId,
  overwrite: true,
  message: 'Redesign com HTML Graphics (tema azul escuro)',
};

fs.writeFileSync(OUT_PATH, JSON.stringify(payload));
console.log('Panels generated:', panels.length);
console.log('Grid bounding box check: maxX=', Math.max(...panels.map(p => p.gridPos.x + p.gridPos.w)), 'maxY=', Math.max(...panels.map(p => p.gridPos.y + p.gridPos.h)));
console.log('Wrote', OUT_PATH, fs.statSync(OUT_PATH).size, 'bytes');
