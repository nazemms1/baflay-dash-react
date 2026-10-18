import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** إجراءات الصفحة، كزر الإضافة. على الهاتف تأخذ كل واحدة عرضاً كاملاً. */
  actions?: ReactNode;
}

/**
 * رأس الصفحة الموحّد: العنوان والشرح، ثم الإجراءات. على الهاتف تتكدس الإجراءات تحت العنوان
 * بأزرار بعرض كامل، وعلى الشاشات الواسعة تصطف بجانب العنوان كما كانت.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 [&>*]:flex-1 sm:shrink-0 sm:[&>*]:flex-none">{actions}</div>
      )}
    </header>
  );
}
