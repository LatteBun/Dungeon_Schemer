import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 재현성 규약. 시드로 같은 판을 다시 만들 수 없게 되므로
      // Math.random 은 예외 없이 금지한다. lib/rng 자신도 쓰지 않는다.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='Math'][property.name='random']",
          message:
            "Math.random 대신 @/lib/rng 의 createRng 를 쓴다. 같은 시드로 같은 판을 재현할 수 없게 된다.",
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
