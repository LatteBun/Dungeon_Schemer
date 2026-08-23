# C6 Ending & Trust Collapse Design

## Document Information

- Feature: C6 Campaign Ending and Trust Collapse
- Scope: Campaign rules only
- Related: C4 Settlement, C5 Promotion, U6 Settlement/Ending, C7 State Transition

## 1. Goal

C6 defines how a campaign ends based on the player's accumulated choices, character trust collapse, and campaign history.

The goal is not to treat endings as simple success/failure states, but as different conclusions created by the player's management of relationships and expeditions.

## 2. Non Goals

- No UI implementation
- No next campaign meta effects
- No trust recovery system
- No AI behavior changes caused by trust
- No additional ending types beyond the current five

## 3. Trust State Rules

A character's trust is persistent during the campaign.

```ts
interface CharacterTrustState {
  trust: number;
  hasReachedZeroTrust: boolean;
}
```

`trust` and `hasReachedZeroTrust` are separate values.

Reason:

- Current trust represents the current relationship state.
- Zero trust history is required for cumulative ending evaluation.

## 4. Trust Collapse

When a character reaches trust 0:

- The character enters permanent distrust state.
- Trust cannot recover.
- `hasReachedZeroTrust` becomes true permanently.

Trust flow:

```
Trust > 0
   ↓
Trust reaches 0
   ↓
Permanent distrust
```

## 5. Immediate Distrust Ending

During an active dungeon, if all surviving party members have trust 0:

```
All survivors trust === 0
```

the campaign ends immediately.

Result:

- Current expedition fails.
- The guide is removed by the party.
- Ending becomes `distrust`.

This check happens before normal campaign ending evaluation.

## 6. Ending Evaluation

All endings are valid campaign conclusions. They are not separated into good/bad categories.

Evaluation priority:

1. `distrust` - 불신의 대가
2. `denounced` - 누적 고발
3. `completed` - 원정 종료
4. `exhausted` - 인력 소진
5. `unemployed` - 실직

## 7. Ending Conditions

### distrust

Condition:

- Active dungeon survivors all reach trust 0.

Meaning:

The party no longer accepts the guide's existence.

### denounced

Condition:

- Five or more surviving characters have reached zero trust during the campaign.

Rules:

- Dead characters do not count.
- Characters only need to have reached zero once.
- Recovery is impossible because zero trust is permanent.

### completed

Condition:

- Complete 15 dungeons.

Additional display data:

- Final guide rank is shown in the ending screen.
- Rank does not change the completion condition.

Example:

```
원정 종료
15개의 던전을 모두 돌파했습니다.
최종 길잡이 등급: S급
```

### exhausted

Condition:

- Existing rule: cannot form a party with three different jobs.

### unemployed

Condition:

- Existing rule: all board requests become unavailable.

## 8. Ending Result Contract

C6 should provide a deterministic result for U6 and C7.

```ts
interface CampaignEndingResult {
  kind: EndingKind;
  title: string;
  reason: string;
  finalRank: GuideRank;
  triggerCharacterIds: string[];
}
```

## 9. Test Cases

### Case 1: Immediate distrust

```
Party:
A trust 0
B trust 0
C trust 0

During dungeon:
Ending = distrust
```

### Case 2: Denounced

```
Alive characters:
A zero trust history
B zero trust history
C zero trust history
D zero trust history
E zero trust history

Dead character:
F zero trust history

Result:
denounced
Count = 5
```

### Case 3: Completed

```
Dungeon clear count = 15

Result:
completed
Display final guide rank
```

## 10. Integration Notes

- C4 provides expedition result data.
- C5 provides promotion/rank data.
- U6 consumes CampaignEndingResult.
- C7 handles post-ending campaign state transition.
