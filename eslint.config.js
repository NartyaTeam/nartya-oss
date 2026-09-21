import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import ts from "typescript-eslint";

export default ts.config(
  { ignores: ["dist", "dist-electron", "node_modules"] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-console": "error",
      "no-warning-comments": ["error", { terms: ["todo", "fixme"], location: "anywhere" }],
      "@typescript-eslint/no-explicit-any": "error",
      "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
      eqeqeq: ["error", "smart"],
    },
  },
  {
    files: ["electron/**", "scripts/**"],
    rules: { "no-console": "off" },
  },
  prettier,
);
