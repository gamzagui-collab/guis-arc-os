import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const read = (path) => fs.readFileSync(path, "utf8");

test("build normalizes package imports for the deployed web root", () => {
  execFileSync(process.execPath, ["scripts/build.mjs"]);
  const files = fs.readdirSync("dist/assets").filter((name) => name.endsWith(".js"));
  for (const file of files) {
    const source = read(`dist/assets/${file}`);
    assert.doesNotMatch(source, /\.\.\/\.\.\/\.\.\/packages\//, `${file} contains a deploy-invalid package import`);
  }
  assert.match(read("dist/assets/app.js"), /from "\/packages\/permissions\/modules\.js"/);
  assert.match(read("dist/assets/app.js"), /from "\/packages\/ui\/components\.js"/);
  assert.ok(fs.existsSync("dist/packages/permissions/modules.js"));
  assert.ok(fs.existsSync("dist/packages/ui/components.js"));
});

test("Pages worker prevents HTML fallback for static assets", () => {
  const worker = read("apps/web/_worker.js");
  assert.match(worker, /isStaticAssetPath/);
  assert.match(worker, /"\/packages\/"/);
  assert.match(worker, /status: 404/);
  assert.match(worker, /new URL\("\/index\.html"/);
  assert.doesNotMatch(read("apps/web/_redirects"), /^\/\*\s+\/index\.html\s+200/m);
});
