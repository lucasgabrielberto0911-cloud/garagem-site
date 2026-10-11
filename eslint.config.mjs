import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),
  {
    rules: {
      // React 19 plugin: padrões existentes (sync de URL/storage) não entram nesta PR.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      // `const { campo: _descartado, ...resto } = obj` é o jeito de omitir uma chave.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
