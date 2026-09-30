import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import fs from "node:fs";
import { db } from "@/src/db";
import * as schema from "@/src/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: { enabled: true },
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (fs.existsSync("/run/secrets/mini-dokploy-auth")
      ? fs.readFileSync("/run/secrets/mini-dokploy-auth", "utf8").trim()
      : undefined),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
});
