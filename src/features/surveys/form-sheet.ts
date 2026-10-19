import QRCode from "qrcode";
import { jsPDF } from "jspdf";

export interface FormSheet {
  title: string;
  title_ar: string;
  slug: string;
  public_url: string;
}

/** A5 بالمليمتر. الرسم على لوحة بدقة 150 نقطة في البوصة ليبقى الرمز حاداً عند الطباعة. */
const PAGE_MM = { width: 148, height: 210 };
const PX_PER_MM = 150 / 25.4;
const PX_PER_PT = 150 / 72;
const QR_MM = 90;

const mm = (value: number) => Math.round(value * PX_PER_MM);

const TITLE_FONT = `700 ${Math.round(20 * PX_PER_PT)}px "IBM Plex Sans", system-ui, sans-serif`;
const TITLE_AR_FONT = `600 ${Math.round(16 * PX_PER_PT)}px "IBM Plex Sans Arabic", "IBM Plex Sans", system-ui, sans-serif`;
const LINK_FONT = `400 ${Math.round(10 * PX_PER_PT)}px "IBM Plex Mono", ui-monospace, monospace`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("QR image failed to load"));
    image.src = src;
  });
}

/**
 * الورقة كلها ترسم على لوحة واحدة ثم تُضاف إلى PDF صورةً كاملة. jsPDF لا يحمل خطوطاً عربية،
 * أما المتصفح فيرسم العربي بخطوطه، فيظهر العنوان العربي صحيحاً.
 */
export async function downloadFormSheet(sheet: FormSheet): Promise<void> {
  const qrSrc = await QRCode.toDataURL(sheet.public_url, { width: 1024, margin: 1, errorCorrectionLevel: "M" });
  const qr = await loadImage(qrSrc);
  await Promise.all([TITLE_FONT, TITLE_AR_FONT, LINK_FONT].map((font) => document.fonts.load(font))).catch(() => undefined);

  const width = mm(PAGE_MM.width);
  const height = mm(PAGE_MM.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#16211c";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const center = width / 2;
  const maxWidth = width * 0.84;

  ctx.direction = "ltr";
  ctx.font = TITLE_FONT;
  ctx.fillText(sheet.title, center, mm(28), maxWidth);

  if (sheet.title_ar) {
    ctx.direction = "rtl";
    ctx.font = TITLE_AR_FONT;
    ctx.fillText(sheet.title_ar, center, mm(38), maxWidth);
  }

  const qrPx = mm(QR_MM);
  ctx.drawImage(qr, mm((PAGE_MM.width - QR_MM) / 2), mm(45), qrPx, qrPx);

  ctx.direction = "ltr";
  ctx.font = LINK_FONT;
  ctx.fillText(sheet.public_url, center, mm(148), maxWidth);

  const pdf = new jsPDF({ unit: "mm", format: "a5" });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, PAGE_MM.width, PAGE_MM.height);
  pdf.save(`form-${sheet.slug}.pdf`);
}
