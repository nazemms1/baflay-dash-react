import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { CrudPage } from "@/components/crud/CrudPage";
import type { CrudModule } from "@/components/crud/types";

/**
 * يبني تعريف الوحدة بلغة الواجهة الحالية ثم يعرضها. التعريف يعتمد على `t`
 * لتسميات الحقول والخيارات، فيُعاد بناؤه عند تبديل اللغة.
 */
export function ModuleRoute<T extends { id: number | string }>({
  build,
}: {
  build: (t: TFunction) => CrudModule<T>;
}) {
  const { t } = useTranslation();
  const module = useMemo(() => build(t as unknown as TFunction), [build, t]);
  return <CrudPage module={module} />;
}
