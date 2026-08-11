# AI 문서 작업 흐름 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 새 기능과 동작 변경을 위한 AI 문서 작업 게이트 및 작성자 포함 spec·plan 파일명 규칙을 저장소의 진입 문서와 실행 지침에 반영한다.

**Architecture:** `README.md`는 사람이 빠르게 확인할 수 있는 프로젝트 개요와 작업 흐름만 제공한다. `AGENTS.md`는 Codex가 읽고 실행할 세부 절차, 예외, 작성자 식별자 선택 및 슬러그 규칙을 제공한다.

**Tech Stack:** Markdown, Git configuration

## Global Constraints

- 새 기능 또는 기존 동작 변경은 `brainstorming → 관련 공식 문서 갱신 → spec → plan → 구현` 순서를 따른다.
- 구현은 대응하는 spec과 plan이 모두 저장된 뒤에만 시작한다.
- 작성자 식별자는 요청의 `작성자: <식별자>`가 우선이며, 없으면 `git config user.name`을 사용한다.
- 파일명 식별자는 소문자 영문, 숫자, 하이픈만 사용한다.
- spec 파일은 `docs/superpowers/specs/YYYY-MM-DD-<topic>-<author>-design.md` 형식을, plan 파일은 `docs/superpowers/plans/YYYY-MM-DD-<feature>-<author>.md` 형식을 사용한다.
- AI 도구 이름은 파일명이 아니라 문서 본문의 작성 정보에 기록한다.
- 단순 질의, 읽기 전용 조사, 오탈자만 바로잡는 변경은 spec·plan 게이트 대상이 아니다.

---

### Task 1: 최상위 README를 프로젝트 진입점과 작업 게이트로 정리한다

**Files:**
- Modify: `README.md`
- Reference: `docs/README.md`
- Reference: `docs/superpowers/specs/2026-08-12-ai-document-workflow-lattebun-design.md`

**Interfaces:**
- Consumes: 문서 우선순위와 AI 문서 작업 흐름 설계
- Produces: 사람이 확인하는 프로젝트 개요, 공식 문서 링크, 기능 변경 전 필수 게이트 요약

- [ ] **Step 1: 기존 README와 문서 안내의 링크 대상을 확인한다**

Run:

```powershell
Get-Content -Raw README.md
Get-Content -Raw docs/README.md
```

Expected: README의 기존 내용과 `docs/README.md`의 공식 문서 진입 경로를 확인한다.

- [ ] **Step 2: README에 프로젝트 안내와 핵심 문서 링크를 작성한다**

`README.md`를 아래 구조로 교체한다.

```markdown
# Dungeon Schemer

던전의 설계자 ...

## 문서

- [문서 안내](docs/README.md)
- [게임 원칙](docs/GAME_PRINCIPLES.md)
- [팀 개발 워크플로](docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md)
- [AI 개발 전 사전 점검표](docs/technical/AI_DEVELOPMENT_PRECHECK.md)
```

프로젝트 설명은 게임 원칙과 개요를 과장 없이 한두 문장으로 요약한다.

- [ ] **Step 3: README에 AI 기능 변경 게이트를 작성한다**

`## AI 작업 규칙` 섹션에 다음 순서와 금지 조건을 적는다.

```text
brainstorming으로 사용자와 합의 → 관련 docs/ 공식 문서 갱신 → spec 작성 및 사용자 검토 → plan 작성 → 구현

spec과 plan이 모두 없으면 새 기능 또는 동작 변경을 구현하지 않는다.
```

`AGENTS.md`와 `docs/superpowers/`를 세부 규칙의 참조 대상으로 연결한다.

- [ ] **Step 4: README 링크와 게이트 문구를 검증한다**

Run:

```powershell
rg -n "docs/README.md|docs/GAME_PRINCIPLES.md|TEAM_DEVELOPMENT_WORKFLOW.md|AI_DEVELOPMENT_PRECHECK.md|brainstorming|spec|plan" README.md
```

Expected: 네 개의 핵심 문서 링크와 AI 작업 게이트의 모든 단계가 출력된다.

- [ ] **Step 5: Commit**

```powershell
git add README.md
git commit -m "docs: define AI workflow entry point"
```

### Task 2: Codex 실행 지침과 작성자 기반 파일명 규칙을 추가한다

**Files:**
- Create: `AGENTS.md`
- Reference: `README.md`
- Reference: `docs/superpowers/specs/2026-08-12-ai-document-workflow-lattebun-design.md`

**Interfaces:**
- Consumes: README의 요약 규칙과 spec의 상세 요구사항
- Produces: Codex가 작업 전·중·후에 적용할 실행 순서와 작성자 식별자 산출 규칙

- [ ] **Step 1: AGENTS.md의 규칙을 작성한다**

아래 섹션을 포함해 `AGENTS.md`를 만든다.

```markdown
# AI 작업 지침

## 적용 범위

새 기능 또는 기존 동작 변경에 적용한다. 단순 질의, 읽기 전용 조사, 오탈자 수정은 제외한다.

## 필수 순서

1. `superpowers:brainstorming`으로 사용자와 설계를 합의한다.
2. `docs/README.md`, `docs/GAME_PRINCIPLES.md`, 관련 공식 문서를 확인하고 필요한 설정집을 갱신한다.
3. spec을 작성하고 사용자의 검토·승인을 받는다.
4. plan을 작성한다.
5. spec과 plan이 모두 있을 때만 구현을 시작한다.
```

- [ ] **Step 2: 작성자 식별자와 파일명 규칙을 작성한다**

`## Spec과 plan 파일명` 섹션에 아래 우선순위와 형식을 포함한다.

```text
작성자 우선순위: 요청에 지정한 `작성자: <식별자>` → git config user.name
정규화: 소문자 영문·숫자·하이픈만 사용하고, 공백은 하이픈으로 바꾼다.
spec: docs/superpowers/specs/YYYY-MM-DD-<topic>-<author>-design.md
plan: docs/superpowers/plans/YYYY-MM-DD-<feature>-<author>.md
```

Git 이름을 찾을 수 없고 요청자 지정도 없으면 구현 전에 작성자 식별자를 사용자에게 묻도록 명시한다. AI 도구 이름은 파일명에 넣지 않고 문서 본문의 `작성 도구` 항목에 기록하도록 명시한다.

- [ ] **Step 3: AGENTS.md의 규칙을 검증한다**

Run:

```powershell
rg -n "brainstorming|spec|plan|작성자:|git config user.name|YYYY-MM-DD|작성 도구" AGENTS.md
```

Expected: 필수 순서, 작성자 우선순위, 두 파일명 형식, AI 도구 기록 위치가 모두 출력된다.

- [ ] **Step 4: 두 문서의 흐름과 형식이 일치하는지 검증한다**

Run:

```powershell
rg -n "brainstorming|spec|plan|작성자|git config user.name|docs/superpowers" README.md AGENTS.md
```

Expected: README에는 요약 게이트와 세부 규칙 링크가, AGENTS.md에는 실행 가능한 세부 규칙이 출력된다.

- [ ] **Step 5: Commit**

```powershell
git add AGENTS.md README.md
git commit -m "docs: add AI workflow instructions"
```
