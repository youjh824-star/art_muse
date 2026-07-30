// 시스템 공지 자동 등록 스크립트
// 사용법:
//   node scripts/post-system-notice.mjs --admin-version v1.0.10 --parent-version v1.0.9 \
//     --item "전체 UI 아이콘 개편" --item "버그 수정" [--important] [--no-homepage] [--no-push]
//
// 동작:
//   1) system_notices 테이블에 공지 등록 (SUPABASE_SERVICE_ROLE_KEY로 RLS 우회)
//   2) index.html의 "최근 업데이트" 목록을 동일 항목으로 갱신 후 git commit + push
//   3) 전체 사용자(원장+학부모)에게 푸시 알림 발송
//
// 이 스크립트는 로컬 빌드 환경에서만 실행하세요 (서비스 키를 앱에 절대 포함하지 마세요).

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

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
    else if (a === "--no-homepage") args.noHomepage = true;
    else if (a === "--no-push") args.noPush = true;
  }
  return args;
}

/** index.html의 두 dl-changelog <ul> 블록(원장/학부모)을 최신 항목으로 교체 */
function updateHomepageChangelog(items) {
  const htmlPath = join(REPO_ROOT, "index.html");
  const html = readFileSync(htmlPath, "utf8");
  const newList = `<ul>\n${items.map((i) => `          <li>${i}</li>`).join("\n")}\n        </ul>`;
  const pattern = /<ul>\s*(?:<li>[\s\S]*?<\/li>\s*)+<\/ul>/g;
  let count = 0;
  const updated = html.replace(pattern, (match, offset) => {
    // dl-changelog 블록 안의 <ul>만 교체 (앞쪽 컨텍스트로 판별)
    const before = html.slice(Math.max(0, offset - 120), offset);
    if (!before.includes("dl-changelog-title")) return match;
    count++;
    return newList;
  });
  if (count === 0) {
    console.log("[Homepage] dl-changelog <ul> 블록을 찾지 못했습니다 - 건너뜀");
    return false;
  }
  writeFileSync(htmlPath, updated, "utf8");
  console.log(`[Homepage] index.html 업데이트 내역 ${count}곳 갱신 완료`);
  return true;
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

  // 홈페이지(index.html) 최근 업데이트 내역도 함께 갱신 + 커밋 + 푸시
  if (!args.noHomepage) {
    const changed = updateHomepageChangelog(args.items);
    if (changed) {
      try {
        execSync("git add index.html", { cwd: REPO_ROOT, stdio: "inherit" });
        execSync(
          `git commit -m "홈페이지: 최근 업데이트 내역 갱신 (${versionLabel || title})"`,
          { cwd: REPO_ROOT, stdio: "inherit" }
        );
        execSync("git push origin main", { cwd: REPO_ROOT, stdio: "inherit" });
        console.log("[Homepage] 커밋 & 푸시 완료 - artlogapp.com에 곧 반영됩니다");
      } catch (e) {
        console.error("WARNING: 홈페이지 커밋/푸시 실패 (수동으로 처리 필요):", e.message);
      }
    }
  }

  // 전체 사용자(원장+학부모)에게 푸시 발송 — profiles.push_token은 RLS로 보호되므로 서비스 키로만 조회 가능
  if (args.noPush) return;
  try {
    const { data: rows, error: pushErr } = await sb
      .from("profiles")
      .select("push_token")
      .not("push_token", "is", null);
    if (pushErr) throw pushErr;
    const tokens = [...new Set((rows ?? []).map((r) => r.push_token).filter(Boolean))];
    if (!tokens.length) {
      console.log("[SystemNotice] 푸시 대상 토큰 없음 - 알림 발송 생략");
      return;
    }
    const res = await fetch(`${url}/functions/v1/push-notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        tokens,
        title: args.important ? `📢 중요 공지: ${title}` : `📢 ${title}`,
        body: "새로운 시스템 공지가 등록되었습니다. 앱에서 확인해 주세요.",
        data: { type: "system_notice" },
      }),
    });
    const result = await res.json();
    console.log(`[SystemNotice] 푸시 발송 완료 (${tokens.length}명 대상)`, result.sent != null ? `sent=${result.sent}` : "");
  } catch (e) {
    console.error("WARNING: 푸시 발송 실패:", e.message);
  }
}

main();
