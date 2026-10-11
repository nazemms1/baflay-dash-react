import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { TFunction } from "i18next";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SelectField, TextArea, Toggle } from "@/components/ui/Fields";
import { currentLanguage } from "@/i18n";
import { ApiError, toApiError } from "@/lib/http/errors";
import { formatDateTime } from "@/lib/format";
import { countries, customerSurveys, surveys, type Named } from "@/services";
import type { CrudModule, FormProps } from "@/components/crud/types";
import { textColumn } from "./shared";

const DELETE = ["destroy", "delete"] as const;

type Answer = { answer: string; answer_ar: string };
type Question = { question: string; question_ar: string; type: string; required: boolean; answers: Answer[] };

/** الأنواع كما يستقبلها الخادم، والخيارات تظهر فقط للأنواع التي تحتاجها. */
const CHOICE_TYPES = ["mcq", "multiple-choice"];
const QUESTION_TYPES = ["mcq", "multiple-choice", "rating", "text", "number"];

const emptyQuestion = (): Question => ({
  question: "",
  question_ar: "",
  type: "mcq",
  required: false,
  answers: [
    { answer: "", answer_ar: "" },
    { answer: "", answer_ar: "" },
  ],
});

const str = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

/** الأسئلة من السجل، بالشكل نفسه الذي يرسله المحرر. */
function questionsFrom(record: Named | null): Question[] {
  const raw = (record as Record<string, unknown> | null)?.questions;
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const q = entry as Record<string, unknown>;
    const answers = Array.isArray(q.answers) ? (q.answers as Record<string, unknown>[]) : [];
    return {
      question: str(q.question),
      question_ar: str(q.question_ar),
      type: str(q.type) || "text",
      required: Boolean(q.required),
      answers: answers.map((a) => ({ answer: str(a.answer), answer_ar: str(a.answer_ar) })),
    };
  });
}

/** محرر القالب: بيانات الاستبيان، ثم أسئلته، ولكل سؤال خياراته عند الحاجة. */
export function SurveyTemplateForm({ record, onDone }: FormProps<Named>) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const source = record as Record<string, unknown> | null;

  const [header, setHeader] = useState({
    title: str(source?.title),
    title_ar: str(source?.title_ar),
    description: str(source?.description),
    description_ar: str(source?.description_ar),
    date: str(source?.date),
    country_id: (source?.country_id as number | null) ?? null,
    is_active: source?.is_active !== false,
    allow_anonymous: Boolean(source?.allow_anonymous),
    show_results: Boolean(source?.show_results),
  });
  const [questions, setQuestions] = useState<Question[]>(() => questionsFrom(record));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const countryOptions = useQuery({
    queryKey: ["survey-form", "countries"],
    queryFn: async ({ signal }) => {
      const page = await countries.list({ page: 1, per_page: 500 }, signal);
      return page.items.map((row) => ({
        value: row.id,
        label: String(row.name ?? row.name_ar ?? row.id),
      }));
    },
    staleTime: 5 * 60_000,
  });

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      record ? surveys.update(record.id, payload) : surveys.create(payload),
    onSuccess: async () => {
      toast.success(t(record ? "crud.updated" : "crud.created"));
      await queryClient.invalidateQueries({ queryKey: ["surveys"] });
      onDone();
    },
    onError: (caught) => {
      const apiError = toApiError(caught, t("errors.unexpected"));
      const mapped = Object.fromEntries(
        Object.entries(apiError.fieldErrors).map(([key, messages]) => [key, messages[0] ?? ""])
      );
      setFieldErrors(mapped);
      setError(Object.keys(mapped).length === 0 ? apiError.message : null);
    },
  });

  const setQuestion = (index: number, patch: Partial<Question>) =>
    setQuestions((current) => current.map((q, position) => (position === index ? { ...q, ...patch } : q)));

  const setAnswer = (questionIndex: number, answerIndex: number, patch: Partial<Answer>) =>
    setQuestions((current) =>
      current.map((q, position) =>
        position === questionIndex
          ? { ...q, answers: q.answers.map((a, i) => (i === answerIndex ? { ...a, ...patch } : a)) }
          : q
      )
    );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missing: Record<string, string> = {};
    if (!header.title.trim()) missing.title = t("crud.required");
    if (!header.title_ar.trim()) missing.title_ar = t("crud.required");
    questions.forEach((q, index) => {
      if (!q.question.trim() && !q.question_ar.trim()) missing[`question_${index}`] = t("crud.required");
    });
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      return;
    }

    setFieldErrors({});
    setError(null);
    save.mutate({
      ...header,
      country_id: header.country_id,
      questions: questions.map((q) => ({
        question: q.question,
        question_ar: q.question_ar,
        type: q.type,
        required: q.required,
        // الخيارات الفارغة لا تُرسل، والأنواع غير الاختيارية لا تحمل خيارات أصلاً.
        answers: CHOICE_TYPES.includes(q.type) ? q.answers.filter((a) => a.answer || a.answer_ar) : [],
      })),
    });
  }

  const typeLabel = (type: string) => t(`surveys.types.${type}`, { defaultValue: type });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-2">
        <Input label={`${t("surveys.form.title")} · ${t("crud.english")}`} dir="ltr" required value={header.title}
          onChange={(e) => setHeader({ ...header, title: e.target.value })} error={fieldErrors.title || null} />
        <Input label={`${t("surveys.form.title")} · ${t("crud.arabic")}`} dir="rtl" required value={header.title_ar}
          onChange={(e) => setHeader({ ...header, title_ar: e.target.value })} error={fieldErrors.title_ar || null} />
        <TextArea label={`${t("crud.field.description")} · ${t("crud.english")}`} dir="ltr" value={header.description}
          onChange={(e) => setHeader({ ...header, description: e.target.value })} />
        <TextArea label={`${t("crud.field.description")} · ${t("crud.arabic")}`} dir="rtl" value={header.description_ar}
          onChange={(e) => setHeader({ ...header, description_ar: e.target.value })} />
        <Input label={t("surveys.form.date")} type="date" value={header.date}
          onChange={(e) => setHeader({ ...header, date: e.target.value })} />
        <SelectField label={t("surveys.form.country")} options={countryOptions.data ?? []}
          value={header.country_id} placeholder={t("crud.choose")}
          onChange={(value) => setHeader({ ...header, country_id: value === null ? null : Number(value) })} />
        <Toggle label={t("surveys.form.isActive")} checked={header.is_active} onChange={(v) => setHeader({ ...header, is_active: v })} />
        <Toggle label={t("surveys.form.allowAnonymous")} checked={header.allow_anonymous} onChange={(v) => setHeader({ ...header, allow_anonymous: v })} />
        <Toggle label={t("surveys.form.showResults")} checked={header.show_results} onChange={(v) => setHeader({ ...header, show_results: v })} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink">{t("surveys.form.questions", { count: questions.length })}</h3>
          <Button variant="secondary" size="sm" onClick={() => setQuestions((c) => [...c, emptyQuestion()])}>
            <Plus className="size-4" aria-hidden /> {t("surveys.form.addQuestion")}
          </Button>
        </div>

        {questions.length === 0 && <p className="text-sm text-muted">{t("surveys.form.noQuestions")}</p>}

        {questions.map((q, qi) => (
          <div key={qi} className="space-y-4 rounded-2xl border border-line bg-canvas/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink-soft">#{qi + 1} · {typeLabel(q.type)}</span>
              <button type="button" onClick={() => setQuestions((c) => c.filter((_, i) => i !== qi))}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-secondary hover:bg-secondary-soft">
                <Trash2 className="size-4" aria-hidden /> {t("surveys.form.removeQuestion")}
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={`${t("surveys.form.question")} · ${t("crud.english")}`} dir="ltr" value={q.question}
                onChange={(e) => setQuestion(qi, { question: e.target.value })} error={fieldErrors[`question_${qi}`] || null} />
              <Input label={`${t("surveys.form.question")} · ${t("crud.arabic")}`} dir="rtl" value={q.question_ar}
                onChange={(e) => setQuestion(qi, { question_ar: e.target.value })} />
              <SelectField label={t("surveys.form.type")} options={QUESTION_TYPES.map((value) => ({ value, label: typeLabel(value) }))}
                value={q.type} onChange={(value) => setQuestion(qi, { type: value === null ? "text" : String(value) })} />
              <Toggle label={t("surveys.form.required")} checked={q.required} onChange={(v) => setQuestion(qi, { required: v })} />
            </div>

            {CHOICE_TYPES.includes(q.type) && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-ink-soft">{t("surveys.form.options")}</p>
                {q.answers.map((a, ai) => (
                  <div key={ai} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <Input label={`${t("surveys.form.option")} · ${t("crud.english")}`} dir="ltr" value={a.answer}
                      onChange={(e) => setAnswer(qi, ai, { answer: e.target.value })} />
                    <Input label={`${t("surveys.form.option")} · ${t("crud.arabic")}`} dir="rtl" value={a.answer_ar}
                      onChange={(e) => setAnswer(qi, ai, { answer_ar: e.target.value })} />
                    <button type="button" aria-label={t("crud.removeRow")} onClick={() => setQuestion(qi, { answers: q.answers.filter((_, i) => i !== ai) })}
                      className="h-11 cursor-pointer rounded-xl px-3 text-secondary hover:bg-secondary-soft">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={() => setQuestion(qi, { answers: [...q.answers, { answer: "", answer_ar: "" }] })}>
                  <Plus className="size-4" aria-hidden /> {t("surveys.form.addOption")}
                </Button>
              </div>
            )}
          </div>
        ))}
      </section>

      <div className="sticky bottom-0 z-20 -mx-6 -mb-5 flex flex-wrap justify-end gap-2 border-t border-line bg-surface/95 px-6 py-4 backdrop-blur">
        <Button variant="secondary" onClick={onDone} disabled={save.isPending}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={save.isPending} className="bg-primary text-ink hover:bg-primary/90">
          {save.isPending ? t("crud.saving") : t("crud.save")}
        </Button>
      </div>
    </form>
  );
}

/** عرض القالب: بياناته وأسئلته مع خياراتها، كما يظهر للمراجع. */
export function SurveyTemplateDetails({ record }: { record: Named }) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const source = record as Record<string, unknown>;
  const title = language === "ar" ? str(source.title_ar) || str(source.title) : str(source.title) || str(source.title_ar);
  const questions = questionsFrom(record);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-lg font-semibold text-ink">{title || "—"}</p>
        <p className="text-sm text-muted">{str(source.date) || "—"}</p>
      </div>
      <ol className="space-y-3">
        {questions.map((q, index) => {
          const text = language === "ar" ? q.question_ar || q.question : q.question || q.question_ar;
          return (
            <li key={index} className="rounded-xl border border-line p-4">
              <p className="font-medium text-ink">{index + 1}. {text || "—"}</p>
              <p className="mt-1 text-xs text-muted">
                {t(`surveys.types.${q.type}`, { defaultValue: q.type })}
                {q.required && ` · ${t("surveys.form.required")}`}
              </p>
              {q.answers.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-sm text-ink-soft">
                  {q.answers.map((a, ai) => (
                    <li key={ai}>{language === "ar" ? a.answer_ar || a.answer : a.answer || a.answer_ar}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export const surveysModule = (t: TFunction): CrudModule<Named> => ({
  id: "surveys",
  titleKey: "nav.surveyTemplates",
  api: {
    list: surveys.list,
    get: surveys.get,
    create: surveys.create,
    update: surveys.update,
    remove: surveys.remove,
  },
  fields: [],
  form: SurveyTemplateForm,
  details: ({ record }: { record: Named }) => <SurveyTemplateDetails record={record} />,
  columns: [
    {
      key: "title",
      header: "surveys.form.title",
      render: (row) => {
        const source = row as Record<string, unknown>;
        const language = currentLanguage();
        const title = language === "ar" ? str(source.title_ar) || str(source.title) : str(source.title) || str(source.title_ar);
        return <span className="font-medium text-ink">{title || "—"}</span>;
      },
    },
    textColumn<Named>("date", t("surveys.form.date")),
    textColumn<Named>("is_active", t("surveys.form.isActive"), (row) => (
      <span className="text-ink-soft">{(row as Record<string, unknown>).is_active === false ? t("crud.hidden") : t("crud.visible")}</span>
    )),
  ],
  permissions: {
    index: "surveys.index",
    show: "surveys.show",
    create: "surveys.store",
    update: "surveys.update",
    delete: DELETE.map((action) => `surveys.${action}`),
  },
  nameOf: (row) => str((row as Record<string, unknown>).title ?? row.id),
});

/** تصدير إجابات الاستبيانات ملفاً من الخادم، ويُحفظ باسم واضح للمستخدم. */
export function ExportAnswersButton() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function exportFile() {
    setBusy(true);
    try {
      const blob = await customerSurveys.exportFile({});
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "customer-surveys.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : t("errors.unexpected"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" onClick={() => void exportFile()} disabled={busy}>
      <Download className="size-4" aria-hidden /> {busy ? t("crud.exporting") : t("crud.export")}
    </Button>
  );
}

/** تفاصيل إجابات زبون: بياناته ثم إجاباته على كل سؤال. */
export function CustomerAnswersDetails({ record }: { record: Named }) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const source = record as Record<string, unknown>;
  const customer = (source.customer ?? {}) as Record<string, unknown>;
  const answers = Array.isArray(source.customer_survey_answers)
    ? (source.customer_survey_answers as Record<string, unknown>[])
    : [];

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs text-muted">{t("crud.field.name")}</dt><dd className="mt-1">{str(customer.name) || "—"}</dd></div>
        <div><dt className="text-xs text-muted">{t("crud.field.phone")}</dt><dd className="mt-1" dir="ltr">{str(customer.phone_number) || "—"}</dd></div>
        <div><dt className="text-xs text-muted">{t("customerSurveys.birth")}</dt><dd className="mt-1">{str(customer.date_of_birth) || "—"}</dd></div>
        <div><dt className="text-xs text-muted">{t("customerSurveys.visits")}</dt><dd className="mt-1 tabular-nums">{str(customer.visit_count) || "0"}</dd></div>
      </dl>
      <ol className="space-y-3">
        {answers.map((entry, index) => {
          const question = entry.question as Record<string, unknown> | string | undefined;
          const questionText =
            typeof question === "string"
              ? question
              : language === "ar"
                ? str(question?.question_ar) || str(question?.question)
                : str(question?.question) || str(question?.question_ar);
          const answer = (entry.answer ?? {}) as Record<string, unknown>;
          const value =
            language === "ar" ? str(answer.answer_ar) || str(answer.answer) : str(answer.answer) || str(answer.answer_ar);
          const rating = answer.rating ?? entry.rating;
          return (
            <li key={index} className="rounded-xl border border-line p-4">
              <p className="font-medium text-ink">{questionText || str(entry.text) || "—"}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {value || str(entry.text) || "—"}
                {rating !== undefined && rating !== null && <span className="ms-2 text-primary">{"★".repeat(Number(rating) || 0)}</span>}
              </p>
              <p className="mt-1 text-xs text-muted">{formatDateTime(str(entry.created_at) || null)}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export const customerSurveysModule = (t: TFunction): CrudModule<Named> => ({
  id: "customer-surveys",
  titleKey: "nav.surveyAnswers",
  api: {
    list: customerSurveys.list,
    get: customerSurveys.get,
  },
  readOnly: true,
  fields: [],
  headerActions: <ExportAnswersButton />,
  details: ({ record }: { record: Named }) => <CustomerAnswersDetails record={record} />,
  columns: [
    textColumn<Named>("customer", t("crud.field.name"), (row) => (
      <span className="font-medium text-ink">{str(((row as Record<string, unknown>).customer as Record<string, unknown> | undefined)?.name) || "—"}</span>
    )),
    textColumn<Named>("phone", t("crud.field.phone"), (row) => (
      <span className="text-ink-soft" dir="ltr">{str(((row as Record<string, unknown>).customer as Record<string, unknown> | undefined)?.phone_number) || "—"}</span>
    )),
    textColumn<Named>("survey", t("surveys.form.title"), (row) => {
      const survey = ((row as Record<string, unknown>).survey ?? {}) as Record<string, unknown>;
      const language = currentLanguage();
      const title = language === "ar" ? str(survey.title_ar) || str(survey.title) : str(survey.title) || str(survey.title_ar);
      return <span className="text-ink-soft">{title || "—"}</span>;
    }),
  ],
  permissions: {
    index: "customer.surveys.index",
    show: "customer.surveys.show",
  },
  nameOf: (row) => str(((row as Record<string, unknown>).customer as Record<string, unknown> | undefined)?.name ?? row.id),
});
