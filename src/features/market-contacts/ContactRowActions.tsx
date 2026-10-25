import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { usePermissions } from "@/features/auth/hooks";
import { marketContacts, type MarketContact } from "@/services";
import { sortContacts } from "./contactRules";

/**
 * تحريك الوسيلة لأعلى أو لأسفل. الخادم يستقبل ترتيب الدولة كله، فنرسل كل الوسائل بالترتيب الجديد
 * بعد تبديل موقع الوسيلة مع جارتها. الزر يظهر لمن يملك صلاحية الترتيب فقط.
 */
export const makeContactRowActions = (code: string, moduleId: string) =>
  function ContactRowActions({ row }: { row: MarketContact }) {
    const { t } = useTranslation();
    const permissions = usePermissions();
    const queryClient = useQueryClient();
    const canReorder = permissions.has("markets.contacts.order.update");

    const all = useQuery({
      queryKey: [moduleId, "all"],
      queryFn: () => marketContacts.list(code),
      enabled: canReorder,
    });
    const ordered = sortContacts(all.data ?? []);
    const index = ordered.findIndex((contact) => contact.id === row.id);

    if (!canReorder || index < 0) return null;

    const move = async (delta: number) => {
      const target = index + delta;
      if (target < 0 || target >= ordered.length) return;
      const ids = ordered.map((contact) => contact.id);
      [ids[index], ids[target]] = [ids[target], ids[index]];
      try {
        await marketContacts.reorder(code, ids);
        toast.success(t("marketContacts.orderSaved"));
        await queryClient.invalidateQueries({ queryKey: [moduleId] });
      } catch {
        toast.error(t("marketContacts.orderFailed"));
      }
    };

    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("crud.moveUp")}
          title={t("crud.moveUp")}
          disabled={index === 0}
          onClick={() => void move(-1)}
        >
          <ChevronUp className="size-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("crud.moveDown")}
          title={t("crud.moveDown")}
          disabled={index === ordered.length - 1}
          onClick={() => void move(1)}
        >
          <ChevronDown className="size-4" aria-hidden />
        </Button>
      </div>
    );
  };
