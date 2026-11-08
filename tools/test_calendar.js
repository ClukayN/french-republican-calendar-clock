// node test for calendar.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const base = 'D:\\dshWorkspace\\output\\共和历时钟\\src\\www';
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(base, 'calendar.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(base, 'data.js'), 'utf8'), ctx);
const RC = ctx.RC;
RC.setData(ctx.CALENDAR_DATA);

console.log('EPOCH_JDN', RC.EPOCH_JDN);
console.log('greg 1792-09-22 ->', RC.jdnToGreg(RC.gregToJDN(1792, 9, 22)));

function show(y, m, d, rule) {
  const idx = RC.dayFromGreg(y, m, d);
  const r = RC.fromDayIndex(idx, rule);
  const mn = r.month === 13 ? '互补日' : RC.monthInfo(r.month).fr;
  const mnCn = r.month === 13 ? '互补日' : RC.monthInfo(r.month).cn;
  const dn = RC.dayNames(r.month, r.day);
  console.log(
    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}  ${rule.padEnd(7)} => ${r.day} ${mn} an ${RC.roman(r.year)} (${r.year})  ${mnCn}${r.day}日  ${dn.fr}/${dn.cn}  ylen=${r.ylen} leap=${RC.isLeapYear(r.year, rule)}`
  );
  return r;
}

const checks = [
  [1792, 9, 22], [1794, 7, 27], [1799, 11, 9], [1797, 9, 4], [1805, 9, 23],
  [2026, 11, 8], [2026, 9, 22], [2026, 9, 23], [2026, 11, 9], [2027, 9, 22]
];
for (const rule of ['romme', 'equinox']) {
  console.log('---', rule);
  for (const c of checks) show(c[0], c[1], c[2], rule);
}

// 年长一致性
for (const rule of ['romme', 'equinox']) {
  let errs = 0, lens = {};
  for (let Y = 1; Y <= 260; Y++) {
    const len = RC.yearLength(Y, rule);
    lens[len] = (lens[len] || 0) + 1;
    if (len !== 365 && len !== 366) { if (errs < 8) console.log('odd length', rule, Y, len); errs++; }
  }
  console.log(rule, 'year lengths', JSON.stringify(lens), 'odd', errs);
}

// 往返一致性
let bad = 0;
for (let idx = -2000; idx < 100000; idx += 7) {
  for (const rule of ['romme', 'equinox']) {
    const a = RC.fromDayIndex(idx, rule);
    const back = RC.toDayIndex(a.year, a.month, a.day, rule);
    if (back !== idx) { bad++; if (bad < 5) console.log('roundtrip fail', rule, idx, JSON.stringify(a), back); }
  }
}
console.log('roundtrip failures', bad);

// 十进制时间
console.log('decimal at 00:00:00', JSON.stringify(RC.decimalTime(0)));
console.log('decimal at 12:00:00', JSON.stringify(RC.decimalTime(12 * 3600)));
console.log('decimal at 23:59:59.864', JSON.stringify(RC.decimalTime(23 * 3600 + 59 * 60 + 59.864)));

// 秋分日期（巴黎）
for (const gy of [1792, 1805, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028]) {
  const jdn = RC.equinoxParisJDN(gy);
  const g = RC.jdnToGreg(jdn);
  const jde = RC.septemberEquinoxJDE(gy);
  // 巴黎时刻
  const jdParis = jde - RC.deltaT(gy) / 86400 + RC.PARIS_OFFSET_SEC / 86400;
  const frac = jdParis + 0.5 - Math.floor(jdParis + 0.5);
  const hh = Math.floor(frac * 24), mm = Math.floor((frac * 24 - hh) * 60);
  console.log(`equinox ${gy}: Paris date ${g.y}-${String(g.m).padStart(2, '0')}-${String(g.d).padStart(2, '0')} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  dT=${RC.deltaT(gy).toFixed(1)}s`);
}
