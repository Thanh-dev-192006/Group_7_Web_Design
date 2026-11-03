// Run with Node.js 22+: node scripts/capture-ui.cjs
// Uses installed Chrome (CHROME_PATH can override it); no npm packages required.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs/images/screenshots');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'weather-screenshots-'));
let failForecast = false;
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (failForecast && pathname === '/mock/forecast.json') {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'Forecast temporarily unavailable' } }));
  }
  const file = path.resolve(root, 'frontend', '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(path.join(root, 'frontend') + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
let browser;
let ws;
let seq = 0;
const pending = new Map();
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression) {
  for (let n = 0; n < 100; n++) {
    if (await evaluate(expression)) return;
    await sleep(200);
  }
  throw new Error('Timed out: ' + expression);
}
async function capture(name, selector) {
  await evaluate('typeof Chart !== "undefined" && Object.values(Chart.instances).forEach(chart => { chart.stop(); chart.update("none"); })');
  const clip = await evaluate(selector
    ? `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}; })()`
    : '({x:0,y:0,width:innerWidth,height:document.documentElement.scrollHeight,scale:1})');
  const { data } = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
  fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(data, 'base64'));
  console.log(name, clip.width, clip.height);
}
async function load(width, dark = false) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 375 });
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  await cdp('Page.navigate', { url: 'http://127.0.0.1:8765/?mock=1&city=1' });
  await waitFor('!!document.querySelector("#daily .daily__item") || !!document.querySelector("#daily button")');
  await sleep(2000);
  await waitFor('document.querySelectorAll(".leaflet-tile-loaded").length > 0 && !document.querySelector(".leaflet-tile:not(.leaflet-tile-loaded)")');
  // Paint the below-the-fold mobile map before taking a full-page capture.
  await evaluate('document.querySelector("#map").scrollIntoView()');
  await sleep(300);
  await evaluate('window.scrollTo(0, 0)');
  await sleep(300);
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  await new Promise(resolve => server.listen(8765, '127.0.0.1', resolve));
  browser = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--remote-debugging-port=9223', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let tabs;
  for (let n = 0; n < 100; n++) {
    try { tabs = await (await fetch('http://127.0.0.1:9223/json')).json(); break; } catch { await sleep(200); }
  }
  if (!tabs) throw new Error('Chrome debugging endpoint unavailable');
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const task = pending.get(message.id);
    pending.delete(message.id);
    message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result);
  });
  await cdp('Page.enable');
  await load(1280);
  await waitFor('!!document.querySelector("#hourly canvas") && !!document.querySelector(".leaflet-tile-loaded")');
  await capture('ui-desktop-home');
  for (const [name, selector] of [['map', '#map'], ['current-aqi', '.content article:nth-child(1)'], ['forecast-48h', '.content article:nth-child(2)'], ['forecast-7days', '.content article:nth-child(3)'], ['rain-alert', '.rain-alert']]) await capture('ui-desktop-' + name, selector);
  await load(375);
  if (await evaluate('document.documentElement.scrollWidth > innerWidth')) throw new Error('Mobile page overflows');
  await capture('ui-mobile-home');
  await load(1280, true);
  await capture('ui-desktop-dark');
  await load(375, true);
  await capture('ui-mobile-dark');
  failForecast = true;
  await load(1280);
  await capture('ui-desktop-error-retry');
  await load(375);
  await capture('ui-mobile-error-retry');
  failForecast = false;
  await evaluate('document.querySelector("#hourly button").click()');
  await waitFor('!!document.querySelector("#hourly canvas") && !!document.querySelector("#daily .daily__item")');
  console.log('Retry restored the chart and daily forecast.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  ws?.close();
  browser?.kill();
  server.close();
  // The temporary Chrome profile is left to the operating system temp cleanup.
});

