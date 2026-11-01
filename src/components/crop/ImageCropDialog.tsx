import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { env } from "@/config/env";
import { Dialog } from "@/components/ui/Dialog";
import {
  PREVIEW_WIDTH,
  exportCrop,
  frameSize,
  geometryOf,
  renderCrop,
  sourceInfoOfUrl,
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
 * الرابط الذي تُقرأ منه الصورة للقص. في التطوير تُطلب صور الخادم من الموقع نفسه عبر الوكيل،
 * فيقرؤها المتصفح دون قيود المصدر المختلف. في الإنتاج يبقى الرابط كما هو.
 */
function readableUrl(url: string): string {
  if (!import.meta.env.DEV) return url;
  try {
    const target = new URL(url);
    if (target.origin === new URL(env.apiUrl).origin && target.pathname.startsWith("/storage/")) {
      return `${target.pathname}${target.search}`;
    }
  } catch {
    // رابط غير صالح يبقى كما هو، فيظهر تنبيه القص عند فشل التحميل.
  }
  return url;
}

/** معرّف في الرابط يجعل الخادم يخدم نسخة الصورة الحالية، لا نسخة محفوظة سابقاً بلا ترويسة CORS. */
function withCorsQuery(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}cors=1`;
}

/**
 * نافذة قص الصورة: تُفتح بملف محلي اختاره المستخدم للتو، أو بصورة محفوظة في الخادم فتُقص من
 * جديد. يحرّك المستخدم الصورة داخل إطار بنسبة محددة، ويكبّرها، ويرى معاينة النتيجة الفعلية،
 * ثم يطبّق القص فيحصل على ملف جديد بالمنطقة المختارة وحدها.
 */
export function ImageCropDialog({
  file,
  url,
  defaultRatio,
  onCancel,
  onConfirm,
  onPickFile,
}: {
  /** ملف محلي. يُعطى هذا أو `url`. */
  file?: File;
  /** رابط صورة محفوظة في الخادم. لا تُقص إلا إن سمح الخادم بقراءتها من الموقع. */
  url?: string;
  defaultRatio: number | null;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
  /** يُعرض عند تعذّر قراءة صورة الخادم، فيختار المستخدم الملف الأصلي من جهازه. */
  onPickFile?: () => void;
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
  const failedText = t(url ? "crop.failedRemote" : "crop.failed");

  // تحميل الصورة: من ملف محلي عبر رابط مؤقت، أو من الخادم. الرابط المؤقت يُلغى عند الإغلاق.
  useEffect(() => {
    const objectUrl = file ? URL.createObjectURL(file) : null;
    const loaded = new Image();
    // صورة الخادم تُطلب كطلب من مصدر آخر، فيُسمح بتصديرها بعد القص إن أذن الخادم بذلك.
    if (!file) loaded.crossOrigin = "anonymous";
    let alive = true;
    loaded.onload = () => {
      if (alive) setImage(loaded);
    };
    loaded.onerror = () => {
      if (alive) setFailed(true);
    };
    loaded.src = objectUrl ?? (url ? withCorsQuery(readableUrl(url)) : "");
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, url]);

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
      onConfirm(await exportCrop(image, frame, geometry, file ?? sourceInfoOfUrl(url ?? "")));
    } catch {
      // الخادم الذي لا يسمح بقراءة الصورة يمنع تصديرها بعد القص، فتظهر الرسالة الصحيحة للمستخدم.
      setFailed(true);
      toast.error(failedText);
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
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-canvas p-4 text-center text-sm text-muted">
                  <p>{failed ? failedText : t("crop.loading")}</p>
                  {failed && url && onPickFile && (
                    <Button variant="ghost" onClick={onPickFile}>
                      {t("crop.pickLocal")}
                    </Button>
                  )}
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
