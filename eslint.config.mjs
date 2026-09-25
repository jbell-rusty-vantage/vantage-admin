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
      "app/(dashboard)/sales-intelligence/page.tsx", // UI1-QUAR: replaced by UI1-DESK
      "app/(dashboard)/sales-intelligence/loading.tsx", // UI1-QUAR: replaced by UI1-DESK
      "components/sales-intelligence/full-output.tsx", // FieldRows from _legacy/assessment-section; removed by a later UI-1 stage (analysis page rebuild)
      "components/sales-intelligence/outreach-detail.tsx", // MessageRepDialog from _legacy/message-rep-dialog; removed by UI1-CHAT
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
