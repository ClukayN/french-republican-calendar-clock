// 移动视口截图：node shot_mobile.js <url> <out.png> <w> <h> [jsFile] [waitMs] [dsf] [dark]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2];
const out = process.argv[3];
const W = parseInt(process.argv[4] || '412', 10);
const H = parseInt(process.argv[5] || '915', 10);
const jsFile = process.argv[6] || '';
const waitMs = parseInt(process.argv[7] || '700', 10);
const dsf = parseFloat(process.argv[8] || '2');
const dark = process.argv[9] === 'dark';
const port = 9500 + Math.floor(Math.random() * 300);
const profile = path.join(os.tmpdir(), 'cdpm-' + Date.now());

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=' + port,
  '--user-data-dir=' + profile,
  url
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/json/list');
      const list = await r.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch (e) { /* not ready */ }
    await sleep(200);
  }
  throw new Error('devtools not ready');
}

(async () => {
  const target = await getTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const logs = [];

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      logs.push(msg.params.type + ': ' + msg.params.args.map((a) => a.value).join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      logs.push('EXCEPTION: ' + ((d.exception && (d.exception.description || d.exception.value)) || d.text));
    }
  });

  const send = (method, params) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });

  await new Promise((r) => ws.addEventListener('open', r));
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: dsf, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  if (dark) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await send('Runtime.enable');
  await send('Page.enable');
  await sleep(1200);

  if (jsFile) {
    const src = fs.readFileSync(jsFile, 'utf8');
    const res = await send('Runtime.evaluate', {
      expression: '(function(){try{' + src + '}catch(e){return "ERR: " + e.message}})()',
      returnByValue: true,
      awaitPromise: true
    });
    console.log('eval:', JSON.stringify(res.result && res.result.value));
    if (!res.result || res.result.value === undefined) {
      console.log('eval raw:', JSON.stringify(res).slice(0, 600));
    }
  }

  await sleep(waitMs);

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  if (logs.length) console.log('console:\n  ' + logs.join('\n  '));

  ws.close();
  child.kill();
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  console.log('saved', out);
})().catch((e) => {
  console.error('FAIL', e.message);
  try { child.kill(); } catch (x) { /* ignore */ }
  process.exit(1);
});
