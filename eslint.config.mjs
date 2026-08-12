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
  {
    files: ["components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/mock", "@/lib/mock/*"],
              message:
                "컴포넌트는 목 데이터를 직접 가져오지 않는다. app/** 에서 props로 넘긴다.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["components/ui/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/mock",
                "@/lib/mock/*",
                "@/lib/domain",
                "@/lib/domain/*",
              ],
              message:
                "components/ui 는 게임을 모르는 프리미티브다. 도메인 타입을 읽는 컴포넌트는 components/game 에 둔다.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
