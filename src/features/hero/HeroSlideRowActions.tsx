import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { usePermissions } from "@/features/auth/hooks";
import { heroSlides, type HeroSlide } from "@/services";
import { sortSlides } from "./slides";

/**
 * تحريك الشريحة لأعلى أو لأسفل. الخادم يستقبل ترتيب الدولة كله، فنرسل كل الشرائح بالترتيب الجديد
 * بعد تبديل موقع الشريحة مع جارتها. الزر يظهر لمن يملك صلاحية الترتيب فقط.
 */
export const makeHeroSlideRowActions = (code: string, moduleId: string) =>
  function HeroSlideRowActions({ row }: { row: HeroSlide }) {
    const { t } = useTranslation();
    const permissions = usePermissions();
    const queryClient = useQueryClient();
    const canReorder = permissions.has("markets.hero.slides.order.update");

    const all = useQuery({
      queryKey: [moduleId, "all"],
      queryFn: () => heroSlides.list(code),
      enabled: canReorder,
    });
    const ordered = sortSlides(all.data ?? []);
    const index = ordered.findIndex((slide) => slide.id === row.id);

    if (!canReorder || index < 0) return null;

    const move = async (delta: number) => {
      const target = index + delta;
      if (target < 0 || target >= ordered.length) return;
      const ids = ordered.map((slide) => slide.id);
      [ids[index], ids[target]] = [ids[target], ids[index]];
      try {
        await heroSlides.reorder(code, ids);
        toast.success(t("heroSlides.orderSaved"));
        await queryClient.invalidateQueries({ queryKey: [moduleId] });
      } catch {
        toast.error(t("heroSlides.orderFailed"));
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
