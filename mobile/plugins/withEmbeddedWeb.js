const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const WEB_DEST = "web";

function resolveWebSrc(projectRoot) {
  const variant = process.env.APP_VARIANT === "parent" ? "parent" : "admin";
  const preferred = `embedded-web-${variant}`;
  const legacy = "embedded-web";
  if (fs.existsSync(path.join(projectRoot, preferred))) return preferred;
  if (fs.existsSync(path.join(projectRoot, legacy))) return legacy;
  return preferred;
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(
      `[ArtLog] ${path.basename(src)}/ not found — run: npm run bundle:web:${process.env.APP_VARIANT === "parent" ? "parent" : "admin"}`
    );
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
  console.log(`[ArtLog] Copied ${path.basename(src)} → ${dest}`);
}

/** EAS 빌드 시 embedded-web 을 Android assets + iOS bundle 에 복사 */
function withEmbeddedWeb(config) {
  if (process.env.USE_EMBEDDED_WEB !== "1") {
    return config;
  }

  let cfg = withDangerousMod(config, [
    "android",
    async (c) => {
      const root = c.modRequest.projectRoot;
      const webSrc = resolveWebSrc(root);
      const dest = path.join(
        c.modRequest.platformProjectRoot,
        "app/src/main/assets",
        WEB_DEST
      );
      copyDir(path.join(root, webSrc), dest);
      return c;
    },
  ]);

  cfg = withDangerousMod(cfg, [
    "ios",
    async (c) => {
      const root = c.modRequest.projectRoot;
      const webSrc = resolveWebSrc(root);
      const projectName = c.modRequest.projectName;
      const dest = path.join(
        c.modRequest.platformProjectRoot,
        projectName,
        WEB_DEST
      );
      copyDir(path.join(root, webSrc), dest);
      return c;
    },
  ]);

  return cfg;
}

module.exports = withEmbeddedWeb;
