import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { usePermissions } from "@/features/auth/hooks";
import { SelectField } from "@/components/ui/Fields";
import { currentLanguage } from "@/i18n";
import { asRecord, toNumber, toText } from "@/lib/coerce";
import { localizedRecord } from "@/lib/localized";
import { toApiError } from "@/lib/http/errors";
import { cities, countries, states, type GeoEntity } from "@/services";
import type { FormProps } from "@/components/crud/types";

/**
 * نموذج المدينة كما في الداشبورد القديم: الاسم بلغتيه، والولاية. وبجانب اختيار الولاية زر
 * لإضافة ولاية جديدة من النافذة نفسها، فتُختار تلقائياً بعد حفظها.
 */
export function CityForm({ record, onDone }: FormProps<GeoEntity>) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const queryClient = useQueryClient();
  const [name, setName] = useState(toText(record?.name));
  const [nameAr, setNameAr] = useState(toText(record?.name_ar));
  const [stateId, setStateId] = useState<number | null>(() => {
    if (!record) return null;
    const row = record as unknown as Record<string, unknown>;
    return toNumber(row.state_id ?? asRecord(row.state).id) || null;
  });
  const [addingState, setAddingState] = useState(false);
  // إضافة ولاية من داخل نموذج المدينة تحتاج صلاحية إنشاء الولايات.
  const canAddState = usePermissions().has("states.store");
  const [error, setError] = useState<{ message: string; stateId?: string } | null>(null);

  const stateList = useQuery({
    queryKey: ["options", "states"],
    queryFn: async ({ signal }) => (await states.list({ page: 1, per_page: 500 }, signal)).items,
    staleTime: 60_000,
  });
  const countryList = useQuery({
    queryKey: ["options", "countries"],
    queryFn: async ({ signal }) => (await countries.list({ page: 1, per_page: 500 }, signal)).items,
    staleTime: 60_000,
  });

  const stateOptions = (stateList.data ?? []).map((row) => ({
    value: toNumber(row.id),
    label: localizedRecord(row, language) || `#${row.id}`,
  }));
  const countryOptions = (countryList.data ?? []).map((row) => ({
    value: toNumber(row.id),
    label: localizedRecord(row, language) || `#${row.id}`,
  }));

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim() || null,
        name_ar: nameAr.trim() || null,
        state_id: stateId,
      };
      return record ? cities.update(record.id, payload) : cities.create(payload);
    },
    onSuccess: async () => {
      toast.success(t(record ? "crud.updated" : "crud.created"));
      await queryClient.invalidateQueries({ queryKey: ["cities"] });
      onDone();
    },
    onError: (caught) => {
      const apiError = toApiError(caught, t("errors.unexpected"));
      setError({ message: apiError.fieldErrors.state_id ? "" : apiError.message, stateId: apiError.fieldErrors.state_id?.[0] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stateId === null) {
      setError({ message: "", stateId: t("crud.required") });
      return;
    }
    setError(null);
    save.mutate();
  }

  return (
    <>
      <form onSubmit={submit} noValidate className="space-y-5">
        {error?.message && (
          <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error.message}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={`${t("crud.field.name")} · ${t("crud.english")}`}
            dir="ltr"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            label={`${t("crud.field.name")} · ${t("crud.arabic")}`}
            dir="rtl"
            value={nameAr}
            onChange={(event) => setNameAr(event.target.value)}
          />
          <div className="flex items-end gap-2 sm:col-span-2">
            <div className="min-w-0 flex-1">
              <SelectField
                label={t("crud.field.state")}
                required
                options={stateOptions}
                value={stateId}
                placeholder={t("crud.choose")}
                error={error?.stateId}
                onChange={(value) => setStateId(value === null ? null : Number(value))}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              aria-label={t("cities.addState")}
              title={t("cities.addState")}
              disabled={!canAddState} onClick={() => setAddingState(true)}
              className="shrink-0"
            >
              <Plus className="size-4" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="sticky bottom-0 z-20 -mx-6 -mb-5 flex justify-end gap-2 border-t border-line bg-surface/95 px-6 py-4 backdrop-blur">
          <Button variant="secondary" type="button" onClick={onDone} disabled={save.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={save.isPending} className="bg-primary text-ink hover:bg-primary/90">
            {save.isPending ? t("crud.saving") : t("crud.save")}
          </Button>
        </div>
      </form>

      {addingState && (
        <AddStateDialog
          countries={countryOptions}
          onClose={() => setAddingState(false)}
          onCreated={(id) => {
            setStateId(id);
            setAddingState(false);
          }}
        />
      )}
    </>
  );
}

/** نافذة إضافة ولاية: الاسم بلغتيه والدولة، ثم تُعاد الولاية الجديدة إلى نموذج المدينة. */
function AddStateDialog({
  countries: countryOptions,
  onClose,
  onCreated,
}: {
  countries: { value: number; label: string }[];
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [countryId, setCountryId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      states.create({ name: name.trim() || null, name_ar: nameAr.trim() || null, country_id: countryId }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["options", "states"] });
      toast.success(t("crud.created"));
      onCreated(toNumber(asRecord(created).id));
    },
    onError: (caught) => setError(toApiError(caught, t("errors.unexpected")).message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (countryId === null) {
      setError(t("crud.required"));
      return;
    }
    setError(null);
    create.mutate();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("cities.addState")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>{t("common.cancel")}</Button>
          <Button
            type="submit"
            form="add-state-form"
            disabled={create.isPending}
            className="bg-primary text-ink hover:bg-primary/90"
          >
            {create.isPending ? t("crud.saving") : t("common.add")}
          </Button>
        </>
      }
    >
      <form id="add-state-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={`${t("crud.field.name")} · ${t("crud.english")}`}
            dir="ltr"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            label={`${t("crud.field.name")} · ${t("crud.arabic")}`}
            dir="rtl"
            value={nameAr}
            onChange={(event) => setNameAr(event.target.value)}
          />
          <div className="sm:col-span-2">
            <SelectField
              label={t("crud.field.country")}
              required
              options={countryOptions}
              value={countryId}
              placeholder={t("crud.choose")}
              onChange={(value) => setCountryId(value === null ? null : Number(value))}
            />
          </div>
        </div>
      </form>
    </Dialog>
  );
}
