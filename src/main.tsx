import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/i18n";
import "./index.css";
import { isConfigMissing } from "@/config/env";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfigErrorScreen } from "@/components/ErrorScreen";
import App from "@/app/App";
import { initInstallPrompt } from "@/features/pwa/install";
import { registerServiceWorker } from "@/features/pwa/serviceWorker";

// التثبيت كتطبيق على الهاتف: يُهيّأ قبل الرسم حتى لا يفوتنا حدث التثبيت الذي يصل مرة واحدة.
initInstallPrompt();
registerServiceWorker();

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
