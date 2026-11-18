const fs = require('fs');
// Usage: node mock_panel.js <payload.json> <htmlMarker> <queryResult.json> [refIds=A,B,C,...] [timeFromMs] [timeToMs]
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const marker = process.argv[3];
const qres = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'));
const refIds = (process.argv[5] || 'A').split(',');

const panel = payload.dashboard.panels.find(p => p.options && p.options.html && p.options.html.includes(marker));
if (!panel) { console.log('panel not found for marker', marker); process.exit(1); }
console.log('Testing panel id', panel.id, 'timeFrom=', panel.timeFrom);

const series = refIds.map(refId => {
  const f = qres.results[refId].frames[0];
  return { refId, fields: f.schema.fields.map((fd, i) => ({ name: fd.name, type: fd.type, values: f.data.values[i] })) };
});

const elements = {};
function mockEl(id) {
  if (!elements[id]) elements[id] = {
    id, textContent: '', innerHTML: '', className: '', style: {}, dataset: {}, _attrs: {}, children: [],
    appendChild(c) { this.children.push(c); },
    querySelector(sel) {
      if (sel === '.mask') return this.children.find(c => c.className === 'mask') || null;
      return null;
    },
    querySelectorAll() { return []; },
    addEventListener() {},
    getBoundingClientRect() { return { width: 1800, left: 0 }; },
    setAttribute(k, v) { this._attrs[k] = v; },
    get parentElement() { return this._parent || null; },
    set parentElement(v) { this._parent = v; },
  };
  return elements[id];
}
const htmlNode = { host: { parentElement: null }, getElementById: (id) => mockEl(id), addEventListener: () => {} };
let autoId = 0;
const mockDocument = {
  createElement: (tag) => {
    const el = {
      tagName: tag, style: {}, textContent: '', className: '', _attrs: {}, children: [],
      appendChild(c) { this.children.push(c); if (c) c._parent = this; },
      setAttribute(k, v) { this._attrs[k] = v; },
      querySelector(sel) { if (sel === '.mask') return this.children.find(c => c.className === 'mask') || null; return null; },
      get parentElement() { return this._parent || null; },
    };
    return el;
  },
  getElementById: () => null,
  head: { appendChild() {} },
  body: { appendChild() {}, style: { setProperty() {} } },
  documentElement: { style: { setProperty() {} } },
};

// find min/max time across all series for a plausible timeRange
let allTimes = [];
series.forEach(s => { const tf = s.fields.find(f => f.type === 'time'); if (tf) allTimes = allTimes.concat(tf.values.filter(v => v != null)); });
const tFrom = allTimes.length ? Math.min(...allTimes) : Date.now() - 3 * 3600000;
const tTo = allTimes.length ? Math.max(...allTimes) : Date.now();

const mockData = { series, timeRange: { from: new Date(tFrom), to: new Date(tTo) } };
const mockProps = { timeRange: mockData.timeRange };
const mockCustomProperties = JSON.parse(panel.options.codeData || '{}');

function run(code, label) {
  try {
    const fn = new Function('htmlNode', 'data', 'customProperties', 'options', 'theme', 'theme2', 'getTemplateSrv', 'getLocationSrv', 'htmlGraphics', 'props', 'width', 'height', 'document', code);
    fn(htmlNode, mockData, mockCustomProperties, panel.options, { isDark: true }, {}, () => ({ replace: (s) => s }), () => ({}), {}, mockProps, 400, 300, mockDocument);
  } catch (e) {
    console.log(`EXCEPTION in ${label}:`, e.stack || e.message);
  }
}
run(panel.options.onInit, 'onInit');
run(panel.options.onRender, 'onRender');

console.log('\n--- element states ---');
for (const id of Object.keys(elements)) {
  const el = elements[id];
  const extra = el.children && el.children.length ? ` children=${el.children.length}` : '';
  console.log(`#${id}: text=${JSON.stringify(el.textContent)}${extra}`);
}
