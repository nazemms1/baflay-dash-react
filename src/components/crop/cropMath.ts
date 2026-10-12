/**
 * هندسة القص بلا واجهة: إطار بنسبة محددة، وصورة تغطيه، وتكبير، وإزاحة. كل الحسابات هنا
 * بالبكسل، والإطار بعرض ثابت على الشاشة، فتتطابق المعاينة مع الناتج النهائي.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Offset {
  x: number;
  y: number;
}

/** أقصى عرض لإطار القص على الشاشة، بالبكسل. */
export const FRAME_MAX = 360;
/** عرض معاينة النتيجة الصغيرة. */
export const PREVIEW_WIDTH = 160;
/** أقصى عرض للصورة الناتجة، فلا تُرسل صور ضخمة إلى الخادم. */
export const OUTPUT_MAX = 1200;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** إطار بنسبة العرض إلى الارتفاع، يبقى ضمن `frameMax` في الاتجاهين. */
export function frameSize(ratio: number, frameMax = FRAME_MAX): Size {
  return ratio >= 1
    ? { width: frameMax, height: frameMax / ratio }
    : { width: frameMax * ratio, height: frameMax };
}

export interface Geometry {
  /** مقياس الصورة على الشاشة، بعد التغطية والتكبير. */
  scale: number;
  /** موضع أعلى-يسار الصورة داخل الإطار. */
  left: number;
  top: number;
  /** الإزاحة بعد التثبيت: لا تسمح بكشف حواف فارغة داخل الإطار. */
  offset: Offset;
}

/** الهندسة الكاملة لصورة داخل إطار، مع تثبيت الإزاحة ضمن الحدود المسموحة. */
export function geometryOf(image: Size, frame: Size, zoom: number, offset: Offset): Geometry {
  const cover = Math.max(frame.width / image.width, frame.height / image.height);
  const scale = cover * zoom;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const maxX = Math.max(0, (drawWidth - frame.width) / 2);
  const maxY = Math.max(0, (drawHeight - frame.height) / 2);
  const clamped = { x: clamp(offset.x, -maxX, maxX), y: clamp(offset.y, -maxY, maxY) };

  return {
    scale,
    left: frame.width / 2 + clamped.x - drawWidth / 2,
    top: frame.height / 2 + clamped.y - drawHeight / 2,
    offset: clamped,
  };
}

/** المستطيل المقصوص من الصورة الأصلية، بالبكسل الأصلي للصورة. */
export function sourceRect(frame: Size, geometry: Geometry) {
  return {
    sx: -geometry.left / geometry.scale,
    sy: -geometry.top / geometry.scale,
    sw: frame.width / geometry.scale,
    sh: frame.height / geometry.scale,
  };
}

/** يرسم المنطقة المقصوصة على لوحة بعرض `outWidth`، والارتفاع يتبع نسبة الإطار. */
export function renderCrop(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  frame: Size,
  geometry: Geometry,
  outWidth: number,
  fill?: string
) {
  const rect = sourceRect(frame, geometry);
  canvas.width = Math.max(1, Math.round(outWidth));
  canvas.height = Math.max(1, Math.round((outWidth * frame.height) / frame.width));

  const context = canvas.getContext("2d");
  if (!context) return;
  context.imageSmoothingQuality = "high";
  if (fill) {
    context.fillStyle = fill;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, canvas.width, canvas.height);
}

/** نوع الملف الناتج: PNG وWebP يبقيان كما هما، وما عداهما يصير JPEG. */
export const outputMime = (type: string) => (type === "image/png" || type === "image/webp" ? type : "image/jpeg");

const EXTENSION: Record<string, string> = { "image/png": "png", "image/webp": "webp", "image/jpeg": "jpg" };

const renamed = (name: string, mime: string) => `${name.replace(/\.[^.]+$/, "") || "image"}.${EXTENSION[mime]}`;

/** المصدر الذي يُقص: نوع الملف واسمه، وهما ما يحدد صيغة الناتج وتسميته. */
export interface CropSourceInfo {
  type: string;
  name: string;
}

/** نوع الصورة واسمها من رابطها، لأن المتصفح لا يعرفهما قبل قراءتها. الامتداد يحدد الصيغة. */
export function sourceInfoOfUrl(url: string): CropSourceInfo {
  const path = url.split(/[?#]/)[0];
  const name = path.split("/").pop() || "image";
  const extension = name.split(".").pop()?.toLowerCase();
  const type = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  return { type, name };
}

/** يصدّر المنطقة المقصوصة ملفاً جديداً. لا يكبّر الصورة، بل يقصّها بدقتها الأصلية كحد أقصى. */
export function exportCrop(image: CanvasImageSource, frame: Size, geometry: Geometry, source: CropSourceInfo): Promise<File> {
  const mime = outputMime(source.type);
  const { sw } = sourceRect(frame, geometry);
  const canvas = document.createElement("canvas");
  // JPEG لا يحمل شفافية، فالخلفية البيضاء تمنع ظهور المناطق الشفافة سوداء.
  renderCrop(canvas, image, frame, geometry, Math.min(OUTPUT_MAX, sw), mime === "image/jpeg" ? "#ffffff" : undefined);

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("crop-failed"));
          return;
        }
        resolve(new File([blob], renamed(source.name, mime), { type: mime, lastModified: Date.now() }));
      },
      mime,
      0.92
    );
  });
}
