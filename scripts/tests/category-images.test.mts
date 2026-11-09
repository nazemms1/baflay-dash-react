// تشغيل: node --experimental-strip-types scripts/tests/category-images.test.mts
// اختبار مصدر صورة التصنيف في الفرع: صورة الفرع الخاصة تغلب العامة، والعامة تظهر إن لم يرفع الفرع صورة،
// وبلا أيٍّ منهما لا صورة.
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

const load = async (relative: string) =>
  import(pathToFileURL(fileURLToPath(new URL(relative, import.meta.url))).href);

const images = await load("../../src/features/branches/categoryImages.ts");

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const GENERAL = "https://cdn.example.com/general.jpg";
const BRANCH = "https://cdn.example.com/jvc.jpg";

check("صورة الفرع الخاصة تُعرض وتغلب العامة", () => {
  assert.equal(
    images.categoryImageSource({ image: BRANCH, branch_image: BRANCH }),
    "branch"
  );
});

check("الفرع بلا صورة خاصة يعرض العامة", () => {
  assert.equal(
    images.categoryImageSource({ image: GENERAL, branch_image: null }),
    "default"
  );
});

check("بلا صورة خاصة ولا عامة لا صورة", () => {
  assert.equal(images.categoryImageSource({ image: "", branch_image: null }), "none");
});

check("صورة فارغة من الخادم بدل null لا تُحسب صورة فرع", () => {
  assert.equal(images.categoryImageSource({ image: GENERAL, branch_image: "" }), "default");
});

console.log(`\n${passed} tests passed`);
