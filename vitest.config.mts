import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // DB tests share one database: run files one at a time.
    fileParallelism: false,
    env: { UNSUB_SECRET: "test-unsub-secret", UNSUB_BASE_URL: "https://example.test" },
  },
});
