import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import {
  PREVIEW_WIDTH,
  exportCrop,
  frameSize,
  geometryOf,
  renderCrop,
  type Offset,
  type Size,
} from "./cropMath";

/** نسب القص المتاحة. `null` تعني نسبة الصورة كما هي. */
const RATIOS = [
  { id: "square", ratio: 1 },
  { id: "landscape", ratio: 16 / 9 },
  { id: "wide", ratio: 4 / 3 },
  { id: "original", ratio: null },
] as const;

type RatioId = (typeof RATIOS)[number]["id"];

const ratioIdOf = (ratio: number | null): RatioId => RATIOS.find((option) => option.ratio === ratio)?.id ?? "original";

const MAX_ZOOM = 4;

/**
 * نافذة قص الصورة قبل إرسالها: يحرّك المستخدم الصورة داخل إطار بنسبة محددة، ويكبّرها،
 * ويرى معاينة النتيجة الفعلية، ثم يطبّق القص فيحصل على ملف جديد بالمنطقة المختارة وحدها.
 */
export function ImageCropDialog({
  file,
  defaultRatio,
  onCancel,
  onConfirm,
}: {
  file: File;
  defaultRatio: number | null;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}) {
  const { t } = useTranslation();
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [ratioId, setRatioId] = useState<RatioId>(() => ratioIdOf(defaultRatio));
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  const frameCanvas = useRef<HTMLCanvasElement>(null);
  const previewCanvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ pointerX: number; pointerY: number; start: Offset } | null>(null);

  const ratio = RATIOS.find((option) => option.id === ratioId)?.ratio ?? null;
  const natural: Size | null = image ? { width: image.naturalWidth, height: image.naturalHeight } : null;
  const frame = frameSize(ratio ?? (natural ? natural.width / natural.height : 1));
  const geometry = natural ? geometryOf(natural, frame, zoom, offset) : null;
  const dpr = typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1);

  // تحميل الصورة من الملف. الرابط المؤقت يُلغى عند الإغلاق أو تغيير الملف.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const loaded = new Image();
    let alive = true;
    loaded.onload = () => {
      if (alive) setImage(loaded);
    };
    loaded.onerror = () => {
      if (alive) setFailed(true);
    };
    loaded.src = url;
    return () => {
      alive = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // رسم الإطار والمعاينة كلما تغيّر شيء في القص.
  useEffect(() => {
    if (!image) return;
    const size = { width: image.naturalWidth, height: image.naturalHeight };
    const nextFrame = frameSize(ratio ?? size.width / size.height);
    const next = geometryOf(size, nextFrame, zoom, offset);
    if (frameCanvas.current) renderCrop(frameCanvas.current, image, nextFrame, next, nextFrame.width * dpr);
    if (previewCanvas.current) renderCrop(previewCanvas.current, image, nextFrame, next, PREVIEW_WIDTH);
  }, [image, ratio, zoom, offset, dpr]);

  // Escape يغلق القص وحده. النافذة الأصلية تستمع إلى Escape على المستند نفسه،
  // فنوقف الحدث في مرحلة الالتقاط كي لا يُغلق النموذج وراءها أيضاً.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onCancel();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  /** الإزاحة بعد تطبيق حدود الإطار للتكبير والنسبة الجديدين، حتى لا تقفز الصورة عند السحب. */
  const settle = (nextZoom: number, nextRatio: number | null, nextOffset: Offset): Offset => {
    if (!natural) return nextOffset;
    const nextFrame = frameSize(nextRatio ?? natural.width / natural.height);
    return geometryOf(natural, nextFrame, nextZoom, nextOffset).offset;
  };

  const changeZoom = (value: number) => {
    setZoom(value);
    setOffset((current) => settle(value, ratio, current));
  };

  const changeRatio = (id: RatioId) => {
    const nextRatio = RATIOS.find((option) => option.id === id)?.ratio ?? null;
    setRatioId(id);
    setOffset((current) => settle(zoom, nextRatio, current));
  };

  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const apply = async () => {
    if (!image || !natural || !geometry) return;
    setBusy(true);
    try {
      onConfirm(await exportCrop(image, frame, geometry, file));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onCancel}
      size="lg"
      title={t("crop.title")}
      description={t("crop.hint")}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>{t("common.cancel")}</Button>
          <Button
            onClick={() => void apply()}
            disabled={!image || busy}
            className="bg-primary text-ink hover:bg-primary/90"
          >
            {busy ? t("crud.saving") : t("crop.apply")}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
        <div className="space-y-5">
          <div role="group" aria-label={t("crop.ratioLabel")} className="flex flex-wrap gap-2">
            {RATIOS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={ratioId === option.id}
                onClick={() => changeRatio(option.id)}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  ratioId === option.id ? "bg-primary text-ink" : "ring-1 ring-line hover:bg-primary-soft"
                }`}
              >
                {t(`crop.${option.id}`)}
              </button>
            ))}
          </div>

          <div className="flex justify-center rounded-xl bg-canvas p-4">
            <div className="relative" style={{ width: frame.width, height: frame.height }}>
              <canvas
                ref={frameCanvas}
                aria-label={t("crop.frame")}
                style={{ width: frame.width, height: frame.height }}
                className="block cursor-grab touch-none rounded-lg ring-1 ring-line active:cursor-grabbing"
                onPointerDown={(event) => {
                  if (!geometry) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  drag.current = { pointerX: event.clientX, pointerY: event.clientY, start: offset };
                }}
                onPointerMove={(event) => {
                  const current = drag.current;
                  if (!current || !natural) return;
                  setOffset(
                    geometryOf(natural, frame, zoom, {
                      x: current.start.x + event.clientX - current.pointerX,
                      y: current.start.y + event.clientY - current.pointerY,
                    }).offset
                  );
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
              />
              {!image && (
                <div className="absolute inset-0 grid place-items-center rounded-lg bg-canvas text-sm text-muted">
                  {failed ? t("crop.failed") : t("crop.loading")}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="w-20 shrink-0 text-ink-soft">{t("crop.zoom")}</span>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              disabled={!image}
              aria-label={t("crop.zoom")}
              onChange={(event) => changeZoom(Number(event.target.value))}
              className="w-full accent-secondary"
            />
            <span className="w-12 shrink-0 text-end tabular-nums text-muted">{zoom.toFixed(1)}×</span>
          </div>
        </div>

        <aside className="space-y-3 text-center md:w-44">
          <p className="text-sm font-medium text-ink-soft">{t("crop.preview")}</p>
          <div className="mx-auto grid place-items-center rounded-xl bg-canvas p-3 ring-1 ring-line">
            <canvas ref={previewCanvas} aria-label={t("crop.preview")} className="max-h-48 max-w-full rounded-lg" />
          </div>
          <Button variant="ghost" onClick={reset} disabled={!image}>
            <RotateCcw className="size-4" aria-hidden />
            {t("crop.reset")}
          </Button>
        </aside>
      </div>
    </Dialog>
  );
}
