import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES, currentLanguage } from "@/i18n";
import {
  daysInMonth,
  formatClock,
  formatDate,
  parseClock,
  parseDate,
  type ClockParts,
  type DateParts,
  type Meridiem,
} from "@/lib/clock";
import { FieldShell } from "./Fields";
import { Select } from "./Select";

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
const HOURS = range(1, 12);
const MINUTES = range(0, 59);
const MERIDIEM: Meridiem[] = ["AM", "PM"];
const pad = (n: number) => String(n).padStart(2, "0");
const DEFAULT_CLOCK: ClockParts = { hour12: 12, minute: 0, meridiem: "AM" };

/** اسم الشهر بلغة الواجهة. */
function monthName(month: number): string {
  return new Intl.DateTimeFormat(LANGUAGES[currentLanguage()].intl, { month: "long", timeZone: "UTC" }).format(
    Date.UTC(2000, month - 1, 1)
  );
}

/**
 * قوائم اليوم والشهر والسنة. الترتيب ثابت (يوم ثم شهر ثم سنة) على كل الأجهزة، والتاريخ الفارغ
 * يبدأ من تاريخ اليوم، فأي اختيار يكمّل الباقي من اليوم الحالي. القيمة YYYY-MM-DD.
 */
function DateSelects({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const today = new Date();
  const current = parseDate(value);
  const base: DateParts = current ?? { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() };
  const years = range(Math.min(today.getFullYear() - 1, base.year), Math.max(today.getFullYear() + 5, base.year));

  const update = (patch: Partial<DateParts>) => {
    const next = { ...base, ...patch };
    next.day = Math.min(next.day, daysInMonth(next.year, next.month));
    onChange(formatDate(next));
  };

  return (
    <div dir="ltr" className="grid grid-cols-[1fr_1.6fr_1.1fr] gap-2">
      <Select
        id={`${id}-day`}
        aria-label={t("clock.day")}
        value={current ? current.day : ""}
        onChange={(event) => update({ day: Number(event.target.value) })}
        wrapperClassName="w-full"
        className="w-full"
      >
        <option value="">—</option>
        {range(1, daysInMonth(base.year, base.month)).map((day) => (
          <option key={day} value={day}>
            {day}
          </option>
        ))}
      </Select>
      <Select
        id={`${id}-month`}
        aria-label={t("clock.month")}
        value={current ? current.month : ""}
        onChange={(event) => update({ month: Number(event.target.value) })}
        wrapperClassName="w-full"
        className="w-full"
      >
        <option value="">—</option>
        {range(1, 12).map((month) => (
          <option key={month} value={month}>
            {monthName(month)}
          </option>
        ))}
      </Select>
      <Select
        id={`${id}-year`}
        aria-label={t("clock.year")}
        value={current ? current.year : ""}
        onChange={(event) => update({ year: Number(event.target.value) })}
        wrapperClassName="w-full"
        className="w-full"
      >
        <option value="">—</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </Select>
    </div>
  );
}

/**
 * قوائم الساعة والدقيقة وAM/PM. القيمة HH:MM، والفارغ يبدأ من 12:00 AM. مع `endOfDay` يكون
 * منتصف الليل عند الإغلاق `24:00`، أي آخر اليوم.
 */
function TimeSelects({
  id,
  value,
  endOfDay,
  onChange,
}: {
  id: string;
  value: string;
  endOfDay: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const clock = parseClock(value);

  const update = (patch: Partial<ClockParts>) =>
    onChange(formatClock({ ...(clock ?? DEFAULT_CLOCK), ...patch }, endOfDay));

  return (
    <div dir="ltr" className="grid grid-cols-[1fr_1fr_1fr] gap-2">
      <Select
        id={`${id}-hour`}
        aria-label={t("clock.hour")}
        value={clock ? clock.hour12 : ""}
        onChange={(event) => update({ hour12: Number(event.target.value) })}
        wrapperClassName="w-full"
        className="w-full"
      >
        <option value="">—</option>
        {HOURS.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </Select>
      <Select
        id={`${id}-minute`}
        aria-label={t("clock.minute")}
        value={clock ? clock.minute : ""}
        onChange={(event) => update({ minute: Number(event.target.value) })}
        wrapperClassName="w-full"
        className="w-full"
      >
        <option value="">—</option>
        {MINUTES.map((minute) => (
          <option key={minute} value={minute}>
            {pad(minute)}
          </option>
        ))}
      </Select>
      <Select
        id={`${id}-period`}
        aria-label={t("clock.period")}
        value={clock ? clock.meridiem : ""}
        onChange={(event) => update({ meridiem: event.target.value as Meridiem })}
        wrapperClassName="w-full"
        className="w-full"
      >
        <option value="">—</option>
        {MERIDIEM.map((meridiem) => (
          <option key={meridiem} value={meridiem}>
            {meridiem}
          </option>
        ))}
      </Select>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  required?: boolean;
}

/** تاريخ بقوائم اليوم والشهر والسنة، بترتيب واحد على كل الأجهزة. القيمة YYYY-MM-DD. */
export function DateField({ label, value, onChange, error, required }: FieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={`${id}-day`} error={error} required={required}>
      <DateSelects id={id} value={value} onChange={onChange} />
    </FieldShell>
  );
}

/**
 * تاريخ ووقت: التاريخ ثم الوقت بقوائم AM/PM، فلا يعتمد على دعم المتصفح لحقل الوقت. القيمة
 * YYYY-MM-DDTHH:mm بالتوقيت المحلي، والفارغ حتى يكتمل التاريخ والوقت معاً.
 */
export function DateTimeField({ label, value, onChange, error, required }: FieldProps) {
  const id = useId();
  // الجزآن يُقرآن من القيمة مرة واحدة، فالتاريخ الذي اختاره المشغّل يبقى ظاهراً حتى يُكمل الوقت.
  const [draft, setDraft] = useState(() => {
    const [date = "", time = ""] = value.split("T");
    return { date, time };
  });

  const update = (next: { date: string; time: string }) => {
    setDraft(next);
    onChange(next.date && next.time ? `${next.date}T${next.time}` : "");
  };

  return (
    <FieldShell label={label} htmlFor={`${id}-day`} error={error} required={required}>
      <div className="space-y-2">
        <DateSelects id={id} value={draft.date} onChange={(date) => update({ ...draft, date })} />
        <TimeSelects id={`${id}-time`} value={draft.time} endOfDay={false} onChange={(time) => update({ ...draft, time })} />
      </div>
    </FieldShell>
  );
}

interface TimeFieldProps {
  label: string;
  /** HH:MM، أو `24:00` لإغلاق عند منتصف الليل. */
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  /** الإغلاق: منتصف الليل يُكتب `24:00` لا `00:00`. */
  endOfDay?: boolean;
}

/** وقت واحد بقوائم الساعة والدقيقة وAM/PM. القيمة HH:MM بنظام ٢٤ ساعة للخادم. */
export function TimeField({ label, value, onChange, error, endOfDay = false }: TimeFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={`${id}-hour`} error={error}>
      <TimeSelects id={id} value={value} endOfDay={endOfDay} onChange={onChange} />
    </FieldShell>
  );
}
