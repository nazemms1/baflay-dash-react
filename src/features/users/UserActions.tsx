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
 * الأدوار تُبحث في الخادم عشرين في الصفحة. قيمة الخيار هي اسم الدور نفسه، فهو ما يستقبله
 * الخادم عند إسناد الأدوار، ولا حاجة لربط الفهارس بينهما.
 */
const ROLE_OPTIONS: RemoteSource = {
  cacheKey: "roles-names",
  search: async (term, page, signal) => {
    const result = await roles.list({ page, per_page: 20, ...(term ? { search: term } : {}) }, signal);
    return {
      items: result.items.map((role) => ({
        value: toText(role.name),
        label: toText(role.label) || toText(role.name),
      })),
      lastPage: result.meta.lastPage,
    };
  },
  byId: async (value, signal) => {
    const result = await roles.list({ page: 1, per_page: 20, search: String(value) }, signal);
    const found = result.items.find((role) => toText(role.name) === String(value));
    return { value, label: found ? toText(found.label) || String(value) : String(value) };
  },
};

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

  if (!permissions.has("access.update")) return null;

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
      {open && <AccessDialog userId={row.id} userName={String(row.name ?? `#${row.id}`)} onClose={() => setOpen(false)} />}
    </>
  );
}

function AccessDialog({ userId, userName, onClose }: { userId: number | string; userName: string; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string[] | null>(null);

  const current = useQuery({
    queryKey: ["user-access", userId],
    queryFn: async () => {
      const body = asRecord(await users.getAccess(userId));
      const list = Array.isArray(body) ? (body as unknown[]) : asArray(body.roles);
      return list.map((entry) => (typeof entry === "string" ? entry : toText(asRecord(entry).name)));
    },
  });

  // الأدوار المختارة هي أسماؤها، فالحفظ يرسلها كما هي.
  const selected = draft ?? current.data ?? [];

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
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>{t("common.cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={loading || save.isPending} className="bg-primary text-ink hover:bg-primary/90">
            {save.isPending ? t("crud.saving") : t("crud.save")}
          </Button>
        </>
      }
    >
      {loading && <Skeleton className="h-64" />}
      {current.isError && (
        <ErrorState message={t("errors.unexpected")} onRetry={() => void current.refetch()} error={current.error} />
      )}
      {current.isSuccess && (
        <RemoteCheckList source={ROLE_OPTIONS} selected={selected} onChange={(next) => setDraft(next.map(String))} />
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
