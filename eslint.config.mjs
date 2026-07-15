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
    "archive/**",
    "next-env.d.ts",
  ]),
  {
    // Existing 2.x prototype debt remains visible while the new 3.0 core is
    // held to the strict override below.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    files: [
      "src/lib/**/*.{ts,tsx}",
      "src/server/**/*.{ts,tsx}",
      "src/app/actions/v3/**/*.{ts,tsx}",
      "src/app/v3/**/*.{ts,tsx}",
      "src/components/v3/**/*.{ts,tsx}",
      "src/proxy.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "react-hooks/set-state-in-effect": "error",
    },
  },
]);

export default eslintConfig;
