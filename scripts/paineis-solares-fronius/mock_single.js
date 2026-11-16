const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const qres = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));

const dash = payload.dashboard;
const panel = dash.panels.find(p => p.options && p.options.html && p.options.html.includes('ew-days'));
console.log('Testing Energy per Week panel id', panel.id, 'timeFrom=', panel.timeFrom);

function fieldsFor(key) {
  const f = qres.results[key].frames[0];
  return f.schema.fields.map((fd, i) => ({ name: fd.name, type: fd.type, values: f.data.values[i] }));
}
const series = [
  { refId: 'A', fields: fieldsFor('A') },
  { refId: 'B', fields: fieldsFor('B') },
];

const elements = {};
function mockEl(id) {
  if (!elements[id]) elements[id] = { id, textContent:'', innerHTML:'', className:'', style:{}, dataset:{}, _attrs:{}, children:[], appendChild(c){this.children.push(c);}, querySelector(){return null;}, querySelectorAll(){return [];}, addEventListener(){}, getBoundingClientRect(){return {width:1800,left:0};}, setAttribute(k,v){this._attrs[k]=v;} };
  return elements[id];
}
const htmlNode = { host: { parentElement: null }, getElementById: (id) => mockEl(id), addEventListener: () => {} };
const mockDocument = { createElement: (tag) => ({ tagName: tag, style: {}, textContent:'', className:'', children:[], appendChild(c){this.children.push(c);}, setAttribute(){} }), getElementById: () => null, head:{appendChild(){}}, body:{appendChild(){}, style:{setProperty(){}}}, documentElement:{style:{setProperty(){}}} };
const from = new Date(qres.results.A.frames[0].data.values[0][0]);
const to = new Date();
const mockData = { series, timeRange: { from, to } };
const mockProps = { timeRange: mockData.timeRange };
const mockCustomProperties = JSON.parse(panel.options.codeData || '{}');

function run(code, label) {
  try {
    const fn = new Function('htmlNode','data','customProperties','options','theme','theme2','getTemplateSrv','getLocationSrv','htmlGraphics','props','width','height','document', code);
    fn(htmlNode, mockData, mockCustomProperties, panel.options, {isDark:true}, {}, ()=>({replace:(s)=>s}), ()=>({}), {}, mockProps, 1800, 334, mockDocument);
  } catch (e) {
    console.log(`EXCEPTION in ${label}:`, e.stack || e.message);
  }
}
run(panel.options.onInit, 'onInit');
run(panel.options.onRender, 'onRender');

console.log('line d set:', !!(elements['ew-line'] && elements['ew-line']._attrs.d));
console.log('hgPoints count:', elements['ew-spark'] && elements['ew-spark'].__hgPoints && elements['ew-spark'].__hgPoints.length);
console.log('axis ticks:', elements['ew-axis'] && elements['ew-axis'].children.map(c => c.textContent));
const days = elements['ew-days'] ? elements['ew-days'].children : [];
console.log('day cards:', days.length);
days.forEach(card => {
  const [lbl, val] = card.children;
  console.log(' ', lbl.textContent, '->', val.textContent, '(class: ' + card.className + ')');
});
