import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function resolveAppRole(mode, env) {
  if (mode === "admin" || mode === "mobile-admin" || mode === "mobile-admin-v2" || mode === "web-admin-v2") return "admin";
  if (mode === "parent" || mode === "mobile-parent" || mode === "mobile-parent-v2" || mode === "web-parent-v2") return "parent";
  return env.VITE_APP_ROLE || "";
}

function resolveMobileOutDir(role) {
  if (role === "admin") return "mobile/embedded-web-admin";
  if (role === "parent") return "mobile/embedded-web-parent";
  return "mobile/embedded-web";
}

function isV2Mode(mode) {
  return mode.includes("v2");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const appRole = resolveAppRole(mode, env);
  const isMobileBuild = mode.startsWith("mobile");
  const v2 = isV2Mode(mode);
  const openaiKey =
    env.VITE_OPENAI_API_KEY || env.OPENAI_API_KEY || env.EXPO_PUBLIC_OPENAI_API_KEY;

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_APP_ROLE": JSON.stringify(appRole),
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(v2 ? "2" : "1"),
    },
    base: isMobileBuild ? "./" : "/",
    build: isMobileBuild
      ? {
          outDir: resolveMobileOutDir(appRole),
          emptyOutDir: true,
          rollupOptions: v2 ? { input: "index-v2.html" } : undefined,
        }
      : v2
      ? { rollupOptions: { input: "index-v2.html" } }
      : undefined,
    server: {
      host: true,
      port: appRole === "parent" ? 5175 : 5174,
      strictPort: true,
      proxy: openaiKey
        ? {
            "/api/openai": {
              target: "https://api.openai.com",
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api\/openai/, ""),
              headers: {
                Authorization: `Bearer ${openaiKey}`,
              },
            },
          }
        : undefined,
    },
  };
});
