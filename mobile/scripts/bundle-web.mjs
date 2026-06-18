/**
 * Vite 웹앱을 mobile/embedded-web-{variant} 에 빌드 (스토어 APK/AAB용 오프라인 번들)
 * Usage: node bundle-web.mjs [admin|parent]
 */
import { execSync } from "child_process";
import { existsSync, readFileSync, copyFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const variant = (process.argv[2] || process.env.APP_VARIANT || "admin").toLowerCase();
if (variant !== "admin" && variant !== "parent") {
  console.error("[ArtLog] variant는 admin 또는 parent 여야 합니다.");
  process.exit(1);
}
const isV2 = process.argv[3] === "v2" || process.env.APP_V2 === "1";

const mobileDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = path.resolve(mobileDir, "..");
const outDir = path.join(mobileDir, `embedded-web-${variant}`);
const viteMode = isV2
  ? (variant === "admin" ? "mobile-admin-v2" : "mobile-parent-v2")
  : (variant === "admin" ? "mobile-admin" : "mobile-parent");

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv(path.join(appRoot, ".env"));
loadDotEnv(path.join(mobileDir, ".env"));

const openaiKey =
  process.env.VITE_OPENAI_API_KEY ||
  process.env.EXPO_PUBLIC_OPENAI_API_KEY ||
  process.env.OPENAI_API_KEY;

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (openaiKey) {
  process.env.VITE_OPENAI_API_KEY = openaiKey;
  console.log("[ArtLog] embedded-web 빌드에 OpenAI 키 포함");
}
if (supabaseUrl && supabaseAnon) {
  process.env.VITE_SUPABASE_URL = supabaseUrl;
  process.env.VITE_SUPABASE_ANON_KEY = supabaseAnon;
  console.log("[ArtLog] embedded-web 빌드에 Supabase 키 포함");
} else {
  console.warn("[ArtLog] Supabase env 없음 — .env에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 추가");
}

console.log(`[ArtLog] Building ${variant} web app for native embed (${viteMode})…`);
execSync(`npm.cmd run build -- --mode ${viteMode}`, {
  cwd: appRoot,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, VITE_APP_ROLE: variant },
});

const expectedHtml = isV2 ? "index-v2.html" : "index.html";
if (!existsSync(path.join(outDir, expectedHtml))) {
  console.error(`[ArtLog] Build failed: ${outDir}/${expectedHtml} not found`);
  process.exit(1);
}

if (isV2) {
  copyFileSync(path.join(outDir, "index-v2.html"), path.join(outDir, "index.html"));
  console.log("[ArtLog] index-v2.html → index.html (WebView entry)");
}

console.log("[ArtLog] Done:", outDir);
