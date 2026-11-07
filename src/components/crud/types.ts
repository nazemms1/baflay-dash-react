import type { ComponentType, ReactNode } from "react";
import type { Language } from "@/i18n";
import type { Page } from "@/lib/http/envelope";
import type { Option } from "@/components/ui/Fields";

/** معاملات الترقيم التي تُرسل لكل قائمة. */
export type ListQuery = {
  page: number;
  per_page: number;
};

/**
 * مصدر خيارات يبحث الخادم فيه: كل طلب يجلب صفحة صغيرة تطابق ما كتبه المستخدم، والخيار المختار
 * يُجلب وحده بمعرّفه. لا تُنزَّل القائمة كلها.
 */
export interface RemoteSource {
  cacheKey: string;
  search: (term: string, page: number, signal: AbortSignal) => Promise<{ items: Option[]; lastPage: number }>;
  byId: (value: string | number, signal: AbortSignal) => Promise<Option | null>;
}

export function isRemoteSource(source: unknown): source is RemoteSource {
  return typeof source === "object" && source !== null && "search" in source;
}

/** مصدر خيارات يُجلب عند الحاجة، مثل قائمة الولايات لحقل المدينة. */
export interface OptionSource {
  cacheKey: string;
  load: (signal: AbortSignal) => Promise<Option[]>;
}

type Common = {
  key: string;
  label: string;
  /** صلاحية تلزم لرؤية هذا الحقل وتعديله؛ من لا يملكها لا يراه ولا يُرسل قيمته. */
  requires?: string;
  /** قسم الحقل في النموذج وفي التفاصيل، مثل «الموقع» أو «التوصيل». */
  group?: string;
  required?: boolean;
  /** يظهر عند الإنشاء فقط، مثل كلمة المرور الأولى. */
  createOnly?: boolean;
  /** يظهر عند التعديل فقط. */
  editOnly?: boolean;
  /**
   * يُعرض في التفاصيل فقط، ولا يدخل النموذج ولا الحمولة. مثل حالة الإغلاق المؤقت
   * التي يديرها الخادم من مواعيد العمل ويتجاهلها عند التعديل.
   */
  readOnly?: boolean;
};

/** ما تستلمه الخلية الإضافية في صف: الصف نفسه، والسجل الذي يُعدَّل (`null` عند الإنشاء)، وتعديل الصف. */
export interface RowExtraProps {
  row: Record<string, unknown>;
  record: Record<string, unknown> | null;
  onPatch: (patch: Record<string, unknown>) => void;
}

export type FieldDef =
  | (Common & {
      kind: "text" | "email" | "phone" | "number" | "password";
      ltr?: boolean;
      hint?: string;
      /** حدود الأرقام: تُفحص قبل الإرسال برسالة بلغة الواجهة، فلا يصل الخادم قيمة خارجها. */
      min?: number;
      max?: number;
      /** لا يقل عن قيمة حقل آخر، مثل «أقصى دقائق» لا يقل عن «أدنى دقائق». */
      notBelow?: string;
    })
  | (Common & { kind: "textarea" })
  // تاريخ بصيغة YYYY-MM-DD، كتاريخ الميلاد.
  | (Common & { kind: "date" })
  | (Common & { kind: "bilingual"; multiline?: boolean })
  | (Common & { kind: "select"; options: Option[] | OptionSource | RemoteSource; placeholder?: string; searchable?: boolean })
  | (Common & { kind: "multiselect"; options: Option[] | OptionSource })
  | (Common & { kind: "permissions"; options: Option[] | OptionSource })
  | (Common & { kind: "switch"; hint?: string; defaultValue?: boolean })
  | (Common & {
      kind: "image";
      /** نسبة القص الافتراضية للصورة: 1 مربع، و16/9 للعرض، و`null` كما هي. */
      ratio?: number | null;
    })
  | (Common & {
      /**
       * كتلة مخصصة تُرسم داخل النموذج وتقرأ قيم الحقول الأخرى، كمعاينة رسوم التوصيل.
       * لا تُرسل شيئاً ولا تدخل الحمولة.
       */
      kind: "custom";
      component: ComponentType<{ values: Values }>;
    })
  | (Common & {
      kind: "rows";
      columns: RowColumn[];
      newRow: Record<string, unknown>;
      /**
       * ترتيب الصفوف بالسحب والإفلات. الترتيب يُحفظ في `orderKey` تلقائياً حسب
       * موضع الصف، فلا يحتاج المستخدم إلى كتابة أرقام.
       */
      sortable?: boolean;
      orderKey?: string;
      /**
       * أعمدة للعرض فقط: تظهر في التفاصيل ولا تدخل النموذج ولا الحمولة، مثل سعر الوجبة
       * للصنف في القائمة، وهو قيمة يحددها الخادم ولا يعدّلها المستخدم هنا.
       */
      viewColumns?: RowColumn[];
      /**
       * خلية إضافية في كل صف بعد الأعمدة، كمفتاح كومبو الصنف. لا تدخل الحمولة ولا تنتظر زر «حفظ»:
       * تحفظ نفسها بطلبها الخاص، وتعدّل الصف في النموذج عبر `onPatch` ليبقى معه إن تغيّر ترتيبه.
       */
      rowExtra?: ComponentType<RowExtraProps>;
      /** تلميح تحت عنوان الصفوف يشرح الخلية الإضافية. */
      rowExtraHint?: string;
    })
  | (Common & {
      /**
       * موقع على الخريطة: `key` هو خط العرض، و`lngKey` خط الطول، و`radiusKey` نطاق التوصيل.
       * الخريطة الأولى لهذا الموقع.
       */
      kind: "location";
      lngKey: string;
      radiusKey?: string;
      /**
       * نقطة خريطة التوصيل الثانية: خط عرضها وخط طولها. تتحرك علامتها وحدها دون أن يتغير موقع
       * الفرع، وعليها تُرسم دائرة النطاق. اختيارية: تُرسل معاً أو تُمسح معاً، وإن غابت تُعرض الخريطة
       * على موقع الفرع.
       */
      deliveryLatKey?: string;
      deliveryLngKey?: string;
    });

/**
 * عمود داخل صف متكرر، مثل سطر صنف داخل قائمة، أو صورة داخل معرض. قيمة الصف
 * كائن يحمل مفاتيح الأعمدة كما يستقبلها الخادم.
 */
export type RowColumn =
  | {
      key: string;
      label: string;
      kind: "text" | "number" | "image";
      required?: boolean;
      /** نسبة القص لصورة الصف، كما في حقل الصورة. */
      ratio?: number | null;
    }
  | {
      key: string;
      label: string;
      kind: "select";
      options: Option[] | OptionSource | RemoteSource;
      required?: boolean;
      /** اختيار مع حقل بحث، مفيد للقوائم الطويلة مثل الأصناف. */
      searchable?: boolean;
      /**
       * الصف نفسه هو السجل المرتبط، كالصنف داخل القائمة: المعرّف هو `id` الصف،
       * والاسم يُقرأ منه، إن لم يأتِ `item_id` أو الكائن المتداخل.
       */
      self?: boolean;
    };

export type Values = Record<string, unknown>;

export interface ColumnDef<T> {
  key: string;
  header: string;
  render: (row: T, language: Language) => ReactNode;
  className?: string;
}

/** عمليات الخدمة التي تحتاجها الوحدة. الوحدة للعرض فقط تكتفي بـ `list`. */
export interface CrudApi<T> {
  list: (query: ListQuery, signal: AbortSignal) => Promise<Page<T>>;
  get: (id: number | string, signal?: AbortSignal) => Promise<T>;
  create?: (payload: Record<string, unknown> | FormData) => Promise<unknown>;
  update?: (id: number | string, payload: Record<string, unknown> | FormData) => Promise<unknown>;
  remove?: (id: number | string) => Promise<unknown>;
}

export interface CrudModule<T extends { id: number | string }> {
  /** مفتاح فريد للوحدة؛ يُستعمل كجذر لمفاتيح الكاش. */
  id: string;
  /** مفتاح الترجمة للعنوان، مثل `nav.countries`. */
  titleKey: string;
  api: CrudApi<T>;
  fields: FieldDef[];
  columns: ColumnDef<T>[];
  /** أسماء صلاحيات المسارات كما يولّدها الخادم. */
  permissions: {
    index: string;
    show?: string;
    create?: string;
    update?: string;
    /** الحذف قد يُسمّى `destroy` أو `delete` حسب الوحدة، فنقبل أيّهما. */
    delete?: string[];
  };
  /**
   * أزرار تظهر في الواجهة دون التحقق من صلاحيتها، مثل التعديل أو الحذف. الخادم يبقى صاحب القرار:
   * الطلب الذي لا تملك صلاحيته يُرفض، والإظهار هنا لا يمنح أي صلاحية.
   */
  showWithoutPermission?: ("update" | "delete")[];
  /** يُرسَل دائماً كـ `FormData`، كما تتوقعه هذه الوحدة في الخادم. */
  multipart?: boolean;
  /** لا إنشاء ولا تعديل ولا حذف، كشاشة تواصل معنا في النسخة الأصلية. */
  readOnly?: boolean;
  /** قيم النموذج من السجل الكامل. الافتراضي يقرأ الحقول بأسمائها. */
  toValues?: (record: T) => Values;
  /** تعديل الحمولة قبل الإرسال، مثل تحويل قائمة الأصناف إلى الصيغة المطلوبة. */
  toPayload?: (values: Values) => Values;
  /** الاسم الذي يظهر في تأكيد الحذف. */
  nameOf?: (record: T, language: Language) => string;
  /**
   * اسم معامل البحث الذي يقبله الخادم في قائمة الوحدة، مثل `search`. وجوده يُظهر حقل البحث،
   * ويُرسل النص مع الترقيم، فيأتي من الخادم ما يطابقه بدل تنزيل كل السجلات وتصفيتها في المتصفح.
   */
  searchParam?: string;
  /** فلاتر تُرسل مع القائمة، مثل حالة الطلب. قيمها خيارات ثابتة. */
  filters?: FilterDef[];
  /** أزرار إضافية في رأس الصفحة، كزر التصدير. */
  headerActions?: ReactNode;
  /** أزرار إضافية في كل صف. مكوّن يملك حالته الخاصة، كنافذة تغيير الحالة. */
  rowActions?: ComponentType<{ row: T }>;
  /** نموذج مخصص يحل محل النموذج العام، للوحدات ذات الحقول المتداخلة. */
  form?: ComponentType<FormProps<T>>;
  /** عرض مخصص للتفاصيل يحل محل العرض العام. */
  details?: ComponentType<{ record: T }>;
}

/** فلتر للقائمة: قائمة خيارات افتراضياً، أو حقل تاريخ للفترات «من» و«إلى». */
export type FilterDef =
  | {
      /** اسم المعامل كما يستقبله الخادم في الاستعلام. */
      key: string;
      label: string;
      kind?: "select";
      /** خيارات ثابتة، أو مصدر يجلبها الخادم مرة واحدة، كقائمة الدول. */
      options: Option[] | OptionSource;
    }
  | {
      key: string;
      label: string;
      kind: "date";
    };

export interface FormProps<T> {
  record: T | null;
  onDone: () => void;
}
