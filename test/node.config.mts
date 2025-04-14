import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    silent: true,
    reporters: "verbose",
    pool: "forks",
    environment: "node",
    setupFiles: ["dotenv/config"],
    include: ["test/api.test.ts"],
  },
});
