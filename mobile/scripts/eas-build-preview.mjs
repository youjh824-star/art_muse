/**
 * Preview APK 빌드 — .env 로드 후 EAS Build 실행
 * Usage: node eas-build-preview.mjs [admin|parent]
 */
import { spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const variant = (process.argv[2] || process.env.APP_VARIANT || "admin").toLowerCase();
const platform = (process.argv[3] || "android").toLowerCase();
if (variant !== "admin" && variant !== "parent") {
  console.error("[ArtLog] variant는 admin 또는 parent 여야 합니다.");
  process.exit(1);
}

const mobileDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(mobileDir, ".env");
const profile = variant === "admin" ? "preview-admin" : "preview-parent";

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

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: mobileDir,
    stdio: "inherit",
    shell: true,
    env: process.env,
    ...opts,
  });
  return result.status ?? 1;
}

loadDotEnv(envPath);
process.env.EAS_NO_VCS = "1";
process.env.EAS_PROJECT_ROOT = mobileDir;
process.env.APP_VARIANT = variant;

const openaiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
// preview는 embedded-web을 로컬에서 먼저 빌드하므로 OpenAI 키가 APK에 포함됨 — EAS env 동기화 생략
if (openaiKey && process.env.SYNC_EAS_ENV === "1") {
  console.log("[ArtLog] EAS preview 환경에 OpenAI 키 동기화 중…");
  const syncCode = run("npx", [
    "eas-cli",
    "env:create",
    "--name",
    "EXPO_PUBLIC_OPENAI_API_KEY",
    "--value",
    openaiKey,
    "--environment",
    "preview",
    "--visibility",
    "sensitive",
    "--force",
    "--non-interactive",
  ]);
  if (syncCode !== 0) {
    console.warn(
      "[ArtLog] EAS env 동기화 실패 — eas login 확인 또는 수동 등록:\n" +
        "  npx eas-cli env:create --name EXPO_PUBLIC_OPENAI_API_KEY --value \"sk-...\" --environment preview --visibility sensitive --force"
    );
  } else {
    console.log("[ArtLog] EAS preview 환경에 OpenAI 키 등록 완료");
  }
} else if (!openaiKey) {
  console.warn(
    "[ArtLog] mobile/.env에 EXPO_PUBLIC_OPENAI_API_KEY가 없습니다. APK에서 AI 피드백이 동작하지 않을 수 있습니다."
  );
} else {
  console.log("[ArtLog] preview 빌드 — OpenAI 키는 embedded-web 번들에 포함됨 (EAS env 동기화 생략)");
}

console.log(`[ArtLog] EAS ${profile} 빌드 시작 (${variant}, ${platform})…`);
const code = run("npx", [
  "eas-cli",
  "build",
  "--profile",
  profile,
  "--platform",
  platform,
  "--non-interactive",
]);

process.exit(code);
