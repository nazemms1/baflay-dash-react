import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-surface hover:bg-ink-soft",
  secondary: "border border-line bg-surface text-ink hover:bg-canvas",
  ghost: "text-ink-soft hover:bg-line/50 hover:text-ink",
  danger: "bg-danger text-surface hover:opacity-90",
};

const SIZES: Record<Size, string> = {
  sm: "h-11 px-3 text-sm gap-1.5 sm:h-8",
  md: "h-11 px-5 text-[15px] gap-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex cursor-pointer items-center justify-center rounded-xl font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    />
  );
}
