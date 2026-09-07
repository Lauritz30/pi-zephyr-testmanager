# pi-zephyr-testmanager

Zephyr Scale Cloud API integration for the [pi coding agent](https://pi.dev) — test cases, test cycles, and test executions for test-management workflows.

> Status: published as a standalone, npm-installable pi package (TypeScript, loaded natively by pi — no build step).
>
> **The tool paths below reflect the publicly documented Zephyr Scale Cloud REST API v2 shape. Confirm `/testexecutions` update semantics and field names against your tenant's API docs before relying on write tools in production.**

## Installation

From npm:

```bash
pi install npm:pi-zephyr-testmanager
```

From git:

```bash
pi install git:github.com/your-github-username/pi-zephyr-testmanager
```

For a one-off session: `pi -e npm:pi-zephyr-testmanager`.

## Quick Start

1. Generate a Zephyr Scale API access token (Jira profile → Zephyr Scale API Access Tokens).
2. Create `~/.pi/agent/pi-zephyr-testmanager.json` with your token.
3. Run `/zephyr-doctor` to verify configuration and connectivity.

### Example configuration

```json
{
  "defaultSite": "acme",
  "safetyLevel": "confirm",
  "sites": [
    {
      "name": "acme",
      "apiToken": "your-zephyr-scale-api-token"
    }
  ]
}
```

`baseUrl` defaults to `https://api.zephyrscale.smartbear.com/v2` and only needs to be set to override it (e.g. a different regional endpoint).

### Mock mode

Set `"mock": true` to let `zephyr_doctor` validate config shape without making a live request.

## Tools

### Read

| Tool | Description |
| --- | --- |
| `zephyr_doctor` | Verify configuration and connection health |
| `zephyr_list_test_cases` | List test cases for a project |
| `zephyr_get_test_case` | Fetch a single test case, including its test script/steps |
| `zephyr_list_test_cycles` | List test cycles for a project |
| `zephyr_get_test_cycle` | Fetch a single test cycle |
| `zephyr_list_test_executions` | List test executions, optionally scoped to a test cycle |
| `zephyr_get_test_execution` | Fetch a single test execution |

### Write (safety-gated)

| Tool | Description |
| --- | --- |
| `zephyr_create_test_case` | Create a test case |
| `zephyr_add_test_cases_to_cycle` | Add one or more test cases to a test cycle (creates a test execution per test case) |
| `zephyr_update_test_execution_status` | Record a test result (e.g. Pass/Fail) on a test execution |

## Commands

| Command | Description |
| --- | --- |
| `/zephyr-status` | Show the current connection status (site, safety level) |
| `/zephyr-doctor` | Check configuration, auth, and connection health |

## Prompt templates

| Template | Description |
| --- | --- |
| `/zephyr-cycle-status <projectKey> <testCycleIdOrKey>` | Summarize a test cycle's execution progress |
| `/zephyr-record-result <testExecutionIdOrKey> <statusName> [comment]` | Record a test result |

## Configuration reference

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `sites` | array | — | List of `{ name, apiToken, baseUrl?, safetyLevel? }` |
| `defaultSite` | string | first site | Default site name used when a tool call omits `site` |
| `safetyLevel` | string | `"confirm"` | Global default: `"open"`, `"confirm"`, or `"readonly"` |
| `mock` | boolean | `false` | Skip live requests in `zephyr_doctor` for offline testing |

## Network egress and corporate proxies

The client calls `api.zephyrscale.smartbear.com` directly over HTTPS and needs no extra config when outbound internet access is available. Set `HTTPS_PROXY`/`HTTP_PROXY` if an outbound proxy is required — the client builds an undici `ProxyAgent` from it automatically.

### Safety levels

`open` / `confirm` (default) / `readonly`, resolved per-site override > global config > default.

| Level | Behavior |
| --- | --- |
| `open` | No confirmation before write tools run |
| `confirm` (default) | Prompts via `ctx.ui.confirm` before create/add/update; blocked outright when no UI is available (e.g. print mode) |
| `readonly` | All write tools blocked |

## Architecture

- `src/config.ts` — load/validate `~/.pi/agent/pi-zephyr-testmanager.json`, site/safety-level resolution
- `src/auth.ts` — Bearer auth header construction (API access token)
- `src/proxy.ts` — optional corporate-proxy dispatcher built from `HTTPS_PROXY`/`HTTP_PROXY`
- `src/client.ts` — fetch wrapper (JSON in/out, error normalization, 429 retry/backoff)
- `src/safety.ts` — mutation confirmation/blocking gate
- `src/status.ts` — footer status label + persistent connection card
- `src/tools/{doctor,read,write}.ts` — tool definitions
- `src/index.ts` — extension entry point, tool/command registration
- `prompts/` — reusable prompt templates for common cycle/result workflows

## Development

```bash
npm install
npm test        # node:test runner against src/*.test.ts — no live network calls
npm run check   # tsc --noEmit type-check
```

Run against a local checkout from anywhere with:

```bash
pi install /absolute/path/to/pi-zephyr-testmanager
# or, for a one-off session:
pi -e /absolute/path/to/pi-zephyr-testmanager
```

## Requirements

- Node.js 22.19+ (pi runs `.ts` extension entries natively via type stripping)
- pi coding agent
- A Zephyr Scale Cloud API access token

## License

MIT — see [LICENSE](LICENSE).
