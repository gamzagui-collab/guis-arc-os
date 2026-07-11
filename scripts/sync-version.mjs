import fs from "node:fs";
const versionPath = "frontend/js/services/version.js";
const versionJs = fs.readFileSync(versionPath, "utf8");
const version = versionJs.match(/APP_VERSION\s*=\s*"([^"]+)"/)?.[1];
if(!version) throw new Error("APP_VERSION을 찾을 수 없습니다.");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.version = version;
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
for(const file of ["wrangler.toml", "wrangler.worker.toml"]){
  let text = fs.readFileSync(file, "utf8");
  text = text.replace(/APP_VERSION\s*=\s*"[^"]+"/, `APP_VERSION = "${version}"`);
  fs.writeFileSync(file, text);
}
console.log(`Synced GUI's Arc OS version to ${version}`);
