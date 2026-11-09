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

  var I = window.I18N;
  function t(k, v) { return I.t(k, v); }
  function isZh() { return I.mode() === 'zh'; }

  /* ── 设置 ─────────────────────────────────────────────── */
  var DEFAULTS = { rule: 'romme', tz: 'local', theme: 'auto', lang: 'auto' };
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
    I.setSetting(S.lang);
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
    r.weekday = r.month === 13 ? null : I.weekdayOf((r.day - 1) % 10);
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
    'footInfo', 'scaleNote', 'tzNote', 'btnTheme',
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
    var stdStr = pad2(Math.floor(parts.sec / 3600)) + ':' +
      pad2(Math.floor(parts.sec / 60) % 60) + ':' + pad2(Math.floor(cur));
    if (dom.stdClock.textContent !== stdStr) dom.stdClock.textContent = stdStr;

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
    if (month >= 13) return { fr: 'Jours complémentaires', cn: '补充日', en: '', note: 'Sansculottides' };
    var mi = DATA.months[month - 1];
    return { fr: mi.fr, cn: mi.cn, en: mi.en || '', note: mi.season };
  }

  function renderDate(r, greg, idx) {
    var isComp = r.month === 13;

    if (isComp) {
      var compInfo = RC.dayDedication(13, r.day) || { fr: '', cn: '', en: '', desc: '' };
      dom.plateDoy.textContent = t('plate.doyComp', { n: r.day });
      dom.plateDecade.textContent = t('plate.decadeComp');
      dom.plateMonth.textContent = I.mode() === 'zh' ? 'JOURS COMPLÉMENTAIRES' : 'SANS-CULOTTIDES';
      dom.plateMonthCn.textContent = I.mode() === 'fr' ? (compInfo.fr || '') : t('plate.complementary');
      dom.plateNote.textContent = t('plate.noteComp');
    } else {
      var mi = DATA.months[r.month - 1];
      dom.plateDoy.textContent = t('plate.doy', { n: r.day });
      dom.plateDecade.textContent = I.decade(r.decade) + ' · ' + I.weekdayOf((r.day - 1) % 10);
      dom.plateMonth.textContent = I.monthUpper(r.month);
      dom.plateMonthCn.textContent = I.monthSecondary(r.month) || '';
      dom.plateNote.textContent = I.season(mi.season) + ' · ' +
        (I.mode() === 'fr' ? (mi.noteFr || mi.note) : (I.mode() === 'en' ? (mi.noteEn || mi.note) : mi.note));
    }

    dom.plateYear.textContent = I.repYear(r.year);
    dom.plateYearCn.textContent = I.repYearSub(r.year);
    dom.plateYearCn.style.display = I.mode() === 'fr' ? 'none' : '';

    dom.plateGreg.textContent = I.gregDate(greg.y, greg.m, greg.d, { weekday: true });

    /* 年进度 */
    var ys = RC.toDayIndex(r.year, 1, 1, S.rule);
    var yl = RC.yearLength(r.year, S.rule);
    var doy = idx - ys + 1;
    if (doy < 1) doy = 1;
    if (doy > yl) doy = yl;
    var pct = (doy - 1) / yl * 100;
    dom.ybCount.textContent = t('yb.count', { doy: doy, len: yl });
    dom.ybFill.style.width = pct.toFixed(2) + '%';
    dom.ybMark.style.left = pct.toFixed(2) + '%';
    var gs = RC.gregFromDay(ys), ge = RC.gregFromDay(ys + yl - 1);
    dom.ybStart.textContent = I.gregDateShort(gs.y, gs.m, gs.d);
    dom.ybEnd.textContent = I.gregDateShort(ge.y, ge.m, ge.d);

    /* 物产卡 */
    var info = r.info;
    if (!info) {
      dom.dediCat.textContent = '';
      dom.dediFr.textContent = '';
      dom.dediCn.textContent = '—';
      dom.dediDesc.textContent = '';
      return;
    }
    dom.dediCat.textContent = I.cat(info.cat) || t('chip.cat');
    dom.dediFr.textContent = info.fr || '';
    dom.dediFr.style.display = (I.mode() === 'fr' || !info.fr) ? 'none' : '';
    dom.dediCn.textContent = I.mode() === 'zh' ? (info.cn || '') : (info.en || info.cn || '');
    dom.dediDesc.textContent = I.dayDesc(info) || '';
  }

  function renderMonth() {
    var y = view.year, m = view.month;
    var isComp = m >= 13;

    if (I.mode() === 'zh') {
      dom.mtCn.textContent = isComp ? t('plate.complementary') : DATA.months[m - 1].cn;
      dom.mtFr.textContent = isComp ? 'SANS-CULOTTIDES' : DATA.months[m - 1].fr.toUpperCase();
      dom.mtFr.style.display = '';
    } else {
      dom.mtCn.textContent = isComp ? t('conv.complementary') : I.monthUpper(m);
      var sec = isComp ? '' : (I.mode() === 'en' ? (DATA.months[m - 1].en || '') : '');
      dom.mtFr.textContent = sec ? sec.toUpperCase() : '';
      dom.mtFr.style.display = sec ? '' : 'none';
    }
    dom.mtYear.textContent = repYearLabel(y);

    var startIdx = RC.toDayIndex(y, m, 1, S.rule);
    var len = isComp ? (RC.yearLength(y, S.rule) - 360) : 30;
    var np = nowParts();
    var todayIdx = np.dayIndex;

    function cellTitle(day, dd) {
      var parts = [String(day)];
      if (dd.en) parts.push(dd.en);
      if (dd.fr) parts.push(dd.fr);
      if (dd.cn) parts.push(dd.cn);
      return parts.join(' · ');
    }

    var html = '';
    if (isComp) {
      html += '<div class="decade"><div class="decade-label"><b>' + t('decade.labelComp') +
        '</b>' + (I.mode() === 'zh' ? 'Sansculottides' : '') + '</div>';
      for (var d = 1; d <= len; d++) {
        var info = RC.dayDedication(13, d) || { fr: '', cn: '', en: '' };
        var cls = 'day complementary' + (startIdx + d - 1 === todayIdx ? ' today' : '') +
          (selection === startIdx + d - 1 ? ' selected' : '');
        html += '<button class="' + cls + '" type="button" data-i="' + (startIdx + d - 1) + '" title="' +
          cellTitle(d, info) + '">' +
          '<span class="dn">' + d + '</span>' +
          '<span class="dd">' + I.dayName(info) + '</span></button>';
      }
      html += '</div>';
    } else {
      for (var dec = 0; dec < 3; dec++) {
        html += '<div class="decade"><div class="decade-label"><b>' + I.decade(dec + 1) + '</b>' +
          (I.mode() === 'zh' ? 'DÉCADE ' + RC.roman(dec + 1) : '') + '</div>';
        for (var i = 0; i < 10; i++) {
          var day = dec * 10 + i + 1;
          var idx = startIdx + day - 1;
          var dd = RC.dayDedication(m, day) || { fr: '', cn: '', en: '' };
          var c = 'day' + (idx === todayIdx ? ' today' : '') + (selection === idx ? ' selected' : '');
          html += '<button class="' + c + '" type="button" data-i="' + idx + '" title="' +
            cellTitle(day, dd) + '">' +
            '<span class="dn">' + day + '</span>' +
            '<span class="dd">' + I.dayName(dd) + '</span></button>';
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
      renderDate(repOf(np.dayIndex), np.greg, np.dayIndex);
    } else {
      renderDate(repOf(selection), RC.gregFromDay(selection), selection);
    }
  }

  function updateModeChip() {
    var isComp = false;
    if (selection === null) {
      var np = nowParts();
      isComp = repOf(np.dayIndex).month >= 13;
    } else {
      isComp = repOf(selection).month >= 13;
    }
    dom.dediMode.textContent = isComp ? t('chip.festival')
      : (selection === null ? t('chip.today') : t('chip.selected'));
  }

  /* ══════════════════════════════════════════════════════
     换算器
     ══════════════════════════════════════════════════════ */
  function initConverter() {
    var gM = document.getElementById('inGM');
    var rM = document.getElementById('inRM');
    var gY = document.getElementById('inGY'), gD = document.getElementById('inGD');
    var rY = document.getElementById('inRY'), rD = document.getElementById('inRD');

    function fillGregMonths() {
      var keep = parseInt(gM.value, 10) || 11;
      gM.innerHTML = '';
      for (var m = 1; m <= 12; m++) {
        var o = document.createElement('option');
        o.value = m;
        o.textContent = I.gregMonthLabel(m);
        gM.appendChild(o);
      }
      gM.value = keep;
    }

    function fillRepMonths() {
      var keep = parseInt(rM.value, 10) || 2;
      rM.innerHTML = '';
      for (var k = 1; k <= 13; k++) {
        var o = document.createElement('option');
        o.value = k;
        o.textContent = I.repMonthLabel(k);
        rM.appendChild(o);
      }
      rM.value = keep;
    }

    function fillRDays() {
      var y = parseInt(rY.value, 10), m = parseInt(rM.value, 10);
      var n = 30;
      if (m === 13) n = (isFinite(y) && y > 0) ? (RC.yearLength(y, S.rule) - 360) : 6;
      var keep = parseInt(rD.value, 10) || 1;
      rD.innerHTML = '';
      for (var d = 1; d <= n; d++) {
        var o = document.createElement('option');
        o.value = d; o.textContent = isZh() ? d + ' 日' : String(d);
        rD.appendChild(o);
      }
      rD.value = Math.min(keep, n);
    }

    function gToR() {
      var y = parseInt(gY.value, 10), m = parseInt(gM.value, 10), d = parseInt(gD.value, 10);
      var out = document.getElementById('outRep');
      if (!isFinite(y) || !isFinite(m) || !isFinite(d) || y < 1 || y > 9999) { out.textContent = '—'; return; }
      var probe = new Date(Date.UTC(y, m - 1, d));
      if (probe.getUTCFullYear() !== y || probe.getUTCMonth() + 1 !== m || probe.getUTCDate() !== d) {
        out.textContent = t('conv.invalid'); return;
      }
      var r = repOf(RC.dayFromGreg(y, m, d));
      var roman = r.year > 0 ? RC.roman(r.year) : String(r.year);
      var monthFr = r.month === 13 ? '' : DATA.months[r.month - 1].fr;
      var monthCn = r.month === 13 ? '' : DATA.months[r.month - 1].cn;
      var dd = RC.dayDedication(r.month, r.day) || { cn: '', en: '', fr: '' };
      var item = I.mode() === 'zh' ? (dd.cn + ' · ' + dd.fr)
        : (I.mode() === 'en' ? ((dd.en || dd.fr) + ' · ' + dd.fr) : dd.fr);
      out.textContent = t(r.month === 13 ? 'conv.repDateComp' : 'conv.repDate', {
        day: r.day, monthFr: monthFr, monthCn: monthCn, year: roman, item: item
      });
    }

    function rToG() {
      var y = parseInt(rY.value, 10), m = parseInt(rM.value, 10), d = parseInt(rD.value, 10);
      var out = document.getElementById('outGreg');
      if (!isFinite(y) || !isFinite(m) || !isFinite(d)) { out.textContent = '—'; return; }
      var maxDay = m === 13 ? (y > 0 ? RC.yearLength(y, S.rule) - 360 : 6) : 30;
      if (d < 1 || d > maxDay) { out.textContent = t('conv.invalid'); return; }
      var idx = RC.toDayIndex(y, m, d, S.rule);
      var g = RC.gregFromDay(idx);
      out.textContent = I.gregDate(g.y, g.m, g.d);
    }

    gY.addEventListener('input', gToR);
    gD.addEventListener('input', gToR);
    gM.addEventListener('change', gToR);
    rY.addEventListener('input', function () { fillRDays(); rToG(); });
    rM.addEventListener('change', function () { fillRDays(); rToG(); });
    rD.addEventListener('change', rToG);

    fillGregMonths();
    fillRepMonths();
    fillRDays();
    gToR(); rToG();

    /* 年长/年首会随置闰规则变化，所以规则切换后需重新计算 */
    refreshConverter = function () {
      fillGregMonths(); fillRepMonths(); fillRDays(); gToR(); rToG();
    };
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

    dom.ruleBadge.textContent = S.rule === 'romme' ? t('badge.romme') : t('badge.equinox');
    dom.footRule.textContent = S.rule === 'romme' ? t('foot.ruleRomme') : t('foot.ruleEquinox');
    dom.footInfo.textContent = S.rule === 'romme' ? t('foot.scaleRomme') : t('foot.scaleEquinox');
    dom.footTz.textContent = S.tz === 'paris' ? t('foot.tzParis') : t('foot.tzLocal', { tz: LOCAL_TZ });
    dom.tzNote.textContent = S.tz === 'paris' ? t('tz.noteParis') : t('tz.noteLocal');

    setSeg('langSeg', S.lang);
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
    segHandler('langSeg', function (v) {
      S.lang = v; saveSettings();
      I.setSetting(v);
      syncSettingsUI();
      I.refresh();
    });

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
    return I.repYear(y);
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
    var i, opt;

    if (rep.options.length === 0) {
      for (i = 1; i <= 13; i++) {
        opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = I.repMonthLabel(i);
        rep.appendChild(opt);
      }
      for (i = 1; i <= 12; i++) {
        opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = I.gregMonthLabel(i);
        greg.appendChild(opt);
      }
    } else {
      for (i = 1; i <= 13; i++) rep.options[i - 1].textContent = I.repMonthLabel(i);
      for (i = 1; i <= 12; i++) greg.options[i - 1].textContent = I.gregMonthLabel(i);
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
    var tg = targetOfInputs();
    dom.yearPreview.textContent = '→ ' + I.monthLabel(tg.month) + ' ' + repYearLabel(tg.year);
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
    I.applyStatic();
    I.onChange(function () { refreshAll(); syncSettingsUI(); });
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
