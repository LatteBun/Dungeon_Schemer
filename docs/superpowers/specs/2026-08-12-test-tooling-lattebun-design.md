# F4 테스트 도구 도입 설계

**작성자:** LatteBun  
**작성 도구:** Claude Code

## 목적

Vitest를 도입해 게임 규칙을 테스트로 검증할 수 있게 만들고, `pnpm test`를 팀의 병합 전 검증 기준에 넣는다.

이 작업은 [프로토타입 작업 배정표](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md)의 `F4`다. `F3` `R1` `R2` `R4` 네 작업의 선행이며, 이들의 완료 기준이 모두 "테스트 통과"이므로 1차 선행 스프린트의 두 번째 병목이다.

완료 기준은 배정표에 정해져 있다.

> Vitest 설치, `pnpm test` 동작, 샘플 테스트 통과, 개발 환경 문서의 병합 전 검증 목록에 추가

## 배경

`DEVELOPMENT_ENVIRONMENT.md`는 이미 Vitest를 예정된 도구로 적어 두었다. 다만 세 곳에 조건이 붙어 있다.

- 검증 명령 표의 `pnpm test` 실행 시점: "Vitest 도입 뒤, Pull Request 병합 전"
- 표 아래 문장: "`pnpm test`는 게임 규칙을 UI에서 분리하고 Vitest를 도입한 뒤 기준에 포함한다"
- 아직 확정하지 않는 것 목록: "테스트 도구와 배포 승인 절차"

F4는 이 조건들을 제거하고 `pnpm test`를 실제 기준으로 만든다.

`F1`이 `lib/domain/`에 타입과 상수를 만들었으므로 테스트할 대상도 이미 존재한다.

## 설계 결정

### 1. 순수 로직 테스트만 지원한다

`vitest` 하나만 설치한다. `jsdom`, `@testing-library/react`, `@vitejs/plugin-react`, 커버리지 도구는 넣지 않는다.

근거는 두 가지다.

- `DEVELOPMENT_ENVIRONMENT.md`가 "게임 규칙을 특정 UI 컴포넌트에만 숨기지 않고 테스트 가능한 게임 로직으로 분리하는 방향"을 명시했다. F4가 풀어 주는 `R1`~`R4`는 모두 순수 함수다.
- 의존성 그래프에서 화면 작업 `U1`~`U5`는 `F4`가 아니라 `F5`에 매달려 있다. 화면 테스트 환경은 F4의 선행 책임이 아니다.

지금 컴포넌트 테스트 환경을 만들면 테스트할 컴포넌트가 `app/page.tsx`의 Hello World 하나뿐이라 검증되지 않은 설정이 남는다. 화면 트랙이 필요해지는 시점에 그 트랙이 도입한다.

커버리지도 넣지 않는다. 테스트할 로직이 아직 0줄인 상태에서 측정한 커버리지는 판단 근거가 되지 못하고, 기준값 합의 부담만 생긴다.

### 2. 경로 별칭을 직접 설정한다

Vitest는 `tsconfig.json`의 `paths`를 읽지 않는다. `resolve.alias`를 설정 파일에 직접 쓴다.

이것이 이 작업에서 가장 깨지기 쉬운 부분이다. `R1`~`R4`의 테스트는 모두 `@/lib/domain`에서 타입과 상수를 가져올 것이므로, 별칭이 해석되지 않으면 네 작업이 동시에 막힌다.

`vite-tsconfig-paths` 플러그인을 쓰면 자동으로 맞출 수 있지만 의존성이 하나 늘어난다. 별칭이 `@` 하나뿐이므로 직접 쓰는 편이 싸다.

### 3. 샘플 테스트가 별칭 해석을 증명한다

샘플 테스트를 형식적인 `expect(1 + 1).toBe(2)`로 두지 않는다. 그러면 별칭 설정이 검증되지 않은 채로 남는다.

`lib/domain/constants.test.ts`가 `@/lib/domain`에서 상수를 가져와 개수와 값을 확인한다. 이 테스트는 두 가지를 동시에 한다.

- 별칭 해석이 동작함을 증명한다.
- 설정집이 확정한 계약(성격 5, 이벤트 분류 4, 진실 유형 3, 진행 단계 6, 신뢰 척도 0~100)을 회귀 테스트로 고정한다.

두 번째 덕분에 이 테스트는 F4가 끝난 뒤에도 살아남는다. 누군가 목록에 항목을 더하면 테스트가 깨지고, 그때 설정집을 함께 고쳐야 한다는 사실이 드러난다.

### 4. 전역 대신 명시적 import를 쓴다

`test.globals: true`를 쓰지 않는다. `describe`, `it`, `expect`를 테스트 파일마다 import한다.

`globals: true`를 쓰면 `tsconfig.json`에 `types: ["vitest/globals"]`를 넣고 eslint에도 전역 선언을 알려야 한다. 설정 두 곳이 늘어나는 대신 얻는 것은 import 한 줄을 아끼는 것뿐이다.

### 5. 테스트 파일은 소스 옆에 둔다

`tests/` 디렉터리를 따로 만들지 않는다. `lib/rules/trust.ts`의 테스트는 `lib/rules/trust.test.ts`다.

같이 바뀌는 파일은 같이 두는 편이 낫다. 규칙을 고칠 때 테스트가 눈에 보이고, 2차 3트랙에서 트랙마다 자기 디렉터리 안에서만 작업하게 된다.

## 변경 내용

### 설치

```
vitest@4.1.10   devDependency
```

Vitest 5.0.0은 아직 RC이므로 쓰지 않는다.

### `vitest.config.ts` (신규)

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
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

`environment: "node"`는 Vitest 4의 기본값이지만 명시한다. 나중에 화면 트랙이 jsdom을 도입할 때 무엇을 바꿔야 하는지 드러나기 때문이다.

`include`를 `**/*.test.ts`로 좁혀 파일명 규약을 설정에 새긴다. 화면 트랙이 `.test.tsx`를 쓰게 되면 이 목록을 넓힌다.

### `package.json` 스크립트

```json
"test": "vitest run",
"test:watch": "vitest"
```

`pnpm test`는 한 번 실행하고 종료한다. 병합 전 검증에 쓰는 명령이므로 감시 모드가 아니어야 한다. 개발 중 반복 실행은 `pnpm test:watch`를 쓴다.

### `lib/domain/constants.test.ts` (신규)

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

테스트 이름은 한국어로 쓴다. 커밋 메시지와 문서가 한국어이므로 실패 출력도 같은 언어로 읽히는 편이 낫다.

## 문서 갱신

### `DEVELOPMENT_ENVIRONMENT.md`

| 위치 | 변경 |
| --- | --- |
| Bash 공통 명령 블록 | `pnpm test`를 명령 목록과 설명에 추가 |
| 검증 명령 표 | `pnpm test`의 실행 시점을 "Vitest 도입 뒤, Pull Request 병합 전"에서 "Pull Request 병합 전"으로 |
| 표 아래 문장 | `pnpm test`를 조건 없이 병합 전 기준에 포함 |
| 현재 확정된 것 | Vitest를 단위 테스트 도구로 확정 |
| 아직 확정하지 않는 것 | "테스트 도구"를 삭제하고 배포 승인 절차만 남김 |
| 새 절 | 테스트 작성 규약 |

새로 넣는 테스트 작성 규약은 다음 넷이다.

- 테스트 파일 이름은 `<대상>.test.ts`이며 대상 소스와 같은 디렉터리에 둔다.
- 다른 모듈은 상대 경로가 아니라 `@/`로 가져온다.
- `describe`, `it`, `expect`를 `vitest`에서 명시적으로 가져온다.
- `describe`와 `it`의 설명은 한국어로 쓴다.

이 규약을 새 문서로 만들지 않는 이유는 `docs/README.md`가 "같은 규칙을 여러 문서에 복사하지 않고 가장 직접적인 문서를 기준으로 연결한다"고 정했기 때문이다. 실행 방법이 이미 `DEVELOPMENT_ENVIRONMENT.md`에 있으므로 작성 방법도 같은 문서에 둔다.

### `TEAM_DEVELOPMENT_WORKFLOW.md`

| 위치 | 변경 |
| --- | --- |
| Codespaces 개발·검증 문단 | Pull Request 전 실행 명령에 `pnpm test` 추가 |
| 병합 전 확인 체크리스트 | `pnpm test` 통과 항목 추가 |

## 팀원이 해야 하는 준비

없다. 이 변경이 병합되면 팀원은 다음만 하면 된다.

```bash
git pull origin main
pnpm install --frozen-lockfile
pnpm test
```

`vitest`가 `package.json`과 `pnpm-lock.yaml`에 기록되고 `vitest.config.ts`가 저장소에 커밋되므로, 개인별 설치나 설정이 필요하지 않다. 새 Codespace에서도 같다.

## 검증

- `pnpm test`가 5개 테스트를 통과한다.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`가 통과한다. 특히 `vitest.config.ts` 추가가 Next.js 빌드를 깨지 않는지 확인한다.
- `pnpm-lock.yaml`에 `vitest`가 기록된다.

`lib/domain/__checks__.ts`는 `.test.ts`가 아니므로 Vitest가 수집하지 않는다. 컴파일 시점 검사 역할은 그대로 `pnpm typecheck`가 맡는다.

### 알려진 위험

`import.meta.dirname`은 Node 20.11 이상에서만 동작한다. Vitest 4는 설정 파일을 ESM으로 로드하므로 문제가 없어야 하지만, 만약 `undefined`가 되면 별칭이 깨진다. 그 경우 다음으로 바꾼다.

```ts
import { fileURLToPath } from "node:url";

alias: { "@": fileURLToPath(new URL(".", import.meta.url)) }
```

샘플 테스트가 통과하는지가 어느 쪽이 맞는지 판정한다. 별칭이 깨지면 `Cannot find module '@/lib/domain'`으로 실패한다.

## 제외 범위

- `jsdom`, `@testing-library/react`, `@vitejs/plugin-react` 설치
- 커버리지 도구와 기준값
- CI 파이프라인 설정 (GitHub Actions)
- `F1`이 만든 타입과 상수의 변경
- 게임 규칙 구현 (`R1`~`R5`)
- `app/page.tsx` 변경

## 후속 작업에 남기는 계약

이 작업이 끝나면 `F3` `R1` `R2` `R4`가 다음을 전제할 수 있다.

- 테스트 파일을 `<대상>.test.ts`로 만들면 `pnpm test`가 수집한다.
- 테스트에서 `@/lib/domain`으로 도메인 타입과 상수를 가져올 수 있다.
- `describe`, `it`, `expect`를 `vitest`에서 가져와 쓴다.
- `pnpm test` 통과가 병합 전 필수 조건이다.
