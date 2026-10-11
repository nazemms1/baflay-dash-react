import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { usePermissions } from "@/features/auth/hooks";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Pagination } from "@/components/ui/Pagination";
import { Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Bars";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SelectField } from "@/components/ui/Fields";
import { Input } from "@/components/ui/Input";
import { currentLanguage } from "@/i18n";
import { ApiError } from "@/lib/http/errors";
import { RecordDetails } from "./RecordDetails";
import { RecordForm } from "./RecordForm";
import type { CrudModule } from "./types";

/** عدد الصفوف في الصفحة الواحدة لكل القوائم. */
const PER_PAGE = 20;

type Active<T> =
  | { kind: "create" }
  | { kind: "edit"; id: number | string }
  | { kind: "show"; id: number | string }
  | { kind: "delete"; row: T };

/**
 * صفحة CRUD كاملة لأي وحدة: قائمة مرقّمة، وإنشاء وتعديل وعرض وحذف، ولكل زر
 * صلاحيته الخاصة من الخادم. الشاشة لا تعرف أي وحدة بعينها، بل تقرأ تعريفها.
 */
export function CrudPage<T extends { id: number | string }>({ module }: { module: CrudModule<T> }) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const permissions = usePermissions();
  const [page, setPage] = useState(1);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [active, setActive] = useState<Active<T> | null>(null);

  const can = (name: string | undefined) => !!name && permissions.has(name);
  const canCreate = !module.readOnly && !!module.api.create && can(module.permissions.create);
  const canEdit = !module.readOnly && !!module.api.update && can(module.permissions.update);
  const canDelete =
    !module.readOnly && !!module.api.remove && (module.permissions.delete ?? []).some((name) => can(name));
  const canShow = can(module.permissions.show ?? module.permissions.index);
  const hasActions = canShow || canEdit || canDelete || !!module.rowActions;

  // الفلاتر الفارغة لا تُرسل، فالخادم يعامل الغياب كـ«الكل».
  const activeFilters = Object.fromEntries(
    Object.entries(filterValues).filter(([, value]) => value !== "")
  );

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // البحث يصل إلى الخادم بعد توقف الكتابة قليلاً، ومع كل تغيير في نصه تعود القائمة إلى الصفحة الأولى.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // الخادم يُرقّم القائمة كلها، ويُرسل إليه نص البحث بالمعامل الذي تعلنه الوحدة.
  const searchParams = module.searchParam && debouncedSearch ? { [module.searchParam]: debouncedSearch } : {};
  const list = useQuery({
    queryKey: [module.id, "list", page, activeFilters, debouncedSearch],
    queryFn: ({ signal }) => module.api.list({ page, per_page: PER_PAGE, ...activeFilters, ...searchParams }, signal),
    placeholderData: keepPreviousData,
  });

  const rows = list.data?.items ?? [];
  const close = () => setActive(null);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t(module.titleKey)}</h1>
          {list.data && (
            <p className="mt-1 text-sm text-muted">{t("common.total", { count: list.data.meta.total })}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {module.headerActions}
          {canCreate && (
            <Button onClick={() => setActive({ kind: "create" })} className="bg-primary text-ink hover:bg-primary/90">
              <Plus className="size-4" aria-hidden />
              {t("crud.add")}
            </Button>
          )}
        </div>
      </header>

      {module.searchParam && (
        <div className="relative">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("crud.searchPlaceholder")}
            aria-label={t("crud.searchPlaceholder")}
            className="h-12 w-full rounded-2xl border border-line bg-surface ps-11 pe-4 text-[15px] text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </div>
      )}

      {module.filters && module.filters.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4">
          {module.filters.map((filter) => (
            <div key={filter.key} className="min-w-44">
              {filter.kind === "date" ? (
                <Input
                  label={filter.label}
                  type="date"
                  value={filterValues[filter.key] ?? ""}
                  onChange={(event) => {
                    setPage(1);
                    setFilterValues((current) => ({ ...current, [filter.key]: event.target.value }));
                  }}
                />
              ) : (
                <SelectField
                  label={filter.label}
                  options={filter.options}
                  placeholder={t("crud.allValues")}
                  value={filterValues[filter.key] ?? null}
                  onChange={(value) => {
                    setPage(1);
                    setFilterValues((current) => ({
                      ...current,
                      [filter.key]: value === null ? "" : String(value),
                    }));
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <Panel>
        {list.isError && (
          <ErrorState
            message={list.error instanceof ApiError ? list.error.message : t("errors.unexpected")}
            onRetry={() => void list.refetch()}
            error={list.error}
          />
        )}

        {!list.isError && list.isPending && (
          <div className="space-y-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        )}

        {list.isSuccess && rows.length === 0 && <EmptyState>{t("common.noData")}</EmptyState>}

        {list.isSuccess && rows.length > 0 && (
          <div className="space-y-4">
            {/* الجدول يبدأ من أعلى البطاقة ويقصّ زواياها، فيصل الهيدر الأحمر إلى الحواف كلها. */}
            <div className="-mx-5 -mt-5 overflow-x-auto rounded-t-2xl">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-secondary text-sm font-semibold text-surface">
                  <tr className="border-b border-line">
                    {module.columns.map((column) => (
                      <th key={column.key} className={`px-5 py-4 text-start font-medium ${column.className ?? ""}`}>
                        {t(column.header)}
                      </th>
                    ))}
                    {hasActions && <th className="px-5 py-4 text-end font-medium">{t("crud.actions")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-line/70 transition last:border-0 hover:bg-canvas/70">
                      {module.columns.map((column) => (
                        <td key={column.key} className={`px-5 py-3 align-middle ${column.className ?? ""}`}>
                          {column.render(row, language)}
                        </td>
                      ))}
                      {hasActions && (
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {module.rowActions && <module.rowActions row={row} />}
                            {canShow && (
                              <IconAction label={t("crud.show")} onClick={() => setActive({ kind: "show", id: row.id })}>
                                <Eye className="size-4" aria-hidden />
                              </IconAction>
                            )}
                            {canEdit && (
                              <IconAction label={t("crud.edit")} onClick={() => setActive({ kind: "edit", id: row.id })}>
                                <Pencil className="size-4" aria-hidden />
                              </IconAction>
                            )}
                            {canDelete && (
                              <IconAction label={t("crud.delete")} tone="danger" onClick={() => setActive({ kind: "delete", row })}>
                                <Trash2 className="size-4" aria-hidden />
                              </IconAction>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {list.data && <Pagination meta={list.data.meta} onPageChange={setPage} />}
          </div>
        )}
      </Panel>

      {active?.kind === "create" && (
        <Dialog open onClose={close} title={t("crud.createTitle", { name: t(module.titleKey) })} size="lg">
          {module.form ? (
            <module.form record={null} onDone={close} />
          ) : (
            <RecordForm module={module} record={null} onDone={close} />
          )}
        </Dialog>
      )}

      {(active?.kind === "edit" || active?.kind === "show") && (
        <RecordDialog module={module} id={active.id} mode={active.kind} onClose={close} />
      )}

      {active?.kind === "delete" && <DeleteDialog module={module} row={active.row} onClose={close} />}
    </div>
  );
}

function IconAction({
  label,
  tone = "default",
  onClick,
  children,
}: {
  label: string;
  tone?: "default" | "danger";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={
        tone === "danger"
          ? "grid size-8 cursor-pointer place-items-center rounded-lg text-ink-soft transition hover:bg-secondary-soft hover:text-secondary"
          : "grid size-8 cursor-pointer place-items-center rounded-lg text-ink-soft transition hover:bg-primary-soft hover:text-ink"
      }
    >
      {children}
    </button>
  );
}

/** تحميل السجل الكامل قبل فتح التعديل أو العرض، لأن القائمة قد تحمل جزءاً منه فقط. */
function RecordDialog<T extends { id: number | string }>({
  module,
  id,
  mode,
  onClose,
}: {
  module: CrudModule<T>;
  id: number | string;
  mode: "edit" | "show";
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const detail = useQuery({
    queryKey: [module.id, "detail", id],
    queryFn: ({ signal }) => module.api.get(id, signal),
  });

  const language = currentLanguage();
  const recordName = detail.data && module.nameOf ? module.nameOf(detail.data, language) : "";
  const title =
    mode === "edit" ? t("crud.editTitle") : recordName || t("crud.showTitle");

  return (
    <Dialog open onClose={onClose} title={title} size="lg">
      {detail.isPending && <Skeleton className="h-64" />}
      {detail.isError && (
        <ErrorState
          message={detail.error instanceof ApiError ? detail.error.message : t("errors.unexpected")}
          onRetry={() => void detail.refetch()}
        />
      )}
      {detail.isSuccess && mode === "edit" &&
        (module.form ? (
          <module.form record={detail.data} onDone={onClose} />
        ) : (
          <RecordForm module={module} record={detail.data} onDone={onClose} />
        ))}
      {detail.isSuccess && mode === "show" &&
        (module.details ? (
          <module.details record={detail.data} />
        ) : (
          <RecordDetails module={module} record={detail.data} />
        ))}
    </Dialog>
  );
}

function DeleteDialog<T extends { id: number | string }>({
  module,
  row,
  onClose,
}: {
  module: CrudModule<T>;
  row: T;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const queryClient = useQueryClient();
  const name = module.nameOf ? module.nameOf(row, language) : `#${row.id}`;

  const remove = useMutation({
    mutationFn: () => module.api.remove!(row.id),
    onSuccess: async () => {
      toast.success(t("crud.deleted"));
      // قوائم الخيارات المخبّأة (الأصناف والفروع...) تُحدَّث أيضاً، فلا يبقى المحذوف في الحقول المنسدلة.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [module.id] }),
        queryClient.invalidateQueries({ queryKey: ["options"] }),
      ]);
      onClose();
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("crud.deleteTitle")}
      description={t("crud.deleteBody", { name })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={remove.isPending}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
            {remove.isPending ? t("crud.deleting") : t("crud.confirmDelete")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">{t("crud.deleteWarning")}</p>
    </Dialog>
  );
}
