import { Type, type Static } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { loadConfig, resolveSite } from "../config.ts";
import { createZephyrClient } from "../client.ts";
import { errorResult, textResult, type ToolResult } from "./shared.ts";

const parameters = Type.Object({
  site: Type.Optional(Type.String({ description: "Site name to check; defaults to defaultSite." })),
});
type Params = Static<typeof parameters>;

/** Shared by the zephyr_doctor tool and the /zephyr-doctor command. */
export async function runDoctor(params: Params): Promise<ToolResult> {
  const config = loadConfig();

  if (!config.configExists) {
    return textResult(
      `No Zephyr Scale config found at ${config.configPath}. Create it with at least one entry under "sites" (see README.md).`,
      { configured: false, configPath: config.configPath },
    );
  }

  let site;
  try {
    site = resolveSite(config, params.site);
  } catch (error) {
    return errorResult((error as Error).message);
  }

  if (config.mock) {
    return textResult(
      `Mock mode enabled. Site "${site.name}" (${site.baseUrl}) resolved from config; no live Zephyr Scale request made.`,
      { configured: true, mock: true, site: site.name },
    );
  }

  const client = createZephyrClient(site);
  // No dedicated "whoami" endpoint; a minimal test case listing call verifies auth + connectivity.
  const result = await client.get("/testcases", { query: { maxResults: 1 } });
  return textResult(
    `Connected to ${site.baseUrl}. Test case listing returned ${result.total ?? "an unknown number of"} result(s).`,
    { configured: true, mock: false, site: site.name },
  );
}

export function createDoctorTool(): ToolDefinition<any, any, any> {
  return {
    name: "zephyr_doctor",
    label: "Zephyr Doctor",
    description: "Check Zephyr Scale configuration and connectivity (config file, site resolution, authentication).",
    promptSnippet: "Verify Zephyr Scale configuration and connection health",
    parameters,
    async execute(_toolCallId: string, params: Params) {
      return runDoctor(params);
    },
  };
}
