import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

/** رقم الـ commit القصير، أو `dev` إن لم يكن المشروع داخل مستودع git. */
function gitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "dev";
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    // معلومات الإصدار تُحقن وقت البناء، فتظهر في التطبيق دون أن يقرأ المتصفح ملفات المشروع.
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_COMMIT__: JSON.stringify(gitCommit()),
      __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    },
    // الصور المحفوظة في الخادم تمر عبر الموقع نفسه في التطوير، فيقرؤها المتصفح للقص دون قيود
    // المصدر المختلف. في الإنتاج يلزم أن يسمح الخادم بقراءة مسار الصور نفسه.
    server: env.VITE_API_URL
      ? {
          proxy: {
            "/storage": {
              target: new URL(env.VITE_API_URL).origin,
              changeOrigin: true,
            },
          },
        }
      : undefined,
  };
});
