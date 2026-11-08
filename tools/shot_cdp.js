// 用 CDP 驱动 headless Edge：加载页面 → 执行一段 JS → 截图
// 用法: node shot_cdp.js <url> <outPng> [jsFile] [waitMs]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2];
const out = process.argv[3];
const jsFile = process.argv[4] || '';
const waitMs = parseInt(process.argv[5] || '900', 10);
const port = 9333 + Math.floor(Math.random() * 200);
const profile = path.join(os.tmpdir(), 'cdp-' + Date.now());

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=1', '--window-size=1180,800',
  '--remote-debugging-port=' + port,
  '--user-data-dir=' + profile,
  url
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/json/list');
      const list = await r.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch (e) { /* 还没起来 */ }
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
      logs.push('EXCEPTION: ' + JSON.stringify(msg.params.exceptionDetails.exception || msg.params.exceptionDetails.text));
    }
  });

  const send = (method, params) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });

  await new Promise((r) => ws.addEventListener('open', r));
  /* 固定视口为 1180x800，避免 headless 窗口装饰影响布局 */
  await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Runtime.enable');
  await send('Page.enable');

  // 等应用启动（boot 在 DOMContentLoaded 后跑）
  await sleep(1200);

  if (jsFile) {
    const src = fs.readFileSync(jsFile, 'utf8');
    const res = await send('Runtime.evaluate', {
      expression: '(function(){try{' + src + '}catch(e){return "ERR: "+e.message}})()',
      returnByValue: true,
      awaitPromise: true
    });
    console.log('eval:', JSON.stringify(res.result && res.result.value));
  }

  await sleep(waitMs);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  if (logs.length) console.log('console:\n  ' + logs.join('\n  '));

  ws.close();
  child.kill();
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  console.log('saved', out);
})().catch((e) => {
  console.error('FAIL', e.message);
  try { child.kill(); } catch (x) { /* 忽略 */ }
  process.exit(1);
});
