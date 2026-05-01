import NepaliDate, { dateConfigMap } from "nepali-date-converter";

export const NEPALI_MONTHS_EN = [
  "Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Aswin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

export const NEPALI_MONTHS_NP = [
  "बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज",
  "कार्तिक", "मंसिर", "पुष", "माघ", "फाल्गुन", "चैत",
];

export const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAYS_NP = ["आइत", "सोम", "मंगल", "बुध", "बिहि", "शुक्र", "शनि"];

const NP_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
export const toNepaliDigits = (n: number | string) =>
  String(n).split("").map(c => (/\d/.test(c) ? NP_DIGITS[+c] : c)).join("");

export interface BSCell {
  bsYear: number;
  bsMonth: number; // 0-11
  bsDay: number;
  adYear: number;
  adMonth: number; // 0-11 (JS)
  adDay: number;
  weekday: number; // 0=Sun
  isoDate: string; // YYYY-MM-DD AD
  isCurrentMonth: boolean;
  isToday: boolean;
}

const isoFromAd = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function getDaysInBsMonth(year: number, monthIdx: number): number {
  const cfg = (dateConfigMap as any)[String(year)];
  if (!cfg) {
    // fallback: try to walk
    try {
      let count = 0;
      while (count < 33) {
        const nd = new NepaliDate(year, monthIdx, count + 1);
        if (nd.getMonth() !== monthIdx) break;
        count++;
      }
      return count || 30;
    } catch {
      return 30;
    }
  }
  return cfg[NEPALI_MONTHS_EN[monthIdx]] ?? 30;
}

export function buildMonthCells(bsYear: number, bsMonth: number): BSCell[] {
  const days = getDaysInBsMonth(bsYear, bsMonth);
  const todayBs = new NepaliDate();
  const tBS = todayBs.getBS();

  const first = new NepaliDate(bsYear, bsMonth, 1);
  const startWeekday = first.getDay(); // 0=Sun

  const cells: BSCell[] = [];

  // previous-month padding
  if (startWeekday > 0) {
    let prevYear = bsYear, prevMonth = bsMonth - 1;
    if (prevMonth < 0) { prevMonth = 11; prevYear -= 1; }
    const prevDays = getDaysInBsMonth(prevYear, prevMonth);
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = prevDays - i;
      const nd = new NepaliDate(prevYear, prevMonth, d);
      const ad = nd.getAD();
      cells.push({
        bsYear: prevYear, bsMonth: prevMonth, bsDay: d,
        adYear: ad.year, adMonth: ad.month, adDay: ad.date,
        weekday: nd.getDay(),
        isoDate: isoFromAd(ad.year, ad.month, ad.date),
        isCurrentMonth: false,
        isToday: false,
      });
    }
  }

  // current month
  for (let d = 1; d <= days; d++) {
    const nd = new NepaliDate(bsYear, bsMonth, d);
    const ad = nd.getAD();
    cells.push({
      bsYear, bsMonth, bsDay: d,
      adYear: ad.year, adMonth: ad.month, adDay: ad.date,
      weekday: nd.getDay(),
      isoDate: isoFromAd(ad.year, ad.month, ad.date),
      isCurrentMonth: true,
      isToday: tBS.year === bsYear && tBS.month === bsMonth && tBS.date === d,
    });
  }

  // trailing padding to complete weeks (multiple of 7), keep grid 6 rows max
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    let nextYear = last.bsYear, nextMonth = last.bsMonth, nextDay = last.bsDay + 1;
    const lastMonthDays = getDaysInBsMonth(last.bsYear, last.bsMonth);
    if (nextDay > lastMonthDays) {
      nextDay = 1;
      nextMonth += 1;
      if (nextMonth > 11) { nextMonth = 0; nextYear += 1; }
    }
    const nd = new NepaliDate(nextYear, nextMonth, nextDay);
    const ad = nd.getAD();
    cells.push({
      bsYear: nextYear, bsMonth: nextMonth, bsDay: nextDay,
      adYear: ad.year, adMonth: ad.month, adDay: ad.date,
      weekday: nd.getDay(),
      isoDate: isoFromAd(ad.year, ad.month, ad.date),
      isCurrentMonth: false,
      isToday: false,
    });
  }

  return cells;
}

export function shiftBsMonth(bsYear: number, bsMonth: number, delta: number) {
  let total = bsYear * 12 + bsMonth + delta;
  const y = Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  return { bsYear: y, bsMonth: m };
}

export function todayBs() {
  const t = new NepaliDate().getBS();
  return { bsYear: t.year, bsMonth: t.month, bsDay: t.date };
}

export function bsToAdIso(bsYear: number, bsMonth: number, bsDay: number) {
  const nd = new NepaliDate(bsYear, bsMonth, bsDay);
  const ad = nd.getAD();
  return isoFromAd(ad.year, ad.month, ad.date);
}

export function adIsoToBs(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const nd = NepaliDate.fromAD(new Date(y, m - 1, d));
  const bs = nd.getBS();
  return { bsYear: bs.year, bsMonth: bs.month, bsDay: bs.date };
}

export const EVENT_TYPE_META: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  holiday: { label: "Holiday", dot: "bg-rose-500", bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400" },
  exam:    { label: "Exam",    dot: "bg-sky-500",  bg: "bg-sky-500/10",  text: "text-sky-600 dark:text-sky-400" },
  meeting: { label: "Meeting", dot: "bg-amber-500",bg: "bg-amber-500/10",text: "text-amber-600 dark:text-amber-400" },
  event:   { label: "Event",   dot: "bg-emerald-500",bg: "bg-emerald-500/10",text: "text-emerald-600 dark:text-emerald-400" },
  notice:  { label: "Notice",  dot: "bg-violet-500",bg: "bg-violet-500/10",text: "text-violet-600 dark:text-violet-400" },
};