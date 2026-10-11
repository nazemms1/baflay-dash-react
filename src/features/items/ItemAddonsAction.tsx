import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Layers } from "lucide-react";
import { usePermissions } from "@/features/auth/hooks";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { RemoteCheckList } from "@/components/ui/RemoteCheckList";
import { ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Bars";
import { asArray, asRecord, toNumber, toText } from "@/lib/coerce";
import { localizedRecord } from "@/lib/localized";
import { currentLanguage } from "@/i18n";
import { ApiError, toApiError } from "@/lib/http/errors";
import { selectedOptions, useIngredientDetails } from "@/features/ingredients/details";
import { remoteSource } from "@/modules/shared";
import { ingredients, itemAddOns, type Named } from "@/services";

/** مكوّنات الإضافات تُبحث في الخادم عشرين في الصفحة، فلا تُنزَّل القائمة كلها. */
const INGREDIENT_OPTIONS = remoteSource("ingredients", ingredients);

/** الإضافات المختارة للصنف، وتغطية الفروع: أي فرع لا يسعّر بعضها. */
interface AddonsState {
  selected: number[];
  uncoveredBranches: { name: string; missing: number }[];
}

function readAddons(body: unknown): AddonsState {
  const root = asRecord(body);
  const selected = asArray(root.ingredient_ids).map((value) => toNumber(value));
  const uncoveredBranches = asArray(root.branches)
    .map((entry) => {
      const branch = asRecord(entry);
      return {
        name: toText(branch.branch_name) || `#${toText(branch.branch_id)}`,
        missing: asArray(branch.missing_ingredient_ids).length,
      };
    })
    .filter((branch) => branch.missing > 0);
  return { selected, uncoveredBranches };
}

/** زر «الإضافات» في صف الصنف: يفتح نافذة اختيار المكونات التي يقبلها الصنف. */
export function ItemAddonsAction({ row }: { row: Named }) {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [open, setOpen] = useState(false);

  if (!permissions.has("items.addons.update")) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("addons.open")}
        title={t("addons.open")}
        className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-primary-soft hover:text-ink"
      >
        <Layers className="size-4" aria-hidden />
      </button>
      {open && <AddonsDialog itemId={row.id} itemName={localizedRecord(row, currentLanguage())} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddonsDialog({ itemId, itemName, onClose }: { itemId: number | string; itemName: string; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<number[] | null>(null);

  const current = useQuery({
    queryKey: ["item-addons", itemId],
    queryFn: async () => readAddons(await itemAddOns.get(itemId)),
  });

  const selected = draft ?? current.data?.selected ?? [];
  // أسماء المختار وصورها من طلب مشترك واحد للمكوّنات، لا من طلب لكل مكوّن على حدة.
  const details = useIngredientDetails(selected);

  const save = useMutation({
    mutationFn: () => itemAddOns.set(itemId, { ingredient_ids: selected }),
    onSuccess: async () => {
      toast.success(t("addons.saved"));
      await queryClient.invalidateQueries({ queryKey: ["item-addons", itemId] });
      onClose();
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  const loading = current.isPending;

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t("addons.title", { name: itemName })}
      description={t("addons.description")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>{t("common.cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || loading} className="bg-primary text-ink hover:bg-primary/90">
            {save.isPending ? t("crud.saving") : t("crud.save")}
          </Button>
        </>
      }
    >
      {loading && <Skeleton className="h-64" />}
      {current.isError && (
        <ErrorState
          message={current.error instanceof ApiError ? current.error.message : t("errors.unexpected")}
          onRetry={() => void current.refetch()}
          error={current.error}
        />
      )}
      {current.isSuccess && (
        <div className="space-y-4">
          <RemoteCheckList
            source={INGREDIENT_OPTIONS}
            selected={selected}
            known={selectedOptions(selected, details)}
            onChange={(next) => setDraft(next.map((value) => Number(value)))}
          />
          {current.data.uncoveredBranches.length > 0 && (
            <div className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
              <p className="font-medium">{t("addons.uncoveredTitle")}</p>
              <ul className="mt-1 list-inside list-disc text-xs">
                {current.data.uncoveredBranches.map((branch) => (
                  <li key={branch.name}>{t("addons.uncoveredBranch", { branch: branch.name, count: branch.missing })}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
