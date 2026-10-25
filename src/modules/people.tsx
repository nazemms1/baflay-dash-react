import type { TFunction } from "i18next";
import type { CrudModule, OptionSource } from "@/components/crud/types";
import { permissionGroupOf, permissionLabel } from "@/components/crud/permissionLabels";
import { DRIVER_ROLE } from "@/features/drivers/permissions";
import { branches, contactUs, listAll, permissionCatalog, roles, users, type Named } from "@/services";
import { UserRowActions } from "@/features/users/UserActions";
import { UserDetails } from "@/features/people/UserDetails";
import { BranchName } from "@/features/people/BranchName";
import { userEmail, userPhone } from "@/features/people/released";
import { ReleasedValue } from "@/components/ui/ReleasedValue";
import { marketOptions } from "@/features/markets/marketOptions";
import { remoteSource, textColumn } from "./shared";

const DELETE = ["destroy", "delete"] as const;

/**
 * المستخدمون: كلمة المرور مطلوبة عند الإنشاء ومعطّلة إلا عند الكتابة عند
 * التعديل. الحقلان يحملان المفتاح نفسه، ويظهر أحدهما حسب الوضع.
 *
 * مدير الفرع لا يرسل الفرع: الخادم يضع المستخدم الجديد في فرع مديره، ويرفض أي فرع آخر
 * بـ `outside_your_branch`، فيُخفى حقل الفرع عنه كلياً ولا يرسل قيمته.
 */
export const usersModule = (t: TFunction, scoped = false): CrudModule<Named> => ({
  id: "users",
  titleKey: "nav.users",
  api: {
    list: users.list,
    get: users.get,
    create: users.create,
    update: users.update,
    remove: users.remove,
  },
  multipart: true,
  fields: [
    { kind: "text", key: "name", label: t("crud.field.name"), required: true },
    { kind: "text", key: "username", label: t("crud.field.username"), ltr: true },
    { kind: "email", key: "email", label: t("crud.field.email"), required: true },
    { kind: "phone", key: "phone", label: t("crud.field.phone"), ltr: true },
    { kind: "password", key: "password", label: t("crud.field.password"), required: true, createOnly: true },
    { kind: "password", key: "password", label: t("crud.field.newPassword"), editOnly: true },
    // الخادم يطابق التأكيد مع كلمة المرور، فيُطلب التأكيد في الوضعين.
    { kind: "password", key: "password_confirmation", label: t("profile.confirmPassword"), required: true, createOnly: true },
    { kind: "password", key: "password_confirmation", label: t("profile.confirmPassword"), editOnly: true },
    {
      kind: "select",
      key: "gender",
      label: t("profile.gender"),
      required: true,
      options: [
        { value: "male", label: t("profile.male") },
        { value: "female", label: t("profile.female") },
      ],
    },
    { kind: "date", key: "date_of_birth", label: t("profile.dateOfBirth"), required: true },
    { kind: "image", key: "picture", label: t("crud.field.picture") },
    // خط العرض في `location_x` وخط الطول في `location_y`، كما في الفروع. الموقع يُضبط بعد الإنشاء فقط.
    { kind: "location", key: "location_x", lngKey: "location_y", label: t("users.userLocation"), editOnly: true },
    ...(scoped
      ? []
      : [
          {
            kind: "select" as const,
            key: "branch_id",
            label: t("crud.field.branch"),
            options: remoteSource("branches", branches, (row) => String((row as Record<string, unknown>).name_ar ?? (row as Record<string, unknown>).name ?? row.id)),
          },
        ]),
  ],
  columns: [
    textColumn<Named>("name", t("crud.field.name")),
    {
      key: "email",
      header: t("crud.field.email"),
      render: (row) => {
        const email = userEmail(row as Record<string, unknown>);
        return <ReleasedValue value={email.value} wasReleased={email.wasReleased} dir="ltr" />;
      },
    },
    {
      key: "phone",
      header: t("crud.field.phone"),
      render: (row) => {
        const phone = userPhone(row as Record<string, unknown>);
        return <ReleasedValue value={phone.value} wasReleased={phone.wasReleased} dir="ltr" />;
      },
    },
    {
      key: "branch",
      header: t("crud.field.branch"),
      render: (row) => (
        <span className="text-ink-soft">
          <BranchName branchId={row.branch_id} branch={row.branch} />
        </span>
      ),
    },
  ],
  filters: [
    {
      key: "trashed",
      label: t("users.trashed"),
      options: [
        { value: "with", label: t("users.withDeleted") },
        { value: "only", label: t("users.onlyDeleted") },
      ],
    },
    // السائقون فقط: قائمة اختيار السائق في الطلب تعتمد على هذا الفلتر نفسه.
    {
      key: "role",
      label: t("users.driverFilter"),
      options: [{ value: DRIVER_ROLE, label: t("users.driversOnly") }],
    },
  ],
  rowActions: UserRowActions,
  details: UserDetails,
  permissions: {
    index: "users.index",
    show: "users.show",
    create: "users.create",
    // تعديل المستخدم الإداري يُحرس بصلاحية مستقلة عن تعديل الزبون.
    update: "users.admin.update",
    delete: DELETE.map((action) => `users.${action}`),
  },
  nameOf: (row) => String((row as Record<string, unknown>).name ?? row.id),
});

/**
 * خيارات الصلاحيات: القيمة معرّف الصلاحية كما كانت، والتسمية من مقاطع اسم المسار مترجمة
 * (`branches.categories.order.update` ← «التصنيفات · ترتيب · تعديل»)، والمجال للتجميع،
 * واسم المسار التقني نصّ ثانوي يدخل في البحث.
 */
const permissionOptions = (t: TFunction): OptionSource => ({
  // مفتاح تخزين جديد: القائمة القديمة كانت تحمل معرّفات، فلا تُستعمل من الذاكرة المؤقتة.
  cacheKey: "permission-names",
  load: async (signal) => {
    // الصلاحيات كلها: الخادم يحدّ عدد الصفوف في الصفحة، فتُتبع الصفحات حتى `last_page`.
    const rows = await listAll<Named>(permissionCatalog.list, signal);
    return rows.map((row) => {
      const record = row as Record<string, unknown>;
      const name = String(record.name ?? "");
      const label = permissionLabel(name, String(record.label ?? name), t);
      // القيمة اسم الصلاحية نفسه، فهذا ما يستقبله الخادم في الدور.
      return { value: name || String(row.id), label: label || `#${row.id}`, group: permissionGroupOf(name), hint: name };
    });
  },
});

/**
 * الأدوار: الاسم التقني والتسمية الظاهرة والصلاحيات. قيم الصلاحيات هي أسماؤها
 * كما يولّدها الخادم، والعنوان الظاهر يُؤخذ من تسميتها إن وُجدت.
 */
export const rolesModule = (t: TFunction): CrudModule<Named> => ({
  id: "roles",
  titleKey: "nav.roles",
  api: {
    list: roles.list,
    get: roles.get,
    create: roles.create,
    update: roles.update,
    remove: roles.remove,
  },
  fields: [
    { kind: "text", key: "label", label: t("crud.field.label"), required: true },
    { kind: "text", key: "name", label: t("crud.field.technicalName"), required: true, ltr: true },
    {
      kind: "permissions",
      key: "permissions",
      label: t("crud.field.permissions"),
      options: permissionOptions(t),
    },
  ],
  columns: [
    textColumn<Named>("label", t("crud.field.label")),
    textColumn<Named>("name", t("crud.field.technicalName")),
  ],
  permissions: {
    index: "roles.show",
    show: "roles.show",
    create: "roles.store",
    update: "roles.update",
    delete: DELETE.map((action) => `roles.${action}`),
  },
  nameOf: (row) => String((row as Record<string, unknown>).label ?? row.id),
});

/**
 * تواصل معنا: عرض الرسائل فقط، كما في الأصلي (لا إنشاء ولا تعديل ولا حذف). كل رسالة تحمل سوقها
 * `market_code`، ويُفلتر صندوق الرسائل بدولة واحدة. الرسالة بلا سوق تظهر بـ«—».
 */
export const contactUsModule = (t: TFunction): CrudModule<Named> => ({
  id: "contact-us",
  titleKey: "nav.contactUs",
  api: {
    list: contactUs.list,
    get: contactUs.get,
  },
  readOnly: true,
  fields: [
    { kind: "text", key: "name", label: t("crud.field.name") },
    { kind: "email", key: "email", label: t("crud.field.email") },
    { kind: "text", key: "market_code", label: t("markets.market"), ltr: true },
    { kind: "textarea", key: "message", label: t("crud.field.message") },
  ],
  columns: [
    textColumn<Named>("name", t("crud.field.name")),
    textColumn<Named>("email", t("crud.field.email")),
    textColumn<Named>("market_code", t("markets.market")),
    textColumn<Named>("message", t("crud.field.message"), (row) => {
      const message = String((row as Record<string, unknown>).message ?? "");
      return <span className="line-clamp-1 max-w-md text-ink-soft">{message || "—"}</span>;
    }),
  ],
  filters: [{ key: "market", label: t("markets.market"), options: marketOptions(t, { includeGeneral: false }) }],
  permissions: {
    index: "contact-us.index",
    show: "contact-us.show",
  },
  nameOf: (row) => String((row as Record<string, unknown>).name ?? row.id),
});
