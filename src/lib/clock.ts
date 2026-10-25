/**
 * الوقت والتاريخ بين صيغة الخادم وأجزاء تُعرض في القوائم. الخادم يستقبل الوقت HH:MM بنظام ٢٤ ساعة،
 * ومنتصف الليل إغلاقاً يكون 24:00، والتاريخ YYYY-MM-DD. والقوائم تعرض الساعة من ١ إلى ١٢ مع AM أو PM،
 * فهذا الملف يحوّل بينهما. لا يستورد شيئاً، ليعمل في اختبارات Node مباشرة.
 */
export type Meridiem = "AM" | "PM";

export interface ClockParts {
  hour12: number;
  minute: number;
  meridiem: Meridiem;
}

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const CLOCK = /^(\d{2}):(\d{2})$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** الوقت من HH:MM. `24:00` تُقرأ منتصف الليل، و`null` إن لم يكن وقتاً صالحاً. */
export function parseClock(value: string): ClockParts | null {
  const match = CLOCK.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 24 || minute > 59 || (hour === 24 && minute > 0)) return null;
  return { hour12: hour % 12 || 12, minute, meridiem: hour % 24 < 12 ? "AM" : "PM" };
}

/**
 * الوقت بصيغة الخادم. منتصف الليل يُكتب `00:00` لبداية الفترة، و`24:00` لنهايتها، فيبقى الإغلاق
 * عند منتصف الليل داخل يومه كما يطلبه الخادم.
 */
export function formatClock(parts: ClockParts, endOfDay = false): string {
  const hour = (parts.hour12 % 12) + (parts.meridiem === "PM" ? 12 : 0);
  if (endOfDay && hour === 0 && parts.minute === 0) return "24:00";
  return `${pad(hour)}:${pad(parts.minute)}`;
}

/** التاريخ من YYYY-MM-DD، و`null` إن لم يكن تاريخاً صالحاً الشكل. */
export function parseDate(value: string): DateParts | null {
  const match = DATE.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function formatDate({ year, month, day }: DateParts): string {
  return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}

/** عدد أيام الشهر، والشهر من ١ إلى ١٢. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
