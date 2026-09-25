import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // UI1-QUAR: new Sales Intelligence code imports nothing from the quarantined workspace.
  {
    files: ["components/**", "app/**", "lib/**", "tests/**", "server/**"],
    ignores: [
      "components/sales-intelligence/_legacy/**",
      "app/(dashboard)/sales-intelligence/legacy/**",
      "tests/legacy/**",
      // Temporary exceptions, each removed by the stage named.
      "lib/api/salesIntelligenceOfficial.test.ts", // runningSummaryText from _legacy/running-summary-panel; removed by U-CUT
    ],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["**/_legacy/**", "**/_legacy"], message: "New Sales Intelligence code imports nothing from _legacy/ (UI-0 §3, ADMIN-REBUILD)." }],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
