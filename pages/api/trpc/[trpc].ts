import { createNextApiHandler } from "@trpc/server/adapters/next";
import { appRouter, createContext } from "@/src/server/router";

export default createNextApiHandler({ router: appRouter, createContext });
