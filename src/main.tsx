import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/i18n";
import "./index.css";
import { isConfigMissing } from "@/config/env";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfigErrorScreen } from "@/components/ErrorScreen";
import App from "@/app/App";

const container = document.getElementById("root");
if (!container) {
  throw new Error("عنصر الجذر #root غير موجود في index.html");
}

// أي خطأ أثناء الرسم يعرض رسالة مهذبة بدل صفحة بيضاء، وإعداد ناقص يعرض شاشته الخاصة.
createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>{isConfigMissing ? <ConfigErrorScreen /> : <App />}</ErrorBoundary>
  </StrictMode>
);
