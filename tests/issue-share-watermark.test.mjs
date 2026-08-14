import test from "node:test";
import assert from "node:assert/strict";

import {fitWatermarkLocation,formatIssuePhotoDateKst} from "../apps/web/assets/issue-share-watermark.js";

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
