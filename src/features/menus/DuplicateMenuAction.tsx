import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Copy, Plus, Trash2 } from "lucide-react";
import { usePermissions } from "@/features/auth/hooks";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { RemoteSelect } from "@/components/ui/RemoteSelect";
import { SelectField } from "@/components/ui/Fields";
import { Pagination } from "@/components/ui/Pagination";
import { PAGE_SIZE, pageOf } from "@/components/ui/paging";
import { Skeleton } from "@/components/ui/Bars";
import { ErrorState } from "@/components/ui/States";
import { asArray, asRecord, toNumber, toText } from "@/lib/coerce";
import { localizedRecord } from "@/lib/localized";
import { currentLanguage } from "@/i18n";
import { toApiError } from "@/lib/http/errors";
import { remoteSource } from "@/modules/shared";
import { branches, items, menus, type Named } from "@/services";

const MENU_CURRENCIES = ["USD", "SYP", "AED", "IQD"];

/** الفروع والأصناف تُبحث في الخادم عشرين في الطلب، ولا تُنزَّل كاملة. */
const BRANCH_OPTIONS = remoteSource("branches", branches);
const ITEM_OPTIONS = remoteSource("items", items);

interface DraftRow {
  item_id: number;
  price: string;
  /** اسم الصنف، يُحفظ مع الصف فلا يُطلب من الخادم من جديد. */
  label?: string;
}

interface DraftForm {
  name: string;
  branchId: number | null;
  branchLabel: string;
  currency: string;
  rows: DraftRow[];
}

/**
 * نسخ قائمة إلى قائمة جديدة: الاسم والفرع والأصناف والأسعار تُنسخ من الأصل،
 * ويستطيع المستخدم تعديلها قبل الحفظ (حذف صنف، أو إضافة آخر، أو تغيير سعر).
 * الحفظ ينشئ قائمة جديدة فقط، ولا يمس القائمة الأصلية.
 */
export function DuplicateMenuAction({ row }: { row: Named }) {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [open, setOpen] = useState(false);

  if (!permissions.has("menus.store")) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("menuDuplicate.open")}
        title={t("menuDuplicate.open")}
        className="grid size-11 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-primary-soft hover:text-ink sm:size-8"
      >
        <Copy className="size-4" aria-hidden />
      </button>
      {open && <DuplicateDialog source={row} onClose={() => setOpen(false)} />}
    </>
  );
}

function DuplicateDialog({ source, onClose }: { source: Named; onClose: () => void }) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const queryClient = useQueryClient();
  const sourceId = toNumber(source.id);
  const sourceName = toText(source.name) || `#${sourceId}`;

  const detail = useQuery({
    queryKey: ["menu-detail", sourceId],
    queryFn: ({ signal }) => menus.get(sourceId, signal),
  });

  // المسودة تُملأ مرة واحدة من القائمة الأصلية، ثم يعدّلها المستخدم بحرية.
  const [draft, setDraft] = useState<DraftForm | null>(null);
  // أصناف القائمة الجديدة تُعرض عشرين في الصفحة، والفهرس يبقى عاماً فتعمل التعديلات على الصف الصحيح.
  const [rowPage, setRowPage] = useState(1);

  // أسماء الأصناف تأتي مع القائمة نفسها، فلا تُطلب الأصناف واحداً واحداً.
  const sourceItems = asArray(asRecord(detail.data).items).map((entry) => {
    const row = asRecord(entry);
    const id = toNumber(row.item_id ?? row.id);
    return {
      item_id: id,
      price: String(toNumber(row.price)),
      currency: toText(row.currency),
      label: localizedRecord(row, language) || `#${id}`,
    };
  });
  const sourceCurrency =
    toText(asRecord(detail.data).currency) || sourceItems.find((row) => row.currency)?.currency || MENU_CURRENCIES[0];

  const form: DraftForm = draft ?? {
    name: t("menuDuplicate.copyOf", { name: sourceName }),
    branchId: null,
    branchLabel: "",
    currency: sourceCurrency,
    rows: sourceItems.map((row) => ({ item_id: row.item_id, price: row.price, label: row.label })),
  };

  const rowsPage = pageOf(form.rows, rowPage);
  const pageStart = (rowsPage.meta.currentPage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;

  const save = useMutation({
    mutationFn: () =>
      menus.create({
        name: form.name.trim(),
        branch_id: form.branchId,
        currency: form.currency,
        original_menu_id: sourceId,
        items: form.rows.map((row, index) => ({
          item_id: row.item_id,
          price: Number(row.price) || 0,
          currency: form.currency,
          order: index + 1,
        })),
      }),
    onSuccess: async () => {
      toast.success(t("menuDuplicate.saved"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["menus"] }),
        queryClient.invalidateQueries({ queryKey: ["options"] }),
      ]);
      onClose();
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  const setForm = (next: Partial<DraftForm>) => setDraft({ ...form, ...next });
  const setRow = (index: number, patch: Partial<DraftRow>) =>
    setForm({ rows: form.rows.map((row, position) => (position === index ? { ...row, ...patch } : row)) });

  const valid =
    form.name.trim() !== "" && form.branchId !== null && form.rows.length > 0 && form.rows.every((row) => toNumber(row.price) > 0);

  const loading = detail.isPending;

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      fullOnMobile
      title={t("menuDuplicate.title", { name: sourceName })}
      description={t("menuDuplicate.description")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>{t("common.cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending || loading} className="bg-primary text-ink hover:bg-primary/90">
            {save.isPending ? t("crud.saving") : t("menuDuplicate.submit")}
          </Button>
        </>
      }
    >
      {loading && <Skeleton className="h-64" />}
      {detail.isError && (
        <ErrorState message={t("errors.unexpected")} onRetry={() => void detail.refetch()} error={detail.error} />
      )}
      {detail.isSuccess && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label={t("menuDuplicate.newName")} value={form.name} onChange={(event) => setForm({ name: event.target.value })} />
            <RemoteSelect
              label={t("menuDuplicate.newBranch")}
              source={BRANCH_OPTIONS}
              value={form.branchId}
              fallbackLabel={form.branchLabel}
              placeholder={t("crud.choose")}
              onChange={(value, label) => setForm({ branchId: value === null ? null : Number(value), branchLabel: label })}
            />
            <SelectField
              label={t("crud.field.menuCurrency")}
              options={MENU_CURRENCIES.map((value) => ({ value, label: value }))}
              value={form.currency}
              onChange={(value) => setForm({ currency: value === null ? form.currency : String(value) })}
            />
          </div>

          <section className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold text-ink">{t("menuDuplicate.items", { count: form.rows.length })}</h3>
              <div className="w-full sm:w-64">
                <RemoteSelect
                  label={t("menuDuplicate.addItem")}
                  source={ITEM_OPTIONS}
                  value={null}
                  placeholder={t("menuDuplicate.addItemPlaceholder")}
                  onChange={(value, label) => {
                    if (value === null) return;
                    const id = Number(value);
                    if (form.rows.some((row) => row.item_id === id)) return;
                    setForm({ rows: [...form.rows, { item_id: id, price: "", label }] });
                  }}
                />
              </div>
            </div>

            {form.rows.length === 0 ? (
              <p className="rounded-xl bg-canvas px-4 py-6 text-center text-sm text-muted">{t("menuDuplicate.noItems")}</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {form.rows.map((row, index) =>
                  index < pageStart || index >= pageEnd ? null : (
                    <li key={`${row.item_id}-${index}`} className="grid items-center gap-3 px-3 py-2.5 sm:grid-cols-[1fr_8rem_auto]">
                      <span className="min-w-0 truncate text-sm font-medium">{row.label || `#${row.item_id}`}</span>
                      <Input
                        label={t("crud.field.price")}
                        type="number"
                        min="0"
                        step="any"
                        dir="ltr"
                        value={row.price}
                        onChange={(event) => setRow(index, { price: event.target.value })}
                      />
                      <button
                        type="button"
                        aria-label={t("crud.removeRow")}
                        onClick={() => setForm({ rows: form.rows.filter((_, position) => position !== index) })}
                        className="grid size-11 cursor-pointer place-items-center rounded-lg text-secondary hover:bg-secondary-soft sm:size-9"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </li>
                  )
                )}
              </ul>
            )}
            {form.rows.length > PAGE_SIZE && <Pagination meta={rowsPage.meta} onPageChange={setRowPage} />}
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Plus className="size-3.5" aria-hidden /> {t("menuDuplicate.hint")}
            </p>
          </section>
        </div>
      )}
    </Dialog>
  );
}
