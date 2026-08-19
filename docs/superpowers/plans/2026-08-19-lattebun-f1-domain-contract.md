# F1 도메인 계약 재정의 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 캐릭터 풀·위험도·임시 파티·월드턴·엔딩 5종을 담은 도메인 타입과 시드 스트림 이름을 놓고, 등급·영속 파티를 전제한 옛 구현을 걷어낸다.

**Architecture:** `F1`은 규칙도 화면도 만들지 않으므로 런타임으로 잡을 것이 거의 없다. 그래서 안전망을 둘로 나눈다. 닫힌 목록이 실제로 닫혀 있는지는 `__checks__.ts`의 **컴파일 타임 계약**이 잡고, 문서 수치가 상수와 맞는지는 **런타임 계약 테스트**가 잡는다. TDD의 red 단계는 테스트 실패가 아니라 **타입 검사 실패**로 나타난다.

새 타입 파일 여럿이 옛 파일과 이름이 겹치므로 철거를 먼저 한다. 철거 직후부터 새 배럴이 완성될 때까지 타입 검사가 깨져 있는 것이 정상이다.

**Tech Stack:** TypeScript 5, Vitest 4, Next.js 16

**Spec:** `docs/superpowers/specs/2026-08-19-lattebun-f1-domain-contract-design.md`

## Global Constraints

- 캐릭터 풀 **30명**. 5직업 × 6명, 5성격 × 6명. 캠페인 도중 충원 없음
- 던전 **15개**, 테마 3종. 초기 위험도 ★1 3개 · ★2 4개 · ★3 4개 · ★4 3개 · ★5 1개
- 진입 한계: C는 ★2, B는 ★3, A는 ★4, S는 ★5
- 시작 명성 **30**, 명성 하한 **0**, 시작 골드 **10**
- 승급 요구 명성 60 / 120 / 200, 골드 승급 150 / 320 / 600. 자동 승급 없음
- 엔딩 5종과 판정 순서: 불신의 대가 → 누적 고발 → 원정 종료 → 인력 소진 → 실직
- 테마마다 생태 규칙 6개, 던전마다 활성 규칙 3개
- 월드턴: HP 50% 미만 강제 휴식, 회복 `max(2, round(최대HP × 0.15))`, 20% 미만 중상, 백그라운드 HP 하한 1
- `Math.random`을 직접 호출하지 않는다. eslint가 오류로 막는다
- 주석은 한국어로 쓰고 **무엇을 하는지가 아니라 왜 그런지**를 적는다. 기존 파일의 주석 밀도를 따른다
- 확정되지 않은 수치를 상수로 넣지 않는다. 모든 상수는 `docs/systems/`에 근거가 있어야 한다

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `lib/domain/ids.ts` (수정) | 브랜드 ID. `CharacterId`·`RuleId`·`MonsterId`·`OfferId` |
| `lib/domain/character.ts` (신규) | 캐릭터 상태, 성격, 직업, 신뢰, 출전 가능 판정 |
| `lib/domain/pool.ts` (신규) | 풀 30명과 원정 1회짜리 임시 파티 |
| `lib/domain/dungeon.ts` (재작성) | 위험도, 테마, 생태 규칙, 몬스터, 보스, 지도 |
| `lib/domain/campaign.ts` (재작성) | 길잡이 등급, 명성·골드, 승급, 엔딩 5종, 단계 |
| `lib/domain/worldturn.ts` (신규) | 휴식·백그라운드·중상 배정과 결과 |
| `lib/domain/expedition.ts` (재작성) | 원정 상태와 보스전 턴 기록 |
| `lib/domain/content.ts` (재작성) | 아이템과 사건 태그 |
| `lib/domain/seeds.ts` (신규) | 시드 스트림 이름 10개 |
| `lib/domain/index.ts` (재작성) | 배럴 |
| `lib/domain/__checks__.ts` (재작성) | 컴파일 타임 계약 |
| `lib/domain/contract.test.ts` (신규) | 문서 수치와 상수가 맞는지 확인 |
| `app/page.tsx` (수정) | 자리 표시 화면 |
| `docs/technical/DEVELOPMENT_ENVIRONMENT.md` (수정) | 스트림 목록과 예시 갱신 |
| `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` (수정) | `F1` 상태와 선행 갱신 |

`lib/domain/party.ts`는 삭제한다. 파티가 캠페인 동안 유지되는 단위가 아니게 되어 `character.ts`와 `pool.ts`로 갈라진다.

---

## Task 1: 옛 모델 철거

**Files:**
- Delete: `lib/backtest/`, `lib/flow/`, `lib/stores/`, `lib/mock/`, `lib/dev-tools/`, `components/game/`
- Delete: `lib/rules/` 중 `board` `boss` `campaign-init` `dungeon` `ending` `event` `expedition-key` `fixtures` `info` `map` `offer-risk` `party` `party-lifecycle` `promotion` `settlement` `statistics` 와 각 테스트
- Delete: `lib/content/` 중 `bosses` `classes` `dungeons` `effects` `events` `items` `names` `validation` 과 `content.test.ts`
- Delete: `app/play/`, `app/e1-test/`, `app/f1-test/`, `app/f2-test/`, `app/info-card-test/`, `app/integration-test/`, `app/u1-test/`, `app/u2-test/`, `app/u3-test/`
- Delete: `lib/domain/` 중 `campaign.test.ts` `expedition.test.ts` `constants.test.ts` `party.ts` `__checks__.ts`

**Interfaces:**
- Consumes: 없음
- Produces: 이 시점부터 타입 검사가 깨진다. Task 3까지 정상이다

- [ ] **Step 1: 옛 구현과 테스트를 지운다**

- [ ] **Step 2: 남겨야 할 자산이 남아 있는지 확인한다**

```bash
ls lib/rng lib/domain/errors.ts lib/content/info-cards.ts components/ui
ls lib/rules/trust.ts lib/rules/trust.test.ts \
   lib/rules/personality-profile.ts lib/rules/personality-profile.test.ts \
   lib/rules/trust-history.ts lib/rules/trust-history.test.ts
```

**이 확인을 건너뛰지 않는다.** `lib/rules/*.test.ts` 같은 와일드카드로 지우면 남겨야 할 신뢰 테스트 3개가 함께 날아간다. 실제로 그렇게 날린 적이 있다.

---

## Task 2: 새 도메인 타입

**Files:**
- Modify: `lib/domain/ids.ts`
- Create: `lib/domain/character.ts`, `lib/domain/pool.ts`, `lib/domain/worldturn.ts`, `lib/domain/seeds.ts`
- Rewrite: `lib/domain/dungeon.ts`, `lib/domain/campaign.ts`, `lib/domain/expedition.ts`, `lib/domain/content.ts`

**Interfaces:**
- Consumes: `docs/systems/` 의 확정 수치
- Produces: `Character` `CharacterPool` `ExpeditionParty` `RiskLevel` `ThemeId` `EcologyRule` `MonsterDef` `BossDef` `CampaignDungeon` `GuideRank` `EndingKind` `CampaignState` `WorldTurnResult` `ExpeditionState` `SeedStream` 과 관련 상수

- [ ] **Step 1: `ids.ts`에 `CharacterId`·`RuleId`·`MonsterId`·`OfferId`를 놓는다**

`MemberId`는 `CharacterId`로 바꾼다. 단위가 파티원이 아니라 캐릭터다.

- [ ] **Step 2: `character.ts`를 쓴다**

`Character`는 `maxHp`·`hp`·`trust`·`gold`·`alive`·`gravelyWounded`를 갖는다. 출전 가능 조건은 함수 하나로 모은다.

```typescript
export function canDeploy(character: Character): boolean {
  return character.alive && character.trust > TRUST_MIN && !character.gravelyWounded;
}
```

세 조건을 한곳에 두는 이유를 주석으로 남긴다. 화면과 편성 규칙이 각자 판단하면 한쪽만 고쳐졌을 때 게시판에는 보이는데 편성은 안 되는 상태가 된다.

- [ ] **Step 3: `pool.ts`를 쓴다**

`CharacterPool`은 `byId`와 생성 순서 `order`를 갖는다. `ExpeditionParty`는 `memberIds`만 갖는다.

**영속 파티 타입을 만들지 않는다.** 타입을 남겨 두면 어딘가에서 다시 캠페인 상태에 얹힌다.

- [ ] **Step 4: `dungeon.ts`를 쓴다**

`CampaignDungeon`은 `initialRiskLevel`과 `riskLevel`을 **따로** 갖는다. 지점 수는 초기 위험도로 고정되고 보상·정보 기회는 현재 위험도를 따른다. 한 필드로 두면 실패가 던전을 길게 만드는 잘못된 규칙이 된다. 이 이유를 주석에 남긴다.

- [ ] **Step 5: `campaign.ts`를 쓴다**

`GuideRank`는 진입 한계만 정한다. `RANK_RISK_LIMIT`을 `Readonly<Record<GuideRank, RiskLevel>>`로 선언해 등급 하나가 빠지면 선언 자리에서 깨지게 한다.

`ENDING_ORDER` 배열 순서가 곧 판정 순서다.

- [ ] **Step 6: `worldturn.ts`와 `expedition.ts`, `content.ts`, `seeds.ts`를 쓴다**

`ExpeditionState`는 계약 시점의 `riskLevel`을 들고 있는다. 정산의 명성 손실을 상승 전 값으로 계산해야 계약 화면에서 본 위험과 어긋나지 않는다.

시드 스트림은 `pool` `board` `party` `map` `ecology` `card` `event` `boss` `trust` `worldturn` 열이다.

---

## Task 3: 배럴과 컴파일 타임 계약

**Files:**
- Rewrite: `lib/domain/index.ts`, `lib/domain/__checks__.ts`

**Interfaces:**
- Consumes: Task 2의 타입들
- Produces: `@/lib/domain` 배럴. 이 시점에 타입 검사가 다시 초록이어야 한다 (남긴 자산의 개명 전이므로 그쪽 오류는 남는다)

- [ ] **Step 1: 배럴을 쓴다**

- [ ] **Step 2: 컴파일 타임 계약을 쓴다**

런타임 상수로 두면 eslint가 미사용 변수로 경고한다. 타입 단언으로 쓴다.

```typescript
type IsExhaustive<TUnion, TList extends readonly unknown[]> =
  Exclude<TUnion, TList[number]> extends never ? true : false;
type Assert<T extends true> = T;

export type EndingOrderCoversEveryEnding = Assert<
  IsExhaustive<EndingKind, typeof ENDING_ORDER>
>;
```

엔딩·단계·등급·테마·성격·진위·스트림·월드턴 활동·위험도 아홉을 확인한다.

선언 자리에서 이미 강제되는 계약은 여기 다시 적지 않는다. 같은 계약을 두 곳에 두면 한쪽만 고쳐진다.

---

## Task 4: 남긴 자산 개명과 자리 표시 화면

**Files:**
- Modify: `lib/rules/trust.ts`, `trust.test.ts`, `personality-profile.ts`, `personality-profile.test.ts`, `trust-history.ts`, `trust-history.test.ts`, `lib/content/info-cards.ts`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `@/lib/domain` 배럴
- Produces: 타입 검사·lint·build 초록

- [ ] **Step 1: `MemberId` → `CharacterId`, `PartyMember` → `Character`, `memberId` → `characterId`로 바꾼다**

- [ ] **Step 2: `trust.test.ts`의 픽스처에 `maxHp`·`hp`·`gold`·`gravelyWounded`를 채운다**

- [ ] **Step 3: `app/page.tsx`를 자리 표시 화면으로 바꾼다**

기존 `redirect("/play")`는 지워진 경로를 가리켜 404가 된다. 빈 화면이나 404를 두지 않는다. 저장소를 처음 받은 사람이 고장인지 진행 중인지 구분할 수 있어야 한다. 무엇이 없는 것이고 어디를 보면 되는지 화면이 직접 말한다.

---

## Task 5: 계약 테스트

**Files:**
- Create: `lib/domain/contract.test.ts`

**Interfaces:**
- Consumes: `@/lib/domain`
- Produces: 문서 수치와 상수가 어긋나면 실패하는 테스트

- [ ] **Step 1: 문서 수치를 상수로 확인하는 테스트를 쓴다**

풀 30명과 5성격 × 6명의 곱이 맞는지, 위험도가 다섯인지, 엔딩 순서 배열이 문서와 같은지, 시드 스트림에 `ecology`와 `worldturn`이 있고 중복이 없는지, 시작값(명성 30 · 골드 10 · 던전 15 · 공고 5 · 파티 3 · 고발 5)이 맞는지, 진입 한계가 `[2, 3, 4, 5]`인지, 승급 요구치가 등급이 오를수록 커지는지를 확인한다.

- [ ] **Step 2: `canDeploy`의 경계를 확인한다**

신뢰 0은 출전 불가, 신뢰 **1은 출전 가능**이다. 낮은 신뢰는 위험할 뿐 자격이 아니다. 이 경계를 테스트로 고정한다.

---

## Task 6: 설정집과 배정표 갱신

**Files:**
- Modify: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: Task 2의 스트림 목록
- Produces: `C3`·`E1`·`U1`의 선행 해제

- [ ] **Step 1: 개발 환경 문서를 고친다**

「난수와 재현성」에 스트림 10개 목록을 적는다. 지금은 분리 원칙만 있고 목록이 없어 스트림 이름의 근거가 코드에만 존재한다. 예시의 `PartyMember`를 `Character`로 바꾸고, 「테스트」 절이 가리키는 예시 파일을 `lib/domain/contract.test.ts`로 바꾼다.

`docs/technical/F1_TESTING.md`는 **손대지 않는다.** 옛 개편의 검증 기록이다.

- [ ] **Step 2: 배정표를 갱신한다**

`F1`을 ✅로 바꾸고 `C1`·`C2`·`C3`·`E1`·`U1`의 선행에서 `F1`을 지운다. 「재사용 자산과 새로 만드는 것」에 옛 구현이 왜 사라졌고 어디서 찾는지를 적는다.

---

## Task 7: 검증

**Files:** 없음

- [ ] **Step 1: 전체 검증을 돌린다**

```bash
npx tsc --noEmit
npm run lint
npm run build
npx vitest run
```

lint 경고가 0이어야 한다. 줄어든 테스트 개수를 기록한다.

- [ ] **Step 2: 컴파일 타임 계약이 실제로 발동하는지 확인한다**

`ENDING_ORDER`에서 엔딩 하나를 빼고 `npx tsc --noEmit`이 `Type 'false' does not satisfy the constraint 'true'`로 깨지는 것을 본 뒤 되돌린다.

**만들기만 하고 발동을 안 보면 검사가 있다고 착각하게 된다.** 이 프로젝트에서 이미 여러 번 잡아낸 실수다.

- [ ] **Step 3: 문서 검사를 돌린다**

```bash
npx vitest run docs/
```

배정표 무결성·용어 감시·링크 검사가 모두 통과해야 한다.
