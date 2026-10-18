import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

/** بطاقة موحّدة: عنوان واضح وشرح قصير وإجراء واحد عند الحاجة. */
export function Panel({ title, description, action, className, children, ...props }: PanelProps) {
  return (
    <section
      className={clsx(
        "flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_0_rgba(23,25,31,0.04)] sm:p-5",
        className
      )}
      {...props}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
