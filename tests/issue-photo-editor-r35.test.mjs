import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("cloud editor module exposes a closed curve path inside the drag box",()=>{
 const source=fs.readFileSync(new URL("../apps/web/assets/issue-photo-editor.js",import.meta.url),"utf8");
 assert.match(source,/export function drawCloudPath/);
 assert.match(source,/ctx\.moveTo/);
 assert.match(source,/ctx\.bezierCurveTo/);
 assert.match(source,/ctx\.closePath\(\)/);
});

test("r37 mobile editor puts four colors first and width plus move on the second row",()=>{
 const css=fs.readFileSync(new URL("../apps/web/assets/issues.css",import.meta.url),"utf8");
 assert.match(css,/\.editor-operation-group/);
 assert.match(css,/\.editor-color-palette\{[^}]*grid-template-columns:repeat\(4,44px\)/);
 assert.match(css,/@media\(max-width:760px\)[\s\S]*\.editor-operation-group\{[^}]*grid-template-areas:"palette palette" "width move"[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(72px,88px\)/);
 assert.match(css,/@media\(max-width:760px\)[\s\S]*\.editor-color-palette\{[^}]*grid-area:palette[^}]*justify-content:space-between/);
 assert.match(css,/@media\(max-width:760px\)[\s\S]*\.editor-width-control\{[^}]*grid-area:width[^}]*width:100%/);
 assert.match(css,/@media\(max-width:760px\)[\s\S]*\.editor-scroll-button\{[^}]*grid-area:move[^}]*width:100%[^}]*white-space:nowrap/);
 assert.doesNotMatch(css,/\.editor-color-palette\{[^}]*overflow-x:(?:auto|scroll)/);
});

test("r36 fixture matches the real full detail DOM and overrides the legacy mobile full rule",()=>{
 const fixture=fs.readFileSync(new URL("./fixtures/r36-mobile-issue-layout.html",import.meta.url),"utf8");
 const css=fs.readFileSync(new URL("../apps/web/assets/issues.css",import.meta.url),"utf8");
 assert.match(fixture,/class="full detail-location-field"/);
 assert.match(fixture,/class="issue-form mobile-issue-form"/);
 assert.match(css,/@media\(max-width:760px\)[\s\S]*\.issue-form \.detail-location-field\{grid-column:1\/-1\}/);
 assert.doesNotMatch(css,/\.issue-form \.detail-location-field\{[^}]*!important/);
});

test("r37 mobile toolbar preserves four 44px color targets without horizontal scroll",()=>{
 const css=fs.readFileSync(new URL("../apps/web/assets/issues.css",import.meta.url),"utf8");
 assert.match(css,/@media\(max-width:760px\)[\s\S]*\.editor-operation-group\{[^}]*width:100%[^}]*max-width:100%/);
 assert.match(css,/\.editor-color-palette\{[^}]*grid-template-columns:repeat\(4,44px\)/);
 assert.match(css,/\.editor-color-button\{[^}]*min-width:44px;min-height:44px/);
});
