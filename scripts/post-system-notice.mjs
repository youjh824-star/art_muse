// 시스템 공지 자동 등록 스크립트
// 사용법:
//   node scripts/post-system-notice.mjs --admin-version v1.0.10 --parent-version v1.0.9 \
//     --item "전체 UI 아이콘 개편" --item "버그 수정" [--important]
//
// SUPABASE_SERVICE_ROLE_KEY(.env)로 RLS를 우회해 system_notices에 직접 등록합니다.
// 이 스크립트는 로컬 빌드 환경에서만 실행하세요 (서비스 키를 앱에 절대 포함하지 마세요).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, "..", ".env");
  const text = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function parseArgs(argv) {
  const args = { items: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--admin-version") args.adminVersion = argv[++i];
    else if (a === "--parent-version") args.parentVersion = argv[++i];
    else if (a === "--item") args.items.push(argv[++i]);
    else if (a === "--title") args.title = argv[++i];
    else if (a === "--important") args.important = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.items.length) {
    console.error("ERROR: --item 을 1개 이상 지정하세요.");
    process.exit(1);
  }

  const env = { ...loadEnv(), ...process.env };
  const url = env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("ERROR: VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env에 없습니다.");
    process.exit(1);
  }

  const versionLabel = [
    args.adminVersion ? `원장 ${args.adminVersion}` : null,
    args.parentVersion ? `학부모 ${args.parentVersion}` : null,
  ].filter(Boolean).join(" · ");

  const title = args.title || `앱 업데이트 안내${versionLabel ? ` (${versionLabel})` : ""}`;

  const content =
    `이번 업데이트 내용은 이렇습니다.\n\n` +
    args.items.map((i) => `- ${i}`).join("\n") +
    `\n\nhttps://artlogapp.com/ 홈페이지에서 다운로드해서 앱을 업데이트 해주세요.`;

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("system_notices")
    .insert({ title, content, important: !!args.important })
    .select()
    .single();

  if (error) {
    console.error("ERROR: 공지 등록 실패:", error.message);
    process.exit(1);
  }

  console.log("[SystemNotice] 등록 완료");
  console.log(`  제목: ${data.title}`);
  console.log(`  내용:\n${data.content.split("\n").map((l) => "    " + l).join("\n")}`);
}

main();
