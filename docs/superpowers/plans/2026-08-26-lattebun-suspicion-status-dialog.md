# 의심 인원 상태 칩 팝업 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 GameShell에서 `의심 인원` 상태 칩을 눌러 누적 고발 위험을 설명하는 팝업을 연다.

**Architecture:** `TopStatusBar`가 팝업 열림 상태와 native dialog를 소유한다. 기존 `StatusItem` button 경로와 `AchievementOverlay`의 showModal/cancel 패턴을 사용한다.

**Tech Stack:** Next.js 16.3.0, React 19, TypeScript, native HTML dialog, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-suspicion-status-dialog-design.md`

## Global Constraints

- 레이블은 `의심 인원`, 값은 raw `livingCount / threshold`이며 집계·엔딩 규칙은 바꾸지 않는다.
- 팝업 제목·본문은 Spec의 고정 문구를 그대로 사용한다.
- `Escape`, backdrop, `닫기`로 닫고 칩으로 포커스를 복귀한다.
- 새 패키지·CampaignState 필드·화면별 상태 바 CSS를 추가하지 않는다.

### Task 1: 상태 칩과 팝업을 구현한다

**Files:** `components/game/TopStatusBar.tsx`, `components/game/TopStatusBar.test.ts`

- [ ] `TopStatusBar.test.ts`에 `의심 인원` button, `aria-label="의심 인원: 7 / 5"`, dialog 제목·고정 본문을 검증하는 실패 테스트를 추가한다.
- [ ] `pnpm vitest run components/game/TopStatusBar.test.ts`가 이전 읽기 전용 렌더링으로 실패하는지 확인한다.
- [ ] `useRef`·`useState`, native `<dialog>`, `showModal`/`close`, Escape·backdrop·닫기와 trigger focus 복귀를 구현한다. trigger test id는 `zero-trust-info-trigger`로 고정한다.
- [ ] `pnpm vitest run components/game/TopStatusBar.test.ts components/game/GameShell.test.ts`와 `pnpm typecheck`를 실행한다.
- [ ] 한글 제목·본문으로 커밋한다.

### Task 2: 문서와 브라우저 회귀를 갱신한다

**Files:** `docs/README.md`, `docs/experience/SCREEN_LAYOUT.md`, `docs/experience/ONBOARDING_AND_INTERFACE.md`, `docs/technical/SCREEN_ADAPTER_CONTRACT.md`, `e2e/canvas-layout.spec.ts`

- [ ] 문서의 `신뢰 0` 상태 바 설명을 `의심 인원` 레이블, 현재 생존 `trust === 0` 집계, 고정 팝업의 누적 고발 설명으로 갱신하고 spec/plan 색인을 추가한다.
- [ ] `/u1-test?screen=board`에서 trigger를 클릭해 dialog·고정 본문을 확인하고 Escape 후 dialog가 닫히며 trigger로 초점이 돌아오는 Playwright 회귀를 추가한다.
- [ ] 문서 테스트, `TopStatusBar` test, canvas E2E, typecheck, `git diff --check`를 실행하고 한글 제목·본문으로 커밋한다.
