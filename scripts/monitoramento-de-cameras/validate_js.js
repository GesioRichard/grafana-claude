const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let errors = 0;
for (const p of payload.dashboard.panels) {
  for (const field of ['onInit', 'onRender']) {
    const code = p.options[field];
    if (!code) continue;
    try {
      // eslint-disable-next-line no-new-func
      new Function('htmlNode', 'data', 'customProperties', 'options', 'theme', 'theme2', 'getTemplateSrv', 'getLocationSrv', 'htmlGraphics', 'props', 'width', 'height', 'document', code);
    } catch (e) {
      errors++;
      console.log(`SYNTAX ERROR in panel #${p.id} [${field}]:`, e.message);
    }
  }
  try { JSON.parse(p.options.codeData); } catch (e) {
    errors++;
    console.log(`codeData JSON error in panel #${p.id}:`, e.message);
  }
}
console.log(errors === 0 ? 'All JS blocks parsed OK.' : `${errors} error(s) found.`);
