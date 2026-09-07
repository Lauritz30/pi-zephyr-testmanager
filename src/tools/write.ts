import { Type, type Static } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { loadConfig, resolveSite } from "../config.ts";
import { createZephyrClient } from "../client.ts";
import { guardMutation, type MutationContext } from "../safety.ts";
import { siteParam, textResult } from "./shared.ts";

function getSiteClient(params: { site?: string }) {
  const config = loadConfig();
  const site = resolveSite(config, params.site);
  return { config, site, client: createZephyrClient(site) };
}

const createCaseParameters = Type.Object({
  projectKey: Type.String(),
  name: Type.String(),
  objective: Type.Optional(Type.String()),
  precondition: Type.Optional(Type.String()),
  folderId: Type.Optional(Type.Integer({ description: "Folder id to file the test case under." })),
  fields: Type.Optional(
    Type.Record(Type.String(), Type.Unknown(), { description: "Additional raw Zephyr Scale fields, merged in as-is." }),
  ),
  site: siteParam,
});
type CreateCaseParams = Static<typeof createCaseParameters>;

const addToCycleParameters = Type.Object({
  projectKey: Type.String(),
  testCycleKey: Type.String({ description: "Test cycle id or key to add the test cases to." }),
  testCaseKeys: Type.Array(Type.String(), {
    minItems: 1,
    description: 'Test case keys to add, e.g. ["UAT-T1", "UAT-T2"].',
  }),
  statusName: Type.Optional(
    Type.String({ description: "Initial status name, e.g. Not Executed. Defaults to the project's default status when omitted." }),
  ),
  environmentName: Type.Optional(Type.String()),
  site: siteParam,
});
type AddToCycleParams = Static<typeof addToCycleParameters>;

const updateExecutionParameters = Type.Object({
  testExecutionIdOrKey: Type.String(),
  statusName: Type.String({ description: "Status name as configured in the project, e.g. Pass, Fail, Blocked." }),
  comment: Type.Optional(Type.String()),
  site: siteParam,
});
type UpdateExecutionParams = Static<typeof updateExecutionParameters>;

export function createWriteTools(): ToolDefinition<any, any, any>[] {
  return [
    {
      name: "zephyr_create_test_case",
      label: "Create Test Case",
      description: "Create a Zephyr Scale test case. Gated by safetyLevel (default: confirm).",
      promptSnippet: "Create a new Zephyr Scale test case",
      parameters: createCaseParameters,
      async execute(
        _toolCallId: string,
        params: CreateCaseParams,
        _signal: AbortSignal | undefined,
        _onUpdate: unknown,
        ctx: MutationContext | undefined,
      ) {
        const { config, site, client } = getSiteClient(params);
        await guardMutation(config, site, ctx, {
          title: "Create Zephyr Scale test case",
          message: `Create test case "${params.name}" in ${params.projectKey}?`,
        });

        const created = await client.post("/testcases", {
          projectKey: params.projectKey,
          name: params.name,
          ...(params.objective ? { objective: params.objective } : {}),
          ...(params.precondition ? { precondition: params.precondition } : {}),
          ...(params.folderId ? { folderId: params.folderId } : {}),
          ...params.fields,
        });
        return textResult(`Created test case ${created.key ?? created.id}.`, created);
      },
    },
    {
      name: "zephyr_add_test_cases_to_cycle",
      label: "Add Test Cases to Cycle",
      description:
        "Add one or more test cases to a test cycle. Zephyr Scale associates a test case with a cycle by creating a test execution for it, so this creates one execution per test case. Gated by safetyLevel (default: confirm).",
      promptSnippet: "Add test cases to a Zephyr Scale test cycle",
      promptGuidelines: [
        "Use zephyr_add_test_cases_to_cycle when the user asks to add, assign, or include test cases in a test cycle.",
      ],
      parameters: addToCycleParameters,
      async execute(
        _toolCallId: string,
        params: AddToCycleParams,
        _signal: AbortSignal | undefined,
        _onUpdate: unknown,
        ctx: MutationContext | undefined,
      ) {
        const { config, site, client } = getSiteClient(params);
        await guardMutation(config, site, ctx, {
          title: "Add test cases to Zephyr Scale cycle",
          message: `Add ${params.testCaseKeys.length} test case(s) to cycle ${params.testCycleKey} in ${params.projectKey}?`,
        });

        const created: Array<{ testCaseKey: string; executionKey: string }> = [];
        for (const testCaseKey of params.testCaseKeys) {
          const execution = await client.post("/testexecutions", {
            projectKey: params.projectKey,
            testCaseKey,
            testCycleKey: params.testCycleKey,
            ...(params.statusName ? { statusName: params.statusName } : {}),
            ...(params.environmentName ? { environmentName: params.environmentName } : {}),
          });
          created.push({ testCaseKey, executionKey: execution.key ?? execution.id });
        }

        const summary = created.map((c) => `${c.testCaseKey} -> execution ${c.executionKey}`).join("\n");
        return textResult(`Added ${created.length} test case(s) to cycle ${params.testCycleKey}.\n${summary}`, {
          testCycleKey: params.testCycleKey,
          created,
        });
      },
    },
    {
      name: "zephyr_update_test_execution_status",
      label: "Update Test Execution Status",
      description:
        "Record a UAT test result by updating a test execution's status (e.g. Pass/Fail) and optional comment. Gated by safetyLevel (default: confirm).",
      promptSnippet: "Record a pass/fail result on a Zephyr Scale test execution",
      parameters: updateExecutionParameters,
      async execute(
        _toolCallId: string,
        params: UpdateExecutionParams,
        _signal: AbortSignal | undefined,
        _onUpdate: unknown,
        ctx: MutationContext | undefined,
      ) {
        const { config, site, client } = getSiteClient(params);
        await guardMutation(config, site, ctx, {
          title: "Update Zephyr Scale test execution status",
          message: `Set ${params.testExecutionIdOrKey} status to "${params.statusName}"?`,
        });

        await client.put(`/testexecutions/${encodeURIComponent(params.testExecutionIdOrKey)}`, {
          statusName: params.statusName,
          ...(params.comment ? { comment: params.comment } : {}),
        });
        return textResult(`Updated ${params.testExecutionIdOrKey} to "${params.statusName}".`, {
          testExecutionIdOrKey: params.testExecutionIdOrKey,
          statusName: params.statusName,
        });
      },
    },
  ];
}
