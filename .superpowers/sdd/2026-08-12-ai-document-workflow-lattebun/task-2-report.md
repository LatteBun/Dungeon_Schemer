# Task 2 작업 보고서

## 변경 파일

- `AGENTS.md` (신규): AI 작업 적용 범위, 필수 순서, 작성자 식별자·파일명 규칙을 추가했다.

## 검증

- `rg -n "brainstorming|spec|plan|작성자:|git config user.name|YYYY-MM-DD|작성 도구" AGENTS.md`
  - 종료 코드 0. 필수 순서, 작성자 우선순위, 두 파일명 형식, `작성 도구` 기록 위치가 출력됐다.
- `rg -n "brainstorming|spec|plan|작성자|git config user.name|docs/superpowers" README.md AGENTS.md`
  - 종료 코드 0. README의 요약 게이트와 `AGENTS.md`의 실행 가능한 세부 규칙이 출력됐다.
- `git diff --check`
  - 종료 코드 0. 공백 오류가 없다.
- `git diff --cached --check`
  - 종료 코드 0. 커밋 전 스테이징된 `AGENTS.md`에 공백 오류가 없다.

## 자체 검토

- 범위 예외(단순 질의, 읽기 전용 조사, 오탈자 수정)를 명시했다.
- brainstorming부터 spec·plan 존재 확인까지의 5단계 실행 순서를 브리프와 일치시켰다.
- 요청 작성자 우선, Git 사용자명 차순위, 소문자 영문·숫자·하이픈 정규화, 두 경로 형식, 식별자 미확인 시 사용자 질의, AI 도구의 본문 기록을 모두 포함했다.
- README와 다른 기존 파일은 수정하지 않았다.

## 커밋

- `a195abd` — `docs: add AI workflow instructions`

## Fix round 1

### 변경

- `AGENTS.md`: 비영문을 ASCII 로마자로 변환하지 않고 영숫자가 아닌 문자로 처리하는 안전한 정규화 절차를 명시했다. 영숫자가 아닌 연속 문자를 하이픈 하나로 바꾸고 앞뒤 하이픈을 제거하며, 최종 slug가 비어 있지 않은 `[a-z0-9-]+`인지 확인하도록 했다.
- `AGENTS.md`: 정규화 결과가 비어 있으면 명시적 `작성자:` 값을 다시 묻고 유효한 slug가 나올 때까지 구현을 시작하지 않도록 했다.

### 검증

- `rg -n "로마자|영숫자|하이픈|비어|작성자:|git config user.name|YYYY-MM-DD|작성 도구" AGENTS.md`
  - 종료 코드 0. 안전한 정규화 절차, 빈 slug 처리, 작성자 우선순위, 두 파일명 형식, 작성 도구 기록 위치가 출력됐다.
- `git diff --check`
  - 종료 코드 0. 공백 오류가 없다.
- `git diff --cached --check`
  - 종료 코드 0. 커밋 전 스테이징된 `AGENTS.md`에 공백 오류가 없다.

### 자체 검토

- 기존 작성자 우선순위, 정확한 spec/plan 경로 형식, AI 도구명 본문 기록 규칙을 유지했다.
- `김대연`과 `!!!`처럼 ASCII 영숫자가 없는 입력은 빈 결과로 처리하고 재질의하도록 했으며, `A/B`는 `a-b`로 정규화된다.
- `AGENTS.md` 외 프로젝트 파일은 수정하지 않았다. 이 보고서는 요청된 작업 기록이다.

### 커밋

- `301367a` — `docs: harden author slug rules`
