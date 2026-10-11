import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/i18n";
import "./index.css";
import App from "@/app/App";

const container = document.getElementById("root");
if (!container) {
  throw new Error("عنصر الجذر #root غير موجود في index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
