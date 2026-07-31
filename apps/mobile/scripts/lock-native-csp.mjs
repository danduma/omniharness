import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativePages = [
  "ios/App/App/public/index.html",
  "ios/App/App/public/app-shell.html",
  "android/app/src/main/assets/public/index.html",
  "android/app/src/main/assets/public/app-shell.html",
];
const nativeCsp = "<meta http-equiv=\"Content-Security-Policy\" content=\"connect-src 'self'\">";

for (const relativePath of nativePages) {
  const filePath = path.join(mobileRoot, relativePath);
  const html = fs.readFileSync(filePath, "utf8");
  const next = html.match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i)
    ? html.replace(
      /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i,
      nativeCsp,
    )
    : html.replace("<head>", `<head>\n    ${nativeCsp}`);
  fs.writeFileSync(filePath, next);
}
