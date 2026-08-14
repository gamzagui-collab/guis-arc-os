import test from "node:test";
import assert from "node:assert/strict";

import {fitWatermarkLocation,formatIssuePhotoDateKst,issueShareDisplay,issueShareWatermarkLayout,wrapWatermarkContent} from "../apps/web/assets/issue-share-watermark.js";

test("share watermark formats the stored Issue timestamp in KST with Korean weekday",()=>{
 assert.equal(formatIssuePhotoDateKst("2026-08-13 15:30:00"),"2026.08.14(금)");
 assert.equal(formatIssuePhotoDateKst("2026-08-14T23:30:00Z"),"2026.08.15(토)");
});

test("share watermark date stays based on the stored timestamp",()=>{
 assert.equal(formatIssuePhotoDateKst("2024-01-01 01:00:00"),"2024.01.01(월)");
});

test("share watermark shortens only the location to preserve the date area",()=>{
 const measure=text=>text.length*10;
 assert.equal(fitWatermarkLocation("202동 14층 1401호 거실",120,measure),"202동 14층 14…");
 assert.equal(fitWatermarkLocation("위치 정보 없음",120,measure),"위치 정보 없음");
});

test("r29 uses location as the stable base for the 10 to 8 to 6 ratio",()=>{
 const layout=issueShareWatermarkLayout(1200,1600);
 assert.equal(layout.locationSize,38);
 assert.equal(layout.contentSize,30.400000000000002);
 assert.equal(layout.dateSize,22.8);
 assert.ok(layout.locationMaxWidth+layout.dateWidthBudget+layout.gap<=1200-layout.padding*2);
 assert.ok(layout.contentTop+layout.contentLineHeight*2<=1600-layout.padding);
});

test("r29 watermark geometry remains valid for small portrait and landscape photos",()=>{
 for(const [width,height] of [[320,480],[480,320]]){
  const layout=issueShareWatermarkLayout(width,height);
  assert.ok(layout.footerHeight<=height);
  assert.ok(layout.locationMaxWidth>=0);
  assert.ok(layout.contentTop>=height-layout.footerHeight);
  assert.ok(layout.contentTop+layout.contentLineHeight<=height-layout.padding);
 }
});

test("r29 separates canonical structure from detail and removes structural duplication",()=>{
 const issue={location:"201동 / 19층 / 1903호 / 거실 벽면",description:"201동 1903호 거실 벽면 면갈이",buildingLocationId:"b",floorLocationId:"f",unitLocationId:"u",roomLocationId:null};
 const display=issueShareDisplay(issue);
 assert.deepEqual(display,{location:"201동 / 19층 / 1903호",content:"거실 벽면 면갈이"});
 assert.equal(issue.location,"201동 / 19층 / 1903호 / 거실 벽면");
 assert.equal(issue.description,"201동 1903호 거실 벽면 면갈이");
});

test("r29 keeps direct input and historical ROOM locations compatible",()=>{
 assert.deepEqual(issueShareDisplay({location:"옥상 물탱크실 옆",description:"누수 확인"}),{location:"옥상 물탱크실 옆",content:"누수 확인"});
 assert.deepEqual(issueShareDisplay({location:"201동 / 19층 / 1903호 / 거실",description:"면갈이",buildingLocationId:"b",floorLocationId:"f",unitLocationId:"u",roomLocationId:"r"}),{location:"201동 / 19층 / 1903호 / 거실",content:"면갈이"});
});

test("r29 content falls back independently when detail or description is absent",()=>{
 assert.deepEqual(issueShareDisplay({location:"201동 / 19층 / 1903호",description:"면갈이",buildingLocationId:"b",floorLocationId:"f",unitLocationId:"u"}),{location:"201동 / 19층 / 1903호",content:"면갈이"});
 assert.deepEqual(issueShareDisplay({location:"201동 / 19층 / 1903호 / 거실 벽면",description:"",buildingLocationId:"b",floorLocationId:"f",unitLocationId:"u"}),{location:"201동 / 19층 / 1903호",content:"거실 벽면"});
});

test("r29 uses the exact location content date ratio 10 to 8 to 6",()=>{
 const layout=issueShareWatermarkLayout(1200,1600);
 assert.equal(layout.contentSize/layout.locationSize,.8);
 assert.equal(layout.dateSize/layout.locationSize,.6);
});

test("r29 content wrapping stays within two measured lines without clipping",()=>{
 const measure=text=>text.length*10;
 const lines=wrapWatermarkContent("거실벽면면갈이작업이매우길게이어지는문장 추가내용",100,measure,2);
 assert.equal(lines.length,2);
 assert.ok(lines.every(line=>measure(line)<=100));
 assert.ok(lines.some(line=>line.endsWith("…")));
});
