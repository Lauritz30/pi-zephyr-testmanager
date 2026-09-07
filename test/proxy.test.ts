import { test } from "node:test";
import assert from "node:assert/strict";
import { ProxyAgent } from "undici";
import { getProxyDispatcher } from "../src/proxy.ts";

test("getProxyDispatcher returns undefined when no proxy env vars are set", () => {
  assert.equal(getProxyDispatcher({}), undefined);
});

test("getProxyDispatcher builds a ProxyAgent from HTTPS_PROXY", async () => {
  const dispatcher = getProxyDispatcher({ HTTPS_PROXY: "http://proxy.example.com:8080" });
  try {
    assert.ok(dispatcher instanceof ProxyAgent);
  } finally {
    await dispatcher?.close();
  }
});
