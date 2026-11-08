// node test for calendar.js  (v2)
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

function fmt(r) {
  const mn = r.month === 13 ? '互补日' : RC.monthInfo(r.month).fr;
  const mnCn = r.month === 13 ? '互补日' : RC.monthInfo(r.month).cn;
  const dn = RC.dayNames(r.month, r.day);
  const yl = r.year > 0 ? 'an ' + RC.roman(r.year) : '共和前 ' + (1 - r.year) + ' 年';
  return `${r.day} ${mn} (${mnCn}${r.day}日) ${yl}  ${dn.fr}/${dn.cn}`;
}
function show(y, m, d, rule) {
  const idx = RC.dayFromGreg(y, m, d);
  const r = RC.fromDayIndex(idx, rule);
  const g = RC.gregFromDay(idx);
  console.log(`${String(y).padStart(4)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} [${rule.padEnd(7)}] => ${fmt(r)}   ylen=${r.ylen} leap=${RC.isLeapYear(r.year, rule)}  back=${JSON.stringify(g)}`);
  return r;
}

console.log('EPOCH_JDN', RC.EPOCH_JDN, '(expect 2375840 = JD 2375839.5 at 0h)');
console.log('yearStart(15) romme/equinox', RC.yearStart(15, 'romme'), RC.yearStart(15, 'equinox'));
console.log('an XV start date', JSON.stringify(RC.gregFromDay(RC.yearStart(15, 'romme'))));

const checks = [
  [1792, 9, 22], [1793, 9, 22], [1794, 7, 27], [1797, 9, 4], [1799, 11, 9],
  [1805, 9, 23], [1805, 12, 31], [1806, 1, 1], [1806, 9, 23],
  [2026, 11, 8], [2026, 9, 22], [2026, 9, 23], [2024, 2, 29], [1914, 8, 1]
];
for (const rule of ['romme', 'equinox']) {
  console.log('---', rule);
  for (const c of checks) show(c[0], c[1], c[2], rule);
}

for (const rule of ['romme', 'equinox']) {
  let errs = 0, lens = {};
  for (let Y = -50; Y <= 400; Y++) {
    const len = RC.yearLength(Y, rule);
    lens[len] = (lens[len] || 0) + 1;
    if (len !== 365 && len !== 366) { if (errs < 6) console.log('odd length', rule, Y, len); errs++; }
  }
  console.log(rule, 'lengths', JSON.stringify(lens), 'odd', errs);
}

let bad = 0;
for (let idx = -40000; idx < 120000; idx += 3) {
  for (const rule of ['romme', 'equinox']) {
    const a = RC.fromDayIndex(idx, rule);
    const back = RC.toDayIndex(a.year, a.month, a.day, rule);
    if (back !== idx) { bad++; if (bad < 4) console.log('roundtrip fail', rule, idx, JSON.stringify(a), back); }
  }
}
console.log('roundtrip failures', bad);

// 两种规则差异统计（2020-2030）
let diff = {};
for (let idx = RC.dayFromGreg(2020, 1, 1); idx < RC.dayFromGreg(2030, 1, 1); idx++) {
  const a = RC.fromDayIndex(idx, 'romme'), b = RC.fromDayIndex(idx, 'equinox');
  const k = (a.year - b.year) * 400 + (a.month - b.month) * 40 + (a.day - b.day);
  diff[k] = (diff[k] || 0) + 1;
}
console.log('romme-equinox offset histogram 2020-2030', JSON.stringify(diff));

console.log('decimal', JSON.stringify(RC.decimalTime(0)), JSON.stringify(RC.decimalTime(43200)), JSON.stringify(RC.decimalTime(86399.864)));
