import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePermissions } from "@/features/auth/hooks";
import { EmptyState } from "@/components/ui/States";
import { asRecord, toNumber } from "@/lib/coerce";
import { toApiError } from "@/lib/http/errors";
import { branches, type Named } from "@/services";
import { BranchChooser } from "./BranchChooser";
import { PosRegister } from "./PosRegister";
import { Receipt, type ReceiptData } from "./Receipt";
import { COUNTER_ORDER_PERMISSION } from "./buildOrderBody";

interface Session {
  branch: Named;
  menuId: number;
}

/**
 * نقطة البيع للكاشير كما في الداشبورد القديم: يختار الكاشير الفرع فقط، فتظهر أصنافه مباشرة.
 * لا زبون ولا عنوان ولا خريطة، والدفع نقداً ثم إيصال. الشاشة كلها لمن يملك صلاحية الطلب
 * من الكاشير، ومن لا يملكها لا يراها.
 */
export function CreateOrderPage() {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const canStart = usePermissions().has(COUNTER_ORDER_PERMISSION);

  // اختيار الفرع يحمّل بياناته وقائمته فقط، ولا ينشئ شيئاً في الخادم قبل الدفع.
  const open = useMutation({
    mutationFn: async (branchId: number) => {
      const branch = await branches.get(branchId);
      return { branch, menuId: toNumber(asRecord(branch.menu).id) };
    },
    onSuccess: ({ branch, menuId }) => {
      if (!menuId) {
        toast.error(t("createOrder.noMenu"));
        return;
      }
      setSession({ branch, menuId });
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  return (
    <div className="space-y-6">
      {session ? (
        <PosRegister
          key={toNumber(session.branch.id)}
          branch={session.branch}
          menuId={session.menuId}
          onChangeBranch={() => setSession(null)}
          onPaid={(data) => {
            setSession(null);
            setReceipt(data);
          }}
        />
      ) : canStart ? (
        <BranchChooser busyId={open.isPending ? (open.variables ?? null) : null} onSelect={(id) => open.mutate(id)} />
      ) : (
        <EmptyState>{t("common.noData")}</EmptyState>
      )}

      {receipt && <Receipt data={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
