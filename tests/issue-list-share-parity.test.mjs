import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const js=fs.readFileSync("apps/web/assets/issues.js","utf8");
const css=fs.readFileSync("apps/web/assets/issues.css","utf8");

const extract=(start,end)=>{
  const from=js.indexOf(start),to=js.indexOf(end,from+start.length);
  assert.notEqual(from,-1,`missing ${start}`);
  assert.notEqual(to,-1,`missing ${end}`);
  return js.slice(from,to);
};

test("Issue list renders sharing only for an Issue with a creation photo",()=>{
  const helper=extract("const issueHasShareablePhoto=","function bindIssueListShareActions");
  assert.match(helper,/creationMediaCount/);
  assert.match(helper,/thumbnailUrl/);
  assert.match(helper,/공유하기/);
  assert.match(helper,/data-issue-list-share/);
  assert.doesNotMatch(helper,/canvas|toBlob|fitWatermarkLocation|formatIssuePhotoDateKst/);
});

test("mobile cards and the PC list reuse the same list share renderer",()=>{
  const card=extract("const card=","async function expandCard");
  const pc=extract("const render=total=>","const bind=total=>");
  assert.match(card,/issueListShareAction\(issue\)/);
  assert.match(pc,/issueListShareAction\(issue\)/);
});

test("list share click delegates the exact Issue to the existing common share entry point",async()=>{
  const source=extract("function bindIssueListShareActions","async function createSharePhoto");
  const bind=new Function(`${source}; return bindIssueListShareActions`)();
  const issue={id:"issue-v3",location:"201동 / 19층 / 1903호 / 거실 벽면 명갈이",creationMediaCount:1};
  const output={};
  const button={dataset:{issueListShare:"issue-v3"},onclick:null,closest:()=>({querySelector:()=>output})};
  const root={querySelectorAll:()=>[button]};
  const calls=[];
  bind(root,[issue],async(value,status)=>calls.push([value,status]));
  await button.onclick();
  assert.deepEqual(calls,[[issue,output]]);
});

test("list sharing and photo view both resolve through shareIssuePhoto without a second watermark pipeline",()=>{
  const binding=extract("function bindIssueListShareActions","async function createSharePhoto");
  const slides=extract("function bindIssueSlides","async function list");
  assert.match(binding,/shareIssuePhoto/);
  assert.match(slides,/shareIssuePhoto/);
  assert.equal((binding.match(/shareIssuePhoto/g)||[]).length,1);
  assert.doesNotMatch(binding,/canvas|toBlob|createImageBitmap|navigator\.share|URL\.createObjectURL/);
});

test("r29 common share pipeline derives one structural header and one normalized content block",()=>{
 const pipeline=extract("createSharePhoto=async function","const downloadIssueShareFile");
 assert.match(pipeline,/issueShareDisplay\(issue\)/);
 assert.match(pipeline,/display\.location/);
 assert.match(pipeline,/display\.content/);
 assert.doesNotMatch(pipeline,/issue\.location\|\|"위치 정보 없음"/);
});

test("list share markup preserves v3 and historical location text and stays mobile-safe",()=>{
  assert.match(js,/issue\.location/);
  assert.match(js,/room_location_id|roomLocationId/);
  assert.match(css,/issue-list-share-actions/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/overflow-x:hidden/);
});
