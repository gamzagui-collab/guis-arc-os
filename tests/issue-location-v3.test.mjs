import assert from "node:assert/strict";
import test from "node:test";
import {issueDetailSuggestions,issueLocationSubmission} from "../apps/web/assets/issue-location-resolver.js";

test("canonical v3 submission stores three IDs plus detail text and never a room ID",()=>{
  const value=issueLocationSubmission({mode:"CANONICAL",canonicalText:"202동 / 14층 / 1402호",detailText:"거실 창가 쪽",canonical:{buildingLocationId:"b",floorLocationId:"f",unitLocationId:"u",roomLocationId:"historical-room"}});
  assert.deepEqual(value,{location:"202동 / 14층 / 1402호 / 거실 창가 쪽",buildingLocationId:"b",buildingType:"BUILDING",floorLocationId:"f",unitLocationId:"u",roomLocationId:""});
});

test("detail suggestions are contextual strings and never canonical rows",()=>{
  assert.equal(issueDetailSuggestions({space:"1402호"}).kind,"RESIDENTIAL");
  assert.equal(issueDetailSuggestions({building:"지하주차장",floor:"B1"}).kind,"PARKING");
  assert.equal(issueDetailSuggestions({building:"외부"}).kind,"EXTERIOR");
  assert.equal(issueDetailSuggestions({space:"관리사무소"}).kind,"INDEPENDENT");
  const common=issueDetailSuggestions({building:"관리동",floor:"1층"});
  assert.equal(common.kind,"COMMON");
  assert.ok(common.items.includes("기타"));
  assert.ok(common.items.every(item=>typeof item==="string"));
});

test("direct structural fallback stays mutually exclusive with detail and canonical IDs",()=>{
  assert.deepEqual(issueLocationSubmission({mode:"DIRECT",manualText:"옥상 물탱크실 옆",detailText:"거실",canonical:{buildingLocationId:"b",floorLocationId:"f",unitLocationId:"u"}}),{location:"옥상 물탱크실 옆",buildingLocationId:"",buildingType:"BUILDING",floorLocationId:"",unitLocationId:"",roomLocationId:""});
});
