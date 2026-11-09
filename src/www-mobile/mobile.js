/* =========================================================================
   法国共和历 · 移动端
   四页分页（钟 / 日历 / 换算 / 设置）+ 底部导航 + 左右滑动
   历法核心来自 calendar.js（window.RC），物产数据来自 data.js
   ========================================================================= */
(function () {
  'use strict';

  var RC = window.RC;
  var DATA = window.CALENDAR_DATA;
  RC.setData(DATA);

  var SVGNS = 'http://www.w3.org/2000/svg';
  var CX = 240, CY = 240;

  var WEEKDAYS = ['Primidi', 'Duodi', 'Tridi', 'Quartidi', 'Quintidi', 'Sextidi',
    'Septidi', 'Octidi', 'Nonidi', 'Décadi'];
  var WEEKDAYS_CN = ['一日', '二日', '三日', '四日', '五日', '六日', '七日', '八日', '九日', '十日'];
  var GREG_WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  var CN_DIGIT = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var FR_MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet',
    'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  /* ── 设置 ─────────────────────────────────────────────── */
  var DEFAULTS = { rule: 'romme', tz: 'local', theme: 'auto', fmt: 'both' };
  var S = Object.assign({}, DEFAULTS);
  var STORE_KEY = 'rc.settings.v1';

  function loadSettings() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        Object.keys(DEFAULTS).forEach(function (k) {
          if (o[k] !== undefined) S[k] = o[k];
        });
      }
    } catch (e) { /* 忽略 */ }
  }
  function saveSettings() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* 忽略 */ }
  }

  /* ── 工具 ─────────────────────────────────────────────── */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function cnNumber(n) {
    if (!isFinite(n)) return String(n);
    n = Math.trunc(n);
    if (n === 0) return '〇';
    if (n < 0) return '负' + cnNumber(-n);
    if (n > 9999) {
      return String(n).split('').map(function (c) { return CN_DIGIT[+c]; }).join('');
    }
    var units = ['', '十', '百', '千'];
    var digits = String(n).split('').map(Number);
    var out = '';
    var zero = false;
    for (var i = 0; i < digits.length; i++) {
      var d = digits[i];
      var u = units[digits.length - 1 - i];
      if (d === 0) { zero = true; continue; }
      if (zero && out) out += '〇';
      zero = false;
      out += (d === 1 && u === '十' && i === 0 ? '' : CN_DIGIT[d]) + u;
    }
    return out;
  }

  var LOCAL_TZ = (function () {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '本地'; }
    catch (e) { return '本地'; }
  })();

  var PARIS = RC.PARIS_OFFSET_SEC;

  /* 返回 { greg:{y,m,d}, sec: 当日秒, dayIndex } */
  function nowParts() {
    var now = new Date();
    var y, mo, d, h, mi, s;
    if (S.tz === 'paris') {
      var p = new Date(now.getTime() + PARIS * 1000);
      y = p.getUTCFullYear(); mo = p.getUTCMonth(); d = p.getUTCDate();
      h = p.getUTCHours(); mi = p.getUTCMinutes(); s = p.getUTCSeconds();
    } else {
      y = now.getFullYear(); mo = now.getMonth(); d = now.getDate();
      h = now.getHours(); mi = now.getMinutes(); s = now.getSeconds();
    }
    var ms = now.getMilliseconds();
    var sec = h * 3600 + mi * 60 + s + ms / 1000;
    return {
      greg: { y: y, m: mo + 1, d: d },
      sec: sec,
      dayIndex: RC.dayFromGreg(y, mo + 1, d)
    };
  }

  function repOf(dayIndex) {
    var r = RC.fromDayIndex(dayIndex, S.rule);
    var weekday = r.month >= 13 ? -1 : (r.day - 1) % 10;
    return {
      year: r.year, month: r.month, day: r.day, comp: r.comp, ylen: r.ylen,
      weekday: weekday,
      info: RC.dayDedication(r.month, r.day)
    };
  }

  /* ── SVG 辅助 ─────────────────────────────────────────── */
  function el(name, attrs, parent) {
    var e = document.createElementNS(SVGNS, name);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function pt(r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  }
  function seg(deg, r1, r2) {
    var p1 = pt(r1, deg), p2 = pt(r2, deg);
    return 'M' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) +
      'L' + p2[0].toFixed(2) + ' ' + p2[1].toFixed(2);
  }
  function ticksPath(r1, r2, stepDeg) {
    var d = '';
    for (var deg = 0; deg < 360 - 1e-9; deg += stepDeg) d += seg(deg, r1, r2);
    return d;
  }
  function handPath(len, halfW, tailLen, tailW) {
    return 'M' + (-halfW) + ' ' + tailLen +
      'L0 ' + (-len) +
      'L' + halfW + ' ' + tailLen +
      'L0 ' + (tailLen - (tailW || 8)) + 'Z';
  }

  var dial = { h24: null, decM: null, sec: null };

  function buildDial() {
    var host = document.getElementById('dialHost');
    host.innerHTML = '';
    var root = el('svg', { viewBox: '0 0 480 480', class: 'dial', role: 'img', 'aria-label': '双轨表盘' }, host);

    var defs = el('defs', null, root);
    var gFace = el('radialGradient', { id: 'faceGrad', cx: '42%', cy: '34%', r: '78%' }, defs);
    el('stop', { offset: '0%', 'stop-color': 'var(--dial-face-a)' }, gFace);
    el('stop', { offset: '72%', 'stop-color': 'var(--dial-face-b)' }, gFace);
    el('stop', { offset: '100%', 'stop-color': 'var(--dial-face-b)', 'stop-opacity': '.96' }, gFace);
    var gBezel = el('linearGradient', { id: 'bezelGrad', x1: '0', y1: '0', x2: '1', y2: '1' }, defs);
    el('stop', { offset: '0%', 'stop-color': 'var(--dial-rim)', 'stop-opacity': '.85' }, gBezel);
    el('stop', { offset: '45%', 'stop-color': 'var(--dial-rim)', 'stop-opacity': '.25' }, gBezel);
    el('stop', { offset: '100%', 'stop-color': 'var(--dial-rim)', 'stop-opacity': '.75' }, gBezel);

    el('circle', { cx: CX, cy: CY, r: 236, fill: 'none', stroke: 'var(--dial-rim)', 'stroke-width': '.8', opacity: '.35' }, root);
    el('circle', { cx: CX, cy: CY, r: 229, fill: 'url(#faceGrad)' }, root);
    el('circle', { cx: CX, cy: CY, r: 229, fill: 'none', stroke: 'url(#bezelGrad)', 'stroke-width': '5' }, root);
    el('circle', { cx: CX, cy: CY, r: 223, fill: 'none', stroke: 'var(--dial-rim)', 'stroke-width': '.7', opacity: '.5' }, root);

    el('path', {
      d: ticksPath(200, 208, 3.75), stroke: 'var(--dial-mute)', 'stroke-width': '.7',
      'stroke-linecap': 'round', opacity: '.55', fill: 'none'
    }, root);
    el('path', {
      d: ticksPath(195, 211, 15), stroke: 'var(--dial-ink)', 'stroke-width': '1.5',
      'stroke-linecap': 'round', fill: 'none'
    }, root);

    for (var i = 1; i <= 24; i++) {
      var p = pt(181, i * 15);
      el('text', {
        x: p[0].toFixed(2), y: p[1].toFixed(2), class: 'num roman',
        'text-anchor': 'middle', 'dominant-baseline': 'central'
      }, root).textContent = RC.roman(i);
    }

    el('circle', { cx: CX, cy: CY, r: 166, fill: 'none', stroke: 'var(--dial-rim)', 'stroke-width': '.6', opacity: '.35' }, root);
    el('circle', {
      cx: CX, cy: CY, r: 96, fill: 'none', stroke: 'var(--dial-mute)',
      'stroke-width': '.55', 'stroke-dasharray': '1 2.4', opacity: '.3'
    }, root);
    el('circle', { cx: CX, cy: CY, r: 84, fill: 'none', stroke: 'var(--dial-rim)', 'stroke-width': '.45', opacity: '.26' }, root);

    var minor = '', medium = '', major = '';
    for (var k = 0; k < 1000; k++) {
      var deg = k * 0.36;
      if (k % 100 === 0) major += seg(deg, 134, 152);
      else if (k % 10 === 0) medium += seg(deg, 137, 147);
      else minor += seg(deg, 140, 144);
    }
    el('path', { d: minor, stroke: 'var(--dial-mute)', 'stroke-width': '.32', opacity: '.22', fill: 'none' }, root);
    el('path', { d: medium, stroke: 'var(--dial-mute)', 'stroke-width': '.6', opacity: '.62', fill: 'none' }, root);
    el('path', { d: major, stroke: 'var(--dial-accent)', 'stroke-width': '1.1', opacity: '.85', fill: 'none' }, root);

    for (var j = 0; j <= 9; j++) {
      var q = pt(115, j * 36);
      el('text', {
        x: q[0].toFixed(2), y: q[1].toFixed(2), class: 'num arab',
        'text-anchor': 'middle', 'dominant-baseline': 'central'
      }, root).textContent = String(j);
    }

    el('circle', { cx: CX, cy: CY, r: 55, fill: 'var(--dial-face-a)', stroke: 'var(--dial-rim)', 'stroke-width': '.8', opacity: '.95' }, root);
    el('path', { d: ticksPath(44, 50, 3.6), stroke: 'var(--dial-mute)', 'stroke-width': '.5', opacity: '.5', fill: 'none' }, root);
    el('path', {
      d: ticksPath(40, 50, 36), stroke: 'var(--dial-ink)', 'stroke-width': '1.05',
      'stroke-linecap': 'round', fill: 'none', opacity: '.85'
    }, root);

    dial.h24 = el('g', { class: 'hand-24h' }, root);
    el('path', { d: handPath(176, 4.6, 18, 13) }, dial.h24);
    dial.decM = el('g', { class: 'hand-decmin' }, root);
    el('path', { d: handPath(150, 1.7, 14, 9) }, dial.decM);
    dial.sec = el('g', { class: 'hand-sec' }, root);
    el('path', { d: 'M-1.1 10 L0 -45 L1.1 10 Z' }, dial.sec);

    el('circle', { cx: CX, cy: CY, r: 7.4, class: 'hub' }, root);
    el('circle', { cx: CX, cy: CY, r: 3.2, class: 'hub-cap' }, root);
  }

  /* ── DOM ──────────────────────────────────────────────── */
  var dom = {};
  ['dh', 'dm', 'ds', 'stdClock', 'btn24', 'scaleNote', 'ruleBadge',
    'tsMonth', 'tsDay', 'tsYear', 'tsGreg',
    'mtCn', 'mtFr', 'mtYear', 'btnPrevYear', 'btnPrevMonth', 'btnNextMonth', 'btnNextYear',
    'btnYearPick', 'decades', 'plateDoy', 'plateDecade', 'plateMonth', 'plateMonthCn',
    'plateYear', 'plateYearCn', 'plateGreg', 'plateNote',
    'dediCat', 'dediMode', 'dediFr', 'dediCn', 'dediDesc',
    'inGY', 'inGM', 'inGD', 'outRep', 'inRY', 'inRM', 'inRD', 'outGreg',
    'ybCount', 'ybFill', 'ybMark', 'ybStart', 'ybEnd',
    'tzSeg', 'themeSeg', 'fmtSeg', 'tzNote', 'ruleCards',
    'yearSheet', 'sheetScrim', 'yearMode', 'repRow', 'yearIn', 'monthInRep',
    'gregRow', 'gregYearIn', 'gregMonthIn', 'yearPreview', 'yearQuick', 'yearGo',
    'tabbar', 'pager'].forEach(function (id) {
      dom[id] = document.getElementById(id);
    });

  var view = { year: 1, month: 1 };
  var selection = null;
  var lastKeys = {};

  /* ── 时钟渲染 ─────────────────────────────────────────── */
  function setText(node, txt) {
    if (node && node.textContent !== txt) node.textContent = txt;
  }

  function renderClock(parts) {
    var dt = RC.decimalTime(parts.sec);
    setText(dom.dh, pad2(dt.h));
    setText(dom.dm, pad2(dt.m));
    setText(dom.ds, pad2(Math.floor(dt.s)));

    if (S.fmt === 'dec') {
      setText(dom.stdClock, '24 时');
    } else {
      var hh = Math.floor(parts.sec / 3600);
      var mm = Math.floor((parts.sec % 3600) / 60);
      var ss = Math.floor(parts.sec % 60);
      setText(dom.stdClock, pad2(hh) + ':' + pad2(mm) + ':' + pad2(ss));
    }

    var a24 = (parts.sec / 86400) * 360;
    var aDecM = ((parts.sec / 86.4) % 100) * 3.6;
    var aSec = (((parts.sec / 0.864) % 100)) * 3.6;

    if (dial.h24) dial.h24.setAttribute('transform', 'translate(' + CX + ',' + CY + ') rotate(' + a24.toFixed(3) + ')');
    if (dial.decM) dial.decM.setAttribute('transform', 'translate(' + CX + ',' + CY + ') rotate(' + aDecM.toFixed(3) + ')');
    if (dial.sec) dial.sec.setAttribute('transform', 'translate(' + CX + ',' + CY + ') rotate(' + aSec.toFixed(3) + ')');
  }

  function monthLabel(month) {
    if (month >= 13) return { cn: '补充日', fr: 'Sansculottides' };
    var mi = DATA.months[month - 1];
    return { cn: mi.cn, fr: mi.fr };
  }

  /* ── 今日条 / 日期牌 ─────────────────────────────────── */
  function renderToday(parts, idx) {
    var r = repOf(idx);
    var ml = monthLabel(r.month);
    setText(dom.tsMonth, ml.cn);
    setText(dom.tsDay, r.month >= 13 ? String(r.day) : String(r.day));
    setText(dom.tsYear, 'AN ' + RC.roman(r.year));
    setText(dom.tsGreg, parts.greg.y + ' 年 ' + parts.greg.m + ' 月 ' + parts.greg.d + ' 日 · ' +
      GREG_WEEK[new Date(parts.greg.y, parts.greg.m - 1, parts.greg.d).getDay()]);
  }

  function renderPlate(r, greg, idx) {
    var isComp = r.month >= 13;
    var ml = monthLabel(r.month);

    setText(dom.plateDoy, isComp ? ('第 ' + r.day + ' 补充日') : ('第 ' + r.day + ' 日'));
    setText(dom.plateDecade, isComp ? '岁末 · Sansculottides'
      : ('第' + cnNumber(Math.floor((r.day - 1) / 10) + 1) + '旬 · ' + WEEKDAYS[r.weekday]));
    setText(dom.plateMonth, ml.fr);
    setText(dom.plateMonthCn, ml.cn);
    setText(dom.plateYear, 'AN ' + RC.roman(r.year));
    setText(dom.plateYearCn, '共和' + cnNumber(r.year) + '年');
    setText(dom.plateGreg, greg.y + ' 年 ' + greg.m + ' 月 ' + greg.d + ' 日 · ' + weekdayOf(greg));
    setText(dom.plateNote, isComp ? '补充日 · 共和历的岁末节日'
      : (DATA.months[r.month - 1].season + ' · ' + DATA.months[r.month - 1].note));

    var info = r.info;
    if (info) {
      setText(dom.dediCat, info.cat || '物产');
      setText(dom.dediMode, r.month >= 13 ? '岁末节日' : '当日物产');
      setText(dom.dediFr, info.fr);
      setText(dom.dediCn, info.cn);
      setText(dom.dediDesc, info.desc || '');
    }
  }

  function weekdayOf(greg) {
    return GREG_WEEK[new Date(greg.y, greg.m - 1, greg.d).getDay()];
  }

  /* ── 月历 ─────────────────────────────────────────────── */
  function renderMonth() {
    var y = view.year, m = view.month;
    var todayIdx = RC.dayFromGreg(nowParts().greg.y, nowParts().greg.m, nowParts().greg.d);

    var label = monthLabel(m);
    setText(dom.mtCn, label.cn);
    setText(dom.mtFr, label.fr);
    setText(dom.mtYear, repYearLabel(y));

    var base = RC.toDayIndex(y, m, 1, S.rule);
    var isComp = m >= 13;

    var html = '';
    if (!isComp) {
      for (var dcd = 0; dcd < 3; dcd++) {
        html += '<div class="decade"><div class="decade-label"><b>第' + cnNumber(dcd + 1) + '旬</b>DÉCADE ' + RC.roman(dcd + 1) + '</div>';
        for (var i = 0; i < 10; i++) {
          var dayNo = dcd * 10 + i + 1;
          var didx = base + dayNo - 1;
          html += dayCell(dayNo, didx, todayIdx, false);
        }
        html += '</div>';
      }
    } else {
      var len = RC.yearLength(y, S.rule) - 360;
      html += '<div class="decade comp" style="grid-template-columns:30px repeat(' + Math.max(len, 1) + ',minmax(0,1fr))">' +
        '<div class="decade-label"><b>岁末</b>SANS.</div>';
      for (var c = 1; c <= len; c++) {
        html += dayCell(c, base + c - 1, todayIdx, true);
      }
      html += '</div>';
    }
    dom.decades.innerHTML = html;

    var sel = selection === null ? todayIdx : selection;
    renderPlate(repOf(sel), RC.gregFromDay(sel), sel);
  }

  function dayCell(dayNo, idx, todayIdx, isComp) {
    var r = RC.fromDayIndex(idx, S.rule);
    var info = RC.dayDedication(r.month, r.day);
    var nm = info ? info.cn : '';
    var cls = 'day' + (isComp ? ' comp' : '');
    if (idx === todayIdx) cls += ' today';
    if (selection !== null && idx === selection) cls += ' selected';
    return '<button type="button" class="' + cls + '" data-i="' + idx + '" title="' + dayNo + ' ' +
      (info ? info.fr : '') + '">' +
      '<span class="dn">' + dayNo + '</span>' +
      '<span class="dd">' + nm + '</span>' +
      '</button>';
  }

  function selectDay(idx) {
    var todayIdx = RC.dayFromGreg(nowParts().greg.y, nowParts().greg.m, nowParts().greg.d);
    selection = (idx === todayIdx) ? null : idx;
    renderMonth();
  }

  /* ── 年份 ─────────────────────────────────────────────── */
  function repYearLabel(y) {
    return y > 0 ? ('AN ' + RC.roman(y)) : ('前' + cnNumber(1 - y) + '年');
  }

  function setView(y, m) {
    if (!isFinite(y)) y = 1;
    view.year = Math.max(-9999, Math.min(9999, Math.trunc(y)));
    view.month = Math.max(1, Math.min(13, Math.trunc(m)));
    renderMonth();
    syncYearInputs();
  }

  function shiftMonth(dir) {
    var m = view.month + dir, y = view.year;
    if (m < 1) { m = 13; y -= 1; }
    if (m > 13) { m = 1; y += 1; }
    setView(y, m);
  }
  function shiftYear(dir) { setView(view.year + dir, view.month); }

  function clampInt(v, lo, hi, fb) {
    v = parseInt(v, 10);
    if (!isFinite(v)) return fb;
    return Math.max(lo, Math.min(hi, v));
  }

  /* 该公历月多数日子所属的共和月 */
  function repMonthOfGregYear(y, m) {
    var d = 15;
    var maxD = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (d > maxD) d = maxD;
    return RC.fromDayIndex(RC.dayFromGreg(y, m, d), S.rule);
  }

  function fillYearSelects() {
    if (dom.monthInRep.options.length === 0) {
      var f = document.createDocumentFragment();
      for (var i = 1; i <= 12; i++) {
        var mi = DATA.months[i - 1];
        var o = document.createElement('option');
        o.value = String(i);
        o.textContent = mi.cn + ' · ' + mi.fr;
        f.appendChild(o);
      }
      var o13 = document.createElement('option');
      o13.value = '13';
      o13.textContent = '补充日 · Sansculottides';
      f.appendChild(o13);
      dom.monthInRep.appendChild(f);
    }
    if (dom.gregMonthIn.options.length === 0) {
      var g = document.createDocumentFragment();
      for (var j = 1; j <= 12; j++) {
        var og = document.createElement('option');
        og.value = String(j);
        og.textContent = j + ' 月 · ' + FR_MONTHS[j - 1];
        g.appendChild(og);
      }
      dom.gregMonthIn.appendChild(g);
    }
  }

  function syncYearInputs() {
    fillYearSelects();
    dom.yearIn.value = String(view.year);
    dom.monthInRep.value = String(view.month);
    var g = RC.gregFromDay(RC.toDayIndex(view.year, view.month, 1, S.rule));
    dom.gregYearIn.value = String(g.y);
    dom.gregMonthIn.value = String(g.m);
    updateYearPreview();
  }

  var yearMode = 'rep';

  function modeYearValue() {
    return yearMode === 'rep'
      ? clampInt(dom.yearIn.value, -9999, 9999, view.year)
      : clampInt(dom.gregYearIn.value, 1, 9999, 2000);
  }

  function targetOfInputs() {
    var y, m, out;
    if (yearMode === 'rep') {
      y = clampInt(dom.yearIn.value, -9999, 9999, view.year);
      m = clampInt(dom.monthInRep.value, 1, 13, 1);
      var g = RC.gregFromDay(RC.toDayIndex(y, m, 1, S.rule));
      out = { year: y, month: m, gregText: g.y + '-' + pad2(g.m) };
    } else {
      var gy = clampInt(dom.gregYearIn.value, 1, 9999, 2000);
      var gm = clampInt(dom.gregMonthIn.value, 1, 12, 1);
      var r = repMonthOfGregYear(gy, gm);
      out = { year: r.year, month: r.month, gregText: gy + '-' + pad2(gm) };
    }
    out.label = out.gregText + ' → ' + monthLabel(out.month).cn + ' ' + repYearLabel(out.year);
    return out;
  }

  function updateYearPreview() {
    if (!dom.yearPreview) return;
    var t = targetOfInputs();
    dom.yearPreview.textContent = t.label;
  }

  function setYearMode(mode) {
    yearMode = mode === 'greg' ? 'greg' : 'rep';
    Array.prototype.forEach.call(dom.yearMode.querySelectorAll('button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-v') === yearMode);
    });
    dom.repRow.hidden = yearMode !== 'rep';
    dom.gregRow.hidden = yearMode !== 'greg';
    syncYearInputs();
    var inp = yearMode === 'rep' ? dom.yearIn : dom.gregYearIn;
    setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) { } }, 60);
  }

  function openYearPop() {
    fillYearSelects();
    dom.yearSheet.hidden = false;
    dom.sheetScrim.hidden = false;
    requestAnimationFrame(function () {
      dom.yearSheet.classList.add('open');
      dom.sheetScrim.classList.add('show');
    });
    setYearMode('rep');
  }

  function closeYearPop() {
    dom.yearSheet.classList.remove('open');
    dom.sheetScrim.classList.remove('show');
    setTimeout(function () {
      dom.yearSheet.hidden = true;
      dom.sheetScrim.hidden = true;
    }, 280);
  }

  function applyYearJump() {
    var t = targetOfInputs();
    setView(t.year, t.month);
    closeYearPop();
  }

  function initYearNav() {
    dom.btnPrevMonth.addEventListener('click', function () { shiftMonth(-1); });
    dom.btnNextMonth.addEventListener('click', function () { shiftMonth(1); });
    dom.btnPrevYear.addEventListener('click', function () { shiftYear(-1); });
    dom.btnNextYear.addEventListener('click', function () { shiftYear(1); });
    dom.btnYearPick.addEventListener('click', function (e) { e.stopPropagation(); openYearPop(); });
    dom.sheetScrim.addEventListener('click', closeYearPop);
    dom.yearGo.addEventListener('click', applyYearJump);

    Array.prototype.forEach.call(dom.yearMode.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { setYearMode(b.getAttribute('data-v')); });
    });

    [dom.yearIn, dom.gregYearIn].forEach(function (inp) {
      inp.addEventListener('input', updateYearPreview);
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); applyYearJump(); }
        if (e.key === 'Escape') closeYearPop();
      });
    });
    [dom.monthInRep, dom.gregMonthIn].forEach(function (sel) {
      sel.addEventListener('change', updateYearPreview);
    });

    Array.prototype.forEach.call(dom.yearQuick.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        var d = parseInt(b.getAttribute('data-d'), 10);
        if (yearMode === 'rep') {
          var y = clampInt(dom.yearIn.value, -9999, 9999, view.year);
          dom.yearIn.value = String(clampInt(y + d, -9999, 9999, y));
        } else {
          var gy = clampInt(dom.gregYearIn.value, 1, 9999, 2000);
          dom.gregYearIn.value = String(clampInt(gy + d, 1, 9999, gy));
        }
        updateYearPreview();
      });
    });

    dom.decades.addEventListener('click', function (e) {
      var btn = e.target.closest('.day');
      if (!btn) return;
      selectDay(parseInt(btn.getAttribute('data-i'), 10));
    });
  }

  /* ── 换算 ─────────────────────────────────────────────── */
  var refreshConverter = null;

  function initConverter() {
    var f = document.createDocumentFragment();
    for (var i = 1; i <= 12; i++) {
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = i + ' 月';
      f.appendChild(o);
    }
    dom.inGM.appendChild(f);

    var f2 = document.createDocumentFragment();
    for (var m = 1; m <= 12; m++) {
      var om = document.createElement('option');
      om.value = String(m);
      om.textContent = DATA.months[m - 1].cn + ' · ' + DATA.months[m - 1].fr;
      f2.appendChild(om);
    }
    var om13 = document.createElement('option');
    om13.value = '13';
    om13.textContent = '补充日 · Sansculottides';
    f2.appendChild(om13);
    dom.inRM.appendChild(f2);

    function fillRDays() {
      var y = parseInt(dom.inRY.value, 10);
      if (!isFinite(y)) y = 1;
      var m = parseInt(dom.inRM.value, 10) || 1;
      var len = m >= 13 ? (RC.yearLength(y, S.rule) - 360) : 30;
      var keep = parseInt(dom.inRD.value, 10) || 1;
      dom.inRD.innerHTML = '';
      for (var d = 1; d <= len; d++) {
        var o = document.createElement('option');
        o.value = String(d);
        o.textContent = d + ' 日';
        dom.inRD.appendChild(o);
      }
      dom.inRD.value = String(Math.min(keep, len));
    }

    function gToR() {
      var y = parseInt(dom.inGY.value, 10);
      var mo = parseInt(dom.inGM.value, 10);
      var d = parseInt(dom.inGD.value, 10);
      var out = dom.outRep;
      if (!isFinite(y) || !isFinite(mo) || !isFinite(d)) { out.textContent = '日期无效'; return; }
      var probe = new Date(Date.UTC(y, mo - 1, d));
      if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
        out.textContent = '日期无效';
        return;
      }
      var idx = RC.dayFromGreg(y, mo, d);
      var r = RC.fromDayIndex(idx, S.rule);
      var ml = monthLabel(r.month);
      var label = r.month >= 13
        ? (r.day + ' 补充日 an ' + RC.roman(r.year))
        : (r.day + ' ' + DATA.months[r.month - 1].fr + ' an ' + RC.roman(r.year));
      out.textContent = label + ' ／ ' + ml.cn + r.day + '日';
      var dd = RC.dayDedication(r.month, r.day);
      if (dd) {
        var item = document.createElement('span');
        item.className = 'conv-item';
        item.textContent = ' · ' + dd.cn + ' · ' + dd.fr;
        out.appendChild(item);
      }
    }

    function rToG() {
      var y = parseInt(dom.inRY.value, 10);
      var m = parseInt(dom.inRM.value, 10);
      var d = parseInt(dom.inRD.value, 10);
      if (!isFinite(y) || !isFinite(m) || !isFinite(d)) { dom.outGreg.textContent = '日期无效'; return; }
      var g = RC.gregFromDay(RC.toDayIndex(y, m, d, S.rule));
      dom.outGreg.textContent = g.y + ' 年 ' + g.m + ' 月 ' + g.d + ' 日';
    }

    [dom.inGY, dom.inGD].forEach(function (i) { i.addEventListener('input', gToR); });
    dom.inGM.addEventListener('change', gToR);
    dom.inRY.addEventListener('input', function () { fillRDays(); rToG(); });
    dom.inRM.addEventListener('change', function () { fillRDays(); rToG(); });
    dom.inRD.addEventListener('change', rToG);

    refreshConverter = function () {
      var keep = parseInt(dom.inRD.value, 10) || 1;
      var y = parseInt(dom.inRY.value, 10) || 1;
      var m = parseInt(dom.inRM.value, 10) || 1;
      var len = m >= 13 ? (RC.yearLength(y, S.rule) - 360) : 30;
      while (dom.inRD.options.length > len) dom.inRD.remove(dom.inRD.options.length - 1);
      while (dom.inRD.options.length < len) {
        var o = document.createElement('option');
        o.value = String(dom.inRD.options.length + 1);
        o.textContent = (dom.inRD.options.length + 1) + ' 日';
        dom.inRD.appendChild(o);
      }
      dom.inRD.value = String(Math.min(keep, len));
      gToR();
      rToG();
    };

    fillRDays();
    gToR();
    rToG();
  }

  function renderYearBar() {
    var parts = nowParts();
    var idx = parts.dayIndex;
    var r = repOf(idx);
    var ys = RC.toDayIndex(r.year, 1, 1, S.rule);
    var yl = RC.yearLength(r.year, S.rule);
    var doy = idx - ys + 1;
    var pct = ((doy - 1) / yl) * 100;
    setText(dom.ybCount, '第 ' + doy + ' / ' + yl + ' 日');
    dom.ybFill.style.width = pct.toFixed(2) + '%';
    dom.ybMark.style.left = pct.toFixed(2) + '%';
    var a = RC.gregFromDay(ys), b = RC.gregFromDay(ys + yl - 1);
    setText(dom.ybStart, a.y + ' 年 ' + a.m + ' 月 ' + a.d + ' 日');
    setText(dom.ybEnd, b.y + ' 年 ' + b.m + ' 月 ' + b.d + ' 日');
  }

  /* ── 设置 ─────────────────────────────────────────────── */
  /* 原生宿主会把状态栏/导航栏高度告诉我们（edge-to-edge 时环境变量拿不到） */
  function applyInsets() {
    try {
      if (!window.AndroidHost || !window.AndroidHost.edgeToEdge) return;
      var sb = window.AndroidHost.statusBarHeight();
      var nb = window.AndroidHost.navBarHeight();
      document.documentElement.style.setProperty('--sb', sb + 'px');
      document.documentElement.style.setProperty('--nb', nb + 'px');
    } catch (e) { /* 浏览器里忽略 */ }
  }

  function applyTheme() {
    var t = S.theme;
    if (t === 'auto') {
      t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', t);
    // 让原生状态栏/导航栏跟着网页主题走（系统暗色 ≠ 应用暗色）
    try {
      if (window.AndroidHost && window.AndroidHost.setTheme) window.AndroidHost.setTheme(t);
    } catch (e) { /* 桌面浏览器里没有宿主 */ }
  }

  function setSeg(id, val) {
    Array.prototype.forEach.call(document.querySelectorAll('#' + id + ' button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-v') === val);
    });
  }

  function syncSettingsUI() {
    Array.prototype.forEach.call(document.querySelectorAll('#ruleCards input'), function (i) {
      i.checked = (i.value === S.rule);
    });
    setSeg('tzSeg', S.tz);
    setSeg('themeSeg', S.theme);
    setSeg('fmtSeg', S.fmt);

    setText(dom.ruleBadge, S.rule === 'romme' ? '定长规则 · 罗姆' : '秋分精确法');
    setText(dom.tzNote, S.tz === 'paris'
      ? '以巴黎子午线平太阳时零时为共和历 0 时。'
      : '以本机当地零时为共和历 0 时。');

    dom.btn24.classList.toggle('off', S.fmt === 'dec');
    dom.btn24.title = S.fmt === 'dec' ? '显示 24 小时制' : '隐藏 24 小时制';
  }

  function segHandler(id, cb) {
    var box = document.getElementById(id);
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { cb(b.getAttribute('data-v')); });
    });
  }

  function initSettings() {
    Array.prototype.forEach.call(document.querySelectorAll('#ruleCards input'), function (i) {
      i.addEventListener('change', function () {
        if (!i.checked) return;
        S.rule = i.value;
        saveSettings();
        syncSettingsUI();
        refreshAll();
      });
    });
    segHandler('tzSeg', function (v) { S.tz = v; saveSettings(); syncSettingsUI(); refreshAll(); });
    segHandler('themeSeg', function (v) { S.theme = v; saveSettings(); applyTheme(); syncSettingsUI(); });
    segHandler('fmtSeg', function (v) { S.fmt = v; saveSettings(); syncSettingsUI(); });

    dom.btn24.addEventListener('click', function () {
      S.fmt = S.fmt === 'dec' ? 'both' : 'dec';
      saveSettings();
      syncSettingsUI();
    });

    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChg = function () { if (S.theme === 'auto') applyTheme(); };
      if (mq.addEventListener) mq.addEventListener('change', onChg);
      else if (mq.addListener) mq.addListener(onChg);
    }
  }

  /* ── 分页 ─────────────────────────────────────────────── */
  var PAGE_COUNT = 4;
  var pageIdx = 0;
  var pager = dom.pager;

  function applyPager(offsetPct, animate) {
    pager.classList.toggle('animate', !!animate);
    pager.style.transform = 'translate3d(' + offsetPct + '%,0,0)';
  }

  function setPage(i, animate) {
    pageIdx = Math.max(0, Math.min(PAGE_COUNT - 1, i));
    applyPager(-pageIdx * 25, animate !== false);
    Array.prototype.forEach.call(dom.tabbar.querySelectorAll('.tab'), function (t, k) {
      t.classList.toggle('on', k === pageIdx);
    });
    var pages = pager.querySelectorAll('.page');
    if (pages[pageIdx]) pages[pageIdx].scrollTop = pages[pageIdx].scrollTop; /* 保留滚动位置 */
  }

  function initPager() {
    dom.tabbar.addEventListener('click', function (e) {
      var t = e.target.closest('.tab');
      if (!t) return;
      setPage(parseInt(t.getAttribute('data-i'), 10), true);
    });

    var startX = 0, startY = 0, dx = 0, dragging = false, decided = false, active = false;

    function vw() { return window.innerWidth || 360; }

    pager.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { active = false; return; }
      if (dom.yearSheet && !dom.yearSheet.hidden) { active = false; return; }
      active = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dx = 0; dragging = false; decided = false;
      pager.classList.remove('animate');
    }, { passive: true });

    pager.addEventListener('touchmove', function (e) {
      if (!active) return;
      var t = e.touches[0];
      var mx = t.clientX - startX;
      var my = t.clientY - startY;
      if (!decided) {
        if (Math.abs(mx) > Math.abs(my) + 6) { decided = true; dragging = true; }
        else if (Math.abs(my) > 10) { decided = true; dragging = false; }
        else return;
      }
      if (!dragging) return;
      e.preventDefault();
      dx = mx;
      if ((pageIdx === 0 && dx > 0) || (pageIdx === PAGE_COUNT - 1 && dx < 0)) dx *= 0.34;
      var pct = (-pageIdx * 25) + (dx / vw()) * 25;
      pager.style.transform = 'translate3d(' + pct + '%,0,0)';
    }, { passive: false });

    function endDrag() {
      if (!active) return;
      active = false;
      if (!dragging) { applyPager(-pageIdx * 25, true); return; }
      var threshold = vw() * 0.18;
      var next = pageIdx;
      if (dx < -threshold && pageIdx < PAGE_COUNT - 1) next = pageIdx + 1;
      else if (dx > threshold && pageIdx > 0) next = pageIdx - 1;
      dragging = false;
      setPage(next, true);
    }

    pager.addEventListener('touchend', endDrag, { passive: true });
    pager.addEventListener('touchcancel', endDrag, { passive: true });

    document.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') { if (pageIdx > 0) setPage(pageIdx - 1); }
      if (e.key === 'ArrowRight') { if (pageIdx < PAGE_COUNT - 1) setPage(pageIdx + 1); }
      if (e.key === 'Escape' && dom.yearSheet && !dom.yearSheet.hidden) closeYearPop();
    });
  }

  /* ── 主循环 ───────────────────────────────────────────── */
  var lastDayKey = null;

  function tick() {
    var parts = nowParts();
    renderClock(parts);

    var dayKey = parts.greg.y + '-' + parts.greg.m + '-' + parts.greg.d + '-' + S.rule + '-' + S.tz;
    if (dayKey !== lastDayKey) {
      lastDayKey = dayKey;
      renderToday(parts, parts.dayIndex);
      var r = repOf(parts.dayIndex);
      if (selection === null || view.year !== r.year || view.month !== r.month) {
        if (selection === null) { view.year = r.year; view.month = r.month; }
      }
      renderMonth();
      renderYearBar();
    }
    requestAnimationFrame(tick);
  }

  function refreshAll() {
    lastDayKey = null;
    if (refreshConverter) refreshConverter();
    tickOnce();
    renderYearBar();
  }

  var ticking = false;
  function tickOnce() {
    if (ticking) return;
    ticking = true;
    var parts = nowParts();
    lastDayKey = null;
    renderToday(parts, parts.dayIndex);
    renderClock(parts);
    renderMonth();
    renderYearBar();
    if (refreshConverter) refreshConverter();
    ticking = false;
  }

  function boot() {
    loadSettings();
    applyInsets();
    applyTheme();
    syncSettingsUI();

    buildDial();
    initSettings();
    initConverter();
    initYearNav();
    initPager();

    var parts = nowParts();
    var r = repOf(parts.dayIndex);
    view.year = r.year;
    view.month = r.month;
    selection = null;

    renderToday(parts, parts.dayIndex);
    renderClock(parts);
    renderMonth();
    renderYearBar();
    setPage(0, false);
    syncYearInputs();

    lastDayKey = null;
    requestAnimationFrame(function () { tick(); });

    /* 调试/测试钩子 */
    window.RCApp = {
      go: function (i) { setPage(i, false); },
      page: function () { return pageIdx; },
      view: function () { return view; },
      setView: setView,
      select: selectDay,
      handleBack: function () {
        if (dom.yearSheet && !dom.yearSheet.hidden) { closeYearPop(); return true; }
        if (pageIdx !== 0) { setPage(0, true); return true; }
        return false;
      },
      state: function () { return { rule: S.rule, tz: S.tz, theme: S.theme, fmt: S.fmt }; }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
