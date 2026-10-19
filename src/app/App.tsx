import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { router } from "./router";
import { setSessionExpiredHandler } from "@/lib/http/client";
import { setForbiddenHandler } from "@/lib/http/forbidden";
import { useSession } from "@/features/auth/session-store";
import { ApiError } from "@/lib/http/errors";
import { UpdatePrompt } from "@/features/pwa/UpdatePrompt";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // الأخطاء المتكررة من الخادم (403، 404، 422) لا تستحق إعادة المحاولة.
      retry: (failureCount, error) => {
        const status = error instanceof ApiError ? error.status : null;
        const isClientError = status !== null && status >= 400 && status < 500;
        return !isClientError && failureCount < 1;
      },
    },
  },
});

export default function App() {
  useEffect(() => {
    setSessionExpiredHandler(() => {
      useSession.getState().expire();
      void router.navigate("/login", { replace: true });
    });
    // الخروج يُبلغ الخادم ثم يعيد إلى شاشة الدخول.
    setForbiddenHandler(() => {
      void useSession
        .getState()
        .signOut()
        .finally(() => void router.navigate("/login", { replace: true }));
    });
    void useSession.getState().hydrate();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* بلا انتقالات React: تبدأ مؤشرات التحميل فوراً عند التنقل، بدل إبقاء الصفحة القديمة حتى تكتمل الجديدة. */}
      <RouterProvider router={router} useTransitions={false} />
      <Toaster position="top-center" richColors closeButton />
      <UpdatePrompt />
    </QueryClientProvider>
  );
}
