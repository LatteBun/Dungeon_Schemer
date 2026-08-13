# AI 작업 지침

## 적용 범위

새 기능 또는 기존 동작 변경에 적용한다. 단순 질의, 읽기 전용 조사, 오탈자 수정은 제외한다.

## 커밋 메시지

- 커밋 메시지는 제목과 본문을 포함해 항상 한글로 작성한다.

## 필수 순서

1. `superpowers:brainstorming`으로 사용자와 설계를 합의한다.
2. `docs/README.md`, `docs/GAME_PRINCIPLES.md`, 관련 공식 문서를 확인하고 필요한 설정집을 갱신한다.
3. spec을 작성하고 사용자의 검토·승인을 받는다.
4. plan을 작성한다.
5. spec과 plan이 모두 있을 때만 구현을 시작한다.

## Spec과 plan 파일명

작성자 우선순위: 요청에 지정한 `작성자: <식별자>` → `git config user.name`

안전한 정규화 절차: 입력 식별자를 소문자로 바꾸고 ASCII 영숫자만 보존한다. 비영문은 ASCII 로마자로 변환하지 않고 영숫자가 아닌 문자로 취급한다. 공백·비영문·특수문자를 포함한 영숫자가 아닌 연속 문자는 하이픈 하나로 바꾸고, 앞뒤 하이픈은 제거한다. 결과 slug는 비어 있지 않은 `[a-z0-9-]+`여야 한다.

```text
spec: docs/superpowers/specs/YYYY-MM-DD-<author>-<topic>-design.md
plan: docs/superpowers/plans/YYYY-MM-DD-<author>-<feature>.md
```

요청자 지정 작성자와 Git 이름을 모두 찾을 수 없거나 정규화한 결과 slug가 비어 있으면, 구현 전에 사용자에게 명시적 `작성자: <식별자>` 값을 묻는다. 유효한 slug가 나올 때까지 구현을 시작하지 않는다. AI 도구 이름은 파일명에 넣지 않고 문서 본문의 `작성 도구` 항목에 기록한다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
