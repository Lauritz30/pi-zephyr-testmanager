import type { ZephyrClient } from "./client.ts";

export interface ZephyrPage<T> {
  values: T[];
  total?: number;
  isLast?: boolean;
}

export interface PaginationOptions {
  maxResults?: number;
  startAt?: number;
  signal?: AbortSignal;
  maxPages?: number;
  maxItems?: number;
}

export interface TestCaseSummary {
  key?: string;
  id?: string | number;
  name?: string;
  [key: string]: unknown;
}

export interface TestCycleSummary {
  key?: string;
  id?: string | number;
  name?: string;
  [key: string]: unknown;
}

export interface TestExecutionSummary {
  key?: string;
  id?: string | number;
  testCaseKey?: string;
  testExecutionStatus?: { name?: string };
  [key: string]: unknown;
}

export interface CreateTestCaseInput {
  projectKey: string;
  name: string;
  objective?: string;
  precondition?: string;
  folderId?: number;
  fields?: Record<string, unknown>;
}

export interface AddTestCasesToCycleInput {
  projectKey: string;
  testCycleKey: string;
  testCaseKeys: string[];
  statusName?: string;
  environmentName?: string;
}

export interface UpdateTestExecutionInput {
  testExecutionIdOrKey: string;
  statusName: string;
  comment?: string;
}

export interface DryRunPreview {
  dryRun: true;
  method: "POST" | "PUT";
  path: string;
  body: unknown;
}

export interface ZephyrService {
  listTestCases(options: { projectKey?: string } & PaginationOptions): Promise<ZephyrPage<TestCaseSummary>>;
  listAllTestCases(options: { projectKey?: string } & PaginationOptions): Promise<ZephyrPage<TestCaseSummary>>;
  getTestCase(testCaseKey: string, signal?: AbortSignal): Promise<TestCaseSummary>;
  listTestCycles(options: { projectKey: string } & PaginationOptions): Promise<ZephyrPage<TestCycleSummary>>;
  listAllTestCycles(options: { projectKey: string } & PaginationOptions): Promise<ZephyrPage<TestCycleSummary>>;
  getTestCycle(testCycleIdOrKey: string, signal?: AbortSignal): Promise<TestCycleSummary>;
  listTestExecutions(options: { projectKey: string; testCycle?: string } & PaginationOptions): Promise<ZephyrPage<TestExecutionSummary>>;
  listAllTestExecutions(options: { projectKey: string; testCycle?: string } & PaginationOptions): Promise<ZephyrPage<TestExecutionSummary>>;
  getTestExecution(testExecutionIdOrKey: string, signal?: AbortSignal): Promise<TestExecutionSummary>;
  createTestCase(input: CreateTestCaseInput, options?: { dryRun?: boolean; signal?: AbortSignal }): Promise<TestCaseSummary | DryRunPreview>;
  addTestCasesToCycle(
    input: AddTestCasesToCycleInput,
    options?: { dryRun?: boolean; signal?: AbortSignal },
  ): Promise<{ testCycleKey: string; created: Array<{ testCaseKey: string; executionKey: string }> } | DryRunPreview[]>;
  updateTestExecution(
    input: UpdateTestExecutionInput,
    options?: { dryRun?: boolean; signal?: AbortSignal },
  ): Promise<{ testExecutionIdOrKey: string; statusName: string } | DryRunPreview>;
}

const DEFAULT_MAX_PAGES = 100;
const DEFAULT_MAX_ITEMS = 10_000;

function encodePathPart(value: string): string {
  return encodeURIComponent(value);
}

function page<T>(result: { values?: T[]; total?: number; isLast?: boolean }): ZephyrPage<T> {
  return {
    values: result.values ?? [],
    total: result.total,
    isLast: result.isLast,
  };
}

async function fetchAll<T, TOptions extends PaginationOptions>(
  fetchPage: (options: TOptions) => Promise<ZephyrPage<T>>,
  options: TOptions,
): Promise<ZephyrPage<T>> {
  const values: T[] = [];
  let startAt = options.startAt ?? 0;
  let total: number | undefined;
  let isLast = false;
  let pages = 0;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;

  while (!isLast && pages < maxPages && values.length < maxItems) {
    const result = await fetchPage({ ...options, startAt } as TOptions);
    const remaining = maxItems - values.length;
    values.push(...result.values.slice(0, remaining));
    total = result.total ?? total;
    pages += 1;
    isLast = result.isLast === true || result.values.length === 0 || values.length >= maxItems;
    if (!isLast) {
      startAt += result.values.length;
      if (result.total !== undefined && startAt >= result.total) isLast = true;
    }
  }

  return { values, total, isLast };
}

export function createZephyrService(client: ZephyrClient): ZephyrService {
  const listTestCases = async ({ projectKey, maxResults, startAt, signal }: { projectKey?: string } & PaginationOptions) =>
    page<TestCaseSummary>(await client.get("/testcases", { query: { projectKey, maxResults, startAt }, signal }));

  const listTestCycles = async ({ projectKey, maxResults, startAt, signal }: { projectKey: string } & PaginationOptions) =>
    page<TestCycleSummary>(await client.get("/testcycles", { query: { projectKey, maxResults, startAt }, signal }));

  const listTestExecutions = async ({ projectKey, testCycle, maxResults, startAt, signal }: { projectKey: string; testCycle?: string } & PaginationOptions) =>
    page<TestExecutionSummary>(
      await client.get("/testexecutions", {
        query: { projectKey, testCycle, maxResults, startAt },
        signal,
      }),
    );

  return {
    listTestCases,
    listAllTestCases: (options) => fetchAll(listTestCases, options),
    getTestCase: (testCaseKey, signal) => client.get(`/testcases/${encodePathPart(testCaseKey)}`, { signal }),
    listTestCycles,
    listAllTestCycles: (options) => fetchAll(listTestCycles, options),
    getTestCycle: (testCycleIdOrKey, signal) => client.get(`/testcycles/${encodePathPart(testCycleIdOrKey)}`, { signal }),
    listTestExecutions,
    listAllTestExecutions: (options) => fetchAll(listTestExecutions, options),
    getTestExecution: (testExecutionIdOrKey, signal) => client.get(`/testexecutions/${encodePathPart(testExecutionIdOrKey)}`, { signal }),
    createTestCase: async (input, { dryRun = false, signal } = {}) => {
      const body = {
        projectKey: input.projectKey,
        name: input.name,
        ...(input.objective ? { objective: input.objective } : {}),
        ...(input.precondition ? { precondition: input.precondition } : {}),
        ...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
        ...input.fields,
      };
      if (dryRun) return { dryRun: true, method: "POST", path: "/testcases", body };
      return client.post("/testcases", body, { signal });
    },
    addTestCasesToCycle: async (input, { dryRun = false, signal } = {}) => {
      const previews = input.testCaseKeys.map((testCaseKey) => ({
        dryRun: true as const,
        method: "POST" as const,
        path: "/testexecutions",
        body: {
          projectKey: input.projectKey,
          testCaseKey,
          testCycleKey: input.testCycleKey,
          ...(input.statusName ? { statusName: input.statusName } : {}),
          ...(input.environmentName ? { environmentName: input.environmentName } : {}),
        },
      }));
      if (dryRun) return previews;

      const created: Array<{ testCaseKey: string; executionKey: string }> = [];
      for (const preview of previews) {
        const execution = await client.post(preview.path, preview.body, { signal });
        created.push({ testCaseKey: String(preview.body.testCaseKey), executionKey: String(execution.key ?? execution.id) });
      }
      return { testCycleKey: input.testCycleKey, created };
    },
    updateTestExecution: async (input, { dryRun = false, signal } = {}) => {
      const path = `/testexecutions/${encodePathPart(input.testExecutionIdOrKey)}`;
      const body = {
        statusName: input.statusName,
        ...(input.comment ? { comment: input.comment } : {}),
      };
      if (dryRun) return { dryRun: true, method: "PUT", path, body };
      await client.put(path, body, { signal });
      return { testExecutionIdOrKey: input.testExecutionIdOrKey, statusName: input.statusName };
    },
  };
}
