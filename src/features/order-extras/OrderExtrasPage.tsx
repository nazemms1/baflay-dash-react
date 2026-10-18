import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RemoteCheckList } from "@/components/ui/RemoteCheckList";
import { ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Bars";
import { asArray, asRecord, toNumber } from "@/lib/coerce";
import { toApiError } from "@/lib/http/errors";
import { usePermissions } from "@/features/auth/hooks";
import { selectedOptions, useIngredientDetails } from "@/features/ingredients/details";
import { remoteSource } from "@/modules/shared";
import { ingredients, orderExtras } from "@/services";

/** مكوّنات الإضافات تُبحث في الخادم عشرين في الصفحة، فلا تُنزَّل القائمة كلها. */
const INGREDIENT_OPTIONS = remoteSource("ingredients", ingredients);

/**
 * الإضافات العامة للطلب: قائمة واحدة للبراند كله، تظهر في كل الفروع التي تسعّر
 * المكوّن. كل فرع يستطيع إطفاء ما لا يريده من قائمته (من صفحة القائمة نفسها).
 */
export function OrderExtrasPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<number[] | null>(null);
  // تعديل القائمة يحتاج صلاحية تعديل إضافات الطلب، ومن لا يملكها يراها للقراءة فقط.
  const canEdit = usePermissions().has("order-extras.update");

  const current = useQuery({
    queryKey: ["order-extras"],
    queryFn: async () => {
      const root = asRecord(await orderExtras.get());
      return asArray(root.ingredient_ids).map((value) => toNumber(value));
    },
  });

  const selected = draft ?? current.data ?? [];
  // أسماء المختار وصورها من طلب مشترك واحد للمكوّنات، لا من طلب لكل مكوّن على حدة.
  const details = useIngredientDetails(selected);

  const save = useMutation({
    mutationFn: () => orderExtras.set({ ingredient_ids: selected }),
    onSuccess: async () => {
      toast.success(t("orderExtras.saved"));
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["order-extras"] });
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">{t("nav.orderExtras")}</h1>
        <p className="mt-1 text-sm text-muted">{t("orderExtras.subtitle")}</p>
      </header>

      <Panel
        title={t("orderExtras.title")}
        description={t("orderExtras.description")}
        action={
          canEdit && draft !== null && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={save.isPending} onClick={() => setDraft(null)}>
                {t("ingredientsPage.discard")}
              </Button>
              <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()} className="bg-primary text-ink hover:bg-primary/90">
                {save.isPending ? t("crud.saving") : t("crud.save")}
              </Button>
            </div>
          )
        }
      >
        {current.isPending && <Skeleton className="h-64" />}
        {current.isError && (
          <ErrorState message={t("errors.unexpected")} onRetry={() => void current.refetch()} error={current.error} />
        )}
        {current.isSuccess && (
          <RemoteCheckList
            source={INGREDIENT_OPTIONS}
            selected={selected}
            known={selectedOptions(selected, details)}
            onChange={(next) => setDraft(next.map((value) => Number(value)))}
            readOnly={!canEdit}
          />
        )}
      </Panel>
    </div>
  );
}
