import { nodeLintPreset } from "@toruslabs/oxlint-config-node";
import { formatPreset } from "@toruslabs/torus-scripts/fmt";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
  },
  fmt: {
    ...formatPreset(),
    ignorePatterns: ["dist/**", "coverage/**", "package-lock.json", "CHANGELOG.md"],
  },
  lint: {
    ...nodeLintPreset(),
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
