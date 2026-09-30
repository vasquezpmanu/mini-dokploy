import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/src/server/router";

export const api = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc" })],
});
