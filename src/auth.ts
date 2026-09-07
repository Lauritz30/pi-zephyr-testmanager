/** Build the `Authorization: Bearer ...` header value for a Zephyr Scale API access token. */
export function buildBearerAuthHeader(apiToken: string | undefined): string {
  if (!apiToken) {
    throw new Error("buildBearerAuthHeader requires an apiToken.");
  }
  return `Bearer ${apiToken}`;
}
