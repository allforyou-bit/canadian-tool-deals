import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Archived previous project (not built or deployed).
    "archive/**",
    // Google Apps Script source (runs on Google, not in Node).
    "integrations/**",
    // Separate product package with its own tooling (products/clb).
    "products/**",
  ]),
]);

export default eslintConfig;
