import clsx from "clsx";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
}

/**
 * اختيار من خيارات قليلة ظاهرة دائماً. يُستعمل للفترات والتبويبات، بدل
 * قائمة منسدلة تُخفي ما يحتاجه المستخدم.
 */
export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-line/50 p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={clsx(
              "h-8 cursor-pointer rounded-lg px-3 text-sm font-medium transition",
              active ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
