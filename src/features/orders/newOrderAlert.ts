import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toNumber } from "@/lib/coerce";
import { orderAdmin } from "@/services";
import { countArrivals } from "./orderArrivals";
import { playNewOrderChime } from "./orderSound";
import { showNewOrdersToast } from "./showNewOrdersToast";

const STORAGE_KEY = "orders.newOrderSound";
const POLL_INTERVAL_MS = 25_000;

function readStoredPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function storePreference(value: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // التفضيل يبقى لهذه الجلسة فقط إن منع المتصفح التخزين.
  }
}

/**
 * تنبيه الطلبات الجديدة بالاستعلام الدوري. أحدث 20 طلباً تُجلب كل 25 ثانية، ويُعد الطلب جديداً إن
 * ظهر برقم أكبر من كل ما رأيناه. هذا الاستعلام لا يتأثر بفلاتر الصفحة، فتغيير الفلتر لا يُطلق تنبيهاً كاذباً.
 * الطلبات الموجودة عند فتح الصفحة لا تُعلن، والقياس يبدأ من أول جلب من الخادم بعد الفتح،
 * فالبيانات المخزّنة من زيارة سابقة لا تدخل فيه.
 */
export function useNewOrderAlert(enabled: boolean, onView?: () => void) {
  const queryClient = useQueryClient();
  const [soundOn, setSoundOn] = useState(readStoredPreference);
  const baseline = useRef<number | null>(null);
  // زر "عرض الأحدث" في التنبيه يستدعي أحدث نسخة من `onView`، فلا يُعاد إنشاء التنبيه مع كل رسم.
  const onViewRef = useRef(onView);
  useEffect(() => {
    onViewRef.current = onView;
  }, [onView]);

  const latest = useQuery({
    queryKey: ["orders", "new-order-alert"],
    enabled,
    // كل فتح للصفحة يجلب القائمة من الخادم، فالخط الأساسي لا يُؤخذ من الذاكرة المخزّنة.
    refetchOnMount: "always",
    refetchInterval: POLL_INTERVAL_MS,
    // التبويب المخفي لا يستعلم، فلا حمل على الخادم من صفحة لا يراها أحد.
    refetchIntervalInBackground: false,
    queryFn: ({ signal }) => orderAdmin.list({ page: 1, perPage: 20 }, signal),
  });

  // البيانات التي كانت في الذاكرة عند الفتح لا تُقاس بها: القياس يبدأ من جلب وصل بعد الفتح.
  const [cachedAt] = useState(latest.dataUpdatedAt);
  const fetchedHere = latest.dataUpdatedAt !== cachedAt;
  const data = latest.data;

  useEffect(() => {
    if (!data || !fetchedHere) return;
    const { arrived, next } = countArrivals(
      baseline.current,
      data.items.map((row) => toNumber(row.id))
    );
    baseline.current = next;
    if (arrived === 0) return;

    if (soundOn) playNewOrderChime();
    showNewOrdersToast(arrived, () => onViewRef.current?.());
    // قائمة الصفحة تُحدَّث لتظهر الطلبات الجديدة، بفلاترها الحالية.
    void queryClient.invalidateQueries({ queryKey: ["orders", "admin"] });
  }, [data, fetchedHere, soundOn, queryClient]);

  const toggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundOn(next);
    storePreference(next);
    // النقرة تفتح الصوت في المتصفح، والنغمة تؤكد للمستخدم أنه فعّله.
    if (next) playNewOrderChime();
  }, [soundOn]);

  return { soundOn, toggleSound };
}
