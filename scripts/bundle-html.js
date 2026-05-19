const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');

// Read index.html
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

// Find and inline the JS bundle
const scriptMatch = html.match(/src="(\/_expo\/static\/js\/web\/[^"]+)"/);
if (!scriptMatch) { console.error('Could not find JS bundle in index.html'); process.exit(1); }
const bundlePath = path.join(dist, scriptMatch[1].replace(/^\//, '').replace(/\//g, path.sep));
const bundleJs = fs.readFileSync(bundlePath, 'utf8');
html = html.replace(`<script src="${scriptMatch[1]}" defer></script>`, `<script>${bundleJs}</script>`);

// Inline the favicon SVG as a data URI
const faviconSvg = fs.readFileSync(path.join(dist, 'favicon.svg'), 'utf8');
const faviconB64 = Buffer.from(faviconSvg).toString('base64');
html = html.replace(`href="/favicon.svg"`, `href="data:image/svg+xml;base64,${faviconB64}"`);

// Inline the RTG logo as base64 so it works without a server
const logoPath = path.join(dist, 'rtg-logo.png');
if (fs.existsSync(logoPath)) {
  const logoB64 = fs.readFileSync(logoPath).toString('base64');
  const logoDataUri = `data:image/png;base64,${logoB64}`;
  html = html.replace(/\/rtg-logo\.png/g, logoDataUri);
}

// Write output
const out = path.join(__dirname, '..', 'bundle.html');
fs.writeFileSync(out, html, 'utf8');
const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`bundle.html created — ${kb} KB`);
