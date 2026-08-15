import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const root=new URL("..",import.meta.url),expected=["guis-arc-work","guis-arc-debug","guis-arc-data-change","guis-arc-deploy","guis-arc-release"].sort();
test("project exposes exactly five operational skills",()=>{const dirs=fs.readdirSync(new URL(".agents/skills",root),{withFileTypes:true}).filter(entry=>entry.isDirectory()&&fs.existsSync(new URL(`.agents/skills/${entry.name}/SKILL.md`,root))).map(entry=>entry.name).sort();assert.deepEqual(dirs,expected)});
test("each project skill has concise trigger metadata",()=>{for(const name of expected){const text=fs.readFileSync(new URL(`.agents/skills/${name}/SKILL.md`,root),"utf8");assert.match(text,new RegExp(`^---\\r?\\nname: ${name}\\r?\\ndescription: Use when `));assert.ok(text.split(/\r?\n/).length<=30,name)}});
