import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBearerAuthHeader } from "../src/auth.ts";

test("buildBearerAuthHeader wraps the token", () => {
  assert.equal(buildBearerAuthHeader("abc123"), "Bearer abc123");
});

test("buildBearerAuthHeader throws when apiToken is missing", () => {
  assert.throws(() => buildBearerAuthHeader(undefined), /requires an apiToken/);
  assert.throws(() => buildBearerAuthHeader(""), /requires an apiToken/);
});
