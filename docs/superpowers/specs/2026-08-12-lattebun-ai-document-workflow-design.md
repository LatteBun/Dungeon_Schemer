# AI 문서 작업 흐름 설계

## 목적

Dungeon Schemer에서 AI가 수행하는 새 기능과 동작 변경을 일관되게 관리한다. 구현 전에 사용자와 설계를 합의하고, 관련 공식 문서를 갱신하며, spec과 plan을 남기도록 문서 규칙을 정한다.

## 범위

- 최상위 `README.md`에 프로젝트 안내와 AI 개발 작업 흐름을 정리한다.
- 루트 `AGENTS.md`에 Codex가 작업 시작 시 따르는 실행 지침을 둔다.
- 기존 `docs/superpowers/specs/`와 `docs/superpowers/plans/`를 각각 설계 기록과 실행 계획의 저장소로 유지한다.

## 작업 흐름

새 기능 또는 기존 동작을 변경하는 요청은 다음 순서를 따른다.

1. `superpowers:brainstorming`으로 사용자와 목적, 범위, 성공 기준을 합의한다.
2. 변경 대상과 연관된 `docs/`의 공식 설정집을 확인하고, 변경된 규칙을 반영한다.
3. `docs/superpowers/specs/`에 승인된 설계를 기록하고 사용자의 문서 검토를 받는다.
4. `docs/superpowers/plans/`에 실행 계획을 기록한다.
5. spec과 plan이 모두 존재하는 경우에만 구현을 시작한다.

단순 질의, 읽기 전용 조사, 오탈자만 바로잡는 변경에는 이 흐름을 적용하지 않는다. 범위가 모호하면 AI는 구현 전에 사용자에게 확인한다.

## 파일 이름과 작성자

spec과 plan 파일명에는 작업 요청자의 식별자를 포함한다. 기본값은 현재 저장소의 `git config user.name`이며, 요청자가 작업 시작 시 `작성자: <식별자>`로 지정하면 그 값을 우선한다.

파일명에 쓰는 식별자는 소문자 영문, 숫자, 하이픈만 사용하도록 슬러그로 정규화한다. 예를 들어 `LatteBun`은 `lattebun`, `Kim Daeyeon`은 `kim-daeyeon`이다. AI 도구 이름은 파일명 대신 문서 본문의 작성 정보에 기록한다.

```text
docs/superpowers/specs/YYYY-MM-DD-<author>-<topic>-design.md
docs/superpowers/plans/YYYY-MM-DD-<author>-<feature>.md
```

## 문서 책임

- `README.md`: 프로젝트 진입점과 반드시 지켜야 할 AI 작업 게이트를 간결하게 안내한다.
- `AGENTS.md`: Codex가 실행할 구체적 규칙, 예외, 파일명 산출 절차를 정의한다.
- `docs/README.md`: 게임·기술 공식 문서의 우선순위와 목록을 유지한다.

## 검증

- README와 AGENTS.md의 흐름, 경로, 파일명 규칙이 이 문서와 일치하는지 확인한다.
- Markdown 링크가 올바른 대상에 연결되는지 확인한다.
- 기존 `docs/`의 공식 문서와 원본 자료 보존 규칙을 바꾸지 않는다.
