import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { FormProps } from "@/components/crud/types";
import { Button } from "@/components/ui/Button";
import { ImageField, Toggle } from "@/components/ui/Fields";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/http/errors";
import { heroSlides, type HeroSlide } from "@/services";

/**
 * نموذج شريحة الواجهة الرئيسية لدولة بعينها. الدولة تأتي من الوحدة التي تبنيه، فالشريحة
 * تُحفظ دائماً في دولتها. الملفات تُرسل فقط عند اختيارها.
 */
export const makeHeroSlideForm = (code: string, moduleId: string) =>
  function HeroSlideForm({ record, onDone }: FormProps<HeroSlide>) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const [desktop, setDesktop] = useState<File | null>(null);
    const [mobile, setMobile] = useState<File | null>(null);
    const [removeMobile, setRemoveMobile] = useState(false);
    const [titleEn, setTitleEn] = useState(record?.title ?? "");
    const [titleAr, setTitleAr] = useState(record?.title_ar ?? "");
    const [subtitleEn, setSubtitleEn] = useState(record?.subtitle ?? "");
    const [subtitleAr, setSubtitleAr] = useState(record?.subtitle_ar ?? "");
    const [isActive, setIsActive] = useState(record ? record.is_active : true);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const validate = (): Record<string, string> => {
      const next: Record<string, string> = {};
      if (!record && !desktop) next.desktop_image = t("heroSlides.errors.desktopRequired");
      if (!titleEn.trim()) next.title = t("crud.required");
      if (!titleAr.trim()) next.title_ar = t("crud.required");
      return next;
    };

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFormError(null);
      const next = validate();
      setErrors(next);
      if (Object.keys(next).length > 0) return;

      const body = new FormData();
      if (desktop) body.append("desktop_image", desktop);
      if (mobile) body.append("mobile_image", mobile);
      else if (removeMobile) body.append("remove_mobile_image", "1");
      body.append("title", titleEn.trim());
      body.append("title_ar", titleAr.trim());
      body.append("subtitle", subtitleEn.trim());
      body.append("subtitle_ar", subtitleAr.trim());
      body.append("is_active", isActive ? "1" : "0");

      setSaving(true);
      try {
        if (record) await heroSlides.update(record.id, body);
        else await heroSlides.create(code, body);
        toast.success(t("heroSlides.saved"));
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

    return (
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {formError && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {formError}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <ImageField
            label={t("heroSlides.desktopImage")}
            currentUrl={record?.desktop_image ?? null}
            file={desktop}
            onChange={setDesktop}
            error={errors.desktop_image}
            ratio={16 / 9}
          />
          <div className="space-y-2">
            <ImageField
              label={t("heroSlides.mobileImage")}
              currentUrl={removeMobile ? null : (record?.mobile_image ?? null)}
              file={mobile}
              onChange={(file) => {
                setMobile(file);
                // إزالة صورة الجوال الموجودة تُرسل بعلامة صريحة، لا بغياب الحقل.
                setRemoveMobile(file === null && Boolean(record?.mobile_image));
              }}
              ratio={null}
            />
            <p className="text-xs text-muted">{t("heroSlides.mobileImageHint")}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label={t("heroSlides.titleEn")}
            dir="ltr"
            value={titleEn}
            onChange={(event) => setTitleEn(event.target.value)}
            error={errors.title}
            required
          />
          <Input
            label={t("heroSlides.titleAr")}
            value={titleAr}
            onChange={(event) => setTitleAr(event.target.value)}
            error={errors.title_ar}
            required
          />
          <Input
            label={t("heroSlides.subtitleEn")}
            dir="ltr"
            value={subtitleEn}
            onChange={(event) => setSubtitleEn(event.target.value)}
          />
          <Input
            label={t("heroSlides.subtitleAr")}
            value={subtitleAr}
            onChange={(event) => setSubtitleAr(event.target.value)}
          />
        </div>

        <Toggle
          label={t("heroSlides.active")}
          hint={t("heroSlides.activeHint")}
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
