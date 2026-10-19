import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Clock3, Plus, X } from "lucide-react";
import { usePermissions } from "@/features/auth/hooks";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { currentLanguage } from "@/i18n";
import { toNumber, toText } from "@/lib/coerce";
import { toApiError } from "@/lib/http/errors";
import { localizedRecord } from "@/lib/localized";
import { branchApi, type Named } from "@/services";
import {
  MAX_PERIODS,
  NEW_PERIOD,
  WEEK_DAYS,
  hoursFrom,
  hoursIssues,
  isAlwaysOpen,
  openingHoursBody,
  type Hours,
  type PeriodIssue,
  type WeekDay,
} from "./openingHours";

/** صلاحية تحديد أوقات الدوام، بالاسم الذي يعرفه الخادم. */
const OPENING_HOURS_PERMISSION = "branches.opening.hours.update";

const ISSUE_KEY: Record<PeriodIssue, string> = {
  invalidOpens: "openingHours.invalidTime",
  invalidCloses: "openingHours.invalidTime",
  sameTime: "openingHours.sameTime",
};

/** زر أوقات الدوام والعطل في صف الفرع. يظهر لمن يملك الصلاحية فقط. */
export function OpeningHoursAction({ row }: { row: Named }) {
  const { t } = useTranslation();
  const canEdit = usePermissions().has(OPENING_HOURS_PERMISSION);
  const [open, setOpen] = useState(false);

  if (!canEdit) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("openingHours.open")}
        title={t("openingHours.open")}
        className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-soft transition hover:bg-primary-soft hover:text-ink"
      >
        <Clock3 className="size-4" aria-hidden />
      </button>
      {open && <OpeningHoursDialog row={row} onClose={() => setOpen(false)} />}
    </>
  );
}

function OpeningHoursDialog({ row, onClose }: { row: Named; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const language = currentLanguage();
  const branchId = toNumber(row.id);
  const branchName = localizedRecord(row, language) || `#${row.id}`;
  const initialZone = toText(row.timezone).trim();

  const [initial] = useState(() => hoursFrom(row.opening_hours));
  const [holidays, setHolidays] = useState<WeekDay[]>(initial.holidays);
  const [hours, setHours] = useState<Hours>(initial.hours);
  const [timezone, setTimezone] = useState(initialZone);
  // أخطاء الخادم بمفاتيحها كما تأتي، مثل `opening_hours.monday.0`، ومعها الخطأ العام.
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const allHolidays = holidays.length === WEEK_DAYS.length;
  const issues = hoursIssues(hours, holidays);
  const hasIssues = Object.keys(issues).length > 0;
  const changed =
    JSON.stringify({ holidays, hours }) !== JSON.stringify({ holidays: initial.holidays, hours: initial.hours }) ||
    timezone.trim() !== initialZone;
  const canSave = changed && !allHolidays && !hasIssues;

  const save = useMutation({
    mutationFn: () => branchApi.setOpeningHours(branchId, openingHoursBody(holidays, hours, timezone)),
    onSuccess: async () => {
      toast.success(t("openingHours.saved"));
      await queryClient.invalidateQueries({ queryKey: ["branches"] });
      onClose();
    },
    // الخطأ يظهر داخل النافذة، وما اختاره المشغّل يبقى كما هو للتصحيح.
    onError: (caught) => {
      const apiError = toApiError(caught, t("errors.unexpected"));
      setServerErrors(
        Object.fromEntries(Object.entries(apiError.fieldErrors).map(([key, messages]) => [key, messages[0] ?? ""]))
      );
      setServerError(apiError.message);
    },
  });

  const clearServerErrors = () => {
    setServerErrors({});
    setServerError(null);
  };

  const setHoliday = (day: WeekDay, holiday: boolean) => {
    clearServerErrors();
    setHolidays(WEEK_DAYS.filter((position) => (position === day ? holiday : holidays.includes(position))));
  };

  const editPeriod = (day: WeekDay, index: number, patch: Partial<{ opens: string; closes: string }>) => {
    clearServerErrors();
    setHours((current) => ({
      ...current,
      [day]: current[day].map((period, position) => (position === index ? { ...period, ...patch } : period)),
    }));
  };

  const addPeriod = (day: WeekDay) => {
    clearServerErrors();
    setHours((current) => ({ ...current, [day]: [...current[day], { ...NEW_PERIOD }] }));
  };

  const removePeriod = (day: WeekDay, index: number) => {
    clearServerErrors();
    setHours((current) => ({ ...current, [day]: current[day].filter((_, position) => position !== index) }));
  };

  const periodError = (day: WeekDay, index: number): string | null => {
    const issue = issues[`${day}.${index}`];
    if (issue) return t(ISSUE_KEY[issue]);
    return serverErrors[`opening_hours.${day}.${index}`] || null;
  };

  const alwaysOpen = isAlwaysOpen(holidays, hours);

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      fullOnMobile
      title={t("openingHours.title", { name: branchName })}
      description={t("openingHours.hint")}
      footer={
        <>
          <Button variant="secondary" onClick={() => setHolidays([])} disabled={holidays.length === 0 || save.isPending}>
            {t("openingHours.clearHolidays")}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={!canSave || save.isPending}
            className="bg-primary text-ink hover:bg-primary/90"
          >
            {save.isPending ? t("crud.saving") : t("crud.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {allHolidays && <p className="text-sm text-danger">{t("openingHours.allHoliday")}</p>}
        {!allHolidays && alwaysOpen && <p className="text-sm text-ok">{t("openingHours.alwaysOpen")}</p>}
        {serverError && <p className="text-sm text-danger">{serverError}</p>}

        <ul className="space-y-3">
          {WEEK_DAYS.map((day) => {
            const holiday = holidays.includes(day);
            const periods = hours[day];
            return (
              <li key={day} className="space-y-3 rounded-xl border border-line p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-ink">{t(`openingHours.days.${day}`)}</p>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      checked={holiday}
                      onChange={(event) => setHoliday(day, event.target.checked)}
                      className="size-4 cursor-pointer accent-primary"
                    />
                    {t("openingHours.holiday")}
                  </label>
                </div>

                {holiday ? (
                  <p className="text-sm font-medium text-danger">{t("openingHours.closedToday")}</p>
                ) : (
                  <>
                    {periods.map((period, index) => (
                      <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
                        <Input
                          label={t("openingHours.from")}
                          dir="ltr"
                          inputMode="numeric"
                          placeholder="HH:MM"
                          maxLength={5}
                          value={period.opens}
                          error={periodError(day, index)}
                          onChange={(event) => editPeriod(day, index, { opens: event.target.value.trim() })}
                        />
                        <Input
                          label={t("openingHours.to")}
                          dir="ltr"
                          inputMode="numeric"
                          placeholder="HH:MM"
                          maxLength={5}
                          value={period.closes}
                          onChange={(event) => editPeriod(day, index, { closes: event.target.value.trim() })}
                        />
                        <button
                          type="button"
                          onClick={() => removePeriod(day, index)}
                          disabled={periods.length === 1}
                          aria-label={t("openingHours.removePeriod")}
                          title={t("openingHours.removePeriod")}
                          className="mt-7 grid size-11 cursor-pointer place-items-center rounded-xl text-muted ring-1 ring-line transition hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 sm:size-10"
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      </div>
                    ))}
                    {periods.length < MAX_PERIODS && (
                      <button
                        type="button"
                        onClick={() => addPeriod(day)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-secondary hover:bg-secondary-soft"
                      >
                        <Plus className="size-4" aria-hidden />
                        {t("openingHours.addPeriod")}
                      </button>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>

        <Input
          label={t("openingHours.timezone")}
          dir="ltr"
          placeholder="Asia/Damascus"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
        />
      </div>
    </Dialog>
  );
}
