# U5 전투 피드백 시퀀스 설계

## 문서 정보

- 작성자: LatteBun
- 작성 도구: Codex
- 작성일: 2026-08-25
- 최종 개정일: 2026-08-26
- 대상: 일반 몬스터전·보스전의 결과 공개 순서, 우측 파티 카드 HP·신뢰 연출
- 기준 브랜치: `spec/u5-console-situation-readability` (`f25a6a6`)

## 1. 목표

조언을 선택한 직후 이미 계산된 전투 결과와 신뢰 변화가 화면에 한꺼번에
나오는 문제를 없앤다. 플레이어가 다음 인과 사슬을 실제 시간 순서로 느끼게
한다.

```text
카드 선택
→ 핵심 파티원의 수용·의심·적발
→ 전투를 부른 사건 결과
→ 자동 전투
→ HP 변화
→ 핵심 파티원의 사후 반응
→ 신뢰 변화
→ 다음 단계
```

완료 목표는 다음과 같다.

- 전투가 끝나기 전에 승패·최종 신뢰·전체 결과를 노출하지 않는다.
- 자동 전투 frame의 HP를 전투 장면과 우측 파티 카드가 동시에 사용한다.
- 전투 건너뛰기는 전투 동작만 생략하고 사후 반응과 신뢰 확인은 유지한다.
- 좌측 하단의 결과 3단 나열을 없애고 현재 인과 단계 하나만 보여준다.
- 핵심 파티원의 사후 대사를 장면 하단 리본으로 강조한다.
- HP와 신뢰의 전후 숫자·증감 효과는 우측 파티 카드에서 표현한다.
- 전체 반응과 원인은 진행 기록과 카드 원정 이력에서 다시 확인한다.

## 2. 근거와 현재 문제

근거 문서는 다음과 같다.

- `docs/GAME_PRINCIPLES.md` — 전투는 앞선 판단이 HP와 생존으로 드러나는 결과 장면이며, 선택 뒤 변화와 원인을 설명해야 한다.
- `docs/systems/INFORMATION_AND_DECEPTION.md` — 즉시 사건과 보스 정보의 검증 시점, 수용·의심·적발과 신뢰 변화 계약.
- `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md` — UI는 이미 확정된 전투 기록만 순차 재생하며 스킵이 게임 상태를 바꾸지 않는 계약.
- `docs/experience/SCREEN_LAYOUT.md` — 진행 화면의 장면·콘솔·우측 파티 상태와 단일 CTA 자리.
- `docs/experience/ONBOARDING_AND_INTERFACE.md` — 결과를 원인 순서로 이해시키는 인터페이스 원칙.
- `docs/experience/UI_IMPLEMENTATION_GUIDE.md` — 전투 frame, HP bar, reduced motion, 고정 캔버스 구현 기준.

현재 구현에는 다음 누출이 있다.

1. `U5ProgressScreen.Outcome`은 `pendingOutcome`이 생기는 즉시 파티원별 반응,
   사건 결과, 수치·신뢰 변화를 세 구역에 모두 렌더링한다.
2. `progressViewFor`는 규칙 적용이 끝난 `active.partyMembers`로 우측 카드를
   만들기 때문에 전투 replay보다 먼저 최종 HP와 신뢰가 보일 수 있다.
3. `changesByMemberId`는 현재 원정의 전체 기록을 즉시 카드 뒷면에 공급하므로
   카드를 뒤집으면 아직 연출하지 않은 결과를 알 수 있다.
4. `logFor`도 Store에 이미 기록된 전체 결과를 그대로 공급하므로 진행 기록
   탭이 미래 단계의 우회 노출 경로가 될 수 있다.
5. `useU5BattlePlayback`은 장면의 현재 frame을 계산하지만 우측 파티 카드는
   이 frame을 소비하지 않아 두 HP 표시가 같은 시계를 사용하지 않는다.
6. complete frame은 곧바로 지도·정산 CTA를 열어, HP 확인과 사후 신뢰 검증이
   하나의 체감 가능한 단계가 되지 못한다.

이번 변경은 규칙 결과를 늦게 계산하지 않는다. 이미 확정된 결과 중 **현재
시점에 보일 projection**만 제한한다.

## 3. 승인된 시각 방향

사용자는 비교 목업에서 `A. 장면 하단 대화 리본`을 승인했다.

### 3.1 장면 하단 대화 리본

- 전투 장면 안쪽 하단에 좌우로 긴 어두운 금속·양피지형 리본을 둔다.
- 리본에는 핵심 파티원의 이름, 한 줄 대사, 현재 확인 동작만 둔다.
- 전투 참가자와 피해 숫자를 가리지 않으며 우측 파티 카드 위에 겹치지 않는다.
- 모든 파티원의 반응을 차례로 반복하지 않는다. 현재 단계의 원인을 대표하는
  인물 한 명만 강조한다.
- 대화 리본은 장면을 완전히 가리는 모달이 아니다. 전투가 끝난 장소와 파티를
  계속 볼 수 있어야 한다.

### 3.2 우측 파티 카드 효과

새 이미지 에셋을 만들지 않고 기존 초상, 막대, 테두리와 숫자를 사용한다.

- HP settle: 수치와 막대가 replay frame 값으로 바뀌고 해당 카드는 짧게
  흔들리며 `HP −N`을 함께 표시한다.
- 회복 settle: 같은 frame 계약으로 수치와 막대가 늘고 `HP +N`을 표시한다.
- 사망: HP가 0이 되는 settle frame에서만 기존 `사망` 상태로 전환한다.
- 신뢰 확인: 해당 카드의 신뢰 수치와 막대가 바뀌고 `신뢰 −N` 또는
  `신뢰 +N`을 표시한다.
- 확인 뒤에는 0이 아닌 HP·신뢰 변화량을 카드 앞면에 동시에 남긴다.
- 증감은 색만으로 전달하지 않는다. 앞면의 최종 수치와 라벨·부호 있는 변화량을
  함께 제공하고, 전체 전후 수치와 원인은 카드 뒷면 이력에 보존한다.
- `prefers-reduced-motion`에서는 흔들림과 점멸 시간을 0으로 만들지만 변화량
  문구와 단계 순서는 유지한다.

## 4. 피드백 상태 계약

### 4.1 상태 전이

전투 피드백은 다음 로컬 표시 상태를 사용한다.

```text
preBattleReaction
  일반 사건의 핵심 반응
  ├─ 전투 전 적발 신뢰 있음 → preBattleImmediateTrust
  └─ 그 외 → preBattleConsequence

preBattleImmediateTrust
  이미 드러난 거짓의 신뢰 변화
  └─ 자동 → preBattleConsequence

preBattleConsequence
  추가 적 등장 등 전투를 부른 결과
  └─ 자동 → battle

battle
  replay frame 재생
  ├─ 자연 종료 ─────────────┐
  └─ 전투 건너뛰기 ─────────┤
                             ▼
postBattleHp
  complete HP·사망 상태 강조
  ├─ 사후 검증 있음 → postBattleDialogue
  └─ 사후 검증 없음 → complete

postBattleDialogue
  핵심 파티원 대사 · 우측 CTA `반응 확인`
  └─ 사용자 확인 → postBattleTrust

postBattleTrust
  신뢰 수치·막대·변화량 연출
  └─ 자동 → complete

complete
  일반전 `지도로 돌아간다` / 보스전 `정산으로`
```

일반 사건은 앞의 두 상태를 사용한다. 보스방에서는 새 조언을 고르지 않으므로
기존 보스 정보가 별도 사전 반응을 요구하지 않으면 `battle`에서 시작한다.

사전 반응과 사건 결과 beat의 기본 유지 시간은 각각 1,100ms다. 전투 전 즉시
신뢰와 전투 뒤 신뢰 변화 강조는 650ms, 전투 complete 뒤 HP 강조는 500ms다.
이 시간은 전투 `×1 / ×2` 속도와 분리한다.
전투 속도를 높였다고 읽어야 할 대사까지 두 배로 빨라지지 않게 한다.
reduced motion은 CSS motion duration만 0으로 만들고 beat 유지 시간과 사용자
확인 단계를 없애지 않는다.

### 4.2 거짓 적발 예외

방해를 `적발`한 인물은 전투 결과를 기다리지 않고 이미 거짓을 안다. 규칙이
선택 시점에 적용한 `adviceHarmed + deceptionExposed`는 사전 핵심 반응 뒤
즉시 신뢰 변화로 보여준다. 이 변화는 전투 뒤에 다시 적용하거나 반복 연출하지
않는다.

반대로 수용한 조언이 전투 결과로 해로웠음이 밝혀지는 `adviceHarmed`와 보스
정보의 지연 검증은 반드시 complete 뒤에 보여준다.

### 4.3 건너뛰기

`전투 건너뛰기`는 replay frame index만 마지막 complete frame으로 옮긴다.

- `postBattleHp`, `postBattleDialogue`, `postBattleTrust`를 건너뛰지 않는다.
- `ACKNOWLEDGE_OUTCOME`, `COMPLETE_EXPEDITION`, E2, E3, E4를 호출하지 않는다.
- 자연 종료와 건너뛰기는 같은 최종 HP, 대사, 신뢰, CTA에 도달한다.
- 연속 클릭해도 complete frame을 넘거나 신뢰 확인을 중복 실행하지 않는다.

### 4.4 다시 보기

피드백 전체를 한 번 완료한 뒤 `다시 보기`는 전투 replay만 되감는다.

- 중앙 전투 장면만 initial frame으로 돌아간다.
- 우측 파티 카드는 최종 HP·사망 상태·신뢰를 유지한다.
- `반응 확인` 뒤 공개한 `HP ±N`, `신뢰 ±N` 변화량도 우측 카드에 남는다.
- 사전 반응·사건 결과·사후 대사·신뢰 연출은 반복하지 않는다.
- 다시 보기 중 우측 CTA는 `전투 건너뛰기`이며 complete 뒤 원래의 다음 CTA로
  바로 돌아간다.
- 캠페인 Store, RNG, 신뢰와 전투 결과를 다시 계산하지 않는다.

## 5. 좌측 콘솔과 진행 기록

### 5.1 현재 beat만 표시

기존 `Outcome`의 세 구역 동시 표시를 제거한다. `행동 / 조언` 모드는 현재
feedback phase에 맞는 하나의 beat를 보여준다.

| 상태 | 좌측 하단 표시 |
| --- | --- |
| `preBattleReaction` | 선택한 조언과 핵심 파티원의 반응 |
| `preBattleImmediateTrust` | 전투 전에 드러난 거짓과 즉시 반응. 수치는 우측 카드가 소유 |
| `preBattleConsequence` | 추가 거미 등장처럼 전투를 부른 사건 결과 |
| `battle` | `전투 진행 중`과 전투를 부른 원인 문장 |
| `postBattleHp` | 승패와 HP 반영 중이라는 짧은 상태 |
| `postBattleDialogue` | 짧은 사건 결말. 핵심 대사는 장면 리본이 소유 |
| `postBattleTrust` | 사후 반응을 확인했다는 상태. 수치는 우측 카드가 소유 |
| `complete` | 짧은 사건 결말과 다음 단계 안내 |

좌측 콘솔에는 파티원별 HP·신뢰 전후 목록을 다시 만들지 않는다.

### 5.2 진행 기록 공개 경계

Store에 현재 사건의 전체 기록이 이미 있어도 `진행 기록`은 현재 phase까지의
항목만 보여준다.

- 이전 지점의 기록과 공개 생태·관찰 단서는 계속 볼 수 있다.
- 현재 사건의 선택은 선택 뒤부터 보인다.
- 핵심 반응은 `preBattleReaction`부터 보인다.
- 사건 결과는 `preBattleConsequence`부터 보인다.
- 전투 행동은 현재 replay frame까지 보인다.
- 최종 승패·HP 요약은 `postBattleHp`부터 보인다.
- 사후 검증과 신뢰 변화는 `postBattleDialogue`·`postBattleTrust` 이전에
  보이지 않는다.
- `complete` 뒤에는 기존 전체 원정 기록을 모두 볼 수 있다.

필터를 바꿔도 이 공개 경계를 우회할 수 없다.

## 6. 핵심 인물과 대사

### 6.1 결정적 인물 선택

핵심 인물은 안정적인 파티 자리 순서로 결정한다.

- 실행된 일반 사건의 사전 반응: `accepted` 중 첫 번째 인물.
- 아무도 수용하지 않은 사건: 결과를 만든 `suspected` 인물 중 첫 번째.
- 전투 전 적발: 즉시 신뢰 변화가 있는 `exposed` 인물 중 절댓값 변화가 가장
  큰 인물. 동률이면 파티 자리 순서.
- 전투 뒤 반응: 아직 공개하지 않은 신뢰 변화의 절댓값이 가장 큰 인물.
  동률이면 파티 자리 순서.
- 신뢰 변화가 없으면 사후 대화와 `반응 확인`을 만들지 않는다.

핵심 인물 한 명만 강조하지만 나머지 인물의 반응과 변화는 버리지 않는다.
`complete` 뒤 진행 기록과 카드 원정 이력에 모두 남긴다.

### 6.2 1차 고정 대사

1차 구현은 성격별 말투를 만들지 않고 규칙이 제공한 반응·검증 종류를 고정된
세계 안 대사로 옮긴다.

| 판정 | 대사 |
| --- | --- |
| `accepted` | `알겠어. 네 말대로 하지.` |
| `suspected` | `잠깐, 그대로 따르기엔 수상한데.` |
| `exposed` | `처음부터 우릴 속이려 했군.` |
| `adviceHelped` | `이번에는 네 조언이 맞았어.` |
| `adviceHarmed` | `네 말을 믿은 게 실수였군.` |
| `suspicionWasCorrect` | `역시 그대로 따르지 않길 잘했어.` |
| `suspicionWasCostly` | `의심하느라 기회를 놓쳤군.` |

DOM에는 내부 판정 key를 넣지 않고 한국어 이름·대사·사람이 읽는 변화 이유만
전달한다. 성격별 말투 확장은 별도 콘텐츠 설계로 남긴다.

## 7. 상태와 컴포넌트 소유권

```text
CampaignScreen
  ├─ 규칙이 확정한 pendingOutcome / bossResult
  ├─ 전투 replay와 현재 사건 기록
  └─ U5ProgressScreen
      ├─ feedback sequence controller
      │   ├─ phase
      │   ├─ 현재 공개 가능한 beat·log·change projection
      │   └─ 핵심 인물·대사
      ├─ battle playback controller
      │   ├─ currentFrame
      │   ├─ play / complete / replay
      │   └─ skipToComplete()
      ├─ U5BattleScene
      │   └─ currentFrame의 장면 참가자·피해·HP
      ├─ CurrentBeatPanel
      │   └─ 좌측 하단 현재 단계 하나
      └─ PartyMemberCard
          └─ currentFrame HP + phase에 맞는 신뢰·효과
```

feedback sequence는 replay와 현재 결과의 signature로 식별하는 UI 로컬 상태다.
활성 원정이 바뀌거나 새 결과 signature가 들어오면 첫 phase로 초기화한다.
Campaign Store에는 frame index, phase, 대사 확인 여부를 저장하지 않는다.

### 7.1 파티 카드 projection

우측 카드의 표시 값은 다음 우선순위를 따른다.

1. 최초 전투 중 HP: `currentFrame.hpByParticipantId[member.id]`.
2. 전투 전 HP: replay participant의 `initialHp`.
3. 전투 complete 이후 HP: replay participant의 `finalHp`.
4. 완료된 전투 다시 보기 중 HP: replay frame과 무관하게 participant의 `finalHp`.
5. 사후 확인 전 신뢰: 현재 검증 묶음에서 첫 변화의 `before`.
6. 사후 확인 뒤 신뢰: 마지막 변화의 `after`.
7. 현재 결과에 해당 값이 없으면 기존 party view 값.

같은 인물에게 `adviceHarmed`와 `deceptionExposed`처럼 연속 신뢰 변화가 있으면
첫 `before`와 마지막 `after`를 사용하되 전체 중간 사유는 기록에 보존한다.

### 7.2 완료 변화량

`반응 확인`으로 `postBattleTrust`에 들어간 순간부터 우측 카드 앞면에 이번 결과의
변화량을 지속 표시한다.

- HP는 replay participant의 `initialHp`와 `finalHp` 차이를 `HP ±N`으로 표시한다.
- 신뢰는 즉시 변화와 사후 변화 묶음의 첫 `before`와 마지막 `after` 차이를
  `신뢰 ±N`으로 표시한다.
- HP와 신뢰가 모두 변했으면 두 항목을 동시에 표시한다.
- 변화량이 0인 항목은 표시하지 않는다.
- 사후 검증이 없어 `반응 확인`을 생략한 전투는 `complete`부터 최종 변화량을
  표시한다.
- 변화량은 다음 화면으로 이동하기 전까지 유지하며 다시보기 중에도 사라지거나
  재애니메이션하지 않는다.

### 7.3 카드 뒤집기

현재 사건의 feedback sequence가 `complete`가 되기 전에는 U5 파티 카드의
뒤집기 버튼을 노출하지 않는다. 이전 지점 이력을 보고 싶다면 진행 기록을
사용한다. complete 뒤에는 기존 `changesByMemberId` 전체 이력을 다시 공급한다.
U3·U4의 공용 파티 카드 동작은 바꾸지 않는다.

## 8. CTA 계약

우측 하단에는 동시에 하나의 주요 CTA만 둔다.

| 상태 | CTA |
| --- | --- |
| 사전 자동 beat와 즉시 신뢰 | 없음 |
| `battle` replaying | `전투 건너뛰기` |
| `postBattleHp` | 없음 |
| `postBattleDialogue` | `반응 확인` |
| `postBattleTrust` | 없음 |
| `complete` 일반전 | `지도로 돌아간다` |
| `complete` 보스전 | `정산으로` |
| 완료된 전투 다시 보기 | replaying 동안 `전투 건너뛰기`, 끝나면 원래 다음 CTA |

CTA label로 상태를 역추론하지 않는다. 일반전·보스전 호출부가 다음 단계 정책을
명시하고 sequence controller가 현재 가능한 action을 반환한다.

## 9. 접근성

- 장면 하단 리본은 이름을 제목으로 갖는 의미 있는 영역이며 새 대사가 나타날
  때 한 번만 `aria-live="polite"`로 알린다.
- 전투의 기존 settle·complete announcement 계약을 유지한다. 우측 카드 HP를
  별도 live region으로 만들어 같은 피해를 중복 낭독하지 않는다.
- `반응 확인`, `전투 건너뛰기`, 다음 단계 CTA는 실제 `button`이다.
- HP와 신뢰 막대는 현재 보이는 수치와 같은 `aria-valuenow`를 사용한다.
- 흔들림·점멸 없이도 변화량 텍스트와 전후 숫자로 결과를 이해할 수 있다.
- native tab 순서를 유지하고 feedback 중 사용할 수 없는 카드 뒤집기와 다음
  단계 callback은 disabled 복제본이 아니라 DOM에서 제거한다.
- 자동 beat의 내용은 진행 기록에도 남아, 시각적 전환을 놓쳐도 다시 읽을 수
  있다.

## 10. 오류와 경계 조건

- gated replay의 frame이 비어 있으면 CTA를 숨긴 채 멈추지 않는다.
  `createU5BattleReplay`의 기존 유효성 오류 경계로 전달한다.
- replay 참가자에 현재 파티원이 없거나 frame HP chain이 final HP와 맞지 않으면
  화면에서 보정값을 만들지 않고 replay 생성 오류로 처리한다.
- 신뢰 변화 chain의 첫 `before`와 마지막 `after`가 현재 결과와 맞지 않으면
  임의로 클램프하거나 재계산하지 않고 피드백 projection 오류로 처리한다.
- 사후 검증이 없거나 실제 변화량이 0이면 빈 대화 리본과 `반응 확인`을 만들지
  않고 HP 강조 뒤 complete로 간다.
- 파티원 초상이 없어도 대사 이름, 카드 수치, 순서와 CTA는 유지한다.
- component unmount, 결과 signature 변경, 다시 보기에서 기존 timer를 모두
  정리해 이전 사건의 phase가 새 사건으로 넘어오지 않게 한다.
- 연타와 중복 callback은 phase gate로 무시하며 신뢰 변화나 다음 단계 dispatch를
  두 번 호출하지 않는다.

## 11. 테스트 계약

### 11.1 순수 상태와 adapter

- 일반전이 사전 반응부터 complete까지 승인된 순서로 전이한다.
- 보스전은 불필요한 사전 beat를 건너뛰고 battle에서 시작한다.
- 적발의 즉시 신뢰와 전투 뒤 검증 신뢰가 서로 다른 phase에 배치된다.
- 사후 검증이 없으면 대화·확인 phase를 만들지 않는다.
- 핵심 인물은 절댓값 변화와 안정적 파티 자리 순서로 결정된다.
- 내부 판정 key가 presentation DOM 데이터에 포함되지 않는다.
- 현재 phase의 log projection이 미래 결과 항목을 제거한다.
- 신뢰 여러 건의 first-before / last-after chain을 보존한다.

### 11.2 playback와 우측 카드

- idle·attack·impact에서는 장면과 카드가 이전 HP를 함께 표시한다.
- settle frame에서 두 HP가 같은 새 값으로 바뀐다.
- HP 0 settle frame에서만 카드가 사망 상태로 바뀐다.
- 자연 종료와 건너뛰기가 같은 final HP와 후속 phase에 도달한다.
- 건너뛰기가 postBattleDialogue와 postBattleTrust를 건너뛰지 않는다.
- `반응 확인` 전에는 이전 신뢰, 확인 뒤에는 최종 신뢰를 표시한다.
- 다시 보기는 중앙 장면 HP만 되감고 우측 카드의 최종 HP·신뢰·변화량과 사후
  대사를 재적용하지 않는다.
- replay signature 변경과 unmount가 timer를 정리한다.

### 11.3 렌더와 접근성

- 전투 중 승패·최종 신뢰·미래 결과·전체 카드 이력이 DOM에 없다.
- 좌측 하단은 현재 beat 하나만 렌더링하고 기존 세 구역 Outcome을 만들지 않는다.
- 사후 대화가 장면 하단 리본에 이름과 함께 보인다.
- 우측 카드에 변화량 라벨과 전후 수치가 있으며 색만으로 의미를 전달하지 않는다.
- `반응 확인` 뒤 HP·신뢰 변화량이 카드 앞면에 동시에 남고 변화가 없는 항목은
  만들지 않는다.
- 사후 확인 전 카드 뒤집기와 다음 단계 callback이 DOM에 없다.
- 각 phase의 실제 CTA와 accessible name이 일치한다.
- reduced motion에서도 phase 순서·변화 문구·확인 절차가 유지된다.

### 11.4 브라우저 검증

실제 `/campaign`에서 일반 몬스터전과 보스전을 각각 자연 종료와 건너뛰기로
검증한다.

1. 선택 뒤 수용 대사와 추가 적 등 사건 결과가 전투보다 먼저 보인다.
2. 전투 중 좌측 결과와 우측 카드가 결말을 미리 드러내지 않는다.
3. 매 피해 settle에서 장면과 카드 HP가 동시에 감소한다.
4. 전투 complete 뒤 HP 강조, 사후 대사, `반응 확인`, 신뢰 변화가 순서대로
   나온다.
5. 모든 피드백이 끝난 뒤에만 지도·정산 CTA가 활성화된다.
6. 다시 보기에서는 중앙 장면만 되감기고 우측 카드는 최종 HP·신뢰·변화량을
   유지한다.
7. 1920×1080, 2560×1440, 1440×900, 1280×1024에서 대화 리본, 파티 카드,
   변화량과 CTA가 겹치거나 잘리지 않는다.
8. 네 viewport에서 스크롤, 이미지 왜곡, 콘솔 오류가 없다.

전체 검증은 관련 Vitest, `pnpm typecheck`, `pnpm lint`, `pnpm build`,
`git diff --check`를 포함한다. 전투·신뢰 수치를 바꾸지 않으므로 backtest는
실행하지 않는다.

## 12. 예상 변경 경계

- `components/game/U5ProgressScreen.tsx` — 현재 beat, 대화 리본, CTA와 파티 카드 projection 연결.
- `components/game/use-u5-battle-playback.ts` — sequence가 replay 시작·정지·완료를 제어할 수 있는 좁은 계약.
- `components/game/u5-progress-model.ts` — 공개 가능한 feedback beat와 파티 변화 view.
- `components/game/campaign-adapters.ts` — pre/final 상태, 핵심 반응·사후 검증·log projection 구성.
- `components/game/PartyMemberCard.tsx` — U5에서만 주는 표시 수치 override와 일시적 변화 효과.
- `components/game/U5BattleScene.tsx` — 현재 frame 표현 유지, 대화와 다음 단계 소유권은 갖지 않음.
- `app/u5-progress.css`, `app/party-card.css` — 대화 리본과 카드 HP·신뢰 효과.
- 관련 `.test.ts`·`.test.tsx` — 상태 전이, 누출 방지, 동기화와 접근성 회귀.
- 이번 spec에서 갱신한 공식 시스템·경험 문서.

구현 중 파일 경계가 달라질 수 있으나 domain/rules 계산을 UI로 옮기거나
Campaign Store에 연출 phase를 저장하는 방향으로 넓히지 않는다.

## 13. 완료 조건

- 일반전·보스전 중 최종 결과가 전투보다 먼저 보이지 않는다.
- 조언 선택부터 신뢰 변화까지 승인된 인과 순서를 체감할 수 있다.
- 최초 전투에서 장면과 우측 파티 카드 HP가 같은 replay frame에서 동시에 감소한다.
- 건너뛰기로도 사후 대사와 신뢰 변화가 빠지지 않는다.
- HP·신뢰 변화는 우측 카드에서 라벨·숫자·효과로 읽힌다.
- 확인한 HP·신뢰 변화량은 다음 화면으로 이동하기 전까지 우측 카드 앞면에 남는다.
- 좌측 하단은 현재 단계 하나만 보여주며 전체 이력은 기록과 카드에서 복원된다.
- 일반전 지도 복귀와 보스전 정산은 전체 피드백 완료 뒤에만 가능하다.
- 규칙 결과, RNG, 피해, 신뢰 계산, 캠페인 phase에는 회귀가 없다.

## 14. 변경하지 않는 것

- BattleEngine, E2·E3·E4의 피해·수용·의심·적발·신뢰 계산
- Campaign Store의 상태 전이와 저장 범위
- 조언의 help/harm/neutral, relation과 숨은 정답 공개 정책
- GameShell 60:40, 진행 화면 장면 40%·콘솔 60% 구조
- U3·U4 파티 카드의 기존 동작
- 새 캐릭터·몬스터·이펙트 이미지 에셋
- 성격별 대사와 음성, 립싱크, 다프레임 스프라이트, 복잡한 카메라 연출
- 비전투 사건의 기존 결과 확인 흐름
