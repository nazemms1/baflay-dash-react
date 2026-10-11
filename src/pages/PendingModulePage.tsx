import { useTranslation } from "react-i18next";
import { Panel } from "@/components/ui/Panel";

/**
 * وحدة لم تُنقل بعد. تبقى في القائمة كي لا تختفي وظيفة من النظام القديم دون
 * أن يلاحظ أحد، وتقول بوضوح أنها قيد النقل بدل أن تعرض شاشة مكسورة.
 */
export function PendingModulePage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t(titleKey)}</h1>
      <Panel>
        <p className="text-sm text-muted">{t("common.pendingModule")}</p>
      </Panel>
    </div>
  );
}
