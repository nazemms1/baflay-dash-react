import type { SelectHTMLAttributes } from "react";
import clsx from "clsx";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { dropdownClass } from "./dropdownStyle";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** أيقونة تظهر في بداية الحقل، كأيقونة الفرع في فلتر لوحة التحكم. */
  icon?: LucideIcon;
  error?: boolean;
  /** صنف الحاوية، لتحديد عرضها في المكان الذي يُستعمل فيه الحقل. */
  wrapperClassName?: string;
}

/** قائمة منسدلة أصلية بالشكل الموحّد: سهم في النهاية، وأيقونة اختيارية في البداية. */
export function Select({ icon: Icon, error, wrapperClassName, className, children, ...props }: SelectProps) {
  return (
    <span className={clsx("relative inline-flex items-center", wrapperClassName)}>
      {Icon && <Icon className="pointer-events-none absolute start-3 size-4 text-muted" aria-hidden />}
      <select
        className={clsx(dropdownClass({ error }), "cursor-pointer appearance-none pe-9", Icon && "ps-9", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 size-4 text-muted" aria-hidden />
    </span>
  );
}
