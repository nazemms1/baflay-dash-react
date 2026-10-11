import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ErrorState, EmptyState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Bars";
import { ApiError } from "@/lib/http/errors";

/**
 * حالة القسم الواحد: تحميل بهيكل، أو خطأ مع إعادة المحاولة، أو المحتوى.
 * كل قسم يملك حالته، فلا تُخفي شاشةٌ كاملةٌ بسبب قسم واحد متعثّر.
 */
export function QueryBody<T>({
  query,
  skeleton,
  children,
}: {
  query: UseQueryResult<T>;
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const { t } = useTranslation();

  if (query.isError) {
    return (
      <ErrorState
        message={query.error instanceof ApiError ? query.error.message : t("errors.unexpected")}
        onRetry={() => void query.refetch()}
        error={query.error}
      />
    );
  }

  if (query.isPending || query.data === undefined) {
    return skeleton ?? <Skeleton className="h-40" />;
  }

  return <>{children(query.data)}</>;
}

export function NoRows({ children }: { children: ReactNode }) {
  return <EmptyState>{children}</EmptyState>;
}
