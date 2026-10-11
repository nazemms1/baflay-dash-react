import type { FieldDef } from "./types";

export interface FieldGroup {
  /** عنوان القسم، أو `null` للحقول التي لا قسم لها. */
  title: string | null;
  fields: FieldDef[];
}

/** يجمع الحقول المتتالية التي تشترك في القسم نفسه، مع الحفاظ على ترتيبها. */
export function groupFields(fields: FieldDef[]): FieldGroup[] {
  const groups: FieldGroup[] = [];
  for (const field of fields) {
    const title = field.group ?? null;
    const last = groups[groups.length - 1];
    if (last && last.title === title) {
      last.fields.push(field);
    } else {
      groups.push({ title, fields: [field] });
    }
  }
  return groups;
}
