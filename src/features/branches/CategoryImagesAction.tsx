import { useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import clsx from "clsx";
import { ImagePlus, Images, RotateCcw } from "lucide-react";
import { usePermissions } from "@/features/auth/hooks";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Bars";
import { ImageCropDialog } from "@/components/crop/ImageCropDialog";
import { currentLanguage, type Language } from "@/i18n";
import { toNumber } from "@/lib/coerce";
import { localizedRecord } from "@/lib/localized";
import { toApiError } from "@/lib/http/errors";
import { branchApi, type BranchCategoryImage, type Named } from "@/services";
import { categoryImageSource, type CategoryImageSource } from "./categoryImages";

/** زر «صور التصنيفات» في صف الفرع: صورة خاصة بالفرع لكل تصنيف، والفرع الذي لا صورة له يعرض العامة. */
export function CategoryImagesAction({ row }: { row: Named }) {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [open, setOpen] = useState(false);

  if (!permissions.has("branches.categories.images.index")) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("categoryImages.open")}
        title={t("categoryImages.open")}
        className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-soft transition hover:bg-primary-soft hover:text-ink"
      >
        <Images className="size-4" aria-hidden />
      </button>
      {open && (
        <CategoryImagesDialog
          branchId={toNumber(row.id)}
          branchName={localizedRecord(row, currentLanguage()) || `#${row.id}`}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CategoryImagesDialog({ branchId, branchName, onClose }: { branchId: number; branchName: string; onClose: () => void }) {
  const { t } = useTranslation();
  const language: Language = currentLanguage();
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const canUpload = permissions.has("branches.categories.image.update");
  const canReset = permissions.has("branches.categories.image.destroy");

  const queryKey = ["branch-category-images", branchId];

  // الملف يُختار من حقل مخفي واحد لكل النافذة، فنتذكر التصنيف الذي فتح الاختيار.
  const inputRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<number | null>(null);
  const [cropping, setCropping] = useState<{ categoryId: number; file: File } | null>(null);

  const images = useQuery({
    queryKey,
    queryFn: ({ signal }) => branchApi.categoryImages(branchId, signal),
  });

  const categories = images.data?.categories ?? [];

  const upload = useMutation({
    mutationFn: ({ categoryId, file }: { categoryId: number; file: File }) =>
      branchApi.uploadCategoryImage(branchId, categoryId, file),
    onSuccess: async () => {
      toast.success(t("categoryImages.uploaded"));
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  const reset = useMutation({
    mutationFn: (categoryId: number) => branchApi.resetCategoryImage(branchId, categoryId),
    onSuccess: async () => {
      toast.success(t("categoryImages.resetDone"));
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  const busy = upload.isPending || reset.isPending;

  const choose = (categoryId: number) => {
    targetRef.current = categoryId;
    inputRef.current?.click();
  };

  const picked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    // تفريغ الحقل يتيح اختيار الملف نفسه مرة أخرى بعد الإلغاء.
    event.target.value = "";
    const categoryId = targetRef.current;
    if (file && categoryId !== null) setCropping({ categoryId, file });
  };

  const removeBranchImage = (category: BranchCategoryImage) => {
    if (!window.confirm(t("categoryImages.resetConfirm", { name: localizedRecord(category, language) || `#${category.id}` }))) return;
    reset.mutate(category.id);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t("categoryImages.title", { name: branchName })}
      description={t("categoryImages.hint")}
      footer={
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {t("common.close")}
        </Button>
      }
    >
      {images.isPending && <Skeleton className="h-64" />}
      {images.isError && <ErrorState message={t("errors.unexpected")} onRetry={() => void images.refetch()} />}
      {images.isSuccess && categories.length === 0 && <EmptyState>{t("categoryImages.empty")}</EmptyState>}
      {images.isSuccess && categories.length > 0 && (
        <ul className="divide-y divide-line">
          {categories.map((category) => (
            <CategoryImageRow
              key={category.id}
              category={category}
              label={localizedRecord(category, language) || `#${category.id}`}
              canUpload={canUpload}
              canReset={canReset}
              disabled={busy}
              onChoose={() => choose(category.id)}
              onReset={() => removeBranchImage(category)}
            />
          ))}
        </ul>
      )}

      {canUpload && <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={picked} />}

      {cropping && (
        <ImageCropDialog
          file={cropping.file}
          defaultRatio={1}
          onCancel={() => setCropping(null)}
          onConfirm={(cropped) => {
            const categoryId = cropping.categoryId;
            setCropping(null);
            upload.mutate({ categoryId, file: cropped });
          }}
        />
      )}
    </Dialog>
  );
}

const SOURCE_TONE: Record<CategoryImageSource, string> = {
  branch: "bg-primary-soft text-ink",
  default: "bg-line/60 text-ink-soft",
  none: "bg-line/60 text-muted",
};

/** سطر تصنيف: الصورة المعروضة ومصدرها، وهل يبيع الفرع منه شيئاً الآن، وأزرار الرفع والاستعادة. */
function CategoryImageRow({
  category,
  label,
  canUpload,
  canReset,
  disabled,
  onChoose,
  onReset,
}: {
  category: BranchCategoryImage;
  label: string;
  canUpload: boolean;
  canReset: boolean;
  disabled: boolean;
  onChoose: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const source = categoryImageSource(category);
  const hasOwnImage = Boolean(category.branch_image);

  return (
    <li className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
      <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-canvas ring-1 ring-line">
        {category.image ? (
          <img src={category.image} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-5 text-muted" aria-hidden />
        )}
      </span>

      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate font-semibold text-ink">{label}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={clsx(
              "rounded-full px-2 py-0.5 font-medium",
              category.on_menu ? "bg-ok-soft text-ok" : "bg-line/60 text-muted"
            )}
          >
            {category.on_menu ? t("categoryImages.onMenu") : t("categoryImages.notOnMenu")}
          </span>
          <span className={clsx("rounded-full px-2 py-0.5 font-medium", SOURCE_TONE[source])}>
            {t(`categoryImages.source.${source}`)}
          </span>
        </div>
      </div>

      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        {canUpload && (
          <Button variant="secondary" size="sm" disabled={disabled} onClick={onChoose}>
            <ImagePlus className="size-4" aria-hidden />
            {hasOwnImage ? t("categoryImages.change") : t("categoryImages.upload")}
          </Button>
        )}
        {canReset && hasOwnImage && (
          <Button variant="ghost" size="sm" disabled={disabled} onClick={onReset}>
            <RotateCcw className="size-4" aria-hidden />
            {t("categoryImages.reset")}
          </Button>
        )}
      </div>
    </li>
  );
}
