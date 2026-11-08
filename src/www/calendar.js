/* =========================================================================
   法国共和历 · 核心历法模块  (Calendrier républicain — noyau)
   -------------------------------------------------------------------------
   - 纪元: 1792-09-22 = 1 Vendémiaire an I
   - 两种置闰规则（对应法文维基所述 Romme 体系下并存的两套方案）:
       'romme'   罗姆定长规则: 自共和四年（an IV）起每四年一闰（年号为 4 的倍数），
                 并以格里历式世纪修正：百年（C、CC、CCC…）为平年，四百年的倍数
                 仍为闰年，第四十个世纪（an MMMM = 4000）例外为平年。
                 此法与公历的平均年长 365.2425 日一致，故新年始终落在 9 月 22/23 日。
       'equinox' 巴黎秋分精确法: 以巴黎子午线（UTC+9m20.93s）上观测到的
                 九月秋分所在日期为 1 Vendémiaire（an I 至 an XIV 的史实做法）
   - 所有换算均以“距纪元的日数”(dayIndex) 为中转, 不依赖累加
   ========================================================================= */
(function (global) {
  'use strict';

  /* ---------- 儒略日 <-> 公历 ---------- */
  function gregToJDN(y, m, d) {
    var a = Math.floor((14 - m) / 12);
    var y2 = y + 4800 - a;
    var m2 = m + 12 * a - 3;
    return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 +
      Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
  }

  function jdnToGreg(jdn) {
    var a = jdn + 32044;
    var b = Math.floor((4 * a + 3) / 146097);
    var c = a - Math.floor(146097 * b / 4);
    var d = Math.floor((4 * c + 3) / 1461);
    var e = c - Math.floor(1461 * d / 4);
    var m = Math.floor((5 * e + 2) / 153);
    return {
      y: 100 * b + d - 4800 + Math.floor(m / 10),
      m: m + 3 - 12 * Math.floor(m / 10),
      d: e - Math.floor((153 * m + 2) / 5) + 1
    };
  }

  /* 1792-09-22 的儒略日数 */
  var EPOCH_JDN = gregToJDN(1792, 9, 22);          /* = 2375839 */
  var EPOCH_DAY = EPOCH_JDN;                        /* 以“日”为单位的绝对坐标 */

  /* 公历日期 -> dayIndex（0 = 1792-09-22） */
  function dayFromGreg(y, m, d) { return gregToJDN(y, m, d) - EPOCH_DAY; }
  function gregFromDay(idx) { return jdnToGreg(idx + EPOCH_DAY); }

  /* ---------- ΔT (TT - UT), Espenak & Meeus 多项式 ---------- */
  function deltaT(year) {
    var t, u;
    if (year >= 2005 && year < 2050) { t = year - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
    if (year >= 1986 && year < 2005) { t = year - 2000; return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t * t * t + 0.000651814 * Math.pow(t, 4) + 0.00002373599 * Math.pow(t, 5); }
    if (year >= 1961 && year < 1986) { t = year - 1975; return 45.45 + 1.067 * t - t * t / 260 - t * t * t / 718; }
    if (year >= 1941 && year < 1961) { t = year - 1950; return 29.07 + 0.407 * t - t * t / 233 + t * t * t / 2547; }
    if (year >= 1920 && year < 1941) { t = year - 1920; return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * t * t * t; }
    if (year >= 1900 && year < 1920) { t = year - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t * t * t - 0.000197 * Math.pow(t, 4); }
    if (year >= 1860 && year < 1900) { t = year - 1860; return 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * Math.pow(t, 3) - 0.0004473624 * Math.pow(t, 4) + Math.pow(t, 5) / 233174; }
    if (year >= 1800 && year < 1860) { t = year - 1800; return 13.72 - 0.332447 * t + 0.0068612 * t * t + 0.0041116 * Math.pow(t, 3) - 0.00037436 * Math.pow(t, 4) + 0.0000121272 * Math.pow(t, 5) - 0.0000001699 * Math.pow(t, 6) + 0.000000000875 * Math.pow(t, 7); }
    if (year >= 1700 && year < 1800) { t = (year - 1700) / 100; return 8.83 + 0.1603 * t - 0.0059285 * t * t + 0.00013336 * Math.pow(t, 3) - Math.pow(t, 4) / 1174000; }
    if (year >= 2050 && year < 2150) {
      u = (year - 1820) / 100;
      return -20 + 32 * u * u - 0.5628 * (2150 - year);
    }
    u = (year - 1820) / 100;
    return -20 + 32 * u * u;
  }

  /* ---------- 九月秋分（Meeus《Astronomical Algorithms》第 27 章） ---------- */
  var TERMS = [
    [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186],
    [182, 27.85, 445267.112], [156, 73.14, 45036.886], [136, 171.52, 22518.443],
    [77, 222.54, 65928.934], [74, 296.72, 3034.906], [70, 243.58, 9037.513],
    [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
    [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417],
    [18, 155.12, 67555.328], [17, 288.79, 4562.452], [16, 198.04, 62894.029],
    [14, 199.76, 31436.921], [12, 95.39, 14577.848], [12, 287.11, 31931.756],
    [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074]
  ];

  /* 返回公历 year 年九月秋分的 JDE（力学时 TT） */
  function septemberEquinoxJDE(year) {
    var Y = (year - 2000) / 1000;
    var y2 = Y * Y, y3 = y2 * Y, y4 = y3 * Y;
    var jde0 = 2451810.21715 + 365242.01767 * Y - 0.11575 * y2 + 0.00337 * y3 + 0.00078 * y4;
    var T = (jde0 - 2451545.0) / 36525;
    var W = (35999.373 * T - 2.47) * Math.PI / 180;
    var dLambda = 1 + 0.0334 * Math.cos(W) + 0.0007 * Math.cos(2 * W);
    var S = 0;
    for (var i = 0; i < TERMS.length; i++) {
      S += TERMS[i][0] * Math.cos((TERMS[i][1] + TERMS[i][2] * T) * Math.PI / 180);
    }
    return jde0 + 0.00001 * S / dLambda;
  }

  /* 巴黎平太阳时相对 UT 的偏移（秒）：2°20'14.025" E */
  var PARIS_OFFSET_SEC = 9 * 60 + 20.93;

  /* 公历 year 年秋分在巴黎所处的公历日期（返回 JDN） */
  function equinoxParisJDN(year) {
    var jde = septemberEquinoxJDE(year);            /* TT */
    var jdParis = jde - deltaT(year) / 86400 + PARIS_OFFSET_SEC / 86400;
    /* 巴黎午夜时刻的小时数，用于判断是否跨日（仅作诊断用） */
    return Math.floor(jdParis + 0.5);
  }

  /* ---------- 年起点 ---------- */
  /* 向负无穷取整的除法与取模 */
  function fdiv(a, b) { return Math.floor(a / b); }
  function fmod(a, b) { return a - b * Math.floor(a / b); }

  /* 罗姆定长规则：闰年为 4 的倍数，但 C/CC/CCC 等百年为平年（四百年仍闰），
     an MMMM（4000）为平年。 */
  function rommeLeap(Y) {
    if (fmod(Y, 4000) === 0) return false;          /* 第四十个世纪，平年 */
    if (fmod(Y, 400) === 0) return true;
    if (fmod(Y, 100) === 0) return false;
    return fmod(Y, 4) === 0;
  }

  /* 1..n 中的闰年数 */
  function rommeLeapCount(n) {
    return fdiv(n, 4) - fdiv(n, 100) + fdiv(n, 400) - fdiv(n, 4000);
  }

  function rommeYearStart(Y) {
    return 365 * (Y - 1) + rommeLeapCount(Y - 1);
  }

  var eqCache = {};
  function equinoxYearStart(Y) {
    if (eqCache[Y] !== undefined) return eqCache[Y];
    var gregYear = Y + 1791;
    var jdn = equinoxParisJDN(gregYear);
    var v = jdn - EPOCH_DAY;
    eqCache[Y] = v;
    return v;
  }

  /* 年起点。
     两套规则在共和元年至十四年（历法实际施行的 1792–1805 年）一律采用
     史实的巴黎秋分历表，故任何人查询这一时期都会得到真实的历史日期
     （如 18 Brumaire an VIII = 1799-11-09）；自共和十五年起（1806 年以后
     的推演）才按所选规则分流：秋分法继续依天文推算，罗姆法则依定长周期。 */
  var HISTORICAL_LAST_YEAR = 14;

  function yearStart(Y, rule) {
    if (Y <= HISTORICAL_LAST_YEAR) return equinoxYearStart(Y);
    return rule === 'equinox' ? equinoxYearStart(Y) : rommeYearStart(Y);
  }

  function yearLength(Y, rule) {
    return yearStart(Y + 1, rule) - yearStart(Y, rule);
  }

  function isLeapYear(Y, rule) {
    return yearLength(Y, rule) > 365;
  }

  /* ---------- dayIndex -> 共和历日期 ---------- */
  function fromDayIndex(idx, rule) {
    rule = rule || 'romme';
    var Y = Math.floor((idx) / 365.2425) + 1;
    while (yearStart(Y, rule) > idx) Y--;
    while (yearStart(Y + 1, rule) <= idx) Y++;
    var off = idx - yearStart(Y, rule);
    var len = yearLength(Y, rule);
    if (off < 360) {
      return { year: Y, month: Math.floor(off / 30) + 1, day: (off % 30) + 1, comp: 0, ylen: len };
    }
    return { year: Y, month: 13, day: off - 359, comp: off - 359, ylen: len };
  }

  /* ---------- 共和历日期 -> dayIndex ---------- */
  function toDayIndex(Y, month, day, rule) {
    rule = rule || 'romme';
    var base = yearStart(Y, rule);
    if (month >= 13) return base + 360 + (day - 1);
    return base + (month - 1) * 30 + (day - 1);
  }

  /* ---------- 罗马数字 ---------- */
  function roman(n) {
    if (n <= 0 || n >= 4000) return String(n);
    var map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    var s = '';
    for (var i = 0; i < map.length; i++) {
      while (n >= map[i][0]) { s += map[i][1]; n -= map[i][0]; }
    }
    return s;
  }

  /* ---------- 物产名录 ---------- */
  var DATA = null;
  function setData(d) { DATA = d; }

  function monthInfo(m) {                       /* m: 1..12 */
    if (!DATA) return null;
    return DATA.months[m - 1];
  }

  function dayDedication(month, day) {
    if (!DATA) return null;
    if (month >= 13) {
      var s = DATA.sansculottides[Math.min(day, 6) - 1];
      return s ? { fr: s.fr, cn: s.cn, cat: s.cat, desc: s.desc } : null;
    }
    var mi = monthInfo(month);
    if (!mi) return null;
    var dd = mi.days[day - 1];
    if (!dd) return null;
    return { fr: dd.fr, cn: dd.cn, cat: dd.cat, desc: dd.desc };
  }

  /* 共和历日名（中文 / 法文） */
  function dayNames(month, day) {
    var d = dayDedication(month, day);
    return d ? { fr: d.fr, cn: d.cn } : { fr: '', cn: '' };
  }

  /* ---------- 十进制时间 ---------- */
  /* 返回一天内的十进制时刻。
     seconds: 自午夜起经过的公历秒（可为小数） */
  function decimalTime(seconds) {
    var total = 100000;                       /* 一日的十进制秒数 */
    var f = seconds / 86400;
    if (f < 0) f = 0;
    var abs = f * total;                      /* 十进制秒 */
    var h = Math.floor(abs / 10000);
    var m = Math.floor((abs / 100) % 100);
    var s = abs % 100;
    return { h: h, m: m, s: s, abs: abs };
  }

  var API = {
    EPOCH_JDN: EPOCH_JDN,
    EPOCH_DAY: EPOCH_DAY,
    PARIS_OFFSET_SEC: PARIS_OFFSET_SEC,
    gregToJDN: gregToJDN,
    jdnToGreg: jdnToGreg,
    dayFromGreg: dayFromGreg,
    gregFromDay: gregFromDay,
    deltaT: deltaT,
    septemberEquinoxJDE: septemberEquinoxJDE,
    equinoxParisJDN: equinoxParisJDN,
    yearStart: yearStart,
    yearLength: yearLength,
    isLeapYear: isLeapYear,
    fromDayIndex: fromDayIndex,
    toDayIndex: toDayIndex,
    roman: roman,
    setData: setData,
    monthInfo: monthInfo,
    dayDedication: dayDedication,
    dayNames: dayNames,
    decimalTime: decimalTime
  };

  global.RC = API;
})(typeof window !== 'undefined' ? window : globalThis);
