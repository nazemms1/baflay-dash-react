/**
 * جدول الدوام الأسبوعي للفرع. الفرع مفتوح كل أيام الأسبوع افتراضياً، والمشغّل يحدد لكل يوم
 * مفتوح ساعاته (حتى ثلاث فترات)، ويعطّل اليوم المغلق كعطلة. ما يستقبله الخادم:
 * - `opening_hours: null` يعني مفتوح دائماً طوال الأيام، وهو ما ينتج حين لا عطلة ولا ساعات مخصصة.
 * - جدولاً من سبعة أيام، و[] لكل يوم عطلة، وفترات `{opens, closes}` لكل يوم مفتوح.
 * لا يستورد هذا الملف شيئاً من المشروع، ليعمل في اختبارات Node مباشرة.
 */
export const WEEK_DAYS = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export interface Period {
  opens: string;
  closes: string;
}

export type Hours = Record<WeekDay, Period[]>;

/** الحد الأعلى للفترات في اليوم الواحد، كما يفرضه الخادم. */
export const MAX_PERIODS = 3;

/** اليوم المفتوح طوال اليوم، وهو الافتراضي لكل يوم. */
export const FULL_DAY: Period = { opens: "00:00", closes: "24:00" };

/** فترة جديدة تُضاف إلى يوم مفتوح، والمشغّل يعدّلها. */
export const NEW_PERIOD: Period = { opens: "12:00", closes: "15:00" };

/** HH:MM بنظام ٢٤ ساعة. وقت الإغلاق يقبل 24:00 لمنتصف الليل بالضبط. */
const OPEN_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const CLOSE_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;

export type PeriodIssue = "invalidOpens" | "invalidCloses" | "sameTime";

/** أول مشكلة في الفترة، أو null إن كانت سليمة. تداخل الفترات يتحقق منه الخادم. */
export function periodIssue(period: Period): PeriodIssue | null {
  if (!OPEN_TIME.test(period.opens)) return "invalidOpens";
  if (!CLOSE_TIME.test(period.closes)) return "invalidCloses";
  if (period.opens === period.closes) return "sameTime";
  return null;
}

/** مشاكل فترات الأيام المفتوحة، بمفتاح `اليوم.رقم الفترة`. الأيام المعطّلة لا تُرسل ساعات فلا تُفحص. */
export function hoursIssues(hours: Hours, holidays: readonly WeekDay[]): Record<string, PeriodIssue> {
  const issues: Record<string, PeriodIssue> = {};
  for (const day of WEEK_DAYS) {
    if (holidays.includes(day)) continue;
    hours[day].forEach((period, index) => {
      const issue = periodIssue(period);
      if (issue) issues[`${day}.${index}`] = issue;
    });
  }
  return issues;
}

/** هل اليوم مفتوح طوال اليوم، بفترة واحدة من 00:00 إلى 24:00؟ */
export const isFullDay = (periods: readonly Period[]): boolean =>
  periods.length === 1 && periods[0].opens === FULL_DAY.opens && periods[0].closes === FULL_DAY.closes;

export function defaultHours(): Hours {
  return {
    saturday: [{ ...FULL_DAY }],
    sunday: [{ ...FULL_DAY }],
    monday: [{ ...FULL_DAY }],
    tuesday: [{ ...FULL_DAY }],
    wednesday: [{ ...FULL_DAY }],
    thursday: [{ ...FULL_DAY }],
    friday: [{ ...FULL_DAY }],
  };
}

/**
 * يقرأ `opening_hours` كما يأتي من الخادم. `null` يعني مفتوح كل الأيام طوال اليوم. اليوم بلا
 * فترات عطلة، واليوم المفتوح يحمل فتراته كما هي.
 */
export function hoursFrom(raw: unknown): { holidays: WeekDay[]; hours: Hours } {
  const hours = defaultHours();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { holidays: [], hours };

  const record = raw as Record<string, unknown>;
  const holidays: WeekDay[] = [];
  for (const day of WEEK_DAYS) {
    const list = Array.isArray(record[day]) ? (record[day] as unknown[]) : [];
    const periods = list.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const row = entry as Record<string, unknown>;
      return [{ opens: String(row.opens ?? ""), closes: String(row.closes ?? "") }];
    });
    if (periods.length === 0) holidays.push(day);
    else hours[day] = periods;
  }
  return { holidays, hours };
}

/** مفتوح دائماً: لا عطلة، وكل يوم مفتوح طوال اليوم. */
export function isAlwaysOpen(holidays: readonly WeekDay[], hours: Hours): boolean {
  return holidays.length === 0 && WEEK_DAYS.every((day) => isFullDay(hours[day]));
}

/**
 * جسم الحفظ. الفرع المفتوح دائماً يُرسل `null`، وغيره يُرسل الأيام السبعة كلها: اليوم المعطّل
 * بقائمة فارغة، واليوم المفتوح بفتراته. المنطقة الزمنية تُرسل إن كُتبت، وإن غابت يبقى الخادم
 * على الافتراضي حسب عملة الفرع.
 */
export function openingHoursBody(holidays: readonly WeekDay[], hours: Hours, timezone: string): Record<string, unknown> {
  const body: Record<string, unknown> = isAlwaysOpen(holidays, hours)
    ? { opening_hours: null }
    : {
        opening_hours: Object.fromEntries(
          WEEK_DAYS.map((day) => [
            day,
            holidays.includes(day) ? [] : hours[day].map((period) => ({ opens: period.opens, closes: period.closes })),
          ])
        ),
      };
  const zone = timezone.trim();
  if (zone) body.timezone = zone;
  return body;
}
