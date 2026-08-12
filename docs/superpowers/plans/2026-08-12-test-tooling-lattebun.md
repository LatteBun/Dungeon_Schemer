# F4 테스트 도구 도입 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vitest를 설치하고 `pnpm test`를 동작시켜 팀의 병합 전 검증 기준에 넣는다.

**Architecture:** 의존성은 `vitest` 하나만 설치한다. Vitest가 `tsconfig.json`의 `paths`를 읽지 않으므로 `vitest.config.ts`에 `resolve.alias`를 직접 쓴다. 샘플 테스트가 `@/lib/domain`에서 상수를 가져와 별칭 해석을 증명하면서 설정집이 확정한 계약을 회귀 테스트로 고정한다.

**Tech Stack:** Vitest 4.1.10, TypeScript 5.9.3, Node 24.19.0, pnpm 11.21.0

## Global Constraints

- 커밋 메시지는 제목과 본문을 포함해 항상 한글로 작성한다. (`AGENTS.md`)
- 작업 브랜치는 `feature/test-tooling`이며 `main`에 직접 push하지 않는다. (`docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md`)
- 설치하는 의존성은 `vitest@4.1.10` 하나뿐이다. `jsdom`, `@testing-library/react`, `@vitejs/plugin-react`, `@vitest/coverage-v8`을 설치하지 않는다.
- Vitest 5.0.0은 아직 RC이므로 쓰지 않는다.
- `test.globals: true`를 쓰지 않는다. `describe`, `it`, `expect`를 `vitest`에서 명시적으로 가져온다.
- 테스트 파일 이름은 `<대상>.test.ts`이며 대상 소스와 같은 디렉터리에 둔다. `tests/` 디렉터리를 만들지 않는다.
- 테스트에서 다른 모듈은 상대 경로가 아니라 `@/`로 가져온다.
- `describe`와 `it`의 설명은 한국어로 쓴다.
- `lib/domain/`의 타입과 상수를 변경하지 않는다. F1의 결과물이다.
- `app/page.tsx`를 변경하지 않는다.
- CI 파이프라인(GitHub Actions)을 만들지 않는다.

### 환경 확인 결과

계획 작성 시점에 확인한 사실이다. 다시 조사할 필요 없다.

- 이 브랜치는 `feature/domain-types` 위에 쌓여 있다(stacked). `lib/domain/`의 일곱 파일이 이미 있다.
- `tsconfig.json`에 `"paths": { "@/*": ["./*"] }`와 `"include": ["**/*.ts", ...]`가 있다. **tsconfig를 수정하지 않는다.**
- `package.json`에 `test` 스크립트가 아직 없다. `dev` `build` `start` `lint` `typecheck` 다섯 개만 있다.
- `node --version`은 `v24.19.0`, `pnpm --version`은 `11.21.0`이다.
- `lib/domain/index.ts`가 `PERSONALITIES` `EVENT_KINDS` `TRUTH_TYPES` `RUN_PHASES` `TRUST_MIN` `TRUST_MAX` `PARTY_SIZE_MIN` `PARTY_SIZE_MAX`를 내보낸다.
- `lib/domain/__checks__.ts`는 `.test.ts`가 아니므로 Vitest가 수집하지 않는다. 이 파일을 건드리지 않는다.

### 검증 명령

```bash
pnpm test        # 이 작업이 새로 만드는 명령
pnpm lint
pnpm typecheck
pnpm build
```

---

## File Structure

| 파일 | 책임 | 변경 |
| --- | --- | --- |
| `vitest.config.ts` | 테스트 환경, 수집 대상, 경로 별칭 | 신규 |
| `lib/domain/constants.test.ts` | 도메인 상수 계약 회귀 테스트 + 별칭 해석 증명 | 신규 |
| `package.json` | `test`, `test:watch` 스크립트와 devDependency | 수정 |
| `pnpm-lock.yaml` | vitest 의존성 잠금 | 수정 (자동) |
| `docs/technical/DEVELOPMENT_ENVIRONMENT.md` | 실행 방법, 검증 기준, 테스트 작성 규약 | 수정 6곳 |
| `docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md` | 병합 전 절차와 체크리스트 | 수정 2곳 |

---

## Task 1: Vitest 설치와 샘플 테스트

**Files:**
- Create: `lib/domain/constants.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts와 devDependencies)
- Modify: `pnpm-lock.yaml` (pnpm이 자동 갱신)

**Interfaces:**
- Consumes: `lib/domain/index.ts`가 내보내는 `PERSONALITIES`, `EVENT_KINDS`, `TRUTH_TYPES`, `RUN_PHASES`, `TRUST_MIN`, `TRUST_MAX`
- Produces: `pnpm test` 명령. 이후 `F3` `R1` `R2` `R4`는 `<대상>.test.ts` 파일을 만들면 자동으로 수집되며, 테스트에서 `@/lib/domain`으로 도메인 타입과 상수를 가져올 수 있다.

- [ ] **Step 1: 샘플 테스트 파일을 만든다**

`lib/domain/constants.test.ts`를 만든다. 아직 vitest가 없으므로 실행할 수 없어야 한다.

```ts
import { describe, expect, it } from "vitest";
import {
  EVENT_KINDS,
  PERSONALITIES,
  RUN_PHASES,
  TRUST_MAX,
  TRUST_MIN,
  TRUTH_TYPES,
} from "@/lib/domain";

describe("도메인 상수", () => {
  it("성격은 다섯이다", () => {
    expect(PERSONALITIES).toHaveLength(5);
  });

  it("이벤트 분류는 넷이다", () => {
    expect(EVENT_KINDS).toHaveLength(4);
  });

  it("진실 유형은 셋이다", () => {
    expect(TRUTH_TYPES).toHaveLength(3);
  });

  it("진행 단계는 여섯이다", () => {
    expect(RUN_PHASES).toHaveLength(6);
  });

  it("신뢰 척도는 0 이상 100 이하다", () => {
    expect([TRUST_MIN, TRUST_MAX]).toEqual([0, 100]);
  });
});
```

- [ ] **Step 2: `pnpm test`가 없다는 것을 확인한다**

Run: `pnpm test`
Expected: FAIL. `package.json`에 `test` 스크립트가 없어 `Command "test" not found` 계열 오류가 난다.

- [ ] **Step 3: vitest를 설치한다**

```bash
pnpm add -D vitest@4.1.10
```

설치 뒤 `package.json`의 `devDependencies`에 `"vitest": "4.1.10"`이 들어갔는지, `pnpm-lock.yaml`이 갱신됐는지 확인한다.

```bash
grep -n 'vitest' package.json
```

- [ ] **Step 4: `vitest.config.ts`를 만든다**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Vitest 4의 기본값이지만, 화면 트랙이 jsdom을 도입할 때
    // 무엇을 바꿔야 하는지 드러나도록 명시한다.
    environment: "node",
    include: ["**/*.test.ts"],
  },
  resolve: {
    // Vitest는 tsconfig.json의 paths를 읽지 않으므로 직접 맞춘다.
    // 이 별칭이 없으면 @/lib/domain 을 가져오는 모든 테스트가 깨진다.
    alias: { "@": import.meta.dirname },
  },
});
```

- [ ] **Step 5: `package.json`에 스크립트를 추가한다**

기존 `scripts` 블록을 찾는다.

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
```

다음으로 바꾼다.

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

`test`가 `vitest run`인 이유는 병합 전 검증에 쓰는 명령이라 한 번 실행하고 종료해야 하기 때문이다. 감시 모드는 `test:watch`가 담당한다.

- [ ] **Step 6: 테스트가 통과하는지 확인한다**

Run: `pnpm test`
Expected: PASS. `1 passed` 파일, `5 passed` 테스트가 나온다.

**테스트가 통과하면 경로 별칭이 동작한다는 뜻이다.** `import.meta.dirname`이 `undefined`였다면 별칭이 깨져 `Cannot find module '@/lib/domain'`으로 실패한다.

`Cannot find module '@/lib/domain'`이 나오면 `vitest.config.ts`의 `resolve.alias`를 다음으로 바꾼 뒤 이 단계를 다시 실행한다.

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
```

- [ ] **Step 7: 타입 검사를 확인한다**

Run: `pnpm typecheck`
Expected: PASS.

`vitest.config.ts`도 `tsconfig.json`의 `include: ["**/*.ts"]`에 걸려 타입 검사 대상이다. `Property 'dirname' does not exist on type 'ImportMeta'` 오류가 나면 설치된 `@types/node`가 `import.meta.dirname`을 모른다는 뜻이므로, Step 6의 `fileURLToPath` 대안으로 바꾼 뒤 Step 6과 이 단계를 다시 실행한다.

- [ ] **Step 8: lint와 빌드를 확인한다**

```bash
pnpm lint
pnpm build
```

Expected: 둘 다 통과. `vitest.config.ts`를 루트에 추가하는 것이 Next.js 빌드에 영향을 주지 않는지 확인하는 단계다.

- [ ] **Step 9: 테스트 수집 범위를 확인한다**

```bash
pnpm test 2>&1 | grep -E 'Test Files|Tests'
```

기대 결과: 테스트 파일이 1개다. `lib/domain/__checks__.ts`가 수집되지 않았음을 뜻한다. 파일이 2개로 나오면 `include` 설정을 확인한다.

- [ ] **Step 10: 커밋**

```bash
git add vitest.config.ts lib/domain/constants.test.ts package.json pnpm-lock.yaml
git commit -m "기능: Vitest 도입과 도메인 상수 테스트 추가

pnpm test로 단위 테스트를 실행할 수 있게 한다. 의존성은 vitest
하나만 설치하고 jsdom과 커버리지는 필요해질 때 도입한다.

Vitest는 tsconfig의 paths를 읽지 않으므로 경로 별칭을 설정 파일에
직접 쓴다. 샘플 테스트가 @/lib/domain 에서 상수를 가져와 별칭
해석을 증명하면서 설정집이 확정한 계약을 회귀 테스트로 고정한다."
```

---

## Task 2: 문서 갱신

**Files:**
- Modify: `docs/technical/DEVELOPMENT_ENVIRONMENT.md` (6곳)
- Modify: `docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md` (2곳)

**Interfaces:**
- Consumes: Task 1이 만든 `pnpm test` 명령
- Produces: 없음. 마지막 내용 변경이다.

### 건드리지 않을 곳

다음 두 줄은 그대로 둔다. 고치려는 충동을 참아야 한다.

- `DEVELOPMENT_ENVIRONMENT.md`의 "이 단계에서는 Supabase, 로그인, 환경 변수, Vercel 프로젝트 연결, Zustand, Framer Motion, 테스트 도구, 게임 규칙과 화면 상호작용을 추가하지 않는다." — 이미 끝난 Hello World 초기화의 범위를 기록한 문장이다. 과거 사실이므로 유효하다.
- `TEAM_DEVELOPMENT_WORKFLOW.md`의 "- 공통 검증 명령과 테스트 도구" — 문서를 갱신해야 하는 조건을 나열한 목록이다. 조건 자체는 그대로 유효하다.

- [ ] **Step 1: Bash 공통 명령 블록에 `pnpm test`를 넣는다**

`DEVELOPMENT_ENVIRONMENT.md`에서 찾을 문자열:

```text
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

바꿀 문자열:

```text
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

- [ ] **Step 2: 블록 아래 설명 줄을 고친다**

찾을 문자열:

```markdown
- `pnpm lint`, `pnpm typecheck`, `pnpm build`: Pull Request 전 실행하는 검증 명령이다.
```

바꿀 문자열:

```markdown
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`: Pull Request 전 실행하는 검증 명령이다.
```

- [ ] **Step 3: 검증 명령 표의 `pnpm test` 행을 고친다**

찾을 문자열:

```markdown
| `pnpm test` | Vitest 단위 테스트 | Vitest 도입 뒤, Pull Request 병합 전 |
```

바꿀 문자열:

```markdown
| `pnpm test` | Vitest 단위 테스트 | Pull Request 병합 전 |
```

- [ ] **Step 4: 표 아래 문장을 고치고 테스트 작성 규약 절을 추가한다**

찾을 문자열:

```markdown
`pnpm lint`, `pnpm typecheck`, `pnpm build`는 기본 병합 전 검증 기준이다. `pnpm test`는 게임 규칙을 UI에서 분리하고 Vitest를 도입한 뒤 기준에 포함한다.
```

바꿀 문자열:

```markdown
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`를 병합 전 검증 기준으로 사용한다. 감시 모드가 필요하면 개발 중에만 `pnpm test:watch`를 사용하고, 검증에는 한 번 실행하고 종료하는 `pnpm test`를 사용한다.

## 테스트 작성 규약

단위 테스트는 Vitest로 작성한다. 세 사람이 같은 규약을 쓰도록 다음을 지킨다.

- 테스트 파일 이름은 `<대상>.test.ts`로 하고 대상 소스와 같은 디렉터리에 둔다. 별도의 `tests/` 디렉터리를 만들지 않는다.
- 다른 모듈은 상대 경로가 아니라 `@/`로 가져온다. 예를 들어 `@/lib/domain`이다.
- `describe`, `it`, `expect`를 `vitest`에서 명시적으로 가져온다. 전역으로 쓰지 않는다.
- `describe`와 `it`의 설명은 한국어로 쓴다. 커밋 메시지와 문서가 한국어이므로 실패 출력도 같은 언어로 읽히는 편이 낫다.

현재 테스트 환경은 Node이며 순수 로직 검증을 대상으로 한다. React 컴포넌트를 렌더링하는 테스트가 필요해지면 그 작업에서 `jsdom`과 테스트 라이브러리를 함께 도입하고 이 절을 갱신한다.

가장 가까운 예시는 `lib/domain/constants.test.ts`다.
```

- [ ] **Step 5: 현재 확정된 것 목록을 고친다**

찾을 문자열:

```markdown
- `pnpm lint`, `pnpm typecheck`, `pnpm build`를 병합 전 검증 기준으로 사용한다.
```

바꿀 문자열:

```markdown
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`를 병합 전 검증 기준으로 사용한다.
- Vitest로 단위 테스트를 작성한다.
```

- [ ] **Step 6: 아직 확정하지 않는 것 목록을 고친다**

찾을 문자열:

```markdown
- 테스트 도구와 배포 승인 절차
```

바꿀 문자열:

```markdown
- 배포 승인 절차
```

- [ ] **Step 7: `TEAM_DEVELOPMENT_WORKFLOW.md`의 검증 문단을 고친다**

찾을 문자열:

```markdown
- Pull Request 전 `pnpm lint`, `pnpm typecheck`, `pnpm build`를 실행한다.
```

바꿀 문자열:

```markdown
- Pull Request 전 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`를 실행한다.
```

- [ ] **Step 8: `TEAM_DEVELOPMENT_WORKFLOW.md`의 병합 전 체크리스트를 고친다**

찾을 문자열:

```markdown
- `pnpm lint`, `pnpm typecheck`, `pnpm build`가 통과하는가?
```

바꿀 문자열:

```markdown
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`가 통과하는가?
```

- [ ] **Step 9: 남은 조건 표현이 없는지 확인한다**

```bash
grep -rn 'Vitest 도입 뒤\|Vitest를 도입한 뒤\|테스트 도구와' docs/technical/
```

기대 결과: 출력 없음. 결과가 나오면 Step 3, 4, 6이 빠진 곳이 있다는 뜻이다.

- [ ] **Step 10: `pnpm test`가 문서 네 곳에 모두 있는지 확인한다**

```bash
grep -c 'pnpm test' docs/technical/DEVELOPMENT_ENVIRONMENT.md
grep -c 'pnpm test' docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md
```

기대 결과: 첫 명령이 `5`, 두 번째가 `2`다. `grep -c`는 일치하는 **줄** 수를 센다. 개발 환경 문서의 다섯 줄은 Bash 블록, 블록 아래 설명 줄, 검증 명령 표의 행, 표 아래 기준 문장, 현재 확정된 것 목록의 한 줄이다. 기준 문장 한 줄에는 `pnpm test`가 세 번 나오지만 줄 수로는 하나다.

- [ ] **Step 11: 커밋**

```bash
git add docs/technical/DEVELOPMENT_ENVIRONMENT.md docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md
git commit -m "문서: pnpm test를 병합 전 검증 기준에 추가

Vitest를 도입했으므로 검증 명령에 붙어 있던 도입 조건을 제거하고
pnpm test를 lint, typecheck, build와 같은 기준으로 올린다.

세 사람이 같은 규약으로 테스트를 쓰도록 파일명, 위치, import 방식,
설명 언어를 개발 환경 문서에 기록한다. 실행 방법이 이미 그 문서에
있으므로 작성 방법도 같은 문서에 둔다."
```

---

## Task 3: 배정표 상태 갱신과 Pull Request

**Files:**
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` (F4 행 1줄)

**Interfaces:**
- Consumes: Task 1~2의 커밋
- Produces: `main`을 대상으로 하는 Pull Request

- [ ] **Step 1: 배정표의 `F4` 행을 완료로 바꾼다**

찾을 문자열:

```markdown
| F4 | 테스트 도구 도입 | Vitest 설치, `pnpm test` 동작, 샘플 테스트 통과, 개발 환경 문서의 병합 전 검증 목록에 추가 | — | **F3 R1 R2 R4** | | ⬜ |
```

바꿀 문자열:

```markdown
| F4 | 테스트 도구 도입 | Vitest 설치, `pnpm test` 동작, 샘플 테스트 통과, 개발 환경 문서의 병합 전 검증 목록에 추가 | — | **F3 R1 R2 R4** | LatteBun | ✅ |
```

- [ ] **Step 2: 표의 상태 집계를 확인한다**

```bash
grep -o '| [✅🟡⬜] |$' docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md | sort | uniq -c
```

기대 결과: `✅` 2개(`F1`, `F4`), `⬜` 18개.

- [ ] **Step 3: 표의 의존성 일관성을 확인한다**

`선행`과 `풀리는 것`이 여전히 서로 역방향인지 확인한다. 이번 변경은 `담당`과 `상태` 두 칸만 건드렸으므로 통과해야 한다.

```bash
python3 - <<'PY'
import re
ID = re.compile(r"^[FRPUQ]\d$")
rows = {}
for line in open("docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md", encoding="utf-8"):
    if not line.startswith("|"):
        continue
    c = [x.strip() for x in line.strip().strip("|").split("|")]
    if len(c) != 7 or not ID.match(c[0]):
        continue
    rows[c[0]] = {
        "needs": re.findall(r"[FRPUQ]\d", c[3]),
        "unlocks": re.findall(r"[FRPUQ]\d", c[4]),
        "status": c[6],
    }
exp = {r: set() for r in rows}
for r, v in rows.items():
    for n in v["needs"]:
        if n in exp:
            exp[n].add(r)
bad = [r for r, v in rows.items() if set(v["unlocks"]) != exp[r]]
print(f"행 {len(rows)}개, 간선 {sum(len(v['needs']) for v in rows.values())}개")
print("역방향 불일치:", bad or "없음")
ready = sorted(
    r for r, v in rows.items()
    if v["status"] == "⬜" and all(rows[n]["status"] == "✅" for n in v["needs"])
)
print("지금 시작 가능:", ready)
PY
```

기대 결과: 행 20개, 간선 45개, 역방향 불일치 없음. 시작 가능 목록은 정확히 `['F2', 'F3', 'F5', 'Q3', 'R2']`다.

`R1`과 `R4`는 나오지 않는다. 둘의 선행이 `F1 F3 F4`인데 `F3`이 아직 `⬜`이기 때문이다. `F4`가 직접 푸는 것은 `F3`과 `R2` 둘이고, `R1`·`R4`는 `F3`을 한 단계 더 거쳐야 한다.

- [ ] **Step 4: 커밋**

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -m "문서: 배정표의 F4 상태를 완료로 갱신

테스트 도구 도입을 마쳤으므로 담당자와 상태를 기록한다.
관리 원칙에 따라 Pull Request 병합과 같은 변경 단위에서 갱신한다."
```

- [ ] **Step 5: 검증 명령 넷을 한 번에 돌린다**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: 넷 다 통과. 하나라도 실패하면 원인을 고쳐 커밋한 뒤 이 단계를 다시 실행한다.

- [ ] **Step 6: 변경 파일과 브랜치를 확인한다**

```bash
git branch --show-current
git status --short
git diff --stat feature/domain-types..HEAD
```

기대 결과: 브랜치가 `feature/test-tooling`, 작업 트리가 깨끗하다. `feature/domain-types` 대비 변경은 `vitest.config.ts`, `lib/domain/constants.test.ts`, `package.json`, `pnpm-lock.yaml`, `docs/` 아래 문서 넷이다. `lib/domain/`의 기존 일곱 파일이 변경 목록에 나오면 F1의 결과물을 건드린 것이므로 되돌린다.

- [ ] **Step 7: push한다**

```bash
git push -u origin feature/test-tooling
```

- [ ] **Step 8: Pull Request를 만든다**

`feature/domain-types`가 병합되기 전이면 이 PR에 그 브랜치의 커밋도 함께 보인다. PR 본문에 그 사실을 적는다.

```bash
gh pr create --base main --title "기능: F4 테스트 도구 도입" --body "$(cat <<'PRBODY'
## 배경

프로토타입 배정표의 `F4`다. `F3` `R1` `R2` `R4` 네 작업의 선행이며, 이들의 완료 기준이 모두 "테스트 통과"이므로 1차 선행 스프린트의 두 번째 병목이다.

> **먼저 병합할 것:** 이 브랜치는 `feature/domain-types`(PR #2) 위에 쌓여 있다. PR #2를 먼저 병합하면 이 PR에는 F4 커밋만 남는다.

## 변경

- `vitest@4.1.10`을 devDependency로 설치했다. 의존성은 이것 하나뿐이다.
- `vitest.config.ts`를 추가했다. 환경은 Node, 수집 대상은 `**/*.test.ts`다.
- `pnpm test`(한 번 실행)와 `pnpm test:watch`(감시) 스크립트를 추가했다.
- `lib/domain/constants.test.ts`에 도메인 상수 테스트 5개를 추가했다.
- `DEVELOPMENT_ENVIRONMENT.md`에서 `pnpm test`에 붙어 있던 "Vitest 도입 뒤" 조건을 제거하고 병합 전 검증 기준으로 올렸다. 테스트 작성 규약 절을 추가했다.
- `TEAM_DEVELOPMENT_WORKFLOW.md`의 검증 절차와 병합 전 체크리스트에 `pnpm test`를 추가했다.

`jsdom`, `@testing-library/react`, 커버리지 도구는 넣지 않았다. `R1`~`R4`는 순수 함수이고, 화면 작업 `U1`~`U5`는 의존성 그래프에서 `F5`에 매달려 있어 `F4`의 선행 책임이 아니다. 지금 컴포넌트 테스트 환경을 만들면 테스트할 컴포넌트가 Hello World 하나뿐이라 검증되지 않은 설정이 남는다.

## 팀원이 해야 하는 준비

없다. 병합 뒤 `git pull origin main` → `pnpm install --frozen-lockfile` → `pnpm test` 순으로 실행하면 된다.

`vitest`가 `package.json`과 `pnpm-lock.yaml`에 기록되고 `vitest.config.ts`가 저장소에 커밋되므로 개인별 설치나 설정이 필요하지 않다. 새 Codespace에서도 같다.

## 확인 방법

- `pnpm test`가 5개 테스트를 통과한다.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` 통과.
- 테스트 파일 수집 개수가 1개다. `lib/domain/__checks__.ts`는 `.test.ts`가 아니어서 수집되지 않는다.
- 배정표의 `선행`과 `풀리는 것`이 여전히 역방향이다(20행 45간선).

## 리뷰 요청 사항

- 순수 로직만 지원하는 범위가 적절한지. 화면 테스트 환경을 나중에 별도로 도입하는 데 동의하는지.
- `resolve.alias`를 직접 쓰는 대신 `vite-tsconfig-paths` 플러그인을 쓰는 편이 나은지. 별칭이 `@` 하나뿐이라 직접 쓰는 쪽을 골랐다.
- 테스트 설명을 한국어로 쓰는 규약에 동의하는지.

## 관련 문서

- spec: `docs/superpowers/specs/2026-08-12-test-tooling-lattebun-design.md`
- plan: `docs/superpowers/plans/2026-08-12-test-tooling-lattebun.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
PRBODY
)"
```

- [ ] **Step 9: PR URL을 사용자에게 전달한다**

```bash
gh pr view --json url,number,title
```

출력된 URL을 사용자에게 알린다. 작업자가 아닌 팀원 한 명의 확인이 필요하다는 점과, PR #2를 먼저 병합해야 이 PR이 깔끔해진다는 점을 함께 전달한다.

---

## 완료 조건

- `pnpm test`가 5개 테스트를 통과한다.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`가 모두 통과한다.
- `vitest`가 `package.json`의 devDependencies와 `pnpm-lock.yaml`에 있다.
- `jsdom`, `@testing-library/react`, `@vitejs/plugin-react`, `@vitest/coverage-v8`이 설치되지 않았다.
- `DEVELOPMENT_ENVIRONMENT.md`에 "Vitest 도입 뒤" 조건이 남아 있지 않고 테스트 작성 규약 절이 있다.
- `TEAM_DEVELOPMENT_WORKFLOW.md`의 검증 절차와 체크리스트에 `pnpm test`가 있다.
- 배정표의 `F4`가 `✅`이고 표의 의존성 일관성이 유지된다.
- `lib/domain/`의 기존 일곱 파일과 `app/page.tsx`가 변경되지 않았다.
- `main`을 대상으로 하는 Pull Request가 열려 있고 URL을 사용자가 받았다.

## 이 계획에서 하지 않는 것

- `jsdom`, 테스트 라이브러리, 커버리지 도구 도입
- GitHub Actions 등 CI 파이프라인 설정
- Zustand 설치와 스토어 (`F2`)
- 난수 생성기 (`F3`)
- 게임 규칙 구현 (`R1`~`R5`)
- `lib/domain/` 타입과 상수 변경
- `tsconfig.json` 수정
