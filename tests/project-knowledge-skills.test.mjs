import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=file=>fs.readFileSync(file,"utf8");
test("startup contract stays lean and current",()=>{for(const [file,max] of[["AGENTS.md",50],["DEVELOPMENT_RULES.md",80],["AIOS/PROJECT_STATE.md",30],["AIOS/NEXT_TASK.md",15]])assert.ok(read(file).split(/\r?\n/).length<=max,file);for(const file of["AIOS/00_PROJECT.md","AIOS/12_NEXT_CHAT.md","docs/98_NEXT_CHAT_HANDOFF.md","docs/99_START_NEXT_CHAT.md"])assert.equal(fs.existsSync(file),false,file);for(const token of["v0.27.1","v0.27.1-r38","1ff43bb5c93d921df83b11d15aa8735108ded812"])assert.ok(read("AIOS/PROJECT_STATE.md").includes(token))});
test("package keeps current knowledge and skill roots",()=>{const pack=read("scripts/package-integrated.mjs");assert.match(pack,/"AIOS"/);assert.match(pack,/"\.agents"/)});
