import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { usePermissions } from "@/features/auth/hooks";
import { marketOffers, type MarketOffer } from "@/services";
import { sortOffers } from "./offerRules";

/**
 * تحريك العرض لأعلى أو لأسفل. الخادم يستقبل ترتيب الدولة كله، فنرسل كل العروض بالترتيب الجديد
 * بعد تبديل موقع العرض مع جاره. الزر يظهر لمن يملك صلاحية الترتيب فقط.
 */
export const makeOfferRowActions = (code: string, moduleId: string) =>
  function OfferRowActions({ row }: { row: MarketOffer }) {
    const { t } = useTranslation();
    const permissions = usePermissions();
    const queryClient = useQueryClient();
    const canReorder = permissions.has("markets.offers.order.update");

    const all = useQuery({
      queryKey: [moduleId, "all"],
      queryFn: () => marketOffers.list(code),
      enabled: canReorder,
    });
    const ordered = sortOffers(all.data ?? []);
    const index = ordered.findIndex((offer) => offer.id === row.id);

    if (!canReorder || index < 0) return null;

    const move = async (delta: number) => {
      const target = index + delta;
      if (target < 0 || target >= ordered.length) return;
      const ids = ordered.map((offer) => offer.id);
      [ids[index], ids[target]] = [ids[target], ids[index]];
      try {
        await marketOffers.reorder(code, ids);
        toast.success(t("marketOffers.orderSaved"));
        await queryClient.invalidateQueries({ queryKey: [moduleId] });
      } catch {
        toast.error(t("marketOffers.orderFailed"));
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
