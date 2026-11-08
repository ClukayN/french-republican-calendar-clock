// 连接已在运行的 WebView2 / Chromium 调试端口：执行一段 JS，可选截图
// 用法: node cdp_attach.js <port> [jsFile] [outPng] [waitMs]
const fs = require('fs');

const port = parseInt(process.argv[2], 10);
const jsFile = process.argv[3] || '';
const outPng = process.argv[4] || '';
const waitMs = parseInt(process.argv[5] || '400', 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/json/list');
      const list = await r.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch (e) { /* 还没起来 */ }
    await sleep(250);
  }
  throw new Error('devtools not ready on port ' + port);
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
  await send('Runtime.enable');
  await send('Page.enable');

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

  if (outPng) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outPng, Buffer.from(shot.data, 'base64'));
    console.log('saved', outPng);
  }
  if (logs.length) console.log('console:\n  ' + logs.join('\n  '));

  ws.close();
})().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
