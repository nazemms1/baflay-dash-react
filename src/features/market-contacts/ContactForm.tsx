import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { FormProps } from "@/components/crud/types";
import { Button } from "@/components/ui/Button";
import { SelectField, Toggle } from "@/components/ui/Fields";
import { Input } from "@/components/ui/Input";
import type { CountryScope } from "@/features/markets/countryScope";
import { ApiError } from "@/lib/http/errors";
import {
  marketContacts,
  SOCIAL_PLATFORMS,
  type MarketContact,
  type MarketContactPayload,
  type MarketContactType,
  type SocialPlatform,
} from "@/services";
import {
  CONTACT_TYPES,
  hasArabicValue,
  isEmail,
  isFullUrl,
  isPhoneType,
  phoneProblem,
} from "./contactRules";

/**
 * نموذج وسيلة تواصل لدولة بعينها. الدولة تأتي من الوحدة التي تبنيه، فالوسيلة تُحفظ دائماً في
 * دولتها، ورمز اتصالها يُفحص قبل الإرسال. الحقول تظهر حسب النوع: المنصة لـ`social` فقط، والنسخة
 * العربية لـ`address` و`working_hours` فقط.
 */
export const makeContactForm = (scope: CountryScope, moduleId: string) =>
  function ContactForm({ record, onDone }: FormProps<MarketContact>) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const [type, setType] = useState<MarketContactType>(record?.type ?? "phone");
    const [platform, setPlatform] = useState<SocialPlatform | null>(record?.platform ?? null);
    const [labelEn, setLabelEn] = useState(record?.label ?? "");
    const [labelAr, setLabelAr] = useState(record?.label_ar ?? "");
    const [value, setValue] = useState(record?.value ?? "");
    const [valueAr, setValueAr] = useState(record?.value_ar ?? "");
    const [isActive, setIsActive] = useState(record ? record.is_active : true);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const dialDisplay = scope.dialCode ? `+${scope.dialCode.replace(/\D/g, "")}` : "";

    const validate = (): Record<string, string> => {
      const next: Record<string, string> = {};
      if (type === "social" && !platform) next.platform = t("crud.required");
      if (!labelEn.trim()) next.label = t("crud.required");
      if (!labelAr.trim()) next.label_ar = t("crud.required");

      const trimmed = value.trim();
      if (!trimmed) {
        next.value = t("crud.required");
      } else if (isPhoneType(type)) {
        const problem = phoneProblem(trimmed, scope.dialCode);
        if (problem === "start") next.value = t("marketContacts.errors.phoneStart");
        if (problem === "country") next.value = t("marketContacts.errors.phoneCountry", { dial: dialDisplay });
        if (problem === "format") next.value = t("marketContacts.errors.phoneFormat");
      } else if (type === "email" && !isEmail(trimmed)) {
        next.value = t("marketContacts.errors.email");
      } else if (type === "social" && !isFullUrl(trimmed)) {
        next.value = t("marketContacts.errors.url");
      }
      return next;
    };

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFormError(null);
      const next = validate();
      setErrors(next);
      if (Object.keys(next).length > 0) return;

      const payload: MarketContactPayload = {
        type,
        platform: type === "social" ? platform : null,
        label: labelEn.trim(),
        label_ar: labelAr.trim(),
        value: value.trim(),
        value_ar: hasArabicValue(type) && valueAr.trim() ? valueAr.trim() : null,
        is_active: isActive,
      };

      setSaving(true);
      try {
        if (record) await marketContacts.update(scope.code, record.id, payload);
        else await marketContacts.create(scope.code, payload);
        toast.success(t("marketContacts.saved"));
        await queryClient.invalidateQueries({ queryKey: [moduleId] });
        onDone();
      } catch (error) {
        if (error instanceof ApiError) {
          const fieldErrors = Object.fromEntries(
            Object.entries(error.fieldErrors).map(([field, messages]) => [field, messages[0] ?? ""]),
          );
          setErrors(fieldErrors);
          setFormError(error.message);
        } else {
          setFormError(t("errors.unexpected"));
        }
      } finally {
        setSaving(false);
      }
    };

    const valueHint = isPhoneType(type)
      ? dialDisplay
        ? t("marketContacts.hints.phone", { dial: dialDisplay })
        : t("marketContacts.hints.phoneAny")
      : type === "social"
        ? t("marketContacts.hints.url")
        : null;

    return (
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {formError && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {formError}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label={t("marketContacts.type")}
            required
            value={type}
            options={CONTACT_TYPES.map((item) => ({ value: item, label: t(`marketContacts.types.${item}`) }))}
            onChange={(next) => {
              setType((next === null ? "phone" : String(next)) as MarketContactType);
              setErrors({});
            }}
            error={errors.type}
          />
          {type === "social" && (
            <SelectField
              label={t("marketContacts.platform")}
              required
              value={platform}
              placeholder={t("crud.choose")}
              options={SOCIAL_PLATFORMS.map((item) => ({ value: item, label: t(`marketContacts.platforms.${item}`) }))}
              onChange={(next) => setPlatform(next === null ? null : (String(next) as SocialPlatform))}
              error={errors.platform}
            />
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label={t("marketContacts.labelEn")}
            dir="ltr"
            value={labelEn}
            onChange={(event) => setLabelEn(event.target.value)}
            error={errors.label}
            required
          />
          <Input
            label={t("marketContacts.labelAr")}
            value={labelAr}
            onChange={(event) => setLabelAr(event.target.value)}
            error={errors.label_ar}
            required
          />
        </div>

        <div className="space-y-2">
          <Input
            label={t("marketContacts.value")}
            dir="ltr"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            error={errors.value}
            required
          />
          {valueHint && <p className="text-xs text-muted">{valueHint}</p>}
        </div>

        {hasArabicValue(type) && (
          <Input
            label={t("marketContacts.valueAr")}
            value={valueAr}
            onChange={(event) => setValueAr(event.target.value)}
            error={errors.value_ar}
          />
        )}

        <Toggle
          label={t("marketContacts.active")}
          hint={t("marketContacts.activeHint")}
          checked={isActive}
          onChange={setIsActive}
        />

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onDone}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? t("crud.saving") : t("crud.save")}
          </Button>
        </div>
      </form>
    );
  };
