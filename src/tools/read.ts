import { Type, type Static } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { loadConfig, resolveSite } from "../config.ts";
import { createZephyrClient } from "../client.ts";
import { siteParam, paginationParams, textResult } from "./shared.ts";

function getSiteClient(params: { site?: string }) {
  const config = loadConfig();
  const site = resolveSite(config, params.site);
  return { config, site, client: createZephyrClient(site) };
}

/** Format one page of Zephyr paged results (values/total/isLast) into a readable summary. */
function summarizePage(result: { values?: unknown[]; total?: number; isLast?: boolean }, formatItem: (item: any) => string): string {
  const values = result.values ?? [];
  const lines = values.map(formatItem).join("\n");
  return `${values.length} of ${result.total ?? "?"} result(s) (isLast: ${result.isLast ?? "unknown"}).\n${lines}`;
}

const listCasesParameters = Type.Object({
  projectKey: Type.String(),
  ...paginationParams,
  site: siteParam,
});
type ListCasesParams = Static<typeof listCasesParameters>;

const getCaseParameters = Type.Object({
  testCaseKey: Type.String(),
  site: siteParam,
});
type GetCaseParams = Static<typeof getCaseParameters>;

const listCyclesParameters = Type.Object({
  projectKey: Type.String(),
  ...paginationParams,
  site: siteParam,
});
type ListCyclesParams = Static<typeof listCyclesParameters>;

const getCycleParameters = Type.Object({
  testCycleIdOrKey: Type.String(),
  site: siteParam,
});
type GetCycleParams = Static<typeof getCycleParameters>;

const listExecutionsParameters = Type.Object({
  projectKey: Type.String(),
  testCycle: Type.Optional(Type.String({ description: "Test cycle id or key to filter by." })),
  ...paginationParams,
  site: siteParam,
});
type ListExecutionsParams = Static<typeof listExecutionsParameters>;

const getExecutionParameters = Type.Object({
  testExecutionIdOrKey: Type.String(),
  site: siteParam,
});
type GetExecutionParams = Static<typeof getExecutionParameters>;

export function createReadTools(): ToolDefinition<any, any, any>[] {
  return [
    {
      name: "zephyr_list_test_cases",
      label: "List Test Cases",
      description: "List Zephyr Scale test cases for a project.",
      promptSnippet: "List Zephyr Scale test cases for a project",
      parameters: listCasesParameters,
      async execute(_toolCallId: string, params: ListCasesParams) {
        const { client } = getSiteClient(params);
        const result = await client.get("/testcases", {
          query: { projectKey: params.projectKey, maxResults: params.maxResults, startAt: params.startAt },
        });
        return textResult(summarizePage(result, (tc: any) => `${tc.key}: ${tc.name}`), result);
      },
    },
    {
      name: "zephyr_get_test_case",
      label: "Get Test Case",
      description: "Fetch a single Zephyr Scale test case by key, including its test script/steps.",
      promptSnippet: "Fetch a single Zephyr Scale test case by key",
      parameters: getCaseParameters,
      async execute(_toolCallId: string, params: GetCaseParams) {
        const { client } = getSiteClient(params);
        const testCase = await client.get(`/testcases/${encodeURIComponent(params.testCaseKey)}`);
        return textResult(`${testCase.key}: ${testCase.name}`, testCase);
      },
    },
    {
      name: "zephyr_list_test_cycles",
      label: "List Test Cycles",
      description: "List Zephyr Scale test cycles for a project.",
      promptSnippet: "List Zephyr Scale test cycles for a project",
      parameters: listCyclesParameters,
      async execute(_toolCallId: string, params: ListCyclesParams) {
        const { client } = getSiteClient(params);
        const result = await client.get("/testcycles", {
          query: { projectKey: params.projectKey, maxResults: params.maxResults, startAt: params.startAt },
        });
        return textResult(summarizePage(result, (tc: any) => `${tc.key}: ${tc.name}`), result);
      },
    },
    {
      name: "zephyr_get_test_cycle",
      label: "Get Test Cycle",
      description: "Fetch a single Zephyr Scale test cycle by id or key.",
      promptSnippet: "Fetch a single Zephyr Scale test cycle",
      parameters: getCycleParameters,
      async execute(_toolCallId: string, params: GetCycleParams) {
        const { client } = getSiteClient(params);
        const cycle = await client.get(`/testcycles/${encodeURIComponent(params.testCycleIdOrKey)}`);
        return textResult(`${cycle.key}: ${cycle.name}`, cycle);
      },
    },
    {
      name: "zephyr_list_test_executions",
      label: "List Test Executions",
      description: "List Zephyr Scale test executions, optionally scoped to a test cycle.",
      promptSnippet: "List Zephyr Scale test executions for a project or cycle",
      parameters: listExecutionsParameters,
      async execute(_toolCallId: string, params: ListExecutionsParams) {
        const { client } = getSiteClient(params);
        const result = await client.get("/testexecutions", {
          query: {
            projectKey: params.projectKey,
            testCycle: params.testCycle,
            maxResults: params.maxResults,
            startAt: params.startAt,
          },
        });
        return textResult(
          summarizePage(result, (te: any) => `${te.key ?? te.id}: ${te.testCaseKey} — ${te.testExecutionStatus?.name ?? "unknown status"}`),
          result,
        );
      },
    },
    {
      name: "zephyr_get_test_execution",
      label: "Get Test Execution",
      description: "Fetch a single Zephyr Scale test execution by id or key.",
      promptSnippet: "Fetch a single Zephyr Scale test execution",
      parameters: getExecutionParameters,
      async execute(_toolCallId: string, params: GetExecutionParams) {
        const { client } = getSiteClient(params);
        const execution = await client.get(`/testexecutions/${encodeURIComponent(params.testExecutionIdOrKey)}`);
        return textResult(
          `${execution.key ?? execution.id}: ${execution.testExecutionStatus?.name ?? "unknown status"}`,
          execution,
        );
      },
    },
  ];
}
