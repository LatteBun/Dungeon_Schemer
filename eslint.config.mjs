import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // 목 데이터를 읽는 곳은 app/** 뿐이다. 컴포넌트가 목을 직접 가져오면
    // F2·P1이 실제 상태를 붙일 때 컴포넌트를 전부 고쳐야 한다.
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
    // 프리미티브는 게임을 모른다. 도메인 타입을 읽는 컴포넌트는
    // components/game 에 둔다.
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
