import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const EXPECTED_OFFLINE_MESSAGE = "오프라인에서는 최종 업무를 처리할 수 없습니다.";

async function offlineMessageFrom(file, encoding) {
  const source = fs.readFileSync(file).toString(encoding);
  const handlers = new Map();
  const context = {
    URL,
    Response,
    location: { origin: "https://integration.example" },
    fetch: () => Promise.reject(new Error("offline")),
    caches: {
      open: async () => ({ addAll: async () => {}, put: async () => {} }),
      keys: async () => [],
      delete: async () => true,
      match: async () => undefined,
    },
    self: {
      clients: { claim: async () => {} },
      addEventListener: (name, handler) => handlers.set(name, handler),
    },
  };
  vm.runInNewContext(source, context, { filename: file });
  let responsePromise;
  handlers.get("fetch")({
    request: { url: "https://integration.example/api/v1/issues", method: "POST" },
    respondWith: (promise) => { responsePromise = promise; },
  });
  const response = await responsePromise;
  return (await response.json()).message;
}

test("service worker preserves the exact Korean offline message under deployed script decoding", async () => {
  const file = "apps/web/service-worker.js";
  const bytes = fs.readFileSync(file);
  assert.doesNotThrow(() => new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  assert.equal(await offlineMessageFrom(file, "latin1"), EXPECTED_OFFLINE_MESSAGE);
  assert.doesNotMatch(bytes.toString("utf8"), /ì¤|í|ë¼|ì¸/);
});
