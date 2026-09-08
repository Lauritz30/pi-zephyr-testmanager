import { test } from "node:test";
import assert from "node:assert/strict";
import { createWriteTools } from "../src/tools/write.ts";
import type { ToolRuntime } from "../src/tools/shared.ts";
import type { ZephyrService } from "../src/service.ts";

function runtimeWith(service: Partial<ZephyrService>): ToolRuntime {
  return {
    loadConfig: () => ({
      sites: [{ name: "acme", baseUrl: "https://example.test", safetyLevel: "confirm" }],
      defaultSite: "acme",
      safetyLevel: "confirm",
      mock: false,
      configPath: "/tmp/config.json",
      configExists: true,
    }),
    resolveSite: (config, name) => config.sites.find((site) => site.name === (name ?? config.defaultSite))!,
    getSiteService: () => ({
      config: runtimeWith(service).loadConfig(),
      site: { name: "acme", baseUrl: "https://example.test", safetyLevel: "confirm" },
      service: service as ZephyrService,
    }),
  };
}

test("create test case dry-run skips confirmation", async () => {
  let createCalled = false;
  const tools = createWriteTools(runtimeWith({
    createTestCase: async () => {
      createCalled = true;
      return { dryRun: true, method: "POST", path: "/testcases", body: { projectKey: "PROJ", name: "Login works" } };
    },
  }));
  const tool = tools.find((item) => item.name === "zephyr_create_test_case")!;

  const result = await (tool.execute as any)("call-1", {
    projectKey: "PROJ",
    name: "Login works",
    dryRun: true,
  }, undefined, undefined, undefined);

  assert.match((result.content[0] as { text: string }).text, /Dry-run/);
  assert.equal(createCalled, true);
});

test("update status dry-run does not require a UI", async () => {
  let updateCalled = false;
  const tools = createWriteTools(runtimeWith({
    updateTestExecution: async () => {
      updateCalled = true;
      return { dryRun: true, method: "PUT", path: "/testexecutions/EX-1", body: { statusName: "Pass" } };
    },
  }));
  const tool = tools.find((item) => item.name === "zephyr_update_test_execution_status")!;

  const result = await (tool.execute as any)("call-2", {
    testExecutionIdOrKey: "EX-1",
    statusName: "Pass",
    dryRun: true,
  }, undefined, undefined, undefined);

  assert.match((result.content[0] as { text: string }).text, /Dry-run/);
  assert.equal(updateCalled, true);
});
