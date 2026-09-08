import { Type, type Static } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { guardMutation, type MutationContext } from "../safety.ts";
import { siteParam, textResult, createToolRuntime, type ToolRuntime } from "./shared.ts";

const createCaseParameters = Type.Object({
  projectKey: Type.String(),
  name: Type.String(),
  objective: Type.Optional(Type.String()),
  precondition: Type.Optional(Type.String()),
  folderId: Type.Optional(Type.Integer({ description: "Folder id to file the test case under." })),
  fields: Type.Optional(
    Type.Record(Type.String(), Type.Unknown(), { description: "Additional raw Zephyr Scale fields, merged in as-is." }),
  ),
  dryRun: Type.Optional(Type.Boolean({ description: "Preview the normalized request without prompting or sending it." })),
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
  dryRun: Type.Optional(Type.Boolean({ description: "Preview the normalized requests without prompting or sending them." })),
  site: siteParam,
});
type AddToCycleParams = Static<typeof addToCycleParameters>;

const updateExecutionParameters = Type.Object({
  testExecutionIdOrKey: Type.String(),
  statusName: Type.String({ description: "Status name as configured in the project, e.g. Pass, Fail, Blocked." }),
  comment: Type.Optional(Type.String()),
  dryRun: Type.Optional(Type.Boolean({ description: "Preview the normalized request without prompting or sending it." })),
  site: siteParam,
});
type UpdateExecutionParams = Static<typeof updateExecutionParameters>;

export function createWriteTools(runtime: ToolRuntime = createToolRuntime()): ToolDefinition<any, any, any>[] {
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
        const { config, site, service } = runtime.getSiteService(params);
        if (!params.dryRun) await guardMutation(config, site, ctx, {
          title: "Create Zephyr Scale test case",
          message: `Create test case "${params.name}" in ${params.projectKey}?`,
        });

        const created = await service.createTestCase({
          projectKey: params.projectKey,
          name: params.name,
          objective: params.objective,
          precondition: params.precondition,
          folderId: params.folderId,
          fields: params.fields,
        }, { dryRun: params.dryRun });
        if ("dryRun" in created) return textResult(`Dry-run: would create test case "${params.name}" in ${params.projectKey}.`, created);
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
        const { config, site, service } = runtime.getSiteService(params);
        if (!params.dryRun) await guardMutation(config, site, ctx, {
          title: "Add test cases to Zephyr Scale cycle",
          message: `Add ${params.testCaseKeys.length} test case(s) to cycle ${params.testCycleKey} in ${params.projectKey}?`,
        });

        const created = await service.addTestCasesToCycle({
          projectKey: params.projectKey,
          testCycleKey: params.testCycleKey,
          testCaseKeys: params.testCaseKeys,
          statusName: params.statusName,
          environmentName: params.environmentName,
        }, { dryRun: params.dryRun });
        if (Array.isArray(created)) return textResult(`Dry-run: would add ${params.testCaseKeys.length} test case(s) to cycle ${params.testCycleKey}.`, created);
        const summary = created.created.map((c) => `${c.testCaseKey} -> execution ${c.executionKey}`).join("\n");
        return textResult(`Added ${created.created.length} test case(s) to cycle ${params.testCycleKey}.\n${summary}`, {
          testCycleKey: params.testCycleKey,
          created: created.created,
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
        const { config, site, service } = runtime.getSiteService(params);
        if (!params.dryRun) await guardMutation(config, site, ctx, {
          title: "Update Zephyr Scale test execution status",
          message: `Set ${params.testExecutionIdOrKey} status to "${params.statusName}"?`,
        });

        const updated = await service.updateTestExecution({
          testExecutionIdOrKey: params.testExecutionIdOrKey,
          statusName: params.statusName,
          comment: params.comment,
        }, { dryRun: params.dryRun });
        if (params.dryRun) return textResult(`Dry-run: would update ${params.testExecutionIdOrKey} to "${params.statusName}".`, updated);
        return textResult(`Updated ${params.testExecutionIdOrKey} to "${params.statusName}".`, {
          ...updated,
        });
      },
    },
  ];
}
