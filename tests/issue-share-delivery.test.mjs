import test from "node:test";
import assert from "node:assert/strict";
import {deliverIssueShareFile} from "../apps/web/assets/issue-share-delivery.js";

const file={name:"GUI-Arc-share-photo.jpg",type:"image/jpeg",size:1234};

test("Web Share success does not download",async()=>{
 const calls=[];
 assert.equal(await deliverIssueShareFile(file,{share:async()=>calls.push("share"),canShare:()=>true,download:()=>calls.push("download")}),"SHARED");
 assert.deepEqual(calls,["share"]);
});

test("unsupported Web Share downloads the JPEG",async()=>{
 const calls=[];
 assert.equal(await deliverIssueShareFile(file,{download:value=>calls.push(value)}),"DOWNLOADED");
 assert.deepEqual(calls,[file]);
});

test("non-cancel Web Share failure falls back to JPEG download",async()=>{
 const calls=[];
 assert.equal(await deliverIssueShareFile(file,{share:async()=>{throw new TypeError("share failed")},canShare:()=>true,download:value=>calls.push(value)}),"DOWNLOADED");
 assert.deepEqual(calls,[file]);
});

test("AbortError means user cancel and never forces a download",async()=>{
 const calls=[];const error=new Error("cancelled");error.name="AbortError";
 assert.equal(await deliverIssueShareFile(file,{share:async()=>{throw error},canShare:()=>true,download:value=>calls.push(value)}),"CANCELLED");
 assert.deepEqual(calls,[]);
});
