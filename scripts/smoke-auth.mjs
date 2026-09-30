import assert from "node:assert/strict";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const email = `smoke-${Date.now()}@example.test`;
const signup = await fetch(`${base}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ name: "Smoke Test", email, password: "LocalTestPassword123!" }),
});
assert.equal(signup.status, 200, `sign up failed: ${await signup.text()}`);
const cookie = signup.headers
  .getSetCookie()
  .map((value) => value.split(";")[0])
  .join("; ");
assert.ok(cookie.includes("session_token"), "session cookie missing");

const session = await fetch(`${base}/api/auth/get-session`, { headers: { cookie } });
assert.equal(session.status, 200);
const sessionData = await session.json();
assert.equal(sessionData.user.email, email);

const authed = createTRPCClient({
  links: [httpBatchLink({ url: `${base}/api/trpc`, headers: { cookie } })],
});
const deployments = await authed.deployments.list.query();
assert.ok(Array.isArray(deployments));

const anonymous = createTRPCClient({ links: [httpBatchLink({ url: `${base}/api/trpc` })] });
await assert.rejects(
  () => anonymous.deployments.list.query(),
  (error) => error?.data?.code === "UNAUTHORIZED",
);

console.log("Auth smoke test passed: sign-up, session, protected and anonymous tRPC calls.");
