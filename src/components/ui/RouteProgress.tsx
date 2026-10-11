import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useIsFetching } from "@tanstack/react-query";
import clsx from "clsx";

/** أقل مدة يظهر فيها الشريط، حتى لا يومض عند التنقل السريع بين صفحتين مخزّنتين. */
const MIN_VISIBLE_MS = 350;

/**
 * شريط تقدّم رفيع أعلى الصفحة: يظهر مع كل تنقل بين الصفحات ويبقى ما دامت بياناتها تُجلب،
 * ثم يختفي. الشريط يُعاد تركيبه عند كل تنقل (بمفتاح الموقع) فتبدأ مدته من جديد.
 */
export function RouteProgress() {
  const location = useLocation();
  return <ProgressBar key={location.key} />;
}

function ProgressBar() {
  const fetching = useIsFetching() > 0;
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const busy = fetching || !minElapsed;

  return (
    <div
      aria-hidden
      className={clsx(
        "pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] overflow-hidden transition-opacity duration-500",
        busy ? "opacity-100" : "opacity-0"
      )}
    >
      {/* شريط بتدرّج الهوية (الأصفر إلى الأحمر) مع وهج خفيف، يمرّ عبر أعلى الصفحة. */}
      <div
        className="animate-route-slide h-full w-2/5 rounded-full shadow-[0_0_12px_rgba(191,60,60,0.45)]"
        style={{ background: "linear-gradient(90deg, var(--color-primary), var(--color-secondary))" }}
      />
    </div>
  );
}
