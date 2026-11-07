/** مفتاح تشغيل: مفتوح يعني مفعّلاً. الزر يحمل الحالة في `aria-checked` للقراءة الصوتية. */
export function ToggleSwitch({
  on,
  label,
  disabled = false,
  onToggle,
}: {
  on: boolean;
  label: string;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition disabled:opacity-50 sm:h-5 sm:w-9 ${on ? "bg-ok" : "bg-line"}`}
    >
      <span className={`absolute top-0.5 size-4 rounded-full bg-surface shadow transition ${on ? "end-0.5" : "start-0.5"}`} />
    </button>
  );
}
