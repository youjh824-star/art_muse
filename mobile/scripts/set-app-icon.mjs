/**
 * 소스 PNG → Expo 앱 아이콘 에셋 생성
 * Usage: node scripts/set-app-icon.mjs [source.png]
 */
import { mkdirSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, "..", "assets");
mkdirSync(assetsDir, { recursive: true });

const defaultSource = join(assetsDir, "icon-source.png");

const source = resolve(process.argv[2] || defaultSource);

async function writeSquare(name, size) {
  const out = join(assetsDir, name);
  await sharp(source)
    .resize(size, size, { fit: "cover", position: "centre" })
    .png()
    .toFile(out);
  console.log(`✓ ${out} (${size}×${size})`);
}

async function writeNotificationIcon() {
  const out = join(assetsDir, "notification-icon.png");
  await sharp(source)
    .resize(96, 96, { fit: "cover", position: "centre" })
    .grayscale()
    .negate()
    .png()
    .toFile(out);
  console.log(`✓ ${out} (96×96 notification)`);
}

console.log("Source:", source);
await writeSquare("icon.png", 1024);
await writeSquare("adaptive-icon.png", 1024);
await writeSquare("splash-icon.png", 512);
await writeNotificationIcon();
console.log("Done.");
