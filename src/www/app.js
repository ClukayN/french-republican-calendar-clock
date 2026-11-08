/* =========================================================================
   法国共和历 · 界面逻辑
   - 所有时间量每帧由绝对时间戳重算，不做累加
   - 表盘：SVG 双轨（外 24 时罗马数字 / 内 10 时阿拉伯数字 + 100 小格）
   ========================================================================= */
(function () {
  'use strict';

  var RC = window.RC;
  var DATA = window.CALENDAR_DATA;
  RC.setData(DATA);

  var SVGNS = 'http://www.w3.org/2000/svg';
  var CX = 240, CY = 240;

  var WEEKDAYS = [
    { fr: 'Primidi', cn: '一日' }, { fr: 'Duodi', cn: '二日' }, { fr: 'Tridi', cn: '三日' },
    { fr: 'Quartidi', cn: '四日' }, { fr: 'Quintidi', cn: '五日' }, { fr: 'Sextidi', cn: '六日' },
    { fr: 'Septidi', cn: '七日' }, { fr: 'Octidi', cn: '八日' }, { fr: 'Nonidi', cn: '九日' },
    { fr: 'Décadi', cn: '十日' }
  ];
  var GREG_WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  var CN_DIGIT = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var FR_MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

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

  /* ── 中文数字 ─────────────────────────────────────────── */
  function cnNumber(n) {
    n = Math.abs(Math.round(n));
    if (n === 0) return '〇';
    var units = ['', '十', '百', '千'];
    var s = '', str = String(n), len = str.length;
    for (var i = 0; i < len; i++) {
      var d = +str[i];
      var pos = len - i - 1;
      if (d === 0) {
        if (s && s.slice(-1) !== '〇') s += '〇';
      } else {
        if (d === 1 && pos === 1 && i === 0) { s += '十'; }
        else s += CN_DIGIT[d] + units[pos];
      }
    }
    s = s.replace(/〇+$/, '');
    if (n > 9999) {                       /* 万以上少见，逐位念 */
      s = String(n).split('').map(function (c) { return CN_DIGIT[+c]; }).join('');
    }
    return s;
  }

  /* ── 时区 / 当前快照 ─────────────────────────────────── */
  var LOCAL_TZ = (function () {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '本地'; }
    catch (e) { return '本地'; }
  })();

  function nowParts() {
    var now = new Date();
    var d, sec;
    if (S.tz === 'paris') {
      var shifted = new Date(now.getTime() + RC.PARIS_OFFSET_SEC * 1000);
      d = { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
      sec = shifted.getUTCHours() * 3600 + shifted.getUTCMinutes() * 60 +
        shifted.getUTCSeconds() + shifted.getUTCMilliseconds() / 1000;
    } else {
      d = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
      sec = now.getHours() * 3600 + now.getMinutes() * 60 +
        now.getSeconds() + now.getMilliseconds() / 1000;
    }
    return { greg: d, sec: sec, dayIndex: RC.dayFromGreg(d.y, d.m, d.d) };
  }

  /* ── 时间链 ───────────────────────────────────────────── */
  function repOf(dayIndex) {
    var r = RC.fromDayIndex(dayIndex, S.rule);
    r.decade = r.month === 13 ? 0 : Math.floor((r.day - 1) / 10) + 1;
    r.weekday = r.month === 13 ? null : WEEKDAYS[(r.day - 1) % 10];
    r.info = RC.dayDedication(r.month, r.day);
    return r;
  }

  /* ══════════════════════════════════════════════════════
     表盘
     ══════════════════════════════════════════════════════ */
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
    return 'M' + (-halfW) + ' ' + (tailLen) +
      'L0 ' + (-len) +
      'L' + halfW + ' ' + (tailLen) +
      'L0 ' + (tailLen - (tailW || 8)) + 'Z';
  }

  var dial = { h24: null, decM: null, sec: null };
  var svgRoot = null;

  function buildDial() {
    var host = document.getElementById('dialHost');
    host.innerHTML = '';
    svgRoot = el('svg', { viewBox: '0 0 480 480', class: 'dial', role: 'img', 'aria-label': '双轨表盘' }, host);

    var defs = el('defs', null, svgRoot);
    var gFace = el('radialGradient', { id: 'faceGrad', cx: '42%', cy: '34%', r: '78%' }, defs);
    el('stop', { offset: '0%', 'stop-color': 'var(--dial-face-a)' }, gFace);
    el('stop', { offset: '72%', 'stop-color': 'var(--dial-face-b)' }, gFace);
    el('stop', { offset: '100%', 'stop-color': 'var(--dial-face-b)', 'stop-opacity': '.96' }, gFace);
    var gBezel = el('linearGradient', { id: 'bezelGrad', x1: '0', y1: '0', x2: '1', y2: '1' }, defs);
    el('stop', { offset: '0%', 'stop-color': 'var(--dial-rim)', 'stop-opacity': '.85' }, gBezel);
    el('stop', { offset: '45%', 'stop-color': 'var(--dial-rim)', 'stop-opacity': '.25' }, gBezel);
    el('stop', { offset: '100%', 'stop-color': 'var(--dial-rim)', 'stop-opacity': '.75' }, gBezel);

    /* 外框 */
    el('circle', { cx: CX, cy: CY, r: 236, fill: 'none', stroke: 'var(--dial-rim)', 'stroke-width': '.8', opacity: '.35' }, svgRoot);
    el('circle', { cx: CX, cy: CY, r: 229, fill: 'url(#faceGrad)' }, svgRoot);
    el('circle', { cx: CX, cy: CY, r: 229, fill: 'none', stroke: 'url(#bezelGrad)', 'stroke-width': '5' }, svgRoot);
    el('circle', { cx: CX, cy: CY, r: 223, fill: 'none', stroke: 'var(--dial-rim)', 'stroke-width': '.7', opacity: '.5' }, svgRoot);

    /* 外圈：24 时刻度（每 15 分钟一小格，每时一大格） */
    el('path', {
      d: ticksPath(200, 208, 3.75), stroke: 'var(--dial-mute)', 'stroke-width': '.7',
      'stroke-linecap': 'round', opacity: '.55', fill: 'none'
    }, svgRoot);
    el('path', {
      d: ticksPath(195, 211, 15), stroke: 'var(--dial-ink)', 'stroke-width': '1.5',
      'stroke-linecap': 'round', fill: 'none'
    }, svgRoot);

    /* 罗马数字 I .. XXIV */
    for (var i = 1; i <= 24; i++) {
      var p = pt(181, i * 15);
      el('text', {
        x: p[0].toFixed(2), y: p[1].toFixed(2), class: 'num roman',
        'text-anchor': 'middle', 'dominant-baseline': 'central'
      }, svgRoot).textContent = RC.roman(i);
    }

    /* 分隔环 */
    el('circle', { cx: CX, cy: CY, r: 166, fill: 'none', stroke: 'var(--dial-rim)', 'stroke-width': '.6', opacity: '.35' }, svgRoot);

    /* 中区细密雕纹（guilloché），填补十进数字与小秒盘之间的空白 */
    el('circle', {
      cx: CX, cy: CY, r: 96, fill: 'none', stroke: 'var(--dial-mute)',
      'stroke-width': '.55', 'stroke-dasharray': '1 2.4', opacity: '.3'
    }, svgRoot);
    el('circle', { cx: CX, cy: CY, r: 84, fill: 'none', stroke: 'var(--dial-rim)', 'stroke-width': '.45', opacity: '.26' }, svgRoot);

    /* 内圈：十进制刻度。每大格（0.1 日）分 100 小格，全圈 1000 格 */
    var minor = '', medium = '', major = '';
    for (var k = 0; k < 1000; k++) {
      var deg = k * 0.36;
      if (k % 100 === 0) {
        major += seg(deg, 134, 152);
      } else if (k % 10 === 0) {
        medium += seg(deg, 137, 147);
      } else {
        minor += seg(deg, 140, 144);
      }
    }
    el('path', { d: minor, stroke: 'var(--dial-mute)', 'stroke-width': '.32', opacity: '.22', fill: 'none' }, svgRoot);
    el('path', { d: medium, stroke: 'var(--dial-mute)', 'stroke-width': '.6', opacity: '.62', fill: 'none' }, svgRoot);
    el('path', { d: major, stroke: 'var(--dial-accent)', 'stroke-width': '1.1', opacity: '.85', 'stroke-linecap': 'butt', fill: 'none' }, svgRoot);

    /* 十进制数字 0..9 */
    for (var j = 0; j <= 9; j++) {
      var q = pt(115, j * 36);
      el('text', {
        x: q[0].toFixed(2), y: q[1].toFixed(2), class: 'num arab',
        'text-anchor': 'middle', 'dominant-baseline': 'central'
      }, svgRoot).textContent = String(j);
    }

    /* 小秒盘：一百等分，一周即一十进分（100 共和秒） */
    el('circle', { cx: CX, cy: CY, r: 55, fill: 'var(--dial-face-a)', stroke: 'var(--dial-rim)', 'stroke-width': '.8', opacity: '.95' }, svgRoot);
    el('path', {
      d: ticksPath(44, 50, 3.6), stroke: 'var(--dial-mute)', 'stroke-width': '.5',
      opacity: '.5', fill: 'none'
    }, svgRoot);
    el('path', {
      d: ticksPath(40, 50, 36), stroke: 'var(--dial-ink)', 'stroke-width': '1.05',
      'stroke-linecap': 'round', fill: 'none', opacity: '.85'
    }, svgRoot);

    /* 指针：一柄时针同时读取外圈 24 时与内圈十进时（二者按同一比例旋转），
       一柄细针读十进分（内圈 100 小格的刻环），小盘上为十进秒 */
    dial.h24 = el('g', { class: 'hand-24h' }, svgRoot);
    el('path', { d: handPath(176, 4.6, 18, 13) }, dial.h24);

    dial.decM = el('g', { class: 'hand-decmin' }, svgRoot);
    el('path', { d: handPath(150, 1.7, 14, 9) }, dial.decM);

    dial.sec = el('g', { class: 'hand-sec' }, svgRoot);
    el('path', { d: 'M-1.1 10 L0 -45 L1.1 10 Z' }, dial.sec);

    el('circle', { cx: CX, cy: CY, r: 7.4, class: 'hub' }, svgRoot);
    el('circle', { cx: CX, cy: CY, r: 3.2, class: 'hub-cap' }, svgRoot);
  }

  /* ══════════════════════════════════════════════════════
     渲染
     ══════════════════════════════════════════════════════ */
  var dom = {};
  ['dh', 'dm', 'ds', 'stdClock', 'plateDoy', 'plateDecade', 'plateMonth', 'plateMonthCn',
    'plateYear', 'plateYearCn', 'plateGreg', 'dediCat', 'dediMode', 'dediFr', 'dediCn',
    'dediDesc', 'mtCn', 'mtFr', 'mtYear', 'decades', 'ruleBadge', 'footTz', 'footRule',
    'footInfo', 'scaleNote', 'tzNote', 'btn24', 'btnTheme',
    'plateNote', 'ybCount', 'ybFill', 'ybMark', 'ybStart', 'ybEnd',
    'btnPrevYear', 'btnNextYear', 'btnYearPick', 'yearPop', 'yearIn', 'yearGo',
    'gregYearIn', 'monthInRep', 'gregMonthIn', 'repRow', 'gregRow', 'yearPreview'].forEach(function (id) {
      dom[id] = document.getElementById(id);
    });

  var view = { year: 1, month: 1 };          /* 月历当前显示的年月 */
  var selection = null;                       /* null = 跟随今日 */
  var refreshConverter = null;                /* 换算器重算入口，由 initConverter 注册 */
  var lastTodayKey = '';

  function pad2(n) { return (n < 10 ? '0' : '') + n; }


  function renderClock(parts) {
    var dt = RC.decimalTime(parts.sec);
    var h = Math.floor(dt.h), m = Math.floor(dt.m), s = Math.floor(dt.s);

    if (dom.dh.textContent !== pad2(h)) dom.dh.textContent = pad2(h);
    if (dom.dm.textContent !== pad2(m)) dom.dm.textContent = pad2(m);
    if (dom.ds.textContent !== pad2(s)) dom.ds.textContent = pad2(s);

    var cur = parts.sec % 60;
    if (S.fmt === 'dec') {
      /* 24 时制收起时按钮仍留在原位，作为「点一下展开」的幽灵 chip */
      if (dom.stdClock.textContent !== '24 时') dom.stdClock.textContent = '24 时';
    } else {
      var stdStr = pad2(Math.floor(parts.sec / 3600)) + ':' +
        pad2(Math.floor(parts.sec / 60) % 60) + ':' + pad2(Math.floor(cur));
      if (dom.stdClock.textContent !== stdStr) dom.stdClock.textContent = stdStr;
    }

    /* 指针角度：全部由当日绝对秒数导出 */
    var a24 = parts.sec / 86400 * 360;
    var decMinPos = (parts.sec / 86.4) % 100;           /* 0..100 */
    var aDecM = decMinPos * 3.6;
    var aSec = ((parts.sec / 0.864) % 100) * 3.6;   /* 十进秒：一周 = 100 共和秒 */

    dial.h24.setAttribute('transform', 'translate(' + CX + ',' + CY + ') rotate(' + a24.toFixed(3) + ')');
    dial.decM.setAttribute('transform', 'translate(' + CX + ',' + CY + ') rotate(' + aDecM.toFixed(3) + ')');
    dial.sec.setAttribute('transform', 'translate(' + CX + ',' + CY + ') rotate(' + aSec.toFixed(3) + ')');
  }

  function monthLabel(month) {
    if (month >= 13) return { fr: 'Jours complémentaires', cn: '互补日', note: 'Sansculottides' };
    var mi = DATA.months[month - 1];
    return { fr: mi.fr, cn: mi.cn, note: mi.season };
  }

  function renderDate(r, greg, idx) {
    var ml = monthLabel(r.month);

    /* 日期牌 */
    if (r.month === 13) {
      dom.plateDoy.textContent = '第 ' + r.day + ' 闰日';
      dom.plateDecade.textContent = '补充日 · Sansculottides';
      dom.plateMonth.textContent = 'JOURS COMPLÉMENTAIRES';
      dom.plateMonthCn.textContent = '补充日';
      dom.plateNote.textContent = '岁末六日 · 共和之节庆';
    } else {
      var mi = DATA.months[r.month - 1];
      dom.plateDoy.textContent = '第 ' + r.day + ' 日';
      dom.plateDecade.textContent = '第' + cnNumber(r.decade) + '旬 · ' + r.weekday.fr;
      dom.plateMonth.textContent = ml.fr;
      dom.plateMonthCn.textContent = ml.cn;
      dom.plateNote.textContent = mi.season + ' · ' + mi.note;
    }
    dom.plateYear.textContent = r.year > 0 ? 'AN ' + RC.roman(r.year) : 'AVANT L\'ÈRE';
    dom.plateYearCn.textContent = r.year > 0
      ? '共和' + cnNumber(r.year) + '年'
      : '共和纪元前' + cnNumber(1 - r.year) + '年';

    var gw = new Date(Date.UTC(greg.y, greg.m - 1, greg.d)).getUTCDay();
    dom.plateGreg.textContent = greg.y + ' 年 ' + greg.m + ' 月 ' + greg.d + ' 日 · ' + GREG_WEEK[gw];

    /* 年进度 */
    var ys = RC.toDayIndex(r.year, 1, 1, S.rule);
    var yl = RC.yearLength(r.year, S.rule);
    var doy = idx - ys + 1;
    if (doy < 1) doy = 1;
    if (doy > yl) doy = yl;
    var pct = (doy - 1) / yl * 100;
    dom.ybCount.textContent = '第 ' + doy + ' / ' + yl + ' 日';
    dom.ybFill.style.width = pct.toFixed(2) + '%';
    dom.ybMark.style.left = pct.toFixed(2) + '%';
    var gs = RC.gregFromDay(ys), ge = RC.gregFromDay(ys + yl - 1);
    dom.ybStart.textContent = gs.y + ' 年 ' + gs.m + ' 月 ' + gs.d + ' 日';
    dom.ybEnd.textContent = ge.y + ' 年 ' + ge.m + ' 月 ' + ge.d + ' 日';

    /* 物产卡 */
    var info = r.info || { fr: '—', cn: '—', cat: '', desc: '' };
    dom.dediCat.textContent = info.cat || '—';
    dom.dediFr.textContent = info.fr || '';
    dom.dediCn.textContent = info.cn || '';
    dom.dediDesc.textContent = info.desc || '';
  }

  function renderMonth() {
    var y = view.year, m = view.month;
    var ml = monthLabel(m);
    dom.mtCn.textContent = ml.cn;
    dom.mtFr.textContent = ml.fr.toUpperCase();
    dom.mtYear.textContent = repYearLabel(y);

    var startIdx = RC.toDayIndex(y, m, 1, S.rule);
    var len = m >= 13 ? (RC.yearLength(y, S.rule) - 360) : 30;
    var todayIdx = RC.dayFromGreg.apply(null, [0, 1, 1]);   /* 占位，稍后覆盖 */
    var np = nowParts();
    todayIdx = np.dayIndex;

    var html = '';
    if (m >= 13) {
      html += '<div class="decade"><div class="decade-label"><b>补充日</b>Sansculottides</div>';
      for (var d = 1; d <= len; d++) {
        var info = RC.dayDedication(13, d) || { fr: '—', cn: '' };
        var cls = 'day complementary' + (startIdx + d - 1 === todayIdx ? ' today' : '');
        html += '<button class="' + cls + '" type="button" data-i="' + (startIdx + d - 1) + '" title="' +
          d + ' ' + info.fr + ' ' + info.cn + '">' +
          '<span class="dn">' + (d === 6 ? '6' : d) + '</span>' +
          '<span class="dd">' + (info.cn || '') + '</span></button>';
      }
      html += '</div>';
    } else {
      for (var dec = 0; dec < 3; dec++) {
        html += '<div class="decade"><div class="decade-label"><b>第' + cnNumber(dec + 1) + '旬</b>Décade ' +
          RC.roman(dec + 1) + '</div>';
        for (var i = 0; i < 10; i++) {
          var day = dec * 10 + i + 1;
          var idx = startIdx + day - 1;
          var dd = RC.dayDedication(m, day) || { fr: '—', cn: '' };
          var c = 'day' + (idx === todayIdx ? ' today' : '') + (selection === idx ? ' selected' : '');
          html += '<button class="' + c + '" type="button" data-i="' + idx + '" title="' +
            day + ' ' + dd.fr + ' ' + dd.cn + '">' +
            '<span class="dn">' + day + '</span>' +
            '<span class="dd">' + dd.cn + '</span></button>';
        }
        html += '</div>';
      }
    }
    dom.decades.innerHTML = html;

    Array.prototype.forEach.call(dom.decades.querySelectorAll('.day'), function (btn) {
      btn.addEventListener('click', function () {
        var idx = +btn.getAttribute('data-i');
        selection = (idx === todayIdx) ? null : idx;
        var rr = repOf(idx);
        view.year = rr.year; view.month = rr.month;
        renderMonth();
        renderSelectionCard();
        updateModeChip();
      });
    });
  }

  function renderSelectionCard() {
    if (selection === null) {
      var np = nowParts();
      var r = repOf(np.dayIndex);
      renderDate(r, np.greg, np.dayIndex);
      dom.dediMode.textContent = '今日物产';
    } else {
      var rr = repOf(selection);
      var g = RC.gregFromDay(selection);
      renderDate(rr, g, selection);
      dom.dediMode.textContent = '所选日期';
    }
  }

  function updateModeChip() {
    dom.dediMode.textContent = selection === null ? '今日物产' : '所选日期';
  }

  /* ══════════════════════════════════════════════════════
     换算器
     ══════════════════════════════════════════════════════ */
  function initConverter() {
    var gM = document.getElementById('inGM');
    for (var m = 1; m <= 12; m++) {
      var o = document.createElement('option');
      o.value = m; o.textContent = m + ' 月';
      gM.appendChild(o);
    }
    gM.value = 11;

    var rM = document.getElementById('inRM');
    for (var k = 1; k <= 13; k++) {
      var o2 = document.createElement('option');
      o2.value = k;
      o2.textContent = k === 13 ? '互补日' : (DATA.months[k - 1].cn + ' · ' + DATA.months[k - 1].fr);
      rM.appendChild(o2);
    }
    rM.value = 2;

    var gY = document.getElementById('inGY'), gD = document.getElementById('inGD');
    var rY = document.getElementById('inRY'), rD = document.getElementById('inRD');

    function fillRDays() {
      var y = parseInt(rY.value, 10), m = parseInt(rM.value, 10);
      var n = 30;
      if (m === 13) n = (isFinite(y) && y > 0) ? (RC.yearLength(y, S.rule) - 360) : 6;
      var keep = parseInt(rD.value, 10) || 1;
      rD.innerHTML = '';
      for (var d = 1; d <= n; d++) {
        var o = document.createElement('option');
        o.value = d; o.textContent = d + ' 日';
        rD.appendChild(o);
      }
      rD.value = Math.min(keep, n);
    }

    function gToR() {
      var y = parseInt(gY.value, 10), m = parseInt(gM.value, 10), d = parseInt(gD.value, 10);
      var out = document.getElementById('outRep');
      if (!isFinite(y) || !isFinite(m) || !isFinite(d) || y < 1 || y > 9999) { out.textContent = '—'; return; }
      var t = new Date(Date.UTC(y, m - 1, d));
      if (t.getUTCFullYear() !== y || t.getUTCMonth() + 1 !== m || t.getUTCDate() !== d) {
        out.textContent = '日期无效'; return;
      }
      var r = repOf(RC.dayFromGreg(y, m, d));
      var label = r.month === 13
        ? (r.day + ' 补充日')
        : (r.day + ' ' + DATA.months[r.month - 1].fr);
      /* 日期 + 当日物产写在同一条结果里 */
      out.textContent = label + ' an ' + (r.year > 0 ? RC.roman(r.year) : r.year) +
        ' ／ ' + (r.month === 13 ? '补充日' : DATA.months[r.month - 1].cn) + r.day + '日';
      var dd = RC.dayDedication(r.month, r.day);
      if (dd) {
        var item = document.createElement('span');
        item.className = 'conv-item';
        item.textContent = ' · ' + dd.cn + ' · ' + dd.fr;
        out.appendChild(item);
      }
    }

    function rToG() {
      var y = parseInt(rY.value, 10), m = parseInt(rM.value, 10), d = parseInt(rD.value, 10);
      var out = document.getElementById('outGreg');
      if (!isFinite(y) || !isFinite(m) || !isFinite(d)) { out.textContent = '—'; return; }
      var maxDay = m === 13 ? (y > 0 ? RC.yearLength(y, S.rule) - 360 : 6) : 30;
      if (d < 1 || d > maxDay) { out.textContent = '日期无效'; return; }
      var idx = RC.toDayIndex(y, m, d, S.rule);
      var g = RC.gregFromDay(idx);
      out.textContent = g.y + ' 年 ' + g.m + ' 月 ' + g.d + ' 日';
    }

    [gY, gD].forEach(function (x) { x.addEventListener('input', gToR); });
    gM.addEventListener('change', gToR);
    [rY].forEach(function (x) { x.addEventListener('input', function () { fillRDays(); rToG(); }); });
    rM.addEventListener('change', function () { fillRDays(); rToG(); });
    rD.addEventListener('change', rToG);

    fillRDays();
    gToR(); rToG();

    /* 年长/年首会随置闰规则变化，所以规则切换后需重新计算 */
    refreshConverter = function () { fillRDays(); gToR(); rToG(); };
  }

  /* ══════════════════════════════════════════════════════
     设置界面
     ══════════════════════════════════════════════════════ */
  function applyTheme() {
    var t = S.theme;
    if (t === 'auto') {
      t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', t);
  }

  function syncSettingsUI() {
    Array.prototype.forEach.call(document.querySelectorAll('#ruleCards input'), function (i) {
      i.checked = (i.value === S.rule);
    });
    setSeg('tzSeg', S.tz);
    setSeg('themeSeg', S.theme);
    setSeg('fmtSeg', S.fmt);

    dom.ruleBadge.textContent = S.rule === 'romme' ? '定长规则 · 罗姆' : '秋分精确法';
    dom.footRule.textContent = S.rule === 'romme' ? '置闰：罗姆定长规则' : '置闰：巴黎秋分精确法';
    dom.footInfo.textContent = S.rule === 'romme'
      ? '共和四年起每 4 年一闰 · 世纪修正'
      : '岁首依巴黎秋分真时刻';
    dom.footTz.textContent = S.tz === 'paris' ? '巴黎平太阳时 · UTC+9m21s' : '本地时间 · ' + LOCAL_TZ;
    dom.tzNote.textContent = S.tz === 'paris'
      ? '以巴黎子午线（东经 2°20′14″）平太阳时的零时为共和历 0 时，与法国大革命时期一致。'
      : '以本机当地零时为共和历 0 时。';

    dom.btn24.classList.toggle('off', S.fmt === 'dec');
    dom.btn24.title = S.fmt === 'dec' ? '显示 24 小时制' : '隐藏 24 小时制';
  }

  function setSeg(id, val) {
    Array.prototype.forEach.call(document.querySelectorAll('#' + id + ' button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-v') === val);
    });
  }

  function initSettings() {
    Array.prototype.forEach.call(document.querySelectorAll('#ruleCards input'), function (i) {
      i.addEventListener('change', function () {
        if (!i.checked) return;
        S.rule = i.value; saveSettings(); syncSettingsUI();
        refreshAll();
      });
    });

    segHandler('tzSeg', function (v) { S.tz = v; saveSettings(); syncSettingsUI(); refreshAll(); });
    segHandler('themeSeg', function (v) { S.theme = v; saveSettings(); applyTheme(); syncSettingsUI(); });
    segHandler('fmtSeg', function (v) { S.fmt = v; saveSettings(); syncSettingsUI(); });

    document.getElementById('btnTheme').addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      S.theme = cur === 'dark' ? 'light' : 'dark';
      saveSettings(); applyTheme(); syncSettingsUI();
    });

    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChg = function () { if (S.theme === 'auto') applyTheme(); };
      if (mq.addEventListener) mq.addEventListener('change', onChg);
      else if (mq.addListener) mq.addListener(onChg);
    }
  }

  function segHandler(id, cb) {
    var box = document.getElementById(id);
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { cb(b.getAttribute('data-v')); });
    });
  }

  /* ══════════════════════════════════════════════════════
     抽屉 / 交互
     ══════════════════════════════════════════════════════ */
  function initDrawer() {
    var drawer = document.getElementById('drawer');
    var scrim = document.getElementById('scrim');
    function open() {
      drawer.hidden = false; scrim.hidden = false;
      requestAnimationFrame(function () { drawer.classList.add('open'); scrim.classList.add('show'); });
    }
    function close() {
      drawer.classList.remove('open'); scrim.classList.remove('show');
      setTimeout(function () { drawer.hidden = true; scrim.hidden = true; }, 260);
    }
    document.getElementById('btnSettings').addEventListener('click', open);
    document.getElementById('btnCloseDrawer').addEventListener('click', close);
    scrim.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); closeYearPop(); return; }

      var t = e.target;
      var typing = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
      if (typing) return;

      if (e.key === 'ArrowLeft') { shiftMonth(-1); return; }
      if (e.key === 'ArrowRight') { shiftMonth(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); shiftYear(e.shiftKey ? -10 : -1); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); shiftYear(e.shiftKey ? 10 : 1); return; }
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        if (dom.yearPop.hidden) openYearPop(); else closeYearPop();
      }
    });
  }

  function shiftMonth(dir) {
    var m = view.month + dir, y = view.year;
    if (m < 1) { m = 13; y -= 1; }
    if (m > 13) { m = 1; y += 1; }
    setView(y, m);
  }

  /* ── 年份快速切换 ─────────────────────────────────────── */
  var yearMode = 'rep';                       /* 'rep' 共和纪年 | 'greg' 公元 */

  function setView(y, m) {
    if (!isFinite(y)) y = 1;
    if (y < -9999) y = -9999;
    if (y > 9999) y = 9999;
    if (!(m >= 1)) m = 1;
    if (m > 13) m = 13;
    view.year = y; view.month = m;
    renderMonth();
    syncYearInputs();
  }

  /* 年号标签：共和纪年前为「前 N 年」 */
  function repYearLabel(y) {
    return y > 0 ? 'AN ' + RC.roman(y) : '前' + cnNumber(1 - y) + '年';
  }

  function shiftYear(dir) {
    setView(view.year + dir, view.month);
  }

  function clampInt(v, lo, hi, fallback) {
    v = parseInt(v, 10);
    if (isNaN(v)) return fallback;
    if (v < lo) v = lo;
    if (v > hi) v = hi;
    return v;
  }

  /* 用公元 y-m 的第 15 天落到哪个共和月（该月多数日子所属的月份）来判断 */
  function repMonthOfGregYear(y, m) {
    var dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var d = Math.min(15, dim);
    var r = RC.fromDayIndex(RC.dayFromGreg(y, m, d), S.rule);
    return r;
  }

  function fillYearSelects() {
    var rep = dom.monthInRep, greg = dom.gregMonthIn;
    if (rep.options.length === 0) {
      var i, opt;
      for (i = 1; i <= 12; i++) {
        opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = DATA.months[i - 1].cn + ' · ' + DATA.months[i - 1].fr;
        rep.appendChild(opt);
      }
      opt = document.createElement('option');
      opt.value = '13';
      opt.textContent = '补充日 · Sansculottides';
      rep.appendChild(opt);

      for (i = 1; i <= 12; i++) {
        opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = i + ' 月 · ' + FR_MONTHS[i - 1];
        greg.appendChild(opt);
      }
    }
  }

  /* 把当前视图写回输入框（切模式、翻年、翻月后都保持同步） */
  function syncYearInputs() {
    if (!dom.yearPop || dom.yearPop.hidden) return;
    dom.yearIn.value = view.year;
    dom.monthInRep.value = String(view.month);
    var idx = RC.toDayIndex(view.year, view.month, 1, S.rule);
    var g = RC.gregFromDay(idx);
    dom.gregYearIn.value = g.y;
    dom.gregMonthIn.value = String(g.m);
    updateYearPreview();
  }

  function modeYearValue() {
    return yearMode === 'rep'
      ? clampInt(dom.yearIn.value, -9999, 9999, view.year)
      : clampInt(dom.gregYearIn.value, 1, 9999, RC.gregFromDay(RC.toDayIndex(view.year, view.month, 1, S.rule)).y);
  }

  function targetOfInputs() {
    if (yearMode === 'rep') {
      var y = clampInt(dom.yearIn.value, -9999, 9999, view.year);
      var m = clampInt(dom.monthInRep.value, 1, 13, view.month);
      return { year: y, month: m, gregText: '' };
    }
    var gy = clampInt(dom.gregYearIn.value, 1, 9999, 2026);
    var gm = clampInt(dom.gregMonthIn.value, 1, 12, 1);
    var r = repMonthOfGregYear(gy, gm);
    return { year: r.year, month: r.month, gregText: gy + '-' + pad2(gm) + ' → ' };
  }

  function updateYearPreview() {
    var t = targetOfInputs();
    var ml = monthLabel(t.month);
    dom.yearPreview.textContent = '→ ' + t.gregText + ml.cn + ' ' + repYearLabel(t.year);
  }

  function setYearMode(mode) {
    yearMode = (mode === 'greg') ? 'greg' : 'rep';
    dom.repRow.hidden = yearMode !== 'rep';
    dom.gregRow.hidden = yearMode !== 'greg';
    Array.prototype.forEach.call(document.querySelectorAll('#yearMode button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-v') === yearMode);
    });
    syncYearInputs();
    var f = yearMode === 'rep' ? dom.yearIn : dom.gregYearIn;
    f.focus();
    f.select();
  }

  function openYearPop() {
    fillYearSelects();
    dom.yearPop.hidden = false;
    dom.btnYearPick.classList.add('open');
    setYearMode('rep');
  }

  function closeYearPop() {
    if (!dom.yearPop || dom.yearPop.hidden) return;
    dom.yearPop.hidden = true;
    dom.btnYearPick.classList.remove('open');
  }

  function applyYearJump() {
    var t = targetOfInputs();
    setView(t.year, t.month);
    closeYearPop();
    dom.btnYearPick.focus();
  }

  function initYearNav() {
    dom.btnPrevYear.addEventListener('click', function () { shiftYear(-1); });
    dom.btnNextYear.addEventListener('click', function () { shiftYear(1); });

    dom.btnYearPick.addEventListener('click', function (e) {
      e.stopPropagation();
      if (dom.yearPop.hidden) openYearPop(); else closeYearPop();
    });

    Array.prototype.forEach.call(document.querySelectorAll('#yearMode button'), function (b) {
      b.addEventListener('click', function () { setYearMode(b.getAttribute('data-v')); });
    });

    dom.yearGo.addEventListener('click', applyYearJump);

    [dom.yearIn, dom.gregYearIn].forEach(function (inp) {
      inp.addEventListener('input', updateYearPreview);
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); applyYearJump(); }
        if (e.key === 'Escape') { e.preventDefault(); closeYearPop(); dom.btnYearPick.focus(); }
      });
    });

    [dom.monthInRep, dom.gregMonthIn].forEach(function (sel) {
      sel.addEventListener('change', updateYearPreview);
    });

    Array.prototype.forEach.call(document.querySelectorAll('#yearQuick button'), function (b) {
      b.addEventListener('click', function () {
        var d = parseInt(b.getAttribute('data-d'), 10) || 0;
        if (yearMode === 'rep') {
          dom.yearIn.value = clampInt(clampInt(dom.yearIn.value, -9999, 9999, view.year) + d, -9999, 9999, view.year);
        } else {
          dom.gregYearIn.value = clampInt(clampInt(dom.gregYearIn.value, 1, 9999, 2026) + d, 1, 9999, 2026);
        }
        updateYearPreview();
      });
    });

    document.addEventListener('click', function (e) {
      if (dom.yearPop.hidden) return;
      if (dom.yearPop.contains(e.target) || dom.btnYearPick.contains(e.target)) return;
      closeYearPop();
    });
  }

  /* ══════════════════════════════════════════════════════
     主循环
     ══════════════════════════════════════════════════════ */
  var rafId = null;
  var lastDayKey = null;
  var lastTextAt = 0;

  function tick(ts) {
    var parts = nowParts();
    renderClock(parts);

    var key = parts.greg.y + '-' + parts.greg.m + '-' + parts.greg.d;
    if (key !== lastDayKey) {
      lastDayKey = key;
      if (selection === null) {
        var r = repOf(parts.dayIndex);
        view.year = r.year; view.month = r.month;
      }
      renderDate(selection === null ? repOf(parts.dayIndex) : repOf(selection),
        selection === null ? parts.greg : RC.gregFromDay(selection),
        selection === null ? parts.dayIndex : selection);
      renderMonth();
      updateModeChip();
    }
    rafId = requestAnimationFrame(tick);
  }

  function refreshAll() {
    lastDayKey = null;
    if (selection !== null) {
      var rr = repOf(selection);
      view.year = rr.year; view.month = rr.month;
    }
    tick(0);
    renderMonth();
    if (refreshConverter) refreshConverter();
  }

  /* ── 启动 ─────────────────────────────────────────────── */
  function boot() {
    loadSettings();
    applyTheme();
    buildDial();
    syncSettingsUI();
    initConverter();
    initSettings();
    initDrawer();
    initYearNav();

    document.getElementById('btnToday').addEventListener('click', function () {
      selection = null;
      var np = nowParts();
      var r = repOf(np.dayIndex);
      view.year = r.year; view.month = r.month;
      lastDayKey = null;
      refreshAll();
    });

    document.getElementById('btnPrevMonth').addEventListener('click', function () { shiftMonth(-1); });
    document.getElementById('btnNextMonth').addEventListener('click', function () { shiftMonth(1); });
    document.getElementById('btn24').addEventListener('click', function () {
      S.fmt = S.fmt === 'both' ? 'dec' : 'both';
      saveSettings(); syncSettingsUI();
    });

    var np = nowParts();
    var r0 = repOf(np.dayIndex);
    view.year = r0.year; view.month = r0.month;
    lastDayKey = null;

    tick(0);
    rafId = requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
