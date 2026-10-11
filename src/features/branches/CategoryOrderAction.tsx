import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ListOrdered } from "lucide-react";
import { usePermissions } from "@/features/auth/hooks";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SortableList, type SortItem } from "@/components/ui/SortableList";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Bars";
import { asArray, asRecord, toNumber } from "@/lib/coerce";
import { localizedRecord } from "@/lib/localized";
import { currentLanguage } from "@/i18n";
import { toApiError } from "@/lib/http/errors";
import { branchApi, type Named } from "@/services";

/** زر «ترتيب التصنيفات» في صف الفرع: الترتيب الذي تراه قائمة الزبائن في التطبيق. */
export function CategoryOrderAction({ row }: { row: Named }) {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [open, setOpen] = useState(false);

  if (!permissions.has("branches.categories.order.update")) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("categoryOrder.open")}
        title={t("categoryOrder.open")}
        className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-soft transition hover:bg-primary-soft hover:text-ink"
      >
        <ListOrdered className="size-4" aria-hidden />
      </button>
      {open && (
        <CategoryOrderDialog
          branchId={toNumber(row.id)}
          branchName={localizedRecord(row, currentLanguage()) || `#${row.id}`}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CategoryOrderDialog({ branchId, branchName, onClose }: { branchId: number; branchName: string; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const language = currentLanguage();
  const [draft, setDraft] = useState<SortItem[] | null>(null);

  const branch = useQuery({
    queryKey: ["branch-public", branchId],
    queryFn: ({ signal }) => branchApi.publicGet(branchId, signal),
  });

  const saved: SortItem[] = asArray(asRecord(branch.data).categories).map((entry) => {
    const row = asRecord(entry);
    return {
      id: toNumber(row.id),
      label: localizedRecord(row as { name?: unknown; name_ar?: unknown }, language) || `#${toNumber(row.id)}`,
    };
  });

  const order = draft ?? saved;
  const changed = draft !== null && draft.some((item, index) => item.id !== saved[index]?.id);

  const save = useMutation({
    mutationFn: () => branchApi.reorderCategories(branchId, { category_ids: order.map((item) => item.id) }),
    onSuccess: async () => {
      toast.success(t("categoryOrder.saved"));
      await queryClient.invalidateQueries({ queryKey: ["branch-public", branchId] });
      onClose();
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t("categoryOrder.title", { name: branchName })}
      description={t("categoryOrder.hint")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>{t("common.cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={!changed || save.isPending} className="bg-primary text-ink hover:bg-primary/90">
            {save.isPending ? t("crud.saving") : t("crud.save")}
          </Button>
        </>
      }
    >
      {branch.isPending && <Skeleton className="h-64" />}
      {branch.isError && <ErrorState message={t("errors.unexpected")} onRetry={() => void branch.refetch()} />}
      {branch.isSuccess && saved.length === 0 && <EmptyState>{t("categoryOrder.empty")}</EmptyState>}
      {branch.isSuccess && saved.length > 0 && <SortableList items={order} onChange={setDraft} />}
    </Dialog>
  );
}
