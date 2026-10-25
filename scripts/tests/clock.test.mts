// تشغيل: node --experimental-strip-types scripts/tests/clock.test.mts
// تحويل الوقت والتاريخ بين صيغة الخادم (HH:MM بنظام ٢٤ ساعة، و24:00 لمنتصف الليل عند الإغلاق،
// وYYYY-MM-DD) وأجزاء القوائم (الساعة من ١ إلى ١٢ مع AM أو PM).
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

const load = async (relative: string) =>
  import(pathToFileURL(fileURLToPath(new URL(relative, import.meta.url))).href);

const clock = await load("../../src/lib/clock.ts");

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

check("منتصف الليل يُقرأ 12:00 AM، والظهر 12:00 PM", () => {
  assert.deepEqual(clock.parseClock("00:00"), { hour12: 12, minute: 0, meridiem: "AM" });
  assert.deepEqual(clock.parseClock("12:30"), { hour12: 12, minute: 30, meridiem: "PM" });
});

check("ما بعد الظهر يُقرأ بالساعة من ١ إلى ١١ مع PM", () => {
  assert.deepEqual(clock.parseClock("13:05"), { hour12: 1, minute: 5, meridiem: "PM" });
  assert.deepEqual(clock.parseClock("23:59"), { hour12: 11, minute: 59, meridiem: "PM" });
  assert.deepEqual(clock.parseClock("02:00"), { hour12: 2, minute: 0, meridiem: "AM" });
});

check("24:00 تُقرأ منتصف الليل آخر اليوم، والنص غير الوقت مرفوض", () => {
  assert.deepEqual(clock.parseClock("24:00"), { hour12: 12, minute: 0, meridiem: "AM" });
  assert.equal(clock.parseClock("24:30"), null);
  assert.equal(clock.parseClock("9:00"), null);
  assert.equal(clock.parseClock(""), null);
});

check("الإغلاق عند منتصف الليل يُكتب 24:00، وبداية الفترة 00:00", () => {
  const midnight = { hour12: 12, minute: 0, meridiem: "AM" } as const;
  assert.equal(clock.formatClock(midnight, true), "24:00");
  assert.equal(clock.formatClock(midnight), "00:00");
  assert.equal(clock.formatClock({ hour12: 12, minute: 30, meridiem: "AM" }, true), "00:30");
  assert.equal(clock.formatClock({ hour12: 12, minute: 0, meridiem: "PM" }, true), "12:00");
});

check("الوقت يعود كما كُتب بعد التحويل ذهاباً وإياباً", () => {
  for (const value of ["00:00", "04:15", "09:45", "12:00", "15:00", "22:30", "23:59"]) {
    assert.equal(clock.formatClock(clock.parseClock(value), false), value);
  }
  assert.equal(clock.formatClock(clock.parseClock("24:00"), true), "24:00");
});

check("التاريخ يُقرأ ويُكتب بصيغة YYYY-MM-DD", () => {
  assert.deepEqual(clock.parseDate("2026-10-24"), { year: 2026, month: 10, day: 24 });
  assert.equal(clock.formatDate({ year: 2026, month: 3, day: 5 }), "2026-03-05");
  assert.equal(clock.parseDate("24/10/2026"), null);
});

check("عدد أيام الشهر يراعي السنة الكبيسة", () => {
  assert.equal(clock.daysInMonth(2026, 2), 28);
  assert.equal(clock.daysInMonth(2028, 2), 29);
  assert.equal(clock.daysInMonth(2026, 10), 31);
  assert.equal(clock.daysInMonth(2026, 4), 30);
});

console.log(`\n${passed} tests passed`);
