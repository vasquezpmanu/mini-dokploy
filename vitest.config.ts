import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: {
    coverage: {
      provider: "v8",
      include: [
        "src/server/validation.ts",
        "src/server/docker-commands.ts",
        "src/server/deployment-flow.ts",
        "src/server/repository.ts",
        "pages/index.tsx",
        "src/client/port.ts",
        "src/client/labels.ts",
        "src/client/components/*.tsx",
        "src/client/hooks/*.ts",
      ],
      reporter: ["text", "html", "json-summary"],
      thresholds: { statements: 90, branches: 80, functions: 90, lines: 90 },
    },
  },
});
