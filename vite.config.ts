import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
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
