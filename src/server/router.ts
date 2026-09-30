import { TRPCError, initTRPC } from "@trpc/server";
import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/src/db";
import { deployments } from "@/src/db/schema";
import { auth } from "./auth";
import { createDeployment, redeployDeployment, removeDeployment } from "./deployments";
import { createDeploymentInput } from "./validation";

export async function createContext({ req }: CreateNextContextOptions) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const session = await auth.api.getSession({ headers });
  return { session };
}

const t = initTRPC.context<Awaited<ReturnType<typeof createContext>>>().create();
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { session: ctx.session } });
});

function ownedDeployment(id: string, ownerId: string) {
  const row = db
    .select()
    .from(deployments)
    .where(and(eq(deployments.id, id), eq(deployments.ownerId, ownerId)))
    .get();
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Deployment not found." });
  return row;
}

export const appRouter = t.router({
  deployments: t.router({
    list: protectedProcedure.query(({ ctx }) =>
      db
        .select()
        .from(deployments)
        .where(eq(deployments.ownerId, ctx.session.user.id))
        .orderBy(desc(deployments.createdAt))
        .all(),
    ),
    create: protectedProcedure
      .input(createDeploymentInput)
      .mutation(({ ctx, input }) => createDeployment(ctx.session.user.id, input)),
    redeploy: protectedProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
      const row = ownedDeployment(input.id, ctx.session.user.id);
      try {
        redeployDeployment(row);
      } catch (error) {
        throw new TRPCError({ code: "CONFLICT", message: String(error) });
      }
      return { ok: true };
    }),
    remove: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const row = ownedDeployment(input.id, ctx.session.user.id);
        try {
          await removeDeployment(row);
        } catch (error) {
          throw new TRPCError({ code: "CONFLICT", message: String(error) });
        }
        return { ok: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
