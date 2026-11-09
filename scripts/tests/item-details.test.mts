// تشغيل: node --experimental-strip-types scripts/tests/item-details.test.mts
// اختبار تفاصيل الصنف لكل فرع: قراءة `branch_details`، وما يُرسل عند الحفظ فقط.
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

const load = async (relative: string) =>
  import(pathToFileURL(fileURLToPath(new URL(relative, import.meta.url))).href);

const details = await load("../../src/features/menus/itemDetails.ts");

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const BRANCH_IMAGE = "https://cdn.example.com/dubai.jpg";
const picture = () => new File(["x"], "dubai.jpg", { type: "image/jpeg" });
const draft = (overrides: Record<string, unknown> = {}) => ({
  description: "",
  description_ar: "",
  image: null,
  removeImage: false,
  ...overrides,
});
const saved = (overrides: Record<string, unknown> = {}) => ({
  description: "",
  description_ar: "",
  hasOwnImage: false,
  ...overrides,
});

check("branch_details null يعني أن الفرع يعرض النسخة العامة", () => {
  assert.equal(details.branchDetailsOf(null), null);
  assert.equal(details.branchDetailsOf(undefined), null);
});

check("branch_details بكل حقوله null لا يعني شيئاً خاصاً بالفرع", () => {
  assert.equal(
    details.branchDetailsOf({ image: null, description: null, description_ar: null }),
    null
  );
});

check("branch_details بحقول فارغة نصاً لا يعني شيئاً خاصاً بالفرع", () => {
  assert.equal(details.branchDetailsOf({ image: "", description: "", description_ar: "" }), null);
});

check("branch_details بوصف واحد يُقرأ والحقل الباقي null", () => {
  assert.deepStrictEqual(
    details.branchDetailsOf({ image: null, description: "وصف دبي", description_ar: null }),
    { image: null, description: "وصف دبي", description_ar: null }
  );
});

check("branch_details كاملة تُقرأ كما هي", () => {
  assert.deepStrictEqual(
    details.branchDetailsOf({ image: BRANCH_IMAGE, description: "Dubai", description_ar: "دبي" }),
    { image: BRANCH_IMAGE, description: "Dubai", description_ar: "دبي" }
  );
});

check("لا تغيير يعني لا طلب", () => {
  assert.equal(details.itemDetailsPatch(saved({ description: "abc", hasOwnImage: true }), draft({ description: "abc" })), null);
});

check("مسافات الأطراف وحدها لا تُعدّ تغييراً", () => {
  assert.equal(details.itemDetailsPatch(saved({ description: "abc" }), draft({ description: "abc  " })), null);
});

check("تعديل الوصف الإنجليزي وحده يرسل الحقل وحده", () => {
  const patch = details.itemDetailsPatch(saved({ description: "old" }), draft({ description: "new", description_ar: "" }));
  assert.deepStrictEqual(patch, { description: "new" });
  assert.equal("description_ar" in patch, false);
});

check("تفريغ الوصف الخاص يرسله فارغاً ليرجع للعام", () => {
  const patch = details.itemDetailsPatch(saved({ description_ar: "خاص" }), draft({ description_ar: "" }));
  assert.deepStrictEqual(patch, { description_ar: "" });
});

check("ملف جديد يُرسل مع النصوص المتغيرة، ولا يُرسل معه remove_image", () => {
  const file = picture();
  const patch = details.itemDetailsPatch(saved({ description_ar: "خاص" }), draft({ image: file, description_ar: "خاص", description: "x" }));
  assert.equal(patch?.image, file);
  assert.equal(patch?.description, "x");
  assert.equal("remove_image" in (patch ?? {}), false);
  assert.equal("description_ar" in (patch ?? {}), false);
});

check("إرجاع الصورة يرسل remove_image إن كان للفرع صورة خاصة", () => {
  assert.deepStrictEqual(
    details.itemDetailsPatch(saved({ hasOwnImage: true }), draft({ removeImage: true })),
    { remove_image: true }
  );
});

check("إرجاع الصورة بلا صورة خاصة للفرع لا يرسل شيئاً", () => {
  assert.equal(details.itemDetailsPatch(saved({ hasOwnImage: false }), draft({ removeImage: true })), null);
});

check("الملف المختار يغلب طلب الإرجاع، فلا يُرسلان معاً", () => {
  const file = picture();
  const patch = details.itemDetailsPatch(saved({ hasOwnImage: true }), draft({ image: file, removeImage: true }));
  assert.equal(patch?.image, file);
  assert.equal("remove_image" in (patch ?? {}), false);
});

check("textOrNull يعيد null للقيم غير النصية والفارغة", () => {
  assert.equal(details.textOrNull(undefined), null);
  assert.equal(details.textOrNull(""), null);
  assert.equal(details.textOrNull(42), null);
  assert.equal(details.textOrNull("نص"), "نص");
});

console.log(`\n${passed} tests passed`);
