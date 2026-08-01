import fs from "node:fs";
import zlib from "node:zlib";
const shellFiles = ["dist/assets/app.js", "dist/assets/app.css", "dist/packages/ui/components.js", "dist/packages/permissions/modules.js"];
const issueFiles = ["dist/assets/issues.js", "dist/assets/issues.css"];
const todayFiles = ["dist/assets/today.js", "dist/assets/today.css"];
const workforceFiles = ["dist/assets/workforce.js", "dist/assets/workforce.css", "dist/assets/qrcode-vendor.js"];
const constructionFiles = ["dist/assets/construction.js", "dist/assets/construction.css"];
const report = { assets: {} };
for (const file of [...shellFiles, ...issueFiles, ...todayFiles, ...workforceFiles, ...constructionFiles]) {
  const raw = fs.readFileSync(file);
  report.assets[file] = { rawBytes: raw.length, gzipBytes: zlib.gzipSync(raw).length };
}
const total = (files) => files.reduce((sum, file) => sum + report.assets[file].gzipBytes, 0);
report.shell = { gzipBytes: total(shellFiles), budgetBytes: 153600 };
report.issueLazyBundle = { gzipBytes: total(issueFiles), budgetBytes: 102400 };
report.todayLazyBundle = { gzipBytes: total(todayFiles), budgetBytes: 51200 };
report.workforceLazyBundle = { gzipBytes: total(workforceFiles), budgetBytes: 102400 };
report.constructionLazyBundle = { gzipBytes: total(constructionFiles), budgetBytes: 102400 };
report.pass = report.shell.gzipBytes <= report.shell.budgetBytes && report.issueLazyBundle.gzipBytes <= report.issueLazyBundle.budgetBytes && report.todayLazyBundle.gzipBytes <= report.todayLazyBundle.budgetBytes && report.workforceLazyBundle.gzipBytes <= report.workforceLazyBundle.budgetBytes && report.constructionLazyBundle.gzipBytes <= report.constructionLazyBundle.budgetBytes;
fs.writeFileSync("dist/performance-report.json", JSON.stringify(report, null, 2));
if (!report.pass) throw new Error("Shell, Issue, or Today lazy bundle gzip budget exceeded");
console.log(JSON.stringify(report));
