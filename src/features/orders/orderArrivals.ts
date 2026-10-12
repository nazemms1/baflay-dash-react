/**
 * عدّ الطلبات الواصلة بين قياسين. الطلب الجديد يحصل على رقم أكبر من كل ما سبقه، أما ترتيب القائمة
 * فيتغير حين يُحدَّث طلب قديم، فلا تُحسب مجموعة الأرقام الظاهرة مقياساً للوصول.
 *
 * `previous` هو أكبر رقم طلب رآه القياس السابق، أو `null` قبل أول قياس. القياس الأول يحدد الخط
 * الأساسي فقط، ولا يعلن عن شيء: الطلبات الموجودة عند فتح الصفحة ليست جديدة.
 */
export function countArrivals(previous: number | null, ids: number[]): { arrived: number; next: number } {
  const top = Math.max(0, ...ids);
  if (previous === null) return { arrived: 0, next: top };
  return {
    arrived: ids.filter((id) => id > previous).length,
    next: Math.max(previous, top),
  };
}
