import type { ReactNode } from "react";
import clsx from "clsx";

/** الشاشة التي يبدأ عندها ظهور العمود في الجدول. */
type ColumnFrom = "md" | "lg" | "xl";

export interface RecordColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** بلا `from` يظهر العمود مع الجدول كله (من `md`). مع `from` يُخفى حتى تتسع الشاشة له. */
  from?: ColumnFrom;
  align?: "start" | "end";
  /** صنف إضافي للخلية، كعرض ثابت لعمود الصورة. */
  className?: string;
}

// فئات كاملة مكتوبة صراحةً، لأن Tailwind لا يلتقط أسماء الفئات المبنية من متغيرات.
const SHOW_FROM: Record<ColumnFrom, string> = {
  md: "md:table-cell",
  lg: "lg:table-cell",
  xl: "xl:table-cell",
};

interface ResponsiveRecordListProps<T> {
  /** اسم الجدول لقارئات الشاشة. */
  label: string;
  rows: T[];
  /** مفتاح الصف. يصله الترتيب أيضاً، لمن تتكرر قيمه كسائق بلا معرّف. */
  getKey: (row: T, index: number) => string;
  columns: RecordColumn<T>[];
  /** كرت السجل على الهاتف. الإجراءات تأتي من الصفحة نفسها، فلا يتكرر المنطق بين الكرت والجدول. */
  renderCard: (row: T) => ReactNode;
}

/**
 * بيانات واحدة بعرضين: كروت أقل من `md` (الهاتف)، وجدول من `md` فما فوق.
 * الأعمدة الثانوية تُخفى حتى تتسع الشاشة لها، فيبقى التابلت بأعمدته الأساسية،
 * ويظهر الجدول كاملاً على الشاشات الواسعة.
 *
 * العرضان موجودان في الصفحة معاً، والتبديل بينهما بالفئات وحدها، فلا حاجة إلى قياس الشاشة بالجافاسكربت.
 */
export function ResponsiveRecordList<T>({ label, rows, getKey, columns, renderCard }: ResponsiveRecordListProps<T>) {
  const alignOf = (column: RecordColumn<T>) => (column.align === "end" ? "text-end" : "text-start");
  const visibilityOf = (column: RecordColumn<T>) => (column.from ? clsx("hidden", SHOW_FROM[column.from]) : undefined);

  return (
    <>
      <ul className="grid gap-3 p-3 md:hidden">
        {rows.map((row, index) => (
          <li key={getKey(row, index)}>{renderCard(row)}</li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-t-2xl md:block">
        <table aria-label={label} className="w-full text-sm">
          <thead className="bg-secondary text-xs font-semibold text-surface">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={clsx("px-4 py-3 font-medium", alignOf(column), visibilityOf(column), column.className)}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, index) => (
              <tr key={getKey(row, index)} className="align-middle hover:bg-canvas/60">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={clsx("px-4 py-3", alignOf(column), visibilityOf(column), column.className)}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
