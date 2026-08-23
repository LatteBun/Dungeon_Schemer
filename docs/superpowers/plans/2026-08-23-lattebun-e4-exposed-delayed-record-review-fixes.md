# E4 Exposed 지연 기록 리뷰 보완 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E4가 `exposed` 보스 정보 지연 기록을 사후 trust 검증으로 오해하지 않고 계약 위반으로 거부하며, 원정 상태 주석과 PR 검증 수치를 최신 상태로 맞춘다.

**Architecture:** E2는 `exposed` 반응을 delayed record로 만들지 않지만, E4는 신뢰할 수 없는 `InfoRecord[]` 입력 경계이므로 같은 불변식을 재검증한다. adapter loop가 전투·modifier·verification 전에 `exposed`를 `RuleError("INVALID_GENERATION", ...)`로 중단하고, `actionFor()`도 방어적으로 해당 반응을 거부해 즉시 trust 변화가 중복되지 않게 한다.

**Tech Stack:** TypeScript, Vitest, Next.js 16.3, pnpm, GitHub CLI

**Spec:** `docs/superpowers/specs/2026-08-22-lattebun-e4-boss-battle-adapter-design.md`

## Global Constraints

- E2의 `exposed harm`은 사건 선택 순간에 `adviceHarmed`와 `deceptionExposed`를 처리하며 E4에서 지연 검증하지 않는다.
- E4 입력 `InfoRecord[]`에는 `accepted`와 `suspected` help/harm만 보스전 뒤 검증 대상으로 들어온다.
- `exposed` delayed record는 조용히 skip하거나 suspected 결과로 변환하지 않고 `RuleError("INVALID_GENERATION", ...)`로 드러낸다.
- 검증 실패에서는 `BossResult`, `trustChanges`, `verifications`, `cues`를 반환하지 않아 어떤 후속 계층도 부분 결과를 소비하지 않는다.
- 일반전/보스전 공통 `BattleEngine`과 기존 accepted·suspected 처리, merchant 소비, cue 계약은 변경하지 않는다.
- 커밋 제목과 본문은 한국어로 작성한다.

---

## File Structure

- `lib/rules/boss-battle-adapter.ts`: E4 입력 경계에서 `exposed`를 거부하고 `actionFor()`의 잘못된 suspected fallback을 제거한다.
- `lib/rules/boss-battle-adapter.test.ts`: malformed exposed record가 전투·trust·verification 전에 `INVALID_GENERATION`으로 실패하는 회귀를 고정한다.
- `lib/domain/expedition.ts`: `ExpeditionState.infoRecords` 주석을 accepted와 suspected를 포괄하는 현재 계약으로 수정한다.
- PR #103 본문: 최종 전체 테스트 수를 666개로 갱신하고 이번 입력 경계 검증을 요약한다.

### Task 1: exposed 지연 기록을 E4 입력 경계에서 거부한다

**Files:**
- Modify: `lib/rules/boss-battle-adapter.ts`
- Modify: `lib/rules/boss-battle-adapter.test.ts`

**Interfaces:**
- Consumes: `InfoRecord.reaction`, `InfoRecord.pendingVerification`, `RuleError`.
- Produces: `reaction === "exposed"`인 모든 E4 입력이 battle 실행 전에 `RuleError("INVALID_GENERATION", ...)`를 던지는 `resolveBossBattle()`.

- [ ] **Step 1: malformed exposed record의 실패 회귀 테스트를 작성한다**

```ts
it("exposed delayed record는 trust나 verification을 만들지 않고 INVALID_GENERATION으로 거부한다", () => {
  const exposed = info({
    reaction: "exposed",
    pendingVerification: true,
  });

  expectRuleError(() => resolve({ infoRecords: [exposed] }), {
    code: "INVALID_GENERATION",
    details: {
      record: "boss-event/boss-advice/member-1",
      reaction: "exposed",
    },
  });
});
```

이 테스트는 함수가 throw하므로 `BossResult`, `trustChanges`, `verifications`를 얻을 수 없다는 사실 자체가 부분 결과가 생성되지 않는 계약이다. 기존 `expectRuleError` helper를 재사용하고, test fixture `info()`에 `reaction`과 `pendingVerification`만 덮어쓴다.

- [ ] **Step 2: 현재 exposed fallback에서 테스트가 실패하는지 확인한다**

Run: `pnpm test lib/rules/boss-battle-adapter.test.ts`

Expected: FAIL; 현재 `actionFor()`가 accepted가 아닌 reaction을 suspected로 처리해 `resolveBossBattle()`가 결과를 반환한다.

- [ ] **Step 3: 입력 검증과 방어적 action 분기를 구현한다**

`resolveBossBattle()`의 record loop에서 duplicate/rule/participant 검증 다음, `member.alive` 검사 전에 exposed를 거부한다. 죽은 참가자의 malformed record도 동일하게 계약 위반으로 보고해야 하므로 생존 여부로 검증을 건너뛰지 않는다.

```ts
if (record.reaction === "exposed") {
  invalid("적발된 보스 정보는 E4 지연 기록이 될 수 없다", {
    record: key,
    characterId: record.characterId,
    reaction: record.reaction,
  });
}
```

`actionFor()`는 accepted와 suspected만 반환하도록 명시 분기한다.

```ts
function actionFor(record: InfoRecord): BossInfoVerificationAction {
  if (record.reaction === "accepted") {
    return record.outcome === "help" ? "adviceHelped" : "adviceHarmed";
  }
  if (record.reaction === "suspected") {
    return record.outcome === "help" ? "suspicionWasCostly" : "suspicionWasCorrect";
  }
  invalid("적발된 보스 정보는 사후 검증할 수 없다", {
    record: recordKey(record),
    characterId: record.characterId,
    reaction: record.reaction,
  });
}
```

`neutral` record의 기존 skip과 accepted/suspected의 modifier·verification 동작은 바꾸지 않는다.

- [ ] **Step 4: exposed 회귀와 기존 adapter 계약을 통과시킨다**

Run: `pnpm test lib/rules/boss-battle-adapter.test.ts && pnpm typecheck`

Expected: PASS; malformed exposed input은 `INVALID_GENERATION`이며 accepted/suspected, clamp, cue, roundLimit, mismatch/duplicate 회귀가 계속 통과한다.

- [ ] **Step 5: E4 입력 경계 변경을 커밋한다**

```bash
git add lib/rules/boss-battle-adapter.ts lib/rules/boss-battle-adapter.test.ts
git commit -m "수정: 적발된 보스 정보 지연 기록을 거부한다" -m "E4가 exposed 반응을 suspected 사후 검증으로 오해하지 않도록 입력 계약을 검증한다."
```

### Task 2: 원정 상태 문서와 PR 검증 정보를 갱신한다

**Files:**
- Modify: `lib/domain/expedition.ts`
- Update: PR #103 body

**Interfaces:**
- Produces: accepted/suspected를 모두 설명하는 `ExpeditionState.infoRecords` 주석과 최신 검증 수치가 있는 PR 본문.
- Consumes: Task 1 구현 후 전체 테스트 결과.

- [ ] **Step 1: 원정 상태 주석을 새 지연 검증 계약에 맞춘다**

```ts
/** 보스전 뒤 검증할 지연형 조언의 개인별 반응이다. accepted와 suspected를 보존한다. */
infoRecords: readonly InfoRecord[];
```

이 주석은 `InfoRecord` 자체의 설명과 같은 범위를 가리키며, exposed를 포함한다고 암시하지 않는다.

- [ ] **Step 2: 전체 검증을 실행한다**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm test docs/DOCUMENT_LINKS.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts && pnpm exec next build --webpack && git diff --check`

Expected: typecheck와 webpack build가 통과하고, lint는 새 오류 없이 기존 44개 warning만 보고하며, 전체 Vitest는 67개 파일·666개 테스트, 문서 테스트는 2개 파일·4개 테스트를 통과한다.

- [ ] **Step 3: 주석을 커밋한다**

```bash
git add lib/domain/expedition.ts
git commit -m "문서: 원정 지연 정보 반응 범위를 명확히 한다" -m "원정 상태 주석이 accepted와 suspected 보스 정보 검증 계약을 설명하게 한다."
```

- [ ] **Step 4: PR 본문의 검증 수치와 수정 요약을 갱신한다**

Task 2 Step 2의 실제 통과 결과가 67개 파일·666개 테스트인지 확인한 뒤, 다음 본문으로 PR #103을 갱신한다.

```bash
gh pr edit 103 --body "## 요약
- E4 보스 특성 카탈로그와 신규 보정 공식을 추가했습니다.
- E2 지연 보스 정보 기록을 규칙 ID 기반 계약으로 이관했습니다.
- BattleEngine에 멤버별 정적 보정 입력을 추가했습니다.
- 보스전 어댑터, 사후 검증, 신뢰도 반영, actionIndex 기반 UI presentation cue를 구현했습니다.
- exposed 지연 기록은 E4 입력 경계에서 거부해 즉시 처리된 trust 변화가 중복되지 않게 했습니다.
- 관련 설정집, 작업 배정 문서, 리뷰 보완 Plan을 갱신했습니다.

## 검증
- pnpm test: 67개 파일, 666개 테스트 통과
- pnpm typecheck 통과
- pnpm lint 통과 (기존 경고 44개, 새 오류 없음)
- 문서 링크/용어 테스트 통과
- pnpm exec next build --webpack 통과

참고: 기본 Turbopack 빌드는 환경에서 정체되어 중단했으며 webpack 빌드로 성공을 확인했습니다. E4 작업 상태는 E3 선행 조건 때문에 배정표에서 🟡로 유지했습니다."
```

- [ ] **Step 5: PR 반영 상태를 확인한다**

Run: `git push origin spec/e4-boss-battle-adapter && gh pr view 103 --json url,state,headRefOid,body`

Expected: PR은 Open 상태를 유지하고, `headRefOid`가 Task 1·2 커밋을 포함하며 본문에는 `666개 테스트 통과`와 exposed 입력 경계 설명이 있다.

## Self-Review

- E4 Spec의 exposed 비중복 검증 계약은 Task 1의 입력 거부와 `actionFor()` 방어 분기로 충족한다.
- dead member를 포함한 malformed 입력도 생존 여부 전에 거부하므로 trust/verification partial result가 생기지 않는다.
- 정상 E2 producer는 이미 exposed record를 만들지 않으므로 production path를 넓히지 않고 consumer boundary만 강화한다.
- reviewer가 지적한 `ExpeditionState.infoRecords` 주석과 PR의 오래된 테스트 수는 Task 2가 갱신한다.
- Plan은 공통 BattleEngine, bossInfo modifier, cue priority, merchant semantics를 바꾸지 않는다.

