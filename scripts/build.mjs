import fs from "node:fs";
import path from "node:path";

fs.rmSync("dist", { recursive: true, force: true });
fs.cpSync("apps/web", "dist", { recursive: true });
fs.mkdirSync("dist/templates", { recursive: true });
fs.copyFileSync("apps/web/templates/GUI_Arc_현장위치목록_기본서식_v2.xlsx", "dist/templates/GUI_Arc_현장위치목록_기본서식_v2.xlsx");

for (const dir of ["design-tokens", "ui", "permissions"]) {
  fs.mkdirSync(`dist/packages/${dir}`, { recursive: true });
}
fs.copyFileSync("packages/design-tokens/tokens.css", "dist/packages/design-tokens/tokens.css");
fs.copyFileSync("packages/ui/components.js", "dist/packages/ui/components.js");
fs.copyFileSync("packages/permissions/modules.js", "dist/packages/permissions/modules.js");
fs.copyFileSync("packages/permissions/issue-assignee-response.js", "dist/packages/permissions/issue-assignee-response.js");

// Source files use repository-relative imports for Node tests. After copying to
// dist/assets those paths would escape the deployed web root, so normalize the
// browser build to stable root-relative URLs.
for (const entry of fs.readdirSync("dist/assets", { withFileTypes: true })) {
  if (!entry.isFile() || ![".js", ".css"].includes(path.extname(entry.name))) continue;
  const file = path.join("dist/assets", entry.name);
  const source = fs.readFileSync(file, "utf8")
    .replaceAll('"../../../packages/', '"/packages/')
    .replaceAll("'../../../packages/", "'/packages/");
  fs.writeFileSync(file, source);
}

const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
const sizes = Object.fromEntries(
  ["app.css", "app.js", "issues.css", "issues.js", "today.css", "today.js", "workforce.css", "workforce.js", "construction.css", "construction.js"]
    .map((name) => [name, fs.statSync(`dist/assets/${name}`).size])
);
fs.writeFileSync("dist/build.json", JSON.stringify({ version, assets: sizes, builtAt: new Date().toISOString() }, null, 2));
console.log(`Build completed: shell JS ${sizes["app.js"]} bytes, Issue JS ${sizes["issues.js"]} bytes, Today JS ${sizes["today.js"]} bytes`);
