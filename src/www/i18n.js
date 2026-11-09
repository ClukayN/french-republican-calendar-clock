/* ─────────────────────────────────────────────────────────────
   法国共和历 · 多语言层（桌面版与安卓版共用）
   ------------------------------------------------------------
   三种显示模式：
     zh = 中法对照（中文为主，法文为副）
     en = 英法对照（法文为专名，英文为副）
     fr = 纯法语（不出现中文，也不出现英文）
   设置项 lang = 'auto' | 'zh' | 'en' | 'fr'
   'auto' 依系统语言：zh* → zh，fr* → fr，其余（含 en*）→ en。
   ──────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var MODES = { zh: 1, en: 1, fr: 1 };

  /* 每个模式：主语言 / 副语言 / 日期格式 */
  var PROFILE = {
    zh: { primary: 'zh', secondary: 'fr', dateStyle: 'zh' },
    en: { primary: 'en', secondary: 'fr', dateStyle: 'en' },
    fr: { primary: 'fr', secondary: null, dateStyle: 'fr' }

  };

  /* ── 界面文案 ────────────────────────────────────────────── */
  var UI = {
    zh: {
      'app.name': '法国共和历',
      'app.sub': 'Calendrier républicain · 十进制时钟',
      'app.documentTitle': '法国共和历 · Calendrier républicain',

      'badge.romme': '定长规则 · 罗姆',
      'badge.equinox': '秋分精确法',
      'btn.today': '回到今日',
      'btn.theme': '切换明暗',
      'btn.settings': '设置',
      'btn.close': '关闭',
      'btn.jump': '跳转',
      'label.decimal': '十进时',
      'label.decimalFr': 'heure décimale',
      'label.clock24': '24 时',
      'note.scale': '1日 = 10十进制小时 = 1,000十进制分钟 = 100,000十进制秒<span class="nw">（1十进制秒 = 0.864秒）</span>',

      'plate.doyComp': '第 {n} 补充日',
      'plate.doy': '第 {n} 日',
      'plate.decadeComp': '补充日 · Sansculottides',
      'plate.decade': '第{cn}旬 · {wd}',
      'plate.complementary': '补充日',
      'plate.noteComp': '岁末六日 · 共和之节庆',
      'plate.year': '共和{cn}年',
      'plate.yearBefore': '共和纪元前{cn}年',
      'plate.greg': '{y} 年 {m} 月 {d} 日 · {wd}',
      'yb.title': '年进度',
      'yb.titleFr': 'Année républicaine',
      'yb.count': '第 {doy} / {len} 日',
      'yb.date': '{y} 年 {m} 月 {d} 日',

      'chip.cat': '物产',
      'chip.today': '今日物产',
      'chip.selected': '所选日期',
      'chip.festival': '岁末节日',

      'conv.title': '日期换算',
      'conv.sub': 'Conversion',
      'conv.toRep': '公历 → 共和历',
      'conv.toGreg': '共和历 → 公历',
      'conv.gregMonth': '公历月',
      'conv.repMonth': '共和月',
      'conv.repDay': '共和日',
      'conv.month': '{n} 月',
      'conv.day': '{n} 日',
      'conv.complementary': '补充日 · Sansculottides',
      'conv.invalid': '日期无效',
      'conv.complementaryDay': '{n} 补充日',
      'conv.repDate': '{day} {monthFr} an {year} ／ {monthCn}{day}日 · {item}',
      'conv.repDateComp': '{day} 补充日 an {year} ／ 补充日{day}日 · {item}',
      'conv.gregDate': '{y} 年 {m} 月 {d} 日',
      'conv.hint': '两个方向都按当前置闰规则计算，切换规则后立即重算。',
      'conv.gotoCal': '在月历中查看这一天',

      'nav.prevYear': '上一年',
      'nav.prevMonth': '上个月',
      'nav.nextMonth': '下个月',
      'nav.nextYear': '下一年',
      'nav.prevYearTitle': '上一年（Shift+↑）',
      'nav.prevMonthTitle': '上个月（←）',
      'nav.nextMonthTitle': '下个月（→）',
      'nav.nextYearTitle': '下一年（Shift+↓）',
      'nav.yearTitle': '跳转到指定年份（Y）',

      'decade.n': '第{cn}旬',
      'decade.comp': '补充日',
      'decade.compShort': '岁末',
      'decade.compNote': '补充日 · 共和历的岁末节日',
      'decade.labelComp': '补充日',

      'year.tabRep': '共和纪年',
      'year.tabGreg': '公元',
      'year.unit': '年',
      'year.repLabel': '共和年号（负数表示共和纪年前）',
      'year.gregLabel': '公元年份',
      'year.repMonthLabel': '共和历月份',
      'year.gregMonthLabel': '公历月份',
      'year.hint': '回车跳转 · ↑↓ 逐年 · Shift+↑↓ 每十年',
      'year.hintMobile': '负数表示共和纪年前',
      'year.preview': '→ {date}',
      'year.beforeEra': '前{cn}年',
      'year.an': 'AN {roman}',

      'foot.info': '共和纪元 · 1792 年 9 月 22 日始',
      'foot.tzLocal': '本地时间 · {tz}',
      'foot.tzParis': '巴黎平太阳时 · UTC+9m21s',
      'foot.ruleRomme': '置闰：罗姆定长规则',
      'foot.ruleEquinox': '置闰：巴黎秋分精确法',
      'foot.scaleRomme': '共和四年起每 4 年一闰 · 世纪修正',
      'foot.scaleEquinox': '岁首依巴黎秋分真时刻',

      'drawer.title': '设置',
      'drawer.sub': 'Réglages',
      'field.rule': '置闰规则',
      'field.ruleFr': 'Intercalation',
      'rule.rommeTitle': '定长规则法 · 罗姆',
      'rule.rommeDesc': '自共和四年起每四年一闰，百年为平、四百年复闰。平均年长与公历一致，新年恒在 9 月 22／23 日。',
      'rule.rommeDescMobile': '自共和四年起每四年一闰，百年为平、四百年复闰。',
      'rule.equinoxTitle': '巴黎秋分精确法',
      'rule.equinoxDesc': '以巴黎子午线（UTC+9m21s）上秋分真实时刻所在日为岁首。共和元年至十四年两种算法相同。',
      'rule.equinoxDescMobile': '以巴黎子午线上秋分真实时刻所在日为岁首。',
      'rule.note2026': '两法在 2026 年相差一日：罗姆法为 18 Brumaire，秋分法为 17 Brumaire。',

      'field.tz': '时钟基准',
      'field.tzFr': 'Référence horaire',
      'tz.local': '本地时间',
      'tz.paris': '巴黎平太阳时',
      'tz.noteLocal': '以本机当地零时为共和历 0 时。',
      'tz.noteParis': '以巴黎子午线（东经 2°20′14″）平太阳时的零时为共和历 0 时，与法国大革命时期一致。',
      'tz.noteParisMobile': '以巴黎子午线平太阳时零时为共和历 0 时。',

      'field.theme': '外观',
      'field.themeFr': 'Apparence',
      'theme.auto': '随系统',
      'theme.light': '羊皮纸',
      'theme.dark': '墨夜',

      'field.lang': '语言',
      'field.langFr': 'Langue',
      'lang.auto': '跟随系统',
      'lang.zh': '中文',
      'lang.en': 'English',
      'lang.fr': 'Français',
      'lang.noteAuto': '按设备语言自动选择：中文 → 中法，法语 → 法文，其他 → 英法。',

      'about.era': '纪元：1792 年 9 月 22 日（1 Vendémiaire an I）。月名与日名依 1793 年 10 月 5 日法令；中文名依中文维基百科。',
      'about.eraEn': '月名与日名依 1793 年 10 月 5 日法令；中文名依中文维基百科。',
      'about.check': '数据与算法核验：9 Thermidor an II = 1794-07-27；18 Brumaire an VIII = 1799-11-09；1 Vendémiaire an XIV = 1805-09-23。',
      'about.checkMobile': '校验点：9 Thermidor an II = 1794-07-27；18 Brumaire an VIII = 1799-11-09；1 Vendémiaire an XIV = 1805-09-23。',

      'tab.clock': '钟',
      'tab.calendar': '日历',
      'tab.convert': '换算',
      'tab.settings': '设置',

      'aria.dial': '双轨表盘',
      'aria.dialEn': '双刻度表盘',
      'aria.dialFr': 'cadran à double graduation'
    },

    en: {
      'app.name': 'French Republican Calendar',
      'app.sub': 'Calendrier républicain · decimal clock',
      'app.documentTitle': 'French Republican Calendar',

      'badge.romme': 'Romme rule',
      'badge.equinox': 'Equinox rule',
      'btn.today': 'Today',
      'btn.theme': 'Toggle theme',
      'btn.settings': 'Settings',
      'btn.close': 'Close',
      'btn.jump': 'Go',
      'label.decimal': 'Decimal time',
      'label.decimalFr': 'heure décimale',
      'label.clock24': '24 h',
      'note.scale': '1 day = 10 decimal hours = 1,000 decimal minutes = 100,000 decimal seconds <span class="nw">(1 decimal second = 0.864 seconds)</span>',

      'plate.doyComp': 'Complementary day {n}',
      'plate.doy': 'Day {n}',
      'plate.decadeComp': 'Sansculottides',
      'plate.decade': 'Décade {n} · {wd}',
      'plate.complementary': 'Complementary day',
      'plate.noteComp': 'The six days that close the year',
      'plate.year': 'Year {roman} of the Republic',
      'plate.yearBefore': 'Year {n} before the Era',
      'plate.greg': '{d} {month} {y} · {wd}',
      'yb.title': 'Year progress',
      'yb.titleFr': '',
      'yb.count': 'Day {doy} / {len}',
      'yb.date': '{d} {month} {y}',

      'chip.cat': 'Item',
      'chip.today': "Today's item",
      'chip.today': "Today's item",
      'chip.selected': 'Selected day',
      'chip.festival': 'Festival',

      'conv.title': 'Date conversion',
      'conv.sub': '',
      'conv.toRep': 'Gregorian → Republican',
      'conv.toGreg': 'Republican → Gregorian',
      'conv.gregMonth': 'Gregorian month',
      'conv.repMonth': 'Republican month',
      'conv.repDay': 'Day',
      'conv.month': '{month}',
      'conv.day': '{n}',
      'conv.complementary': 'Sansculottides',
      'conv.invalid': 'Invalid date',
      'conv.complementaryDay': 'Sansculottide {n}',
      'conv.repDate': '{day} {monthFr} an {year} · {item}',
      'conv.repDateComp': 'Sansculottide {day}, an {year} · {item}',
      'conv.gregDate': '{d} {month} {y}',
      'conv.hint': 'Both directions use the active intercalation rule and update as soon as it changes.',
      'conv.gotoCal': 'Show this day in the calendar',

      'nav.prevYear': 'Previous year',
      'nav.prevMonth': 'Previous month',
      'nav.nextMonth': 'Next month',
      'nav.nextYear': 'Next year',
      'nav.prevYearTitle': 'Previous year',
      'nav.prevMonthTitle': 'Previous month',
      'nav.nextMonthTitle': 'Next month',
      'nav.nextYearTitle': 'Next year',
      'nav.yearTitle': 'Jump to a year',

      'decade.n': 'Décade {n}',
      'decade.comp': 'Sansculottides',
      'decade.compShort': 'Sans.',
      'decade.compNote': 'The six closing days of the republican year',
      'decade.labelComp': 'Sansculottides',

      'year.tabRep': 'Republican',
      'year.tabGreg': 'Gregorian',
      'year.unit': '',
      'year.repLabel': 'Republican year (negative: before the Era)',
      'year.gregLabel': 'Gregorian year',
      'year.repMonthLabel': 'Republican month',
      'year.gregMonthLabel': 'Gregorian month',
      'year.hint': 'Enter to jump · ↑↓ year by year',
      'year.hintMobile': 'Negative numbers are years before the Era',
      'year.preview': '→ {date}',
      'year.beforeEra': '{n} before the Era',
      'year.an': 'AN {roman}',

      'foot.info': 'Republican Era · began 22 September 1792',
      'foot.tzLocal': 'Local time · {tz}',
      'foot.tzParis': 'Paris mean solar time · UTC+9m21s',
      'foot.ruleRomme': 'Intercalation: Romme rule',
      'foot.ruleEquinox': 'Intercalation: true equinox of Paris',
      'foot.scaleRomme': 'Leap year every 4 years from an IV, with century rules',
      'foot.scaleEquinox': 'The year begins on the day of the true equinox in Paris',

      'drawer.title': 'Settings',
      'drawer.sub': 'Réglages',
      'field.rule': 'Intercalation',
      'field.ruleFr': 'Intercalation',
      'rule.rommeTitle': 'Fixed rule · Romme',
      'rule.rommeDesc': 'Leap years every four years from an IV; century years are common, except multiples of 400. Mean year length matches the Gregorian calendar.',
      'rule.rommeDescMobile': 'Leap years every four years from an IV; century years are common, except multiples of 400.',
      'rule.equinoxTitle': 'True equinox of Paris',
      'rule.equinoxDesc': 'Each year begins on the day of the true autumn equinox on the Paris meridian (UTC+9m21s). Both rules agree from an I to an XIV.',
      'rule.equinoxDescMobile': 'Each year begins on the day of the true equinox on the Paris meridian.',
      'rule.note2026': 'The two rules differ by one day in 2026: 18 Brumaire (Romme) vs 17 Brumaire (equinox).',

      'field.tz': 'Time reference',
      'field.tzFr': 'Référence',
      'tz.local': 'Local time',
      'tz.paris': 'Paris mean time',
      'tz.noteLocal': 'Local midnight is taken as 0 h of the republican day.',
      'tz.noteParis': 'Midnight of Paris mean solar time (2°20′14″ E) is taken as 0 h, as under the Revolution.',
      'tz.noteParisMobile': 'Midnight of Paris mean solar time is taken as 0 h.',

      'field.theme': 'Appearance',
      'field.themeFr': 'Apparence',
      'theme.auto': 'System',
      'theme.light': 'Parchment',
      'theme.dark': 'Ink night',

      'field.lang': 'Language',
      'field.langFr': 'Langue',
      'lang.auto': 'Automatic',
      'lang.zh': '中文',
      'lang.en': 'English',
      'lang.fr': 'Français',
      'lang.noteAuto': 'Chosen from the device language: Chinese → Chinese with French, French → French, anything else → English with French.',

      'about.era': 'Era: 22 September 1792 (1 Vendémiaire an I). Month and day names follow the decree of 5 October 1793; Chinese names come from the Chinese Wikipedia.',
      'about.eraEn': 'Month and day names follow the decree of 5 October 1793.',
      'about.check': 'Verified: 9 Thermidor an II = 1794-07-27; 18 Brumaire an VIII = 1799-11-09; 1 Vendémiaire an XIV = 1805-09-23.',
      'about.checkMobile': 'Verified: 9 Thermidor an II = 1794-07-27; 18 Brumaire an VIII = 1799-11-09.',

      'tab.clock': 'Clock',
      'tab.calendar': 'Calendar',
      'tab.convert': 'Convert',
      'tab.settings': 'Settings',

      'aria.dial': 'Double-scale clock face',
      'aria.dialEn': 'Double-scale clock face',
      'aria.dialFr': 'cadran à double graduation'
    },

    fr: {
      'app.name': 'Calendrier républicain',
      'app.sub': 'Horloge décimale',
      'app.documentTitle': 'Calendrier républicain',

      'badge.romme': 'Règle de Romme',
      'badge.equinox': 'Équinoxe vrai',
      'btn.today': "Aujourd'hui",
      'btn.theme': 'Changer de thème',
      'btn.settings': 'Réglages',
      'btn.close': 'Fermer',
      'btn.jump': 'Aller',
      'label.decimal': 'Heure décimale',
      'label.decimalFr': '',
      'label.clock24': '24 h',
      'note.scale': '1 jour = 10 heures décimales = 1 000 minutes décimales = 100 000 secondes décimales <span class="nw">(1 seconde décimale = 0,864 seconde)</span>',

      'plate.doyComp': '{n}ᵉ jour complémentaire',
      'plate.doy': '{n}ᵉ jour',
      'plate.decadeComp': 'Sansculottides',
      'plate.decade': '{n}ᵉ décade · {wd}',
      'plate.complementary': 'Jour complémentaire',
      'plate.noteComp': 'Les six derniers jours de l’année',
      'plate.year': 'An {roman} de la République',
      'plate.yearBefore': 'AN −{n}',
      'plate.yearSub': '{n}ᵉ année de la République',
      'plate.greg': '{wd} {d} {month} {y}',
      'yb.title': 'Progression de l’année',
      'yb.titleFr': '',
      'yb.count': 'Jour {doy} / {len}',
      'yb.date': '{d} {month} {y}',

      'chip.cat': 'Objet',
      'chip.today': 'Objet du jour',
      'chip.selected': 'Jour choisi',
      'chip.festival': 'Fête',

      'conv.title': 'Conversion de dates',
      'conv.sub': '',
      'conv.toRep': 'Grégorien → républicain',
      'conv.toGreg': 'Républicain → grégorien',
      'conv.gregMonth': 'Mois grégorien',
      'conv.repMonth': 'Mois républicain',
      'conv.repDay': 'Jour',
      'conv.month': '{month}',
      'conv.day': '{n}',
      'conv.complementary': 'Sansculottides',
      'conv.invalid': 'Date invalide',
      'conv.complementaryDay': 'Sansculottide {n}',
      'conv.repDate': '{day} {monthFr} an {year} · {item}',
      'conv.repDateComp': 'Sansculottide {day}, an {year} · {item}',
      'conv.gregDate': '{d} {month} {y}',
      'conv.hint': 'Les deux sens suivent la règle d’intercalation active et se recalculent aussitôt.',
      'conv.gotoCal': 'Voir ce jour dans le calendrier',

      'nav.prevYear': 'Année précédente',
      'nav.prevMonth': 'Mois précédent',
      'nav.nextMonth': 'Mois suivant',
      'nav.nextYear': 'Année suivante',
      'nav.prevYearTitle': 'Année précédente',
      'nav.prevMonthTitle': 'Mois précédent',
      'nav.nextMonthTitle': 'Mois suivant',
      'nav.nextYearTitle': 'Année suivante',
      'nav.yearTitle': 'Aller à une année',

      'decade.n': '{n}ᵉ décade',
      'decade.comp': 'Sansculottides',
      'decade.compShort': 'Sans.',
      'decade.compNote': 'Les six derniers jours de l’année républicaine',
      'decade.labelComp': 'Sansculottides',

      'year.tabRep': 'République',
      'year.tabGreg': 'Grégorien',
      'year.unit': '',
      'year.repLabel': 'Année républicaine (négatif : avant l’ère)',
      'year.gregLabel': 'Année grégorienne',
      'year.repMonthLabel': 'Mois républicain',
      'year.gregMonthLabel': 'Mois grégorien',
      'year.hint': 'Entrée pour aller · ↑↓ année par année',
      'year.hintMobile': 'Les nombres négatifs précèdent l’ère',
      'year.preview': '→ {date}',
      'year.beforeEra': '{n} avant l’ère',
      'year.an': 'AN {roman}',

      'foot.info': 'Ère républicaine · commencée le 22 septembre 1792',
      'foot.tzLocal': 'Heure locale · {tz}',
      'foot.tzParis': 'Heure moyenne de Paris · UTC+9m21s',
      'foot.ruleRomme': 'Intercalation : règle de Romme',
      'foot.ruleEquinox': 'Intercalation : équinoxe vrai de Paris',
      'foot.scaleRomme': 'Année sextile tous les 4 ans à partir de l’an IV, avec règles séculaires',
      'foot.scaleEquinox': 'L’année commence le jour de l’équinoxe vrai à Paris',

      'drawer.title': 'Réglages',
      'drawer.sub': 'Réglages',
      'field.rule': 'Intercalation',
      'field.ruleFr': '',
      'rule.rommeTitle': 'Règle fixe · Romme',
      'rule.rommeDesc': 'Année sextile tous les quatre ans à partir de l’an IV ; les années séculaires sont communes, sauf les multiples de 400. Durée moyenne identique au calendrier grégorien.',
      'rule.rommeDescMobile': 'Année sextile tous les quatre ans à partir de l’an IV ; années séculaires communes, sauf multiples de 400.',
      'rule.equinoxTitle': 'Équinoxe vrai de Paris',
      'rule.equinoxDesc': 'Chaque année commence le jour de l’équinoxe d’automne vrai au méridien de Paris (UTC+9m21s). Les deux règles coïncident de l’an I à l’an XIV.',
      'rule.equinoxDescMobile': 'Chaque année commence le jour de l’équinoxe vrai au méridien de Paris.',
      'rule.note2026': 'Les deux règles diffèrent d’un jour en 2026 : 18 Brumaire (Romme) contre 17 Brumaire (équinoxe).',

      'field.tz': 'Référence horaire',
      'field.tzFr': '',
      'tz.local': 'Heure locale',
      'tz.paris': 'Heure de Paris',
      'tz.noteLocal': 'Minuit local est pris pour 0 h du jour républicain.',
      'tz.noteParis': 'Minuit de l’heure moyenne de Paris (2°20′14″ E) est pris pour 0 h, comme sous la Révolution.',
      'tz.noteParisMobile': 'Minuit de l’heure moyenne de Paris est pris pour 0 h.',

      'field.theme': 'Apparence',
      'field.themeFr': '',
      'theme.auto': 'Système',
      'theme.light': 'Parchemin',
      'theme.dark': 'Nuit d’encre',

      'field.lang': 'Langue',
      'field.langFr': '',
      'lang.auto': 'Automatique',
      'lang.zh': '中文',
      'lang.en': 'English',
      'lang.fr': 'Français',
      'lang.noteAuto': 'Choisie d’après la langue de l’appareil : chinois → chinois avec français, français → français, autre → anglais avec français.',

      'about.era': 'Ère : 22 septembre 1792 (1 Vendémiaire an I). Noms des mois et des jours d’après le décret du 5 octobre 1793.',
      'about.eraEn': 'Noms des mois et des jours d’après le décret du 5 octobre 1793.',
      'about.check': 'Vérifications : 9 Thermidor an II = 1794-07-27 ; 18 Brumaire an VIII = 1799-11-09 ; 1 Vendémiaire an XIV = 1805-09-23.',
      'about.checkMobile': 'Vérifications : 9 Thermidor an II = 1794-07-27 ; 18 Brumaire an VIII = 1799-11-09.',

      'tab.clock': 'Horloge',
      'tab.calendar': 'Calendrier',
      'tab.convert': 'Convertir',
      'tab.settings': 'Réglages',

      'aria.dial': 'Cadran à double graduation',
      'aria.dialEn': 'Cadran à double graduation',
      'aria.dialFr': 'cadran à double graduation'
    }
  };

  /* ── 词表 ────────────────────────────────────────────────── */
  var WEEKDAYS = {
    zh: ['一日', '二日', '三日', '四日', '五日', '六日', '七日', '八日', '九日', '十日'],
    en: ['Primidi', 'Duodi', 'Tridi', 'Quartidi', 'Quintidi', 'Sextidi', 'Septidi', 'Octidi', 'Nonidi', 'Décadi'],
    fr: ['Primidi', 'Duodi', 'Tridi', 'Quartidi', 'Quintidi', 'Sextidi', 'Septidi', 'Octidi', 'Nonidi', 'Décadi']
  };

  /* 公历星期（0 = 星期日） */
  var GREG_WEEK = {
    zh: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
  };

  var GREG_MONTHS = {
    zh: ['1 月', '2 月', '3 月', '4 月', '5 月', '6 月', '7 月', '8 月', '9 月', '10 月', '11 月', '12 月'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
  };

  var CATS = {
    zh: { '植物': '植物', '动物': '动物', '农具': '农具', '矿物': '矿物', '物产': '物产', '场所': '场所', '器物': '器物', '节日': '节日' },
    en: { '植物': 'Plant', '动物': 'Animal', '农具': 'Tool', '矿物': 'Mineral', '物产': 'Produce', '场所': 'Place', '器物': 'Object', '节日': 'Festival' },
    fr: { '植物': 'Plante', '动物': 'Animal', '农具': 'Outil', '矿物': 'Minéral', '物产': 'Produit', '场所': 'Lieu', '器物': 'Objet', '节日': 'Fête' }
  };

  var SEASONS = {
    zh: { '春': '春', '夏': '夏', '秋': '秋', '冬': '冬' },
    en: { '春': 'Spring', '夏': 'Summer', '秋': 'Autumn', '冬': 'Winter' },
    fr: { '春': 'Printemps', '夏': 'Été', '秋': 'Automne', '冬': 'Hiver' }
  };

  var CN_DIGIT = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

  /* ── 内部状态 ────────────────────────────────────────────── */
  var setting = 'auto';      /* 'auto' | 'zh' | 'en' | 'fr' */
  var mode = 'zh';
  var listeners = [];

  /* 语言标签 → 显示模式：中文（含繁中与各地区的 zh-Hant/zh-TW/zh-HK…、
     以及 cmn/yue 这类汉语变体）一律 zh；法语 fr 一律 fr；其余 en。
     可传入标签或标签数组，便于测试；不传则读 navigator。 */
  function modeOfTag(tag) {
    tag = String(tag || '').toLowerCase().replace(/_/g, '-');
    if (!tag) return null;
    if (tag.indexOf('zh') === 0 || tag.indexOf('cmn') === 0 || tag.indexOf('yue') === 0) return 'zh';
    if (tag.indexOf('fr') === 0) return 'fr';
    if (tag.indexOf('en') === 0) return 'en';
    return null;
  }

  function detect(tags) {
    var list = tags;
    if (!list) {
      try {
        list = navigator.languages && navigator.languages.length
          ? navigator.languages
          : [navigator.language || ''];
      } catch (e) { list = []; }
    }
    if (typeof list === 'string') list = [list];
    var fallback = null;
    for (var i = 0; i < list.length; i++) {
      var m = modeOfTag(list[i]);
      if (!m) continue;
      if (i === 0) return m;            /* 首要语言直接决定 */
      if (!fallback) fallback = m;      /* 次要语言里优先找 zh / fr */
    }
    return fallback || 'en';
  }

  function resolve() {
    if (setting === 'zh' || setting === 'en' || setting === 'fr') return setting;
    return detect();
  }

  function lang() { return mode; }
  function profile() { return PROFILE[mode]; }
  function secondary() { return PROFILE[mode].secondary; }

  /* 中文数字 */
  function cnNumber(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return '〇';
    if (n < 10) return CN_DIGIT[n];
    if (n < 100) {
      var t = Math.floor(n / 10), u = n % 10;
      return (t === 1 ? '十' : CN_DIGIT[t] + '十') + (u ? CN_DIGIT[u] : '');
    }
    if (n < 1000) {
      var h = Math.floor(n / 100), r2 = n % 100;
      var s = CN_DIGIT[h] + '百';
      if (r2 === 0) return s;
      if (r2 < 10) return s + '〇' + CN_DIGIT[r2];
      if (r2 < 20) return s + '一' + cnNumber(r2);
      return s + cnNumber(r2);
    }
    if (n < 10000) {
      var k = Math.floor(n / 1000), r3 = n % 1000;
      var s2 = CN_DIGIT[k] + '千';
      if (r3 === 0) return s2;
      if (r3 < 100) return s2 + '〇' + (r3 < 10 ? CN_DIGIT[r3] : cnNumber(r3));
      return s2 + cnNumber(r3);
    }
    return String(n);
  }

  /* 文案取值 + {占位} 替换 */
  function t(key, vars) {
    var pack = UI[mode] || UI.zh;
    var s = pack[key];
    if (s === undefined) s = UI.zh[key];
    if (s === undefined) return key;
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, name) {
      return vars[name] === undefined || vars[name] === null ? '' : String(vars[name]);
    });
  }

  /* ── 格式化 ──────────────────────────────────────────────── */
  function trimSep(str) {
    return String(str).replace(/\s*[·／,，]\s*$/, '').replace(/\s{2,}/g, ' ').trim();
  }

  function gregDate(y, m, d, opts) {
    var wd = '';
    if (opts && opts.weekday === true) {
      var dt = new Date(Date.UTC(y, m - 1, d));
      wd = GREG_WEEK[mode][dt.getUTCDay()];
    }
    if (mode === 'zh') {
      return trimSep(t('plate.greg', { y: y, m: m, d: d, wd: wd }));
    }
    return trimSep(t('plate.greg', { y: y, d: d, month: GREG_MONTHS[mode][m - 1], wd: wd }));
  }

  function gregDateShort(y, m, d) {
    if (mode === 'zh') return t('yb.date', { y: y, m: m, d: d });
    return t('yb.date', { y: y, d: d, month: GREG_MONTHS[mode][m - 1] });
  }

  /* 共和年号：AN CCXXXV / 前四年 / AN −4 */
  function repYear(y) {
    if (y > 0) return t('year.an', { roman: (global.RC ? global.RC.roman(y) : String(y)) });
    return t('year.beforeEra', { n: mode === 'zh' ? cnNumber(1 - y) : (1 - y) });
  }

  /* 年号下方那行（中文是汉字数字，法语是第 N 年） */
  function repYearSub(y) {
    var roman = global.RC ? global.RC.roman(Math.abs(y)) : String(Math.abs(y));
    if (y > 0) return t('plate.year', { cn: cnNumber(y), roman: roman });
    return t('plate.yearBefore', { cn: cnNumber(1 - y), roman: roman });
  }

  function decade(n) {
    if (mode === 'fr' && n === 1) return '1ʳᵉ décade';
    return t('decade.n', { n: mode === 'zh' ? cnNumber(n) : n, cn: cnNumber(n) });
  }

  function monthPrimary(month) {
    /* 共和月名的「专名」始终是法文 */
    if (month >= 13) return t('plate.complementary');
    var mo = global.CALENDAR_DATA.months[month - 1];
    return mo.fr;
  }

  function monthSecondary(month) {
    if (month >= 13) return null;
    var mo = global.CALENDAR_DATA.months[month - 1];
    if (mode === 'zh') return mo.cn;
    if (mode === 'en') return mo.en || null;
    return null;
  }

  /* 年月跳转面板里用的简短月名：中文模式用中文，其余用法文专名 */
  function monthLabel(month) {
    if (month >= 13) return t('plate.complementary');
    var mo = global.CALENDAR_DATA.months[month - 1];
    return mode === 'zh' ? mo.cn : mo.fr;
  }

  function monthUpper(month) {
    var s = monthPrimary(month);
    return mode === 'fr' ? s : s.toUpperCase();
  }

  function dayName(dd) {
    if (mode === 'zh') return dd.cn;
    if (mode === 'en') return dd.en || dd.fr;
    return dd.fr;
  }

  function daySecondary(dd) {
    if (mode === 'fr') return null;
    return mode === 'zh' ? dd.fr : (dd.en ? dd.fr : null);
  }

  function dayDesc(dd) {
    if (mode === 'zh') return dd.desc;
    if (mode === 'en') return dd.descEn || '';
    return dd.descFr || '';
  }

  /* 下拉/选项里的月名：中文带法文、英文带法文、法文只有法文 */
  function capFirst(w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : w; }

  function gregMonthLabel(m) {
    var fr = capFirst(GREG_MONTHS.fr[m - 1]);
    if (mode === 'zh') return GREG_MONTHS.zh[m - 1] + ' · ' + fr;
    if (mode === 'en') return GREG_MONTHS.en[m - 1] + ' · ' + GREG_MONTHS.fr[m - 1];
    return GREG_MONTHS.fr[m - 1];
  }

  function repMonthLabel(month) {
    if (month >= 13) {
      return mode === 'zh' ? t('plate.complementary') + ' · Sansculottides' : 'Sansculottides';
    }
    var mo = global.CALENDAR_DATA.months[month - 1];
    if (mode === 'zh') return mo.cn + ' · ' + mo.fr;
    if (mode === 'en') return mo.fr + (mo.en ? ' · ' + mo.en : '');
    return mo.fr;
  }

  function cat(c) { return (CATS[mode] && CATS[mode][c]) || c || ''; }

  function season(s) { return (SEASONS[mode] && SEASONS[mode][s]) || s || ''; }

  /* 旬内第九日这类名字：中文界面沿用原版排印习惯显示法文名 */
  function weekdayOf(repWeekdayIndex) {
    if (mode === 'zh') return WEEKDAYS.fr[repWeekdayIndex];
    return WEEKDAYS[mode][repWeekdayIndex];
  }

  function gregWeekdayName(jsDay) { return GREG_WEEK[mode][jsDay]; }

  function gregMonthName(m) { return GREG_MONTHS[mode][m - 1]; }

  function cityName(tz) { return tz; }

  /* ── 应用：静态文本 ──────────────────────────────────────── */
  function applyStatic(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-i18n');
      var s = t(key);
      if (s === '') { el.style.display = 'none'; }
      else {
        el.style.display = '';
        el.textContent = s;
      }
    }
    var htmls = scope.querySelectorAll('[data-i18n-html]');
    for (var j = 0; j < htmls.length; j++) {
      var h = htmls[j];
      h.innerHTML = t(h.getAttribute('data-i18n-html'));
    }
    var attrs = scope.querySelectorAll('[data-i18n-title]');
    for (var k = 0; k < attrs.length; k++) {
      attrs[k].title = t(attrs[k].getAttribute('data-i18n-title'));
    }
    var arias = scope.querySelectorAll('[data-i18n-aria]');
    for (var a = 0; a < arias.length; a++) {
      arias[a].setAttribute('aria-label', t(arias[a].getAttribute('data-i18n-aria')));
    }
    var titles = scope.querySelectorAll('[data-i18n-doctitle]');
    if (titles.length) document.title = t(titles[0].getAttribute('data-i18n-doctitle'));
  }

  /* ── 对外接口 ────────────────────────────────────────────── */
  function setSetting(v) {
    setting = (v === 'zh' || v === 'en' || v === 'fr') ? v : 'auto';
    var next = resolve();
    var changed = next !== mode;
    mode = next;
    if (changed) {
      document.documentElement.setAttribute('lang', mode === 'zh' ? 'zh-HanS' : mode);
      document.documentElement.setAttribute('data-lang', mode);
    }
    return changed;
  }

  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

  function fire() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](mode); } catch (e) { /* 忽略 */}
    }
  }

  /* 语言切换后统一刷新：静态文案 → 动态重绘（由各页面注册） */
  function refresh() {
    applyStatic();
    fire();
  }

  mode = resolve();
  document.documentElement.setAttribute('lang', mode === 'zh' ? 'zh-HanS' : mode);
  document.documentElement.setAttribute('data-lang', mode);

  global.I18N = {
    setSetting: setSetting,
    resolve: resolve,
    get setting() { return setting; },
    detect: detect,
    mode: lang,
    profile: profile,
    secondary: secondary,
    t: t,
    onChange: onChange,
    refresh: refresh,
    applyStatic: applyStatic,
    cnNumber: cnNumber,
    gregDate: gregDate,
    gregDateShort: gregDateShort,
    gregMonthName: gregMonthName,
    gregMonthLabel: gregMonthLabel,
    repMonthLabel: repMonthLabel,
    gregWeekdayName: gregWeekdayName,
    repYear: repYear,
    repYearSub: repYearSub,
    decade: decade,
    monthPrimary: monthPrimary,
    monthLabel: monthLabel,
    monthSecondary: monthSecondary,
    monthUpper: monthUpper,
    dayName: dayName,
    daySecondary: daySecondary,
    dayDesc: dayDesc,
    cat: cat,
    season: season,
    weekdayOf: weekdayOf,
    MODES: MODES
  };
})(this);
