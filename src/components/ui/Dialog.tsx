import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
  /** على الهاتف تملأ الشاشة كلها، للنماذج الطويلة التي لا تُقرأ في نصف الشاشة. */
  fullOnMobile?: boolean;
}

/**
 * نافذة منبثقة بسيطة وصريحة: تُغلق بـ Escape أو بالنقر خارجها أو بزر الإغلاق،
 * وتقفل تمرير الصفحة ما دامت مفتوحة. على الهاتف تنزلق من الأسفل.
 *
 * على الهاتف الحشوات أضيق وأزرار الإغلاق أكبر لتسهل اللمسة، وتذييل النافذة يترك مكاناً
 * لمساحة الأمان في أسفل الشاشة. على الشاشات الواسعة تعود المقاسات الأصلية.
 *
 * تُرسم في `document.body` لا في مكانها داخل الشاشة: الصفحات تحمل حركات ظهور تُنشئ سياقاً
 * خاصاً بها، فلو بقيت النافذة داخلها لغطّت الطبقة الغامقة العمود الرئيسي وحده وتركت القائمة
 * والشريط العلوي بلا تعتيم.
 *
 * تنبيه: الطباعة تعتمد على `role="dialog"` وعلى بنية الحاويات المباشرة في `index.css`،
 * فأي تغيير في هذه البنية يُراجع مع قواعد `@media print`.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = "md", fullOnMobile = false }: DialogProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/45"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={clsx(
          "relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface pb-safe shadow-2xl outline-none sm:max-h-[calc(100dvh-3rem)] sm:rounded-3xl sm:pb-0",
          fullOnMobile && "max-sm:h-dvh max-sm:max-h-dvh max-sm:rounded-none",
          size === "lg" ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
      >
        <header className="relative z-10 flex items-start justify-between gap-4 border-b border-line bg-surface px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-soft transition hover:bg-canvas hover:text-ink sm:size-8"
          >
            <X className="size-4" />
          </button>
        </header>

        {/* طبقة مستقلة للمحتوى: ما فيه من خرائط وقوائم بطبقات عالية يبقى تحت الرأس والتذييل. */}
        <div className="relative z-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>

        {footer && (
          <footer className="relative z-10 flex flex-wrap justify-end gap-2 border-t border-line bg-surface px-4 py-3 [&>*]:flex-1 sm:px-6 sm:py-4 sm:[&>*]:flex-none">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}
