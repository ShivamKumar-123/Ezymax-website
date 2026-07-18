const fs = require('fs');
const target = 'src/screens/MainTradingScreen.js';
const repl   = '_new_bootstrap.js';
const src = fs.readFileSync(target, 'utf8');
const newBody = fs.readFileSync(repl, 'utf8').replace(/\s+$/g, '');
const startMarker = "const CHART_BOOTSTRAP_JS = String.raw`";
const endMarker   = "`;\n\n// iOS 26 Style Toast Notification Component";
const startIdx = src.indexOf(startMarker);
const endIdx   = src.indexOf(endMarker, startIdx);
if (startIdx < 0 || endIdx < 0) {
  console.error('Markers not found', { startIdx, endIdx });
  process.exit(2);
}
const before = src.substring(0, startIdx + startMarker.length);
const after  = src.substring(endIdx);
const out = before + '\n' + newBody + '\n' + after;
fs.writeFileSync(target, out);
console.log('Spliced. New file size:', out.length);
