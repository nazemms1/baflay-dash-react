import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Search, Trash2, type LucideIcon } from "lucide-react";
import { usePermissions } from "@/features/auth/hooks";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FilterSheet, type ActiveFilter } from "@/components/ui/FilterSheet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { ResponsiveRecordList, type RecordColumn } from "@/components/ui/ResponsiveRecordList";
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
 *
 * على الهاتف تصير الصفوف كروتاً، والفلاتر خلف زر، وتملأ النماذج الشاشة. الأعمدة تُرسم مرة
 * واحدة، والكرت يقرأ منها: الصورة تبقى في بدايته، والاسم عنوانه، والباقي تفاصيله.
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
  const canShow = can(module.permissions.show ?? module.permissions.index);
  // التعديل يحمّل السجل كاملاً بصلاحية العرض، فلا يظهر إلا لمن يملكها مع صلاحية التعديل.
  const canEdit = !module.readOnly && !!module.api.update && can(module.permissions.update) && canShow;
  const canDelete =
    !module.readOnly && !!module.api.remove && (module.permissions.delete ?? []).some((name) => can(name));
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

  // أزرار الصف بمصدر واحد، وتظهر بشكلين: أيقونات في الجدول، وأزرار بنص في الكرت.
  const actionsOf = (row: T, variant: "icon" | "button") => (
    <>
      {module.rowActions && <module.rowActions row={row} />}
      {canShow && (
        <RecordAction
          variant={variant}
          icon={Eye}
          label={t("crud.show")}
          onClick={() => setActive({ kind: "show", id: row.id })}
        />
      )}
      {canEdit && (
        <RecordAction
          variant={variant}
          icon={Pencil}
          label={t("crud.edit")}
          onClick={() => setActive({ kind: "edit", id: row.id })}
        />
      )}
      {canDelete && (
        <RecordAction
          variant={variant}
          icon={Trash2}
          label={t("crud.delete")}
          tone="danger"
          onClick={() => setActive({ kind: "delete", row })}
        />
      )}
    </>
  );

  // الجدول: الاسم والصورة والعمودان الأولان يظهران دائماً، والباقي من الشاشات الأوسع.
  const recordColumns: RecordColumn<T>[] = [
    ...module.columns.map((column, index) => ({
      key: column.key,
      header: t(column.header),
      cell: (row: T) => column.render(row, language),
      className: column.className,
      from: index < 2 ? undefined : ("lg" as const),
    })),
    ...(hasActions
      ? [
          {
            key: "actions",
            header: t("crud.actions"),
            align: "end" as const,
            cell: (row: T) => <div className="flex items-center justify-end gap-1">{actionsOf(row, "icon")}</div>,
          },
        ]
      : []),
  ];

  // الكرت على الهاتف: الصورة والاسم في الرأس، والباقي في شبكة صغيرة، والأزرار بعرض كامل تحتها.
  const renderCard = (row: T) => {
    const media = module.columns.find((column) => column.key === "image");
    const title = module.columns.find((column) => column.key === "name") ?? module.columns.find((column) => column !== media);
    const details = module.columns.filter((column) => column !== media && column !== title);

    return (
      <article className="flex flex-col gap-3 rounded-2xl border border-line bg-canvas/60 p-4">
        <div className="flex min-w-0 items-center gap-3">
          {media && <div className="shrink-0">{media.render(row, language)}</div>}
          {title && <div className="min-w-0 flex-1">{title.render(row, language)}</div>}
        </div>

        {details.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-xl bg-surface p-3 text-sm">
            {details.map((column) => (
              <div key={column.key} className="min-w-0">
                <dt className="text-xs text-muted">{t(column.header)}</dt>
                <dd className="mt-0.5 min-w-0 break-words text-ink">{column.render(row, language)}</dd>
              </div>
            ))}
          </dl>
        )}

        {hasActions && <div className="flex flex-wrap gap-2">{actionsOf(row, "button")}</div>}
      </article>
    );
  };

  // فلاتر القائمة النشطة: تظهر شارات على الهاتف، ويُزال كل منها بنقرة.
  const filterChips: ActiveFilter[] = (module.filters ?? []).flatMap((filter) => {
    const value = filterValues[filter.key];
    if (!value) return [];
    const shown =
      filter.kind === "date" ? value : (filter.options.find((option) => String(option.value) === value)?.label ?? value);
    return [
      {
        key: filter.key,
        label: `${filter.label}: ${shown}`,
        onRemove: () => {
          setPage(1);
          setFilterValues((current) => ({ ...current, [filter.key]: "" }));
        },
      },
    ];
  });

  const resetFilters = () => {
    setPage(1);
    setFilterValues({});
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(module.titleKey)}
        description={list.data ? t("common.total", { count: list.data.meta.total }) : undefined}
        actions={
          <>
            {module.headerActions}
            {canCreate && (
              <Button onClick={() => setActive({ kind: "create" })} className="bg-primary text-ink hover:bg-primary/90">
                <Plus className="size-4" aria-hidden />
                {t("crud.add")}
              </Button>
            )}
          </>
        }
      />

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
        <FilterSheet activeFilters={filterChips} onReset={resetFilters}>
          {module.filters.map((filter) => (
            <div key={filter.key} className="min-w-0">
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
        </FilterSheet>
      )}

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        {list.isError && (
          <div className="p-4">
            <ErrorState
              message={list.error instanceof ApiError ? list.error.message : t("errors.unexpected")}
              onRetry={() => void list.refetch()}
              error={list.error}
            />
          </div>
        )}

        {!list.isError && list.isPending && (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        )}

        {list.isSuccess && rows.length === 0 && <EmptyState>{t("common.noData")}</EmptyState>}

        {list.isSuccess && rows.length > 0 && (
          <ResponsiveRecordList
            label={t(module.titleKey)}
            rows={rows}
            getKey={(row) => String(row.id)}
            columns={recordColumns}
            renderCard={renderCard}
          />
        )}

        {list.data && rows.length > 0 && (
          <div className="px-4 pb-4">
            <Pagination meta={list.data.meta} onPageChange={setPage} />
          </div>
        )}
      </section>

      {active?.kind === "create" && (
        <Dialog open onClose={close} title={t("crud.createTitle", { name: t(module.titleKey) })} size="lg" fullOnMobile>
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

/**
 * زر الإجراء في الصف. بشكل الأيقونة في الجدول، وبشكل الزر بعرض كامل في الكرت.
 * الأيقونة 44px على الهاتف ويصغر من `sm`.
 */
function RecordAction({
  variant,
  icon: Icon,
  label,
  tone = "default",
  onClick,
}: {
  variant: "icon" | "button";
  icon: LucideIcon;
  label: string;
  tone?: "default" | "danger";
  onClick: () => void;
}) {
  if (variant === "button") {
    return (
      <Button
        variant="secondary"
        className={tone === "danger" ? "flex-1 text-secondary" : "flex-1"}
        onClick={onClick}
      >
        <Icon className="size-4" aria-hidden />
        {label}
      </Button>
    );
  }

  return (
    <IconAction label={label} tone={tone} onClick={onClick}>
      <Icon className="size-4" aria-hidden />
    </IconAction>
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
          ? "grid size-11 cursor-pointer place-items-center rounded-lg text-ink-soft transition hover:bg-secondary-soft hover:text-secondary sm:size-8"
          : "grid size-11 cursor-pointer place-items-center rounded-lg text-ink-soft transition hover:bg-primary-soft hover:text-ink sm:size-8"
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
    <Dialog open onClose={onClose} title={title} size="lg" fullOnMobile={mode === "edit"}>
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
