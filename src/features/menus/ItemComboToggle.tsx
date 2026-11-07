import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { RowExtraProps } from "@/components/crud/types";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useBranchScope, usePermissions } from "@/features/auth/hooks";
import { asRecord, toNullableNumber, toNumber } from "@/lib/coerce";
import { menuApi } from "@/services";
import { ITEM_COMBO_PERMISSION, hasComboOf } from "./itemCombo";

/**
 * مفتاح الكومبو بجانب كل صنف في نموذج تعديل القائمة. سعر الكومبو واحد للقائمة، وهذا المفتاح يقرّر هل يظهر
 * خيار الوجبة لهذا الصنف. يُحفظ فور تحريكه بمساره الخاص `PUT menus/{menu}/items/{item}/combo`، ولا ينتظر زر
 * «حفظ» الفورم، لأن الخادم لا يقبل `has_combo` ضمن حفظ القائمة العادي.
 *
 * لا يظهر إلا للصنف المحفوظ في القائمة، وللقائمة ذات سعر الكومبو، وحين يرسل الخادم حالة الصنف.
 */
export function ItemComboToggle({ row, record, onPatch }: RowExtraProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const scope = useBranchScope();

  const menuId = toNumber(record?.id);
  const itemId = toNumber(row.item_id ?? row.id);

  const save = useMutation({
    mutationFn: (next: boolean) => menuApi.setItemCombo(menuId, itemId, next),
    onSuccess: (result, next) => {
      // الخادم يعيد الحالة التي حفظها وهي المعتمدة، وإن غابت نأخذ ما أرسلناه.
      const confirmed = asRecord(asRecord(result).data).has_combo;
      onPatch({ has_combo: typeof confirmed === "boolean" ? confirmed : next });
      void queryClient.invalidateQueries({ queryKey: ["public-menu", menuId] });
      // نقطة البيع تقرأ القائمة من هذا المفتاح، فيتجدد خيار الوجبة فيها.
      void queryClient.invalidateQueries({ queryKey: ["menu-detail", menuId] });
      toast.success(t("itemCombo.saved"));
    },
    // خطأ الخادم يعرضه معترض الطلبات العام، فلا نكرر الإشعار هنا.
  });

  if (!record) return null;

  // الكومبو لا معنى له في قائمة بلا سعر كومبو.
  const comboPrice = toNullableNumber(record.combo_price ?? asRecord(record.combo).price);
  if (comboPrice === null || comboPrice <= 0) return null;

  // الصنف المحفوظ فقط: الصف الجديد، أو الذي بُدّل صنفه، لا حالة له عند الخادم بعد.
  const savedHere = row.id !== undefined && toNumber(row.id) === itemId;
  const combo = hasComboOf(row);
  if (!savedHere || combo === null) return null;

  // مدير الفرع يعدّل قائمة فرعه وحده، والخادم يرفض غيرها بـ 403.
  const menuBranchId = toNumber(record.branch_id ?? asRecord(record.branch).id);
  const canToggle =
    permissions.has(ITEM_COMBO_PERMISSION) && (!scope.isBranchScoped || scope.branchId === menuBranchId);

  return (
    <div className="flex shrink-0 flex-col gap-1.5 sm:w-32">
      <span className="text-sm font-medium text-ink-soft">{t("itemCombo.label")}</span>
      <div
        className={`flex h-11 items-center justify-between gap-2 rounded-xl border px-3 transition ${
          combo ? "border-ok/40 bg-ok-soft" : "border-line bg-surface"
        }`}
      >
        <span className={`text-sm font-medium ${combo ? "text-ok" : "text-muted"}`}>
          {combo ? t("itemCombo.on") : t("itemCombo.off")}
        </span>
        {canToggle && (
          <ToggleSwitch
            on={combo}
            label={t("itemCombo.toggle")}
            disabled={save.isPending}
            onToggle={() => save.mutate(!combo)}
          />
        )}
      </div>
    </div>
  );
}
