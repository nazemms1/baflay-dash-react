import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/Badge";
import { statusTone } from "./statusTone";

/**
 * حالة الطلب بلونها. التسمية الرسمية من الخادم (`label`) تسبق الترجمة الاحتياطية،
 * لأن الخادم وحده يعرف أن «مكتمل» تعني «تم الاستلام» في الاستلام و«تم التسليم» في التوصيل.
 */
export function StatusBadge({ status, label }: { status: string; label?: string | null }) {
  const { t } = useTranslation();
  return (
    <Badge tone={statusTone(status)}>
      {label || t(`orders.status.${status}`, { defaultValue: status || "—" })}
    </Badge>
  );
}
