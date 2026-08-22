# U5-2 자동 전투 장면 재생 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E3/E4가 확정한 `BattleResolution`을 규칙 재계산 없이 U5 왼쪽 장면에서 순서대로 재생하고, E4 완성 전에도 실제 E3 일반전과 타입 안전 보스 fixture로 시각 계약을 검증한다.

**Architecture:** 순수 `createU5BattleReplay()` adapter가 전투 기록을 검증해 immutable frame timeline으로 바꾼다. React/Framer Motion 컴포넌트는 timeline의 현재 frame만 표현하며, 기존 `U5ProgressScreen`에는 optional prop으로 연결한다. 실제 일반전 프리뷰만 E3를 호출하고 보스 프리뷰는 E4와 분리된 fixture를 사용한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Framer Motion, 기존 1920×1080 fixed-canvas CSS 계약

**Spec:** `docs/superpowers/specs/2026-08-23-sbh3821-u5-2-battle-replay-design.md`

## Global Constraints

- 작업 위치는 `/Users/semin/Develop/Dungeon_Schemer-codex-u5-2`, 브랜치는 `feature/u5-2-battle-replay`이다.
- 아래 Task 1과 Task 2를 순서대로 실행한다. 사용자가 승인한 범위가 정확히 두 Task이므로 추가 Task를 만들지 않는다.
- `lib/`의 BattleEngine, E2, E3, E4, 도메인 타입과 수치를 수정하지 않는다.
- E4의 modifier 합산·지연 신뢰·원정 결과 반영과 I2 실제 연결은 구현하지 않는다.
- U5 오른쪽 파티 패널의 JSX와 ViewModel을 수정하지 않는다. 전투 장면은 왼쪽 `.u5-scene` 안에만 들어간다.
- 기존 PNG를 재가공하거나 새 이미지 파일을 만들지 않는다.
- 모든 동작 변경은 RED → GREEN → refactor 순서로 진행하고, 각 Task 끝에서 해당 Task의 검증을 통과시킨 뒤 별도 커밋한다.
- 작업 배정표에서 U5-2 전체를 완료 처리하지 않는다. 이번 결과는 Task 1~2 부분 완료다.

---

## Task 1: 순수 replay 계약, 27개 전투 에셋 manifest, 공식 문서 정합성

**Files:**

- Create: `components/game/u5-battle-replay.ts`
- Create: `components/game/u5-battle-replay.test.ts`
- Create: `components/game/u5-battle-assets.ts`
- Create: `components/game/u5-battle-assets.test.ts`
- Modify: `docs/GAME_PRINCIPLES.md`
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/DOCUMENT_TERMINOLOGY.test.ts`

### Step 1: replay timeline의 RED 테스트 작성

- [ ] `components/game/u5-battle-replay.test.ts`를 만들고 다음 최소 record를 fixture로 둔다. 마지막 공격은 `damage: 5`, `targetHpBefore: 4`, `targetHpAfter: 0`으로 만들어 UI가 damage로 HP를 역산하지 못하게 한다.

```ts
const resolution: BattleResolution = {
  status: "victory",
  termination: "defeatedEnemies",
  rounds: 2,
  actions: [
    { round: 1, actorSide: "party", actorId: "party-1", targetId: "enemy-1", damage: 5, targetHpBefore: 9, targetHpAfter: 4, defeated: false },
    { round: 1, actorSide: "enemy", actorId: "enemy-1", targetId: "party-1", damage: 3, targetHpBefore: 10, targetHpAfter: 7, defeated: false },
    { round: 2, actorSide: "party", actorId: "party-1", targetId: "enemy-1", damage: 5, targetHpBefore: 4, targetHpAfter: 0, defeated: true },
  ],
  party: [{ id: "party-1", classId: "warrior", hp: 7, maxHp: 10, attack: 5, hitWeight: 3 }],
  enemies: [{ id: "enemy-1", monsterId: "spider-hatchling", hp: 0, maxHp: 9, baseDamage: 3 }],
};

const presentations = [
  { id: "party-1", name: "코르빈", imageSrc: "/assets/characters/live/warrior/warrior_a.png" },
  { id: "enemy-1", name: "새끼 거미", imageSrc: "/assets/monsters/spider/monster-spider-hatchling.png" },
] as const;
```

- [ ] 다음 계약을 각각 독립된 `it`으로 고정한다.

  - 같은 입력을 두 번 변환하면 구조적으로 같은 replay가 나온다.
  - frame phase가 `idle`, action마다 `attack → impact → settle`, 마지막 `complete` 순서다.
  - 위 3-action fixture는 `1 + 3×3 + 1 = 11` frame이다.
  - `attack`과 `impact`의 대상 HP는 `targetHpBefore`, `settle`은 정확한 `targetHpAfter`다.
  - `impact.damage`는 action의 `damage`를 그대로 유지한다.
  - complete HP는 `resolution.party`와 `resolution.enemies`의 최종 HP와 같다.
  - 처음 target이 된 시점의 `targetHpBefore`가 initial HP이며, target이 된 적 없는 참가자는 final HP를 initial HP로 쓴다.
  - participant 순서는 resolution의 party 뒤 enemies 순서다.
  - presentation의 `name`과 `imageSrc`가 그대로 보존되며 portrait 경로를 임의 생성하지 않는다.
  - presentation 누락·중복, resolution 참가자 ID 중복, 알 수 없는 actor/target, HP chain 불일치, 쓰러진 참가자의 후속 행동, final HP 불일치가 설명 가능한 오류로 거부된다.

- [ ] 아직 모듈이 없어서 실패하는지 확인한다.

Run: `pnpm test -- components/game/u5-battle-replay.test.ts`

Expected: FAIL — `./u5-battle-replay` 모듈을 찾지 못한다.

### Step 2: 최소 replay adapter 구현

- [ ] `components/game/u5-battle-replay.ts`에 승인된 public contract를 그대로 선언한다.

```ts
import type { BattleResolution } from "@/lib/rules/battle-engine";

export interface U5BattleParticipantPresentation {
  readonly id: string;
  readonly name: string;
  readonly imageSrc: string;
}

export interface U5BattleReplayInput {
  readonly resolution: BattleResolution;
  readonly presentations: readonly U5BattleParticipantPresentation[];
}

export interface U5BattleReplayParticipant {
  readonly id: string;
  readonly side: "party" | "enemy";
  readonly name: string;
  readonly imageSrc: string;
  readonly maxHp: number;
  readonly initialHp: number;
  readonly finalHp: number;
}

export type U5BattleReplayPhase = "idle" | "attack" | "impact" | "settle" | "complete";

export interface U5BattleReplayFrame {
  readonly phase: U5BattleReplayPhase;
  readonly actionIndex: number | null;
  readonly actorId: string | null;
  readonly targetId: string | null;
  readonly damage: number | null;
  readonly hpByParticipantId: Readonly<Record<string, number>>;
  readonly defeatedParticipantIds: readonly string[];
}

export interface U5BattleReplay {
  readonly participants: readonly U5BattleReplayParticipant[];
  readonly frames: readonly U5BattleReplayFrame[];
  readonly outcome: BattleResolution["status"];
  readonly termination: BattleResolution["termination"];
}

export function createU5BattleReplay(input: U5BattleReplayInput): U5BattleReplay;
```

- [ ] 구현은 다음 순서를 지킨다.

  1. party/enemy ID와 presentation ID를 각각 `Map`으로 만들면서 중복을 거부한다.
  2. resolution 참가자마다 presentation이 정확히 하나 있는지, 사용되지 않은 presentation이 없는지 확인한다.
  3. action을 첫 target 기준으로 훑어 initial HP를 수집하고, 한 번도 target이 아닌 참가자는 resolution final HP를 사용한다.
  4. initial HP snapshot으로 `idle`을 만든다.
  5. action마다 actor/target 존재, actor 생존, 현재 target HP와 `targetHpBefore` 일치를 확인한다.
  6. snapshot 복사본으로 `attack`과 `impact`를 만들고, action의 `targetHpAfter`를 대입한 새 snapshot으로 `settle`을 만든다.
  7. `defeated === true`이면 target을 defeated set에 넣고 이후 actor 사용을 거부한다. `defeated`와 `targetHpAfter === 0`도 서로 맞아야 한다.
  8. 모든 action 뒤 snapshot을 resolution final HP와 비교하고 그 값으로 `complete`를 만든다.

- [ ] 각 frame의 HP map과 defeated ID 배열은 새 객체/배열로 snapshot하여 이전 frame이 후속 action 때문에 변하지 않게 한다. `damage`로 `targetHpAfter`를 계산하는 코드는 두지 않는다.

- [ ] replay 테스트를 다시 실행한다.

Run: `pnpm test -- components/game/u5-battle-replay.test.ts`

Expected: PASS

### Step 3: 27개 에셋 manifest의 RED 테스트 작성

- [ ] `components/game/u5-battle-assets.test.ts`를 만들고 `THEMES.flatMap(theme => [...theme.monsters, ...theme.bosses])`로 공식 콘텐츠 27개를 수집한다.

- [ ] 다음 계약을 검증한다.

  - 공식 콘텐츠 ID가 정확히 27개다.
  - 모든 ID에 `enemyBattleAssetSrc(id)`가 값을 반환한다.
  - manifest key 집합과 공식 콘텐츠 ID 집합이 정확히 같다.
  - 반환 경로 아래 파일을 읽었을 때 첫 8 byte가 PNG signature다.
  - 알 수 없는 ID는 fallback 이미지 대신 오류를 던진다.

```ts
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

for (const content of THEMES.flatMap((theme) => [...theme.monsters, ...theme.bosses])) {
  const src = enemyBattleAssetSrc(content.id);
  const file = readFileSync(join(process.cwd(), "public", src.replace(/^\//, "")));
  expect(file.subarray(0, 8)).toEqual(PNG_SIGNATURE);
}
```

- [ ] 아직 manifest 모듈이 없어서 실패하는지 확인한다.

Run: `pnpm test -- components/game/u5-battle-assets.test.ts`

Expected: FAIL — `./u5-battle-assets` 모듈을 찾지 못한다.

### Step 4: 명시적 에셋 manifest 구현

- [ ] `components/game/u5-battle-assets.ts`에 다음 27개 매핑을 명시적으로 둔다. 파일명 추론이나 문자열 치환으로 경로를 만들지 않는다.

```ts
export const U5_BATTLE_ENEMY_ASSET_SRC_BY_CONTENT_ID = {
  "spider-hatchling": "/assets/monsters/spider/monster-spider-hatchling.png",
  "spider-corpse": "/assets/monsters/spider/monster-spider-corpse.png",
  "spider-cave": "/assets/monsters/spider/monster-spider-cave.png",
  "spider-armored": "/assets/monsters/spider/monster-spider-armored.png",
  "spider-shadow": "/assets/monsters/spider/monster-spider-shadow.png",
  "boss-spider-1": "/assets/monsters/spider/boss-spider-01-ragna.png",
  "boss-spider-2": "/assets/monsters/spider/boss-spider-02-morkan.png",
  "boss-spider-3": "/assets/monsters/spider/boss-spider-03-serina.png",
  "boss-spider-4": "/assets/monsters/spider/boss-spider-04-araksha.png",
  "desert-scorpion": "/assets/monsters/desert/monster-desert-scorpion.png",
  "desert-lizard": "/assets/monsters/desert/monster-desert-lizard.png",
  "desert-cobra": "/assets/monsters/desert/monster-desert-cobra.png",
  "desert-spirit": "/assets/monsters/desert/monster-desert-spirit.png",
  "desert-mummy": "/assets/monsters/desert/monster-desert-mummy.png",
  "boss-desert-1": "/assets/monsters/desert/boss-desert-01-zakar.png",
  "boss-desert-2": "/assets/monsters/desert/boss-desert-02-kardum.png",
  "boss-desert-3": "/assets/monsters/desert/boss-desert-03-obelon.png",
  "boss-desert-4": "/assets/monsters/desert/boss-desert-04-nephris.png",
  "graveyard-zombie": "/assets/monsters/graveyard/monster-graveyard-zombie.png",
  "graveyard-ghoul": "/assets/monsters/graveyard/monster-graveyard-ghoul.png",
  "graveyard-soldier": "/assets/monsters/graveyard/monster-graveyard-soldier.png",
  "graveyard-archer": "/assets/monsters/graveyard/monster-graveyard-archer.png",
  "graveyard-mage": "/assets/monsters/graveyard/monster-graveyard-mage.png",
  "boss-graveyard-1": "/assets/monsters/graveyard/boss-graveyard-01-barkan.png",
  "boss-graveyard-2": "/assets/monsters/graveyard/boss-graveyard-02-morbian.png",
  "boss-graveyard-3": "/assets/monsters/graveyard/boss-graveyard-03-azrael.png",
  "boss-graveyard-4": "/assets/monsters/graveyard/boss-graveyard-04-valdrak.png",
} as const satisfies Readonly<Record<string, string>>;

export function enemyBattleAssetSrc(contentId: string): string {
  const src = (U5_BATTLE_ENEMY_ASSET_SRC_BY_CONTENT_ID as Readonly<Record<string, string>>)[contentId];
  if (src === undefined) throw new Error(`U5 전투 이미지가 없는 콘텐츠다: ${contentId}`);
  return src;
}
```

- [ ] manifest 테스트를 다시 실행한다.

Run: `pnpm test -- components/game/u5-battle-assets.test.ts`

Expected: PASS, 27개 실제 PNG 확인

### Step 5: 공식 문서 모순을 RED 테스트로 고정하고 정리

- [ ] `docs/DOCUMENT_TERMINOLOGY.test.ts`의 `REQUIRED_ANCHORS`에 아래 문구를 먼저 추가해 실패를 확인한다.

```ts
"GAME_PRINCIPLES.md": [/* existing */, "정적 PNG 기반 전투 결과", "다프레임 스프라이트"],
"experience/SCREEN_LAYOUT.md": [/* existing */, "자동 전투 장면"],
"experience/ONBOARDING_AND_INTERFACE.md": [/* existing */, "후속 폴리시"],
```

Run: `pnpm test -- docs/DOCUMENT_TERMINOLOGY.test.ts`

Expected: FAIL — 새 범위 앵커가 아직 공식 문서에 없다.

- [ ] `docs/GAME_PRINCIPLES.md`를 다음 의미로 좁혀 쓴다.

  - 현재 범위: 정적 PNG 기반 공격·피격·HP 변화·사망·승패 전투 결과 표현.
  - 현재 범위 밖: 다프레임 스프라이트, 전용 파티클 이펙트, 복잡한 카메라 연출.
  - 자동 전투 규칙과 수치는 UI가 아니라 기존 rules 계층이 소유한다.

- [ ] `docs/experience/SCREEN_LAYOUT.md`의 U5 왼쪽 상단 40% 장면 슬롯에 자동 전투 장면이 들어갈 수 있음을 적고, 자동 전투 시각화 전체를 범위 밖으로 두던 옛 문장을 삭제한다.

- [ ] `docs/experience/ONBOARDING_AND_INTERFACE.md`에서 `최종 아트 스타일과 애니메이션`이 범위 밖이라는 표현은 정적 PNG 결과 표현이 아니라 다프레임/이펙트/카메라의 후속 폴리시를 뜻한다고 명확히 한다.

- [ ] 게임 규칙·수치·U5-2 작업 상태는 바꾸지 않았는지 diff로 확인하고 문서 테스트를 통과시킨다.

Run: `pnpm test -- docs/DOCUMENT_TERMINOLOGY.test.ts docs/DOCUMENT_LINKS.test.ts`

Expected: PASS

### Step 6: Task 1 검증과 커밋

- [ ] Task 1 대상 테스트와 정적 검사를 실행한다.

Run: `pnpm test -- components/game/u5-battle-replay.test.ts components/game/u5-battle-assets.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts docs/DOCUMENT_LINKS.test.ts`

Expected: PASS

Run: `pnpm typecheck`

Expected: PASS

Run: `pnpm lint`

Expected: PASS

- [ ] scope와 placeholder를 확인한다.

Run: `git diff --check`

Expected: 출력 없음

Run: `rg -n "TODO|TBD|FIXME|placeholder" components/game/u5-battle-* docs/GAME_PRINCIPLES.md docs/experience/SCREEN_LAYOUT.md docs/experience/ONBOARDING_AND_INTERFACE.md`

Expected: 새 구현 미완료 표식 없음

- [ ] Task 1 파일만 stage하고 커밋한다.

```bash
git add components/game/u5-battle-replay.ts components/game/u5-battle-replay.test.ts components/game/u5-battle-assets.ts components/game/u5-battle-assets.test.ts docs/GAME_PRINCIPLES.md docs/experience/SCREEN_LAYOUT.md docs/experience/ONBOARDING_AND_INTERFACE.md docs/DOCUMENT_TERMINOLOGY.test.ts
git commit -m "feat: U5 전투 재생 계약을 추가한다"
```

---

## Task 2: Framer Motion 전투 장면, U5 왼쪽 슬롯 연결, `/u5-2-test`

**Files:**

- Create: `components/game/U5BattleScene.tsx`
- Create: `components/game/U5BattleScene.test.tsx`
- Create: `components/game/u5-battle-preview-data.ts`
- Create: `components/game/u5-battle-preview-data.test.ts`
- Create: `components/game/U5BattlePreview.tsx`
- Create: `app/u5-battle.css`
- Create: `app/u5-2-test/page.tsx`
- Modify: `components/game/U5ProgressScreen.tsx`
- Modify: `components/game/U5ProgressScreen.test.tsx`
- Modify: `components/game/U5FixedCanvas.test.ts`
- Modify: `app/layout.tsx`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

### Step 1: U5 왼쪽 슬롯 연결의 RED 테스트 작성

- [ ] `components/game/U5ProgressScreen.test.tsx`에 Task 1 adapter로 만든 작은 replay fixture를 추가한다.

- [ ] 다음 계약을 테스트한다.

  - `battleReplay`가 없으면 기존 `data-testid="u5-scene"`, scene background URL, `aria-hidden="true"`가 유지되고 전투 DOM이 없다.
  - `battleReplay`가 있으면 같은 `.u5-scene` 안에 `data-testid="u5-battle-scene"`이 렌더된다.
  - battle이 있을 때 scene 자체는 접근성 트리에서 숨겨지지 않는다.
  - battle 유무 두 HTML에서 `data-testid="u5-party"` 구간을 추출하면 완전히 같다.

- [ ] `U5ProgressScreenProps`에 prop이 없고 전투 컴포넌트도 없어서 실패하는지 확인한다.

Run: `pnpm test -- components/game/U5ProgressScreen.test.tsx`

Expected: FAIL — `battleReplay`가 렌더링에 영향을 주지 않는다.

### Step 2: U5BattleScene의 정적·접근성 RED 테스트 작성

- [ ] `components/game/U5BattleScene.test.tsx`를 만들고 `renderToStaticMarkup()`으로 initial idle frame을 렌더한다.

- [ ] 다음 정적 계약을 검증한다.

  - 모든 참가자 이름, alt, 숫자 `현재 HP / 최대 HP`, HP bar 접근 가능한 label이 있다.
  - party와 enemy group을 문구와 `data-side`로 구분한다.
  - 현재 행동 문장 하나만 `aria-live="polite"`다.
  - `전투 건너뛰기`가 실제 `button`이다.
  - complete frame으로 시작하는 replay를 렌더하면 결과 문구와 `다시 보기` button이 있다.
  - 쓰러진 참가자는 `쓰러짐` 텍스트를 함께 표시한다.

- [ ] 아직 컴포넌트가 없어서 실패하는지 확인한다.

Run: `pnpm test -- components/game/U5BattleScene.test.tsx`

Expected: FAIL — `./U5BattleScene` 모듈을 찾지 못한다.

### Step 3: Framer Motion 의존성 추가

- [ ] 저장소 package manager를 통해 Framer Motion을 추가하고 `package.json`과 `pnpm-lock.yaml`만 갱신되는지 확인한다.

Run: `pnpm add framer-motion`

Expected: dependencies에 `framer-motion`이 추가되고 lockfile이 정상 갱신된다. 네트워크가 sandbox에서 차단되면 같은 명령에 필요한 권한 승인을 요청한다.

### Step 4: U5BattleScene 최소 구현

- [ ] `components/game/U5BattleScene.tsx`를 client component로 만들고 public prop을 다음 하나로 제한한다.

```ts
export interface U5BattleSceneProps {
  readonly replay: U5BattleReplay;
}
```

- [ ] `frameIndex`만 local state로 소유한다. `useEffect`는 현재 frame이 complete가 아닐 때 다음 index로 한 번 이동하는 timeout 하나만 예약하고 cleanup에서 해제한다.

```ts
const FRAME_DURATION_MS: Readonly<Record<U5BattleReplayPhase, number>> = {
  idle: 500,
  attack: 360,
  impact: 420,
  settle: 520,
  complete: 0,
};
```

- [ ] `전투 건너뛰기`는 `setFrameIndex(replay.frames.length - 1)`, `다시 보기`는 `setFrameIndex(0)`만 호출한다. 두 handler 어디에서도 E3/E4/rules 함수나 callback을 호출하지 않는다.

- [ ] 현재 frame 설명을 다음 규칙으로 한 문장만 만든다.

  - idle: `전투가 시작됩니다.`
  - attack: `{actor.name}이(가) {target.name}을(를) 공격합니다.`
  - impact: `{target.name}이(가) {damage} 피해를 받습니다.`
  - settle: defeated이면 `{target.name}이(가) 쓰러졌습니다.`, 아니면 `{target.name} HP가 {hp}로 감소했습니다.`
  - complete: victory이면 `파티가 전투에서 승리했습니다.`, wipe이면 `파티가 전투에서 패배했습니다.`

- [ ] 참가자 DOM은 party/enemy 두 group으로 나누되 같은 participant component를 쓴다. HP width는 `Math.max(0, Math.min(100, hp / maxHp * 100))`의 CSS custom property로만 표현하고 숫자 문구를 항상 함께 둔다.

- [ ] Framer Motion은 participant의 별도 orientation wrapper 안쪽 motion wrapper에 적용한다.

  - alive idle: 작은 `y` 반복.
  - actor + attack: 자기 진영에 따라 중앙 방향 `x` lunge.
  - target + impact: 짧은 `x` shake.
  - impact damage number: opacity/y enter-exit.
  - target + defeated: opacity 감소. 동시에 `쓰러짐` 텍스트 유지.

- [ ] `useReducedMotion()`이 true이면 lunge/idle/shake의 transform 값을 0으로 만들되 frame index, 설명, damage, HP 변화는 그대로 진행한다.

- [ ] `components/game/U5ProgressScreen.tsx`에는 아래 prop과 왼쪽 scene 조건부 렌더만 추가한다. 기존 `rightPanel={...}` 블록은 byte-for-byte 건드리지 않는다.

```ts
export interface U5ProgressScreenProps {
  // existing props
  readonly battleReplay?: U5BattleReplay;
}
```

```tsx
<div
  className="u5-scene"
  data-testid="u5-scene"
  data-scene-kind={progress.sceneKind}
  style={{ backgroundImage: `url("${sceneSrc(progress.theme, progress.sceneKind)}")` }}
  aria-hidden={battleReplay === undefined ? "true" : undefined}
>
  {battleReplay === undefined ? null : <U5BattleScene replay={battleReplay} />}
</div>
```

- [ ] 정적 렌더 테스트를 통과시킨다.

Run: `pnpm test -- components/game/U5BattleScene.test.tsx components/game/U5ProgressScreen.test.tsx`

Expected: PASS

### Step 5: 실제 E3 일반전과 보스 fixture 프리뷰의 RED 테스트 작성

- [ ] `components/game/u5-battle-preview-data.test.ts`를 만들고 다음 계약을 검증한다.

  - preview ID는 정확히 `e3-monster`와 `boss-fixture` 두 개다.
  - `e3-monster` record는 action이 하나 이상이며 같은 seed로 다시 만들면 같다.
  - E3 entry의 replay frame 수는 `1 + actions.length * 3 + 1`이다.
  - `boss-fixture` entry의 source label에 `E4 미연결 fixture`가 명시된다.
  - boss fixture의 enemy ID는 공식 boss manifest 경로로 해석된다.
  - 두 entry의 party presentation에는 명시적인 기존 live portrait 경로가 있다.

- [ ] 모듈이 없어서 실패하는지 확인한다.

Run: `pnpm test -- components/game/u5-battle-preview-data.test.ts`

Expected: FAIL — `./u5-battle-preview-data` 모듈을 찾지 못한다.

### Step 6: preview data를 rules 경계에 맞춰 구현

- [ ] `components/game/u5-battle-preview-data.ts`에 다음 형태를 export한다.

```ts
export type U5BattlePreviewId = "e3-monster" | "boss-fixture";

export interface U5BattlePreviewEntry {
  readonly id: U5BattlePreviewId;
  readonly label: string;
  readonly sourceLabel: string;
  readonly status: TopStatusView;
  readonly progress: U5ProgressView;
  readonly log: readonly U5LogEntry[];
  readonly ecology: U5EcologyView;
  readonly resolution: BattleResolution;
  readonly replay: U5BattleReplay;
}

export function createU5BattlePreviewEntries(): readonly U5BattlePreviewEntry[];
export const U5_BATTLE_PREVIEW_ENTRIES: readonly U5BattlePreviewEntry[];
```

- [ ] 실제 E3 entry는 다음 소스를 직접 사용한다.

  - `initializeCampaign("u5-dungeon-progress-preview")`의 살아 있는 첫 세 캐릭터.
  - `eventsForTheme("spider")`의 encounter가 있는 monster 사건.
  - `SPIDER_THEME.monsters`, `SPIDER_THEME.monsters.map(monster => monster.id)`, `CLASSES`.
  - `resolveMonsterEventBattle({ modifier: {}, pendingMerchantEffect: null, retrySteps: 0, seed: "u5-2-e3-monster-preview", ... })`.
  - 반환 `battle`이 null이면 즉시 명시적 오류.

- [ ] party presentation은 캐릭터별로 `portraitSrcForCharacter(member)`를 호출한 결과를 명시적으로 넘긴다. adapter나 scene에서 `a`/`b` variant를 다시 고르지 않는다.

- [ ] enemy presentation은 resolution enemy의 `monsterId`를 `SPIDER_THEME.monsters`에서 찾아 이름을 얻고, `enemyBattleAssetSrc(monsterId)`로 이미지를 얻는다.

- [ ] boss entry는 코드 상단에 `E4 미연결 시각 fixture이며 resolveBossBattle을 호출하지 않는다`는 주석을 붙인 `satisfies BattleResolution` 상수로 만든다. party/enemy 최종 HP와 모든 action chain이 Task 1 validation을 통과해야 하며 enemy는 `boss-spider-2` 같은 공식 BossId를 사용한다.

- [ ] 화면의 나머지 status/progress/log/ecology는 기존 `U5_PREVIEW_ENTRIES`의 spider 상태를 재사용하거나 얕게 복사한다. boss entry는 `sceneKind: "boss"`, node label과 상황 문구만 보스 fixture임이 드러나도록 바꾼다. 오른쪽 party ViewModel 구조는 수정하지 않는다.

- [ ] preview data 테스트를 통과시킨다.

Run: `pnpm test -- components/game/u5-battle-preview-data.test.ts`

Expected: PASS

### Step 7: `/u5-2-test` 선택기와 fixed-canvas CSS 구현

- [ ] `components/game/U5BattlePreview.tsx`를 client component로 만들고 두 preview entry를 실제 `button` 선택기로 전환한다. 선택한 entry를 다음처럼 기존 화면에 전달한다.

```tsx
<U5ProgressScreen
  status={entry.status}
  progress={entry.progress}
  log={entry.log}
  ecology={entry.ecology}
  battleReplay={entry.replay}
/>
```

- [ ] 선택기는 `aria-pressed`와 명확한 source label을 표시한다. entry가 바뀌어 새 `replay` 객체가 들어오면 `U5BattleScene`의 effect가 `frameIndex`를 0으로 초기화한다. 이를 위해 별도 preview key나 게임 callback을 public prop으로 추가하지 않는다.

- [ ] `app/u5-2-test/page.tsx`는 metadata/게임 규칙 없이 `<U5BattlePreview />`만 렌더한다.

- [ ] `app/u5-battle.css`는 `.u5-battle-*` namespace만 사용한다.

  - `.u5-scene`의 기존 40% 높이와 배경을 변경하지 않고 내부를 `position: relative`로 활용한다.
  - scene overlay, party/enemy group, participant, sprite, name, HP, damage, live text, controls, preview selector만 정의한다.
  - 단위는 `rem`, `%`, `cqw`, `cqh`를 사용한다.
  - `vw`, `vh`, `@media`, `.game-shell__status`, `.u5-party`, 오른쪽 panel selector를 쓰지 않는다.
  - 이미지에는 `object-fit: contain`, 최대 크기와 overflow 경계를 둔다.
  - buttons에는 `:focus-visible` outline을 둔다.

- [ ] `app/layout.tsx`에서 기존 U5 CSS 다음에 `import "./u5-battle.css";`를 한 번만 추가한다.

- [ ] `components/game/U5FixedCanvas.test.ts`가 `u5-progress.css`와 `u5-battle.css` 양쪽을 검사하도록 확장한다.

```ts
for (const source of [progressCss, battleCss]) {
  expect(source).not.toMatch(/\d(vw|vh)\b/);
  expect(source).not.toContain("@media");
}
expect(battleCss).not.toContain("game-shell__status");
expect(battleCss).not.toContain(".u5-party");
expect(layout).toContain('import "./u5-battle.css"');
```

- [ ] 관련 테스트를 실행한다.

Run: `pnpm test -- components/game/U5BattleScene.test.tsx components/game/U5ProgressScreen.test.tsx components/game/u5-battle-preview-data.test.ts components/game/U5FixedCanvas.test.ts`

Expected: PASS

### Step 8: Task 2 자동 검증

- [ ] U5/U5-2 관련 전체 테스트를 실행한다.

Run: `pnpm test -- components/game/u5-battle-replay.test.ts components/game/u5-battle-assets.test.ts components/game/U5BattleScene.test.tsx components/game/U5ProgressScreen.test.tsx components/game/u5-battle-preview-data.test.ts components/game/U5FixedCanvas.test.ts components/game/U5Assets.test.ts components/game/u5-preview-data.test.ts`

Expected: PASS

- [ ] 전체 정적 검사와 테스트를 실행한다.

Run: `pnpm lint`

Expected: PASS

Run: `pnpm typecheck`

Expected: PASS

Run: `pnpm test`

Expected: PASS — 기준 74 files / 700 tests보다 새 테스트 수가 증가한다.

Run: `pnpm build --webpack`

Expected: PASS, `/u5-2-test` route가 build output에 포함된다.

### Step 9: 브라우저 시각·동작 검증

- [ ] 로컬 서버를 실행한다.

Run: `pnpm dev`

Expected: `/u5-2-test`가 로컬 URL에서 열린다.

- [ ] Chromium에서 `1920×1080`, `2560×1440`, `1440×900`, `1280×1024`를 각각 확인한다.

  - canvas 레터박스와 60:40 GameShell이 기존 U5와 같다.
  - 왼쪽 상단 scene 40%와 하단 console 60%가 유지된다.
  - 캐릭터/적 이미지가 찌그러지거나 잘리지 않는다.
  - 이름, HP, damage, 현재 행동, control이 겹치지 않는다.
  - 페이지/scene 내부에 의도하지 않은 scroll과 overflow가 없다.
  - 오른쪽 파티 패널 markup과 배치가 기존 U5와 같다.

- [ ] 두 preview에서 자동 재생을 끝까지 확인한다. `전투 건너뛰기`가 즉시 정확한 final HP로 이동하고 `다시 보기`가 같은 action 순서를 다시 보여주는지 확인한다.

- [ ] DevTools에서 `prefers-reduced-motion: reduce`를 켜고 공간 이동은 사라지지만 action 설명, damage, HP 변화, complete 결과는 유지되는지 확인한다.

- [ ] console에 asset 404, hydration 오류, React key warning, timer cleanup warning이 없는지 확인한다.

### Step 10: Task 2 scope 검토와 커밋

- [ ] diff가 승인 경계를 지키는지 확인한다.

Run: `git diff --stat HEAD`

Expected: Task 1 이후 변경은 Task 2의 명시 파일에 한정된다.

Run: `git diff -- lib components/game/U5ProgressScreen.tsx`

Expected: `lib/` diff 없음. `U5ProgressScreen.tsx`는 optional prop/import/왼쪽 scene 조건부 렌더만 바뀌고 `rightPanel` 블록은 변경되지 않는다.

Run: `git diff --check`

Expected: 출력 없음

Run: `rg -n "TODO|TBD|FIXME|placeholder" components/game/U5BattleScene.tsx components/game/u5-battle-preview-data.ts components/game/U5BattlePreview.tsx app/u5-battle.css app/u5-2-test/page.tsx`

Expected: 새 구현 미완료 표식 없음. `fixture` 표기는 보스 source 경계를 설명하는 의도된 문구이므로 허용한다.

- [ ] Task 2 파일만 stage하고 커밋한다.

```bash
git add components/game/U5BattleScene.tsx components/game/U5BattleScene.test.tsx components/game/u5-battle-preview-data.ts components/game/u5-battle-preview-data.test.ts components/game/U5BattlePreview.tsx components/game/U5ProgressScreen.tsx components/game/U5ProgressScreen.test.tsx components/game/U5FixedCanvas.test.ts app/u5-battle.css app/u5-2-test/page.tsx app/layout.tsx package.json pnpm-lock.yaml
git commit -m "feat: U5 자동 전투 장면을 재생한다"
```

- [ ] 커밋 뒤 작업 트리와 두 커밋을 확인한다.

Run: `git status --short && git log --oneline -3`

Expected: 작업 트리 clean, Task 1과 Task 2 커밋이 설계 커밋 위에 순서대로 있다.
