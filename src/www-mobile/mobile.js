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
  var I = window.I18N;
  function t(k, v) { return I.t(k, v); }
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

  /* ── 工具 ─────────────────────────────────────────────── */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }


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
  ['dh', 'dm', 'ds', 'stdClock', 'scaleNote', 'ruleBadge',
    'tsMonth', 'tsDay', 'tsYear', 'tsGreg',
    'mtCn', 'mtFr', 'mtYear', 'btnPrevYear', 'btnPrevMonth', 'btnNextMonth', 'btnNextYear',
    'btnYearPick', 'decades', 'plateDoy', 'plateDecade', 'plateMonth', 'plateMonthCn',
    'plateYear', 'plateYearCn', 'plateGreg', 'plateNote',
    'dediCat', 'dediMode', 'dediFr', 'dediCn', 'dediDesc',
    'inGY', 'inGM', 'inGD', 'outRep', 'inRY', 'inRM', 'inRD', 'outGreg',
    'ybCount', 'ybFill', 'ybMark', 'ybStart', 'ybEnd',
    'tzSeg', 'themeSeg', 'tzNote', 'ruleCards',
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

    var hh = Math.floor(parts.sec / 3600);
    var mm = Math.floor((parts.sec % 3600) / 60);
    var ss = Math.floor(parts.sec % 60);
    setText(dom.stdClock, pad2(hh) + ':' + pad2(mm) + ':' + pad2(ss));

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
    setText(dom.tsMonth, I.mode() === 'zh' ? monthLabel(r.month).cn : I.monthUpper(r.month));
    setText(dom.tsDay, String(r.day));
    setText(dom.tsYear, I.repYear(r.year));
    setText(dom.tsGreg, I.gregDate(parts.greg.y, parts.greg.m, parts.greg.d, { weekday: true }));
  }

  function renderPlate(r, greg, idx) {
    var isComp = r.month >= 13;

    setText(dom.plateDoy, isComp ? t('plate.doyComp', { n: r.day }) : t('plate.doy', { n: r.day }));
    setText(dom.plateDecade, isComp ? t('plate.decadeComp')
      : (I.decade(Math.floor((r.day - 1) / 10) + 1) + ' · ' + I.weekdayOf((r.day - 1) % 10)));
    setText(dom.plateMonth, I.monthUpper(r.month));
    setText(dom.plateMonthCn, I.monthSecondary(r.month) || '');

    var yl = I.repYear(r.year);
    setText(dom.plateYear, yl);
    var sub = I.repYearSub(r.year);
    setText(dom.plateYearCn, I.mode() === 'fr' ? '' : sub);

    setText(dom.plateGreg, I.gregDate(greg.y, greg.m, greg.d, { weekday: true }));
    setText(dom.plateNote, isComp ? t('plate.noteComp')
      : (I.season(DATA.months[r.month - 1].season) + ' · ' +
        (I.mode() === 'fr' ? (DATA.months[r.month - 1].noteFr || DATA.months[r.month - 1].note)
          : I.mode() === 'en' ? (DATA.months[r.month - 1].noteEn || DATA.months[r.month - 1].note)
            : DATA.months[r.month - 1].note)));

    var info = r.info;
    if (info) {
      setText(dom.dediCat, I.cat(info.cat) || t('chip.cat'));
      setText(dom.dediMode, r.month >= 13 ? t('chip.festival') : t('chip.today'));
      setText(dom.dediFr, info.fr || '');
      dom.dediFr.style.display = (I.mode() === 'fr' || !info.fr) ? 'none' : '';
      setText(dom.dediCn, I.mode() === 'zh' ? (info.cn || '') : (info.en || info.cn || ''));
      setText(dom.dediDesc, I.dayDesc(info) || '');
    }
  }

  function weekdayOf(greg) {
    return I.gregWeekdayName(new Date(greg.y, greg.m - 1, greg.d).getDay());
  }

  /* ── 月历 ─────────────────────────────────────────────── */
  function renderMonth() {
    var y = view.year, m = view.month;
    var todayIdx = RC.dayFromGreg(nowParts().greg.y, nowParts().greg.m, nowParts().greg.d);

    var isComp = m >= 13;
    if (I.mode() === 'zh') {
      setText(dom.mtCn, isComp ? t('plate.complementary') : DATA.months[m - 1].cn);
      setText(dom.mtFr, isComp ? 'SANS-CULOTTIDES' : DATA.months[m - 1].fr.toUpperCase());
      dom.mtFr.style.display = '';
    } else {
      setText(dom.mtCn, I.monthUpper(m));
      var sec = isComp ? '' : (I.mode() === 'en' ? (DATA.months[m - 1].en || '') : '');
      setText(dom.mtFr, sec ? sec.toUpperCase() : '');
      dom.mtFr.style.display = sec ? '' : 'none';
    }
    setText(dom.mtYear, repYearLabel(y));

    var base = RC.toDayIndex(y, m, 1, S.rule);

    var html = '';
    if (!isComp) {
      for (var dcd = 0; dcd < 3; dcd++) {
        html += '<div class="decade"><div class="decade-label"><b>' + I.decade(dcd + 1) + '</b>' +
          (I.mode() === 'zh' ? 'DÉCADE ' + RC.roman(dcd + 1) : '') + '</div>';
        for (var i = 0; i < 10; i++) {
          var dayNo = dcd * 10 + i + 1;
          html += dayCell(dayNo, base + dayNo - 1, todayIdx, false);
        }
        html += '</div>';
      }
    } else {
      var len = RC.yearLength(y, S.rule) - 360;
      html += '<div class="decade comp" style="grid-template-columns:30px repeat(' + Math.max(len, 1) + ',minmax(0,1fr))">' +
        '<div class="decade-label"><b>' + t('decade.labelComp') + '</b>' +
        (I.mode() === 'zh' ? 'SANS.' : '') + '</div>';
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
    var nm = info ? I.dayName(info) : '';
    var cls = 'day' + (isComp ? ' comp' : '');
    if (idx === todayIdx) cls += ' today';
    if (selection !== null && idx === selection) cls += ' selected';
    var title = String(dayNo) + (info ? ' ' + (info.fr || '') : '') +
      (I.mode() === 'zh' && info ? ' · ' + (info.cn || '') : '');
    return '<button type="button" class="' + cls + '" data-i="' + idx + '" title="' + title + '">' +
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
    return I.repYear(y);
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
        o.textContent = I.repMonthLabel(i);
        f.appendChild(o);
      }
      var o13 = document.createElement('option');
      o13.value = '13';
      o13.textContent = I.repMonthLabel(13);
      f.appendChild(o13);
      dom.monthInRep.appendChild(f);
    }
    if (dom.gregMonthIn.options.length === 0) {
      var g = document.createDocumentFragment();
      for (var j = 1; j <= 12; j++) {
        var og = document.createElement('option');
        og.value = String(j);
        og.textContent = I.gregMonthLabel(j);
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
    out.label = out.gregText + ' → ' + I.monthLabel(out.month) + ' ' + repYearLabel(out.year);
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

  /* 月份下拉：语言切换后需要重填，故抽成函数 */
  function fillMonthSelects() {
    var keepG = dom.inGM.value;
    var keepR = dom.inRM.value;

    var f = document.createDocumentFragment();
    for (var i = 1; i <= 12; i++) {
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = I.gregMonthLabel(i);
      f.appendChild(o);
    }
    dom.inGM.innerHTML = '';
    dom.inGM.appendChild(f);
    if (keepG) dom.inGM.value = keepG;

    var f2 = document.createDocumentFragment();
    for (var m = 1; m <= 12; m++) {
      var om = document.createElement('option');
      om.value = String(m);
      om.textContent = I.repMonthLabel(m);
      f2.appendChild(om);
    }
    var om13 = document.createElement('option');
    om13.value = '13';
    om13.textContent = I.repMonthLabel(13);
    f2.appendChild(om13);
    dom.inRM.innerHTML = '';
    dom.inRM.appendChild(f2);
    if (keepR) dom.inRM.value = keepR;
  }

  function initConverter() {
    fillMonthSelects();

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
        o.textContent = I.mode() === 'zh' ? d + ' 日' : String(d);
        dom.inRD.appendChild(o);
      }
      dom.inRD.value = String(Math.min(keep, len));
    }

    function gToR() {
      var y = parseInt(dom.inGY.value, 10);
      var mo = parseInt(dom.inGM.value, 10);
      var d = parseInt(dom.inGD.value, 10);
      var out = dom.outRep;
      if (!isFinite(y) || !isFinite(mo) || !isFinite(d)) { out.textContent = t('conv.invalid'); return; }
      var probe = new Date(Date.UTC(y, mo - 1, d));
      if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
        out.textContent = t('conv.invalid');
        return;
      }
      var idx = RC.dayFromGreg(y, mo, d);
      var r = RC.fromDayIndex(idx, S.rule);
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
      var y = parseInt(dom.inRY.value, 10);
      var m = parseInt(dom.inRM.value, 10);
      var d = parseInt(dom.inRD.value, 10);
      if (!isFinite(y) || !isFinite(m) || !isFinite(d)) { dom.outGreg.textContent = t('conv.invalid'); return; }
      var g = RC.gregFromDay(RC.toDayIndex(y, m, d, S.rule));
      dom.outGreg.textContent = I.gregDate(g.y, g.m, g.d);
    }

    [dom.inGY, dom.inGD].forEach(function (i) { i.addEventListener('input', gToR); });
    dom.inGM.addEventListener('change', gToR);
    dom.inRY.addEventListener('input', function () { fillRDays(); rToG(); });
    dom.inRM.addEventListener('change', function () { fillRDays(); rToG(); });
    dom.inRD.addEventListener('change', rToG);

    refreshConverter = function () {
      fillMonthSelects();
      var keep = parseInt(dom.inRD.value, 10) || 1;
      var y = parseInt(dom.inRY.value, 10) || 1;
      var m = parseInt(dom.inRM.value, 10) || 1;
      var len = m >= 13 ? (RC.yearLength(y, S.rule) - 360) : 30;
      while (dom.inRD.options.length > len) dom.inRD.remove(dom.inRD.options.length - 1);
      for (var di = 0; di < dom.inRD.options.length; di++) {
        var n = di + 1;
        dom.inRD.options[di].textContent = I.mode() === 'zh' ? n + ' 日' : String(n);
      }
      while (dom.inRD.options.length < len) {
        var o = document.createElement('option');
        o.value = String(dom.inRD.options.length + 1);
        o.textContent = I.mode() === 'zh' ? (dom.inRD.options.length + 1) + ' 日' : String(dom.inRD.options.length + 1);
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
    setText(dom.ybCount, t('yb.count', { doy: doy, len: yl }));
    dom.ybFill.style.width = pct.toFixed(2) + '%';
    dom.ybMark.style.left = pct.toFixed(2) + '%';
    var a = RC.gregFromDay(ys), b = RC.gregFromDay(ys + yl - 1);
    setText(dom.ybStart, I.gregDateShort(a.y, a.m, a.d));
    setText(dom.ybEnd, I.gregDateShort(b.y, b.m, b.d));
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
    setSeg('langSeg', S.lang);

    setText(dom.ruleBadge, S.rule === 'romme' ? t('badge.romme') : t('badge.equinox'));
    setText(dom.tzNote, S.tz === 'paris' ? t('tz.noteParis') : t('tz.noteLocal'));

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
    segHandler('langSeg', function (v) {
      S.lang = v; saveSettings();
      I.setSetting(v);
      syncSettingsUI();
      I.refresh();
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

  function applyStaticTitles() {
    var t1 = document.querySelector('.ph-text h1');
    if (t1) t1.textContent = t('app.name');
    var t2 = document.getElementById('phSub');
    if (t2) t2.textContent = I.mode() === 'fr' ? 'Horloge décimale' : 'Calendrier républicain';
  }

  function boot() {
    loadSettings();
    I.applyStatic();
    applyStaticTitles();
    I.onChange(function () {
      applyStaticTitles();
      syncSettingsUI();
      refreshAll();
    });
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
      state: function () { return { rule: S.rule, tz: S.tz, theme: S.theme, lang: S.lang, mode: I.mode() }; }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
