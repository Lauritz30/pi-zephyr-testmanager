import { test } from "node:test";
import assert from "node:assert/strict";
import { createZephyrClient, ZephyrApiError } from "../src/client.ts";

const site = { name: "acme", baseUrl: "https://api.zephyrscale.smartbear.com/v2", apiToken: "tok" };

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: "status",
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    text: async () => JSON.stringify(body),
  };
}

test("GET builds the expected URL and Bearer auth header", async () => {
  let seenUrl = "";
  let seenHeaders: Record<string, string> = {};
  const fetchImpl = async (url: string, init: any) => {
    seenUrl = url;
    seenHeaders = init.headers;
    return jsonResponse(200, { values: [], total: 0 });
  };
  const client = createZephyrClient(site, { fetchImpl: fetchImpl as any });
  await client.get("/testcases", { query: { projectKey: "UAT" } });

  assert.equal(seenUrl, "https://api.zephyrscale.smartbear.com/v2/testcases?projectKey=UAT");
  assert.equal(seenHeaders.Authorization, "Bearer tok");
});

test("PUT sends a JSON body and Content-Type header", async () => {
  let seenBody = "";
  let seenHeaders: Record<string, string> = {};
  let seenMethod = "";
  const fetchImpl = async (_url: string, init: any) => {
    seenBody = init.body;
    seenHeaders = init.headers;
    seenMethod = init.method;
    return jsonResponse(200, {});
  };
  const client = createZephyrClient(site, { fetchImpl: fetchImpl as any });
  await client.put("/testexecutions/UAT-E1", { statusName: "Pass" });

  assert.equal(seenMethod, "PUT");
  assert.equal(seenHeaders["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(seenBody), { statusName: "Pass" });
});

test("non-2xx responses throw ZephyrApiError with status and body", async () => {
  const fetchImpl = async () => jsonResponse(401, { errorMessage: "Unauthorized" });
  const client = createZephyrClient(site, { fetchImpl: fetchImpl as any });

  await assert.rejects(() => client.get("/testcases"), (error) => {
    assert.ok(error instanceof ZephyrApiError);
    assert.equal((error as ZephyrApiError).status, 401);
    assert.match(error.message, /authentication failed/);
    return true;
  });
});

test("429 responses are retried after Retry-After before succeeding", async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    if (attempts === 1) return jsonResponse(429, {}, { "retry-after": "0" });
    return jsonResponse(200, { values: [] });
  };
  const client = createZephyrClient(site, { fetchImpl: fetchImpl as any });
  const result = await client.get("/testcases");

  assert.equal(attempts, 2);
  assert.deepEqual(result, { values: [] });
});

test("204 responses resolve to undefined", async () => {
  const fetchImpl = async () => ({ status: 204, statusText: "No Content", headers: { get: () => null } });
  const client = createZephyrClient(site, { fetchImpl: fetchImpl as any });
  assert.equal(await client.put("/testexecutions/UAT-E1", { statusName: "Pass" }), undefined);
});

test("an explicit dispatcher (e.g. a corporate proxy agent) is passed through to fetch", async () => {
  let seenDispatcher: unknown;
  const fakeDispatcher = { marker: "proxy-dispatcher" };
  const fetchImpl = async (_url: string, init: any) => {
    seenDispatcher = init.dispatcher;
    return jsonResponse(200, {});
  };
  const client = createZephyrClient(site, { fetchImpl: fetchImpl as any, dispatcher: fakeDispatcher });
  await client.get("/testcases");
  assert.equal(seenDispatcher, fakeDispatcher);
});

test("no dispatcher option is set on fetch when none is configured", async () => {
  let sawDispatcherKey = true;
  const fetchImpl = async (_url: string, init: any) => {
    sawDispatcherKey = "dispatcher" in init;
    return jsonResponse(200, {});
  };
  const client = createZephyrClient(site, { fetchImpl: fetchImpl as any, dispatcher: undefined });
  await client.get("/testcases");
  assert.equal(sawDispatcherKey, false);
});
