import { useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";

export interface SortItem {
  id: number;
  label: string;
}

/**
 * قائمة ترتيب بالسحب والإفلات، مع أسهم للوصول بلوحة المفاتيح. لا أرقام تُكتب:
 * الترتيب هو موضع السطر في القائمة وحده.
 */
export function SortableList({
  items,
  onChange,
}: {
  items: SortItem[];
  onChange: (next: SortItem[]) => void;
}) {
  const { t } = useTranslation();
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <ol className="space-y-2">
      {items.map((item, index) => (
        <li
          key={item.id}
          onDragOver={(event) => {
            if (dragFrom !== null) event.preventDefault();
          }}
          onDrop={(event) => {
            if (dragFrom === null) return;
            event.preventDefault();
            move(dragFrom, index);
            setDragFrom(null);
          }}
          className={clsx(
            "flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 transition",
            dragFrom === index && "opacity-50"
          )}
        >
          <button
            type="button"
            draggable
            aria-label={t("crud.dragToReorder")}
            title={t("crud.dragToReorder")}
            onDragStart={(event) => {
              setDragFrom(index);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", String(index));
            }}
            onDragEnd={() => setDragFrom(null)}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") move(index, index - 1);
              if (event.key === "ArrowDown") move(index, index + 1);
            }}
            className="grid h-9 w-7 shrink-0 cursor-grab place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink active:cursor-grabbing"
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
          <span className="w-6 shrink-0 text-center text-sm font-semibold text-muted tabular-nums">{index + 1}</span>
          <span className="min-w-0 flex-1 truncate font-medium text-ink">{item.label}</span>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              aria-label={t("crud.moveUp")}
              disabled={index === 0}
              onClick={() => move(index, index - 1)}
              className="grid size-7 cursor-pointer place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronUp className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={t("crud.moveDown")}
              disabled={index === items.length - 1}
              onClick={() => move(index, index + 1)}
              className="grid size-7 cursor-pointer place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronDown className="size-4" aria-hidden />
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}
