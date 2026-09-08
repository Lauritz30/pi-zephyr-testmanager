import { test } from "node:test";
import assert from "node:assert/strict";
import { createZephyrService } from "../src/service.ts";
import type { ZephyrClient } from "../src/client.ts";

function fakeClient(overrides: Partial<ZephyrClient> = {}): ZephyrClient {
  return {
    baseUrl: "https://example.test",
    get: async () => ({ values: [], total: 0, isLast: true }),
    post: async () => ({ id: "created" }),
    put: async () => undefined,
    ...overrides,
  };
}

test("listAllTestCases follows pages until the API marks the final page", async () => {
  const queries: Array<Record<string, unknown> | undefined> = [];
  const client = fakeClient({
    get: async (_path, options) => {
      queries.push(options?.query);
      const startAt = options?.query?.startAt;
      if (startAt === 0) return { values: [{ key: "CASE-1" }], total: 2, isLast: false };
      return { values: [{ key: "CASE-2" }], total: 2, isLast: true };
    },
  });

  const result = await createZephyrService(client).listAllTestCases({ projectKey: "PROJ", maxResults: 1 });

  assert.deepEqual(result.values.map((item) => item.key), ["CASE-1", "CASE-2"]);
  assert.deepEqual(queries, [
    { projectKey: "PROJ", maxResults: 1, startAt: 0 },
    { projectKey: "PROJ", maxResults: 1, startAt: 1 },
  ]);
});

test("createTestCase dry-run returns the normalized payload without posting", async () => {
  let postCalled = false;
  const client = fakeClient({
    post: async () => {
      postCalled = true;
      return { id: "created" };
    },
  });

  const result = await createZephyrService(client).createTestCase(
    { projectKey: "PROJ", name: "Login works", folderId: 12, fields: { priority: "High" } },
    { dryRun: true },
  );

  assert.deepEqual(result, {
    dryRun: true,
    method: "POST",
    path: "/testcases",
    body: { projectKey: "PROJ", name: "Login works", folderId: 12, priority: "High" },
  });
  assert.equal(postCalled, false);
});
