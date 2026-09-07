import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadConfig,
  resolveSite,
  resolveSafetyLevel,
  ConfigError,
  DEFAULT_BASE_URL,
  type ZephyrConfig,
} from "../src/config.ts";

function withConfigFile(contents: unknown | undefined, run: (path: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "pi-zephyr-test-"));
  const path = join(dir, "config.json");
  if (contents !== undefined) writeFileSync(path, JSON.stringify(contents), "utf8");
  try {
    return run(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("loadConfig returns a not-configured stub when the file is missing", () => {
  withConfigFile(undefined, (path) => {
    const config = loadConfig(path);
    assert.equal(config.configExists, false);
    assert.deepEqual(config.sites, []);
  });
});

test("loadConfig parses a valid config and applies the default base URL", () => {
  withConfigFile({ sites: [{ name: "acme", apiToken: "tok" }], defaultSite: "acme" }, (path) => {
    const config = loadConfig(path);
    assert.equal(config.configExists, true);
    assert.equal(config.sites[0].baseUrl, DEFAULT_BASE_URL);
    assert.equal(config.defaultSite, "acme");
    assert.equal(config.safetyLevel, "confirm");
  });
});

test("loadConfig respects a custom baseUrl override", () => {
  withConfigFile({ sites: [{ name: "acme", apiToken: "tok", baseUrl: "https://custom.example.com/v2" }] }, (path) => {
    assert.equal(loadConfig(path).sites[0].baseUrl, "https://custom.example.com/v2");
  });
});

test("loadConfig rejects a site missing apiToken outside mock mode", () => {
  withConfigFile({ sites: [{ name: "acme" }] }, (path) => {
    assert.throws(() => loadConfig(path), ConfigError);
  });
});

test("loadConfig allows a missing apiToken in mock mode", () => {
  withConfigFile({ mock: true, sites: [{ name: "acme" }] }, (path) => {
    assert.equal(loadConfig(path).mock, true);
  });
});

test("loadConfig throws on malformed JSON", () => {
  withConfigFile(undefined, (path) => {
    writeFileSync(path, "{ not json", "utf8");
    assert.throws(() => loadConfig(path), ConfigError);
  });
});

test("resolveSite finds the named site and falls back to defaultSite", () => {
  const config: ZephyrConfig = {
    configPath: "/tmp/x.json",
    defaultSite: "acme",
    safetyLevel: "confirm",
    mock: false,
    configExists: true,
    sites: [
      { name: "acme", baseUrl: DEFAULT_BASE_URL, apiToken: "a" },
      { name: "other", baseUrl: DEFAULT_BASE_URL, apiToken: "b" },
    ],
  };
  assert.equal(resolveSite(config).name, "acme");
  assert.equal(resolveSite(config, "other").name, "other");
});

test("resolveSite throws for an unknown site name", () => {
  const config: ZephyrConfig = {
    configPath: "/tmp/x.json",
    defaultSite: "acme",
    safetyLevel: "confirm",
    mock: false,
    configExists: true,
    sites: [{ name: "acme", baseUrl: DEFAULT_BASE_URL, apiToken: "a" }],
  };
  assert.throws(() => resolveSite(config, "missing"), ConfigError);
});

test("resolveSite throws when no site is configured at all", () => {
  const config: ZephyrConfig = {
    configPath: "/tmp/x.json",
    defaultSite: undefined,
    safetyLevel: "confirm",
    mock: false,
    configExists: true,
    sites: [],
  };
  assert.throws(() => resolveSite(config), ConfigError);
});

test("resolveSafetyLevel prefers the site override over the global config", () => {
  assert.equal(resolveSafetyLevel({ safetyLevel: "confirm" }, { safetyLevel: "open" }), "open");
  assert.equal(resolveSafetyLevel({ safetyLevel: "confirm" }, {}), "confirm");
  assert.equal(resolveSafetyLevel({ safetyLevel: "confirm" }), "confirm");
});
