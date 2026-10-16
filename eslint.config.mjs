import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // ui/ must stay pure (spec 3.2): it may import only src/lib/utils and other src/ui/**
  {
    files: ["src/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/**", "**/features/**"],
              message: "ui/ must be pure. Do not import from features/.",
            },
            {
              group: ["@supabase/*", "**/lib/supabase/**"],
              message: "ui/ must not access Supabase. Pass data via props.",
            },
            {
              group: ["@/lib/**", "!@/lib/utils"],
              message: "ui/ may only import @/lib/utils from lib/.",
            },
          ],
        },
      ],
    },
  },

  // features/ may import lib/ and ui/, but never app/ (spec 3.2)
  {
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/**"],
              message: "features/ must not import from app/.",
            },
          ],
        },
      ],
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