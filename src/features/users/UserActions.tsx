import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { usePermissions } from "@/features/auth/hooks";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { RemoteCheckList } from "@/components/ui/RemoteCheckList";
import { ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Bars";
import type { RemoteSource } from "@/components/crud/types";
import { asArray, asRecord, toText } from "@/lib/coerce";
import { toApiError } from "@/lib/http/errors";
import { roles, users, type Named } from "@/services";

/**
 * الأدوار تُبحث في الخادم عشرين في الصفحة. قيمة الخيار هي معرّف الدور، لأن الخادم يطلب أعداداً
 * في `roles` (`roles.0 must be an integer`).
 */
const ROLE_OPTIONS: RemoteSource = {
  cacheKey: "roles-ids",
  search: async (term, page, signal) => {
    const result = await roles.list({ page, per_page: 20, ...(term ? { search: term } : {}) }, signal);
    return {
      items: result.items.map((role) => ({
        value: Number(role.id),
        label: toText(role.label) || toText(role.name),
      })),
      lastPage: result.meta.lastPage,
    };
  },
  byId: async (value, signal) => {
    const role = await roles.get(value, signal);
    return { value, label: toText(role.label) || toText(role.name) || String(value) };
  },
};

/** دور من حساب، بمعرّفه للحفظ واسمه الظاهر للعرض. */
interface RoleOption {
  value: number;
  label: string;
}

/**
 * قائمة الأدوار من استجابة `users/{id}/access`. الاستجابة قد تكون قائمة مباشرة، أو كائناً فيه
 * `roles`. لا نمرّرها بـ`asRecord` أولاً، فهي تحوّل القائمة إلى كائن فارغ.
 */
function accessEntries(body: unknown): unknown[] {
  return Array.isArray(body) ? body : asArray(asRecord(body).roles);
}

/**
 * دور واحد من الاستجابة. إن جاء كائناً فيه `id` نأخذه مع اسمه، وإن جاء اسماً نبحث عن الدور بهذا
 * الاسم. ما لم نجد له معرّفاً نُرجع اسمه وحده، فيظهر للمشغّل ولا يُختار بالخطأ.
 */
async function resolveRole(entry: unknown, signal?: AbortSignal): Promise<RoleOption | string | null> {
  const record = asRecord(entry);
  if (record.id !== undefined && record.id !== null) {
    const label = toText(record.label) || toText(record.name) || String(record.id);
    return { value: Number(record.id), label };
  }
  const name = typeof entry === "string" ? entry : toText(record.name);
  if (!name) return null;
  const found = await roles.list({ page: 1, per_page: 20, search: name }, signal);
  const match = found.items.find((role) => toText(role.name) === name);
  if (!match) return name;
  return { value: Number(match.id), label: toText(match.label) || toText(match.name) };
}

/** أزرار الصف: للحساب النشط الأدوار، وللحساب المحذوف الاستعادة والحذف النهائي. */
export function UserRowActions({ row }: { row: Named }) {
  if (row.deleted_at) return <DeletedUserActions row={row} />;
  return <AccessAction row={row} />;
}

/** الأدوار التي يحملها الحساب، تُحمَّل من الخادم بأسمائها كما هي. */
function AccessAction({ row }: { row: Named }) {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [open, setOpen] = useState(false);

  // عرض أدوار المستخدم يحتاج صلاحية الرؤية، فالزر لا يظهر بدونها حتى لو كان التعديل متاحاً.
  if (!permissions.has("access.show")) return null;
  const canEdit = permissions.has("access.update");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("access.open")}
        title={t("access.open")}
        className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-primary-soft hover:text-ink"
      >
        <ShieldCheck className="size-4" aria-hidden />
      </button>
      {open && (
        <AccessDialog userId={row.id} userName={String(row.name ?? `#${row.id}`)} canEdit={canEdit} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function AccessDialog({
  userId,
  userName,
  canEdit,
  onClose,
}: {
  userId: number | string;
  userName: string;
  /** التعديل يحتاج صلاحية التعديل، ومن يملك الرؤية وحدها يرى الأدوار للقراءة فقط. */
  canEdit: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<number[] | null>(null);

  // أدوار الحساب الحالية بأسمائها ومعرّفاتها، وما لم يُعرف معرّفه يبقى اسماً للعرض فقط.
  const current = useQuery({
    queryKey: ["user-access", userId],
    queryFn: async ({ signal }) => {
      const entries = accessEntries(await users.getAccess(userId));
      const resolved = await Promise.all(entries.map((entry) => resolveRole(entry, signal)));
      const matched = resolved.filter((role): role is RoleOption => typeof role === "object" && role !== null);
      const unresolved = resolved.filter((role): role is string => typeof role === "string");
      return { roles: matched, unresolved };
    },
  });

  const currentRoles = current.data?.roles ?? [];
  const currentNames = [...currentRoles.map((role) => role.label), ...(current.data?.unresolved ?? [])];

  // الأدوار المختارة معرّفاتها، والخادم يستقبلها أعداداً.
  const selected = draft ?? currentRoles.map((role) => role.value);

  const save = useMutation({
    mutationFn: () => users.setAccess(userId, { roles: selected }),
    onSuccess: async () => {
      toast.success(t("access.saved"));
      await queryClient.invalidateQueries({ queryKey: ["user-access", userId] });
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
      title={t("access.title", { name: userName })}
      description={t("access.description")}
      footer={
        <>
          {canEdit ? (
            <>
              <Button variant="secondary" onClick={onClose} disabled={save.isPending}>{t("common.cancel")}</Button>
              <Button onClick={() => save.mutate()} disabled={loading || save.isPending} className="bg-primary text-ink hover:bg-primary/90">
                {save.isPending ? t("crud.saving") : t("crud.save")}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={onClose}>{t("common.close")}</Button>
          )}
        </>
      }
    >
      {loading && <Skeleton className="h-64" />}
      {current.isError && (
        <ErrorState message={t("errors.unexpected")} onRetry={() => void current.refetch()} error={current.error} />
      )}
      {current.isSuccess && (
        <div className="space-y-3">
          <p className="rounded-xl bg-canvas px-4 py-3 text-sm font-medium text-ink">
            {currentNames.length > 0
              ? t("access.currentRoles", { roles: currentNames.join("، ") })
              : t("access.noRoles")}
          </p>
          {!canEdit && <p className="text-sm text-muted">{t("access.viewOnly")}</p>}
          <RemoteCheckList
            source={ROLE_OPTIONS}
            selected={selected}
            known={currentRoles}
            onChange={(next) => setDraft(next.map(Number))}
            readOnly={!canEdit}
          />
        </div>
      )}
    </Dialog>
  );
}

/** الحساب المحذوف: استعادته، أو حذفه نهائياً بتأكيد صريح لأنه لا رجعة فيه. */
function DeletedUserActions({ row }: { row: Named }) {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [confirmPurge, setConfirmPurge] = useState(false);

  const restore = useMutation({
    mutationFn: () => users.restore(row.id),
    onSuccess: async (result) => {
      const body = asRecord(result);
      // الاستعادة قد لا تعيد الدخول إن أخذ شخص آخر البريد أو الهاتف.
      if (body.can_sign_in === false) toast.warning(t("users.restoredNoSignIn"));
      else toast.success(t("users.restored"));
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  const purge = useMutation({
    mutationFn: () => users.purge(row.id),
    onSuccess: async () => {
      toast.success(t("users.purged"));
      setConfirmPurge(false);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  return (
    <div className="flex items-center gap-1">
      {permissions.has("users.restore") && (
        <button
          type="button"
          onClick={() => restore.mutate()}
          disabled={restore.isPending}
          aria-label={t("users.restore")}
          title={t("users.restore")}
          className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-ok-soft hover:text-ok disabled:opacity-50"
        >
          <RotateCcw className="size-4" aria-hidden />
        </button>
      )}
      {permissions.has("users.purge") && (
        <button
          type="button"
          onClick={() => setConfirmPurge(true)}
          aria-label={t("users.purge")}
          title={t("users.purge")}
          className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-secondary-soft hover:text-secondary"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}

      <Dialog
        open={confirmPurge}
        onClose={() => setConfirmPurge(false)}
        title={t("users.purgeTitle")}
        description={t("users.purgeBody", { name: String(row.name ?? `#${row.id}`) })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmPurge(false)} disabled={purge.isPending}>{t("common.cancel")}</Button>
            <Button variant="danger" onClick={() => purge.mutate()} disabled={purge.isPending}>
              {purge.isPending ? t("crud.deleting") : t("users.purgeConfirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">{t("users.purgeWarning")}</p>
      </Dialog>
    </div>
  );
}
