import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { toNumber } from "@/lib/coerce";
import { orderAdmin } from "@/services";
import { playNewOrderChime } from "./orderSound";

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
 * تنبيه الطلبات الجديدة بالاستعلام الدوري. أحدث 20 طلباً تُجلب كل 25 ثانية، وأي رقم لم نره بعد
 * يعني طلباً جديداً. هذا الاستعلام لا يتأثر بفلاتر الصفحة، فتغيير الفلتر لا يُطلق تنبيهاً كاذباً.
 * التحميل الأول يحفظ الأرقام الحالية دون صوت، حتى لا يرن على طلبات قديمة.
 */
export function useNewOrderAlert(enabled: boolean) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [soundOn, setSoundOn] = useState(readStoredPreference);
  const seen = useRef<Set<number>>(new Set());
  const seeded = useRef(false);

  const latest = useQuery({
    queryKey: ["orders", "new-order-alert"],
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
    // التبويب المخفي لا يستعلم، فلا حمل على الخادم من صفحة لا يراها أحد.
    refetchIntervalInBackground: false,
    queryFn: ({ signal }) => orderAdmin.list({ page: 1, perPage: 20 }, signal),
  });

  const data = latest.data;
  useEffect(() => {
    if (!data) return;
    const ids = data.items.map((row) => toNumber(row.id));

    if (!seeded.current) {
      ids.forEach((id) => seen.current.add(id));
      seeded.current = true;
      return;
    }

    const fresh = ids.filter((id) => !seen.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => seen.current.add(id));

    if (soundOn) playNewOrderChime();
    toast.info(t("ordersPage.newOrders", { count: fresh.length }));
    // قائمة الصفحة تُحدَّث لتظهر الطلبات الجديدة، بفلاترها الحالية.
    void queryClient.invalidateQueries({ queryKey: ["orders", "admin"] });
  }, [data, soundOn, queryClient, t]);

  const toggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundOn(next);
    storePreference(next);
    // النقرة تفتح الصوت في المتصفح، والنغمة تؤكد للمستخدم أنه فعّله.
    if (next) playNewOrderChime();
  }, [soundOn]);

  return { soundOn, toggleSound };
}
