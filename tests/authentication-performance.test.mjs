import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=file=>fs.readFileSync(file,"utf8"),index=read("worker/index.js"),session=read("worker/core/session.js"),app=read("apps/web/assets/app.js"),issues=read("apps/web/assets/issues.js");

test("login returns canonical context without a duplicate bootstrap session request",()=>{
 assert.match(index,/csrfToken:session\.csrf,context:contextResult\.context/);
 assert.match(app,/integrated\.bootstrap/);
 assert.match(app,/sessionStorage\.removeItem\("integrated\.bootstrap"\)/);
 assert.match(app,/data\.context\?\.defaultRoute/);
 assert.doesNotMatch(app,/localStorage\.setItem\([^\n]*(context|token)/i);
});

test("login and session expose safe Server-Timing instrumentation",()=>{
 for(const metric of ["rateLimit","userLookup","credentialVerify","sessionInsert","auditInsert","contextMembership","contextAuthorization","total"])assert.match(index,new RegExp(metric));
 assert.match(index,/server-timing/);
 assert.match(session,/contextWithTiming/);
 assert.match(session,/visibleModulesFromBoards/);
 assert.doesNotMatch(index.match(/const timingHeader[^\n]+/)[0],/(identifier|credential_hash|cookie|pin)/i);
});

test("browser performance and fail-closed cleanup marks are present",()=>{
 for(const mark of ["login-submit","login-response","context-ready","shell-render-start","shell-first-usable"])assert.match(app,new RegExp(mark));
 for(const mark of ["issue-route-start","issue-list-response","issue-first-usable"])assert.match(issues,new RegExp(mark));
 assert.match(issues,/replaceChildren\(\)/);
 assert.match(issues,/OFFLINE|오프라인/);
});
