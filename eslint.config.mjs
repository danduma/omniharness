import tseslint from "typescript-eslint";

const eslintConfig = [
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: [
      "src/components/**/*.{ts,tsx}",
      "src/interface/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
      "src/runtime-api/**/*.{ts,tsx}",
      "src/ui/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/server",
                "@/server/**",
                "@/runtime",
                "@/runtime/**",
                "**/*.server",
              ],
              message: "Interface code must depend on shared contracts or RuntimeAPIs, not runner modules.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["tests/**/*.ts", "tests/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      "out/**",
      "build/**",
      "dist/**",
      "apps/mobile/ios/App/Pods/**",
      "apps/mobile/ios/DerivedData/**",
      "apps/mobile/android/.gradle/**",
      "apps/mobile/android/**/build/**",
      "apps/vscode/dist/**",
      "apps/electron/dist/**",
      ".agents/**",
      ".claude/**",
      ".omniharness/**",
      "**/.omniharness/**",
      ".runner/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "tmp/**",
      "vibes/**",
      "**/*.min.js",
    ],
  },
];

export default eslintConfig;
