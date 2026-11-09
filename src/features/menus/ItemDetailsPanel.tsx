import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import clsx from "clsx";
import { ImagePlus, RotateCcw, X } from "lucide-react";
import { ImageCropDialog } from "@/components/crop/ImageCropDialog";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Fields";
import { toApiError } from "@/lib/http/errors";
import { menuApi, type ItemDetailsPatch } from "@/services";
import {
  ITEM_DESCRIPTION_MAX,
  itemDetailsPatch,
  type ItemDetailsDraft,
  type ItemDetailsSaved,
  type ItemDetailsView,
} from "./itemDetails";

type ImageSource = "pending" | "branch" | "default" | "none";

const SOURCE_TONE: Record<ImageSource, string> = {
  pending: "bg-ok-soft text-ok",
  branch: "bg-primary-soft text-ink",
  default: "bg-line/60 text-ink-soft",
  none: "bg-line/60 text-muted",
};

/**
 * تفاصيل الصنف في فرع القائمة: صورته ووصفاه. الفرع يحفظ ما غيّره وحده، ومن يرجع إلى العام يتركه
 * فارغاً. تظهر فوق قائمة الأصناف لا في نافذة فوق نافذة التفاصيل، لأن النافذة الثانية تُغلق الأولى
 * معها بزر Escape.
 */
export function ItemDetailsPanel({
  menuId,
  item,
  canUpdate,
  canDestroy,
  onClose,
}: {
  menuId: number;
  item: ItemDetailsView;
  canUpdate: boolean;
  canDestroy: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const rootRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ما هو محفوظ للفرع الآن، وهو المرجع لمعرفة ما تغيّر عند الحفظ.
  const saved: ItemDetailsSaved = {
    description: item.branch?.description ?? "",
    description_ar: item.branch?.description_ar ?? "",
    hasOwnImage: Boolean(item.branch?.image),
  };

  const [draft, setDraft] = useState<ItemDetailsDraft>(() => ({
    description: saved.description,
    description_ar: saved.description_ar,
    image: null,
    removeImage: false,
  }));
  // ملف اختير من الجهاز وينتظر القص.
  const [pending, setPending] = useState<File | null>(null);

  // معاينة الملف الذي اختير ولم يُحفظ بعد، ويُلغى رابطها عند تغييره أو إغلاق اللوحة.
  const pickedUrl = useMemo(() => (draft.image ? URL.createObjectURL(draft.image) : null), [draft.image]);
  useEffect(() => () => {
    if (pickedUrl) URL.revokeObjectURL(pickedUrl);
  }, [pickedUrl]);

  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  const src = pickedUrl ?? (draft.removeImage ? item.defaultImage : item.image);
  const ownShown = !draft.image && !draft.removeImage && Boolean(item.branch?.image);
  const source: ImageSource = draft.image ? "pending" : ownShown ? "branch" : item.defaultImage ? "default" : "none";
  const replacing = source === "branch" || source === "pending";
  const patch = itemDetailsPatch(saved, draft);

  // الصفحات التي تعرض القائمة تحمل نسخها المخزنة، فتُجدَّد كلها بعد الحفظ.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["menus"] }),
      queryClient.invalidateQueries({ queryKey: ["public-menu", menuId] }),
      queryClient.invalidateQueries({ queryKey: ["menu-detail", menuId] }),
    ]);

  const save = useMutation({
    mutationFn: (next: ItemDetailsPatch) => menuApi.saveItemDetails(menuId, item.id, next),
    onSuccess: async () => {
      toast.success(t("itemDetails.saved"));
      await refresh();
      onClose();
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  const reset = useMutation({
    mutationFn: () => menuApi.resetItemDetails(menuId, item.id),
    onSuccess: async () => {
      toast.success(t("itemDetails.resetDone"));
      await refresh();
      onClose();
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  const busy = save.isPending || reset.isPending;

  const choose = () => inputRef.current?.click();

  const picked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    // تفريغ الحقل يتيح اختيار الملف نفسه مرة أخرى بعد الإلغاء.
    event.target.value = "";
    if (file) setPending(file);
  };

  // الرجوع إلى الصورة العامة: يُلغي الملف المختار، ويطلب حذف صورة الفرع الخاصة إن وُجدت.
  const useGeneralImage = () =>
    setDraft((current) => ({ ...current, image: null, removeImage: saved.hasOwnImage }));

  const undoGeneralImage = () => setDraft((current) => ({ ...current, removeImage: false }));

  const resetAll = () => {
    if (window.confirm(t("itemDetails.resetConfirm", { name: item.name }))) reset.mutate();
  };

  return (
    <section ref={rootRef} className="space-y-5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-ink">{t("itemDetails.title", { name: item.name })}</h3>
          <p className="mt-1 text-sm text-muted">{t("itemDetails.hint")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-soft transition hover:bg-canvas hover:text-ink sm:size-8"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div className="grid gap-5 sm:grid-cols-[11rem_1fr]">
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink-soft">{t("itemDetails.image")}</p>
          <div className="grid aspect-square w-full max-w-44 place-items-center overflow-hidden rounded-2xl bg-canvas ring-1 ring-line">
            {src ? (
              <img src={src} alt="" className="size-full object-cover" />
            ) : (
              <ImagePlus className="size-6 text-muted" aria-hidden />
            )}
          </div>
          <span className={clsx("inline-block rounded-full px-2 py-0.5 text-xs font-medium", SOURCE_TONE[source])}>
            {t(`itemDetails.imageSource.${source}`)}
          </span>
          {draft.removeImage && <p className="text-xs text-muted">{t("itemDetails.defaultAfterSave")}</p>}

          {canUpdate && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={busy} onClick={choose}>
                <ImagePlus className="size-4" aria-hidden />
                {replacing ? t("itemDetails.change") : t("itemDetails.upload")}
              </Button>
              {draft.removeImage ? (
                <Button variant="ghost" size="sm" disabled={busy} onClick={undoGeneralImage}>
                  {t("itemDetails.undoGeneralImage")}
                </Button>
              ) : (
                (saved.hasOwnImage || draft.image !== null) && (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={useGeneralImage}>
                    <RotateCcw className="size-4" aria-hidden />
                    {t("itemDetails.useGeneralImage")}
                  </Button>
                )
              )}
            </div>
          )}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={picked} />
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <TextArea
              label={`${t("itemDetails.description")} · ${t("crud.arabic")}`}
              dir="rtl"
              rows={4}
              maxLength={ITEM_DESCRIPTION_MAX}
              placeholder={t("itemDetails.usesGeneral")}
              value={draft.description_ar}
              disabled={!canUpdate || busy}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, description_ar: value }));
              }}
            />
            {item.defaultDescriptionAr && (
              <p className="line-clamp-2 text-xs text-muted">
                {t("itemDetails.general")}: {item.defaultDescriptionAr}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <TextArea
              label={`${t("itemDetails.description")} · ${t("crud.english")}`}
              dir="ltr"
              rows={4}
              maxLength={ITEM_DESCRIPTION_MAX}
              placeholder={t("itemDetails.usesGeneral")}
              value={draft.description}
              disabled={!canUpdate || busy}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, description: value }));
              }}
            />
            {item.defaultDescription && (
              <p className="line-clamp-2 text-xs text-muted">
                {t("itemDetails.general")}: {item.defaultDescription}
              </p>
            )}
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        {canDestroy && item.branch !== null ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={resetAll}>
            <RotateCcw className="size-4" aria-hidden />
            {t("itemDetails.reset")}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          {canUpdate && (
            <Button
              disabled={!patch || busy}
              onClick={() => {
                if (patch) save.mutate(patch);
              }}
              className="bg-primary text-ink hover:bg-primary/90"
            >
              {save.isPending ? t("crud.saving") : t("crud.save")}
            </Button>
          )}
        </div>
      </footer>

      {canUpdate && pending && (
        <ImageCropDialog
          file={pending}
          defaultRatio={1}
          onCancel={() => setPending(null)}
          onConfirm={(cropped) => {
            setPending(null);
            setDraft((current) => ({ ...current, image: cropped, removeImage: false }));
          }}
        />
      )}
    </section>
  );
}
