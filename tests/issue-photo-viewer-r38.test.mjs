import test from "node:test";
import assert from "node:assert/strict";
import {createIssuePhotoViewerState,creationPhotos} from "../apps/web/assets/issue-photo-viewer.js";

const issues=[
  {id:"five",thumbnailUrl:"/five-cover",creationMediaCount:5},
  {id:"one",thumbnailUrl:"/one-cover",creationMediaCount:1}
];
const fiveMedia=Array.from({length:5},(_,index)=>({id:`p${index+1}`,media_role:"CREATION",sort_order:index,thumbnailUrl:`/five-${index+1}`,originalUrl:`/five-${index+1}-original`}));

test("creation photos use only CREATION media in capture order",()=>{
  assert.deepEqual(creationPhotos({media:[fiveMedia[2],{id:"action",media_role:"ACTION",sort_order:0},fiveMedia[0],fiveMedia[1]]}).map(photo=>photo.id),["p1","p2","p3"]);
});

test("five-photo navigation never changes the issue and clamps at the last photo",async()=>{
  const state=createIssuePhotoViewerState({issues,loadDetail:async()=>({media:fiveMedia})});
  await state.ensurePhotos();
  assert.equal(state.snapshot().label,"이슈 1/2 · 사진 1/5");
  state.movePhoto(1);
  assert.equal(state.snapshot().label,"이슈 1/2 · 사진 2/5");
  for(let index=0;index<9;index+=1)state.movePhoto(1);
  assert.equal(state.snapshot().issueIndex,0);
  assert.equal(state.snapshot().photoIndex,4);
});

test("vertical issue movement resets a five-photo issue to photo 1/1",async()=>{
  const state=createIssuePhotoViewerState({issues,loadDetail:async issueId=>({media:issueId==="five"?fiveMedia:[{id:"only",media_role:"CREATION",sort_order:0,thumbnailUrl:"/one"}]})});
  await state.ensurePhotos();
  state.movePhoto(4);
  await state.moveIssue(1);
  assert.equal(state.snapshot().label,"이슈 2/2 · 사진 1/1");
});

test("single-photo horizontal navigation does not change the issue",async()=>{
  const state=createIssuePhotoViewerState({issues:[issues[1]],loadDetail:async()=>({media:[]})});
  state.movePhoto(1);
  assert.equal(state.snapshot().issueIndex,0);
  assert.equal(state.snapshot().photoIndex,0);
  assert.equal(state.snapshot().label,"이슈 1/1 · 사진 1/1");
});

test("stale stored indexes are normalized and stale detail cannot overwrite the active issue",async()=>{
  let resolveFive;
  const state=createIssuePhotoViewerState({issues,initialIssueIndex:99,initialPhotoIndex:99,loadDetail:issueId=>issueId==="five"?new Promise(resolve=>{resolveFive=resolve}):Promise.resolve({media:[{id:"only",media_role:"CREATION",sort_order:0,thumbnailUrl:"/one"}]})});
  assert.equal(state.snapshot().issueIndex,0);
  const pending=state.ensurePhotos();
  await state.moveIssue(1);
  resolveFive({media:fiveMedia});
  await pending;
  assert.equal(state.snapshot().label,"이슈 2/2 · 사진 1/1");
});

test("detail failure preserves representative photo and retry populates creation photos",async()=>{
  let attempts=0;
  const state=createIssuePhotoViewerState({issues:[issues[0]],loadDetail:async()=>{attempts+=1;if(attempts===1)throw new Error("network");return {media:fiveMedia}}});
  await assert.rejects(state.ensurePhotos(),/network/);
  assert.equal(state.snapshot().photo.url,"/five-cover");
  assert.equal(state.snapshot().error,"사진 목록을 불러오지 못했습니다.");
  await state.retry();
  assert.equal(state.snapshot().label,"이슈 1/1 · 사진 1/5");
});
