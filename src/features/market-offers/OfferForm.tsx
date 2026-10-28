import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { FormProps } from "@/components/crud/types";
import { Button } from "@/components/ui/Button";
import { ImageField } from "@/components/ui/Fields";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/http/errors";
import { marketOffers, type MarketOffer } from "@/services";
import { isOfferLink } from "./offerRules";

/**
 * نموذج عرض دولة بعينها. الدولة تأتي من الوحدة التي تبنيه، فالعرض يُحفظ دائماً في دولته.
 * الصورة إجبارية للعرض الجديد، وتُرسل فقط عند اختيار صورة جديدة. الرابط اختياري.
 */
export const makeOfferForm = (code: string, moduleId: string) =>
  function OfferForm({ record, onDone }: FormProps<MarketOffer>) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const [image, setImage] = useState<File | null>(null);
    const [link, setLink] = useState(record?.link ?? "");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const validate = (): Record<string, string> => {
      const next: Record<string, string> = {};
      if (!record && !image) next.image = t("marketOffers.errors.imageRequired");
      if (!isOfferLink(link)) next.link = t("marketOffers.errors.link");
      return next;
    };

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFormError(null);
      const next = validate();
      setErrors(next);
      if (Object.keys(next).length > 0) return;

      const trimmedLink = link.trim();

      setSaving(true);
      try {
        if (record && !image) {
          await marketOffers.updateLink(record.id, trimmedLink || null);
        } else {
          const body = new FormData();
          if (image) body.append("image", image);
          // الرابط الفارغ يُرسل فارغاً، والخادم يحوّله إلى `null`.
          body.append("link", trimmedLink);
          if (record) await marketOffers.updateWithImage(record.id, body);
          else await marketOffers.create(code, body);
        }
        toast.success(t("marketOffers.saved"));
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

        <ImageField
          label={t("marketOffers.image")}
          currentUrl={record?.image ?? null}
          file={image}
          onChange={setImage}
          error={errors.image}
          ratio={null}
        />

        <div className="space-y-2">
          <Input
            label={t("marketOffers.link")}
            dir="ltr"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            error={errors.link}
            placeholder="https://… or /menu"
          />
          <p className="text-xs text-muted">{t("marketOffers.linkHint")}</p>
        </div>

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
