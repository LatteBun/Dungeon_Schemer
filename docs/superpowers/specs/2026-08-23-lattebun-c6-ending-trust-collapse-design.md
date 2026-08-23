# C6 Ending & Trust Collapse Design

## Document Information

- Feature: C6 Campaign Ending and Trust Collapse
- Scope: Campaign rules only
- Related: C3 World Turn, C4 Settlement, C5 Promotion, C7 State Transition, C8 Statistics, U6 Settlement/Ending, B1 Balance

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

`trust` is the only trust-state value. C6 does not add `hasReachedZeroTrust`.

Reason:

- Trust 0 is already permanent: E2's `evaluateTrust` returns a trust-0 member
  unchanged, and C4 rejects a settlement snapshot that raises a campaign
  member from trust 0 to a positive value.
- Therefore, for a living character, `trust === 0` is the single source of truth for both permanent distrust and the cumulative-denouncement count.
- A second history flag would duplicate the same state and introduce a synchronization failure mode without changing an ending result.

## 4. Trust Collapse

When a character reaches trust 0:

- The character enters permanent distrust state.
- Trust cannot recover.
- The character remains excluded from future player-expedition candidates.

Trust flow:

```
Trust > 0
   ↓
Trust reaches 0
   ↓
Permanent distrust
```

## 5. Immediate Distrust Ending

During an active dungeon, C6 applies every trust change produced by one completed advice result or one completed boss-information verification as one batch. After that batch, if one or more party members survive and all surviving party members have trust 0:

```
All survivors trust === 0
```

the campaign ends immediately.

Result:

- The current expedition is aborted and does not enter C4 settlement.
- The guide is removed by the party.
- Ending becomes `distrust`.
- C3 world turn, C4 reward/loss, relic recovery, dungeon risk change, dungeon clear, settlement statistics, and promotion availability are not applied.
- The trust changes that triggered this result remain applied to the surviving party members.

This is the only ending evaluated during an expedition. C7 records the result atomically as `phase: "ended"`; a later transition may not settle or end the same expedition again. This prevents the order of party-member processing inside one advice result from changing the result.

C7 passes the latest active-expedition party state after the entire trust-change
batch has been applied. That state is the source of truth for `alive` and
`trust`, because it can be newer than the campaign pool. Before calling C6, C7
validates that the members are exactly the three distinct contracted party IDs;
C6 does not repair duplicate, missing, or stale party entries.

## 6. Ending Evaluation

All endings are valid campaign conclusions. They are not separated into good/bad categories.

Immediate transition:

1. `distrust` - 불신의 대가

Normal post-C3 transition:

2. `denounced` - 누적 고발
3. `completed` - 원정 종료
4. `exhausted` - 인력 소진
5. `unemployed` - 실직

## 7. Ending Conditions

### distrust

Condition:

- At least one active-dungeon party member survives, and all survivors have `trust === 0` after a completed trust-change batch.

Meaning:

The party no longer accepts the guide's existence.

### denounced

Condition:

- Five or more living characters have `trust === 0` after C3 world turn.

Rules:

- Dead characters do not count.
- No history field is needed: trust 0 is permanent.
- This is evaluated only on the normal C4 → C3 → C6 path, not after an immediate `distrust` ending.

### completed

Condition:

- All 15 campaign dungeons have `status === "cleared"`.

Failed attempts are not clears. C6 must not infer completion from world turns, settlement-record length, or the number of expeditions because a dungeon can be retried.

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

- Existing rule: including emergency candidates (living, trust above 0, even if gravely wounded), no party with three different jobs can be formed.

### unemployed

Condition:

- Existing rule: after `exhausted` has been ruled out, the board contains one or more remaining-dungeon offers and every offer is unavailable because of `rankTooLow`.

An empty offer list is not vacuous unemployment. It is first evaluated as `exhausted`; completion has already taken precedence when no dungeons remain.

## 8. Cumulative Trust-Zero Modifier

Before an advice reaction is decided, C6 counts living characters with `trust === 0` and supplies the matching modifier to E2.

| Living trust-0 count | Acceptance modifier | Harm exposure modifier | Ending |
| ---: | ---: | ---: | --- |
| 0–1 | 0 | 0 | none |
| 2 | −5 | 0 | none |
| 3 | −10 | +5 | none |
| 4 | −15 | +15 | none |
| 5+ | — | — | `denounced` on normal ending evaluation |

The modifier is a C6 campaign-state input; E2 continues to own the individual reaction roll. The values are provisional balance constants. B1 must measure their impact, including the distribution of early endings, and may revise this table with the related official rules documents.

## 9. Ending Result Contract

C6 should provide a deterministic result for U6 and C7.

```ts
interface CampaignEnding {
  kind: EndingKind;
  title: string;
  reason: string;
  finalRank: GuideRank;
  triggerCharacterIds: readonly CharacterId[];
}
```

`title` and `reason` are C6-owned Korean display strings so U6 does not reproduce ending logic or labels. `triggerCharacterIds` is always in `campaign.pool.order` order:

- `distrust`: the living members of the aborted expedition.
- `denounced`: every living character with `trust === 0`.
- `completed`, `exhausted`, `unemployed`: an empty array.

`finalRank` is the campaign rank at the moment C7 writes the ended state. C6 is pure: it returns the deterministic result and does not mutate campaign state itself.

## 10. Test Cases

### Case 1: Immediate distrust

```
Party after one completed trust-change batch:
A trust 0
B trust 0
C trust 0

During dungeon:
Ending = distrust
C4 settlement, rewards, relics, risk increase, dungeon clear, C3 world turn = not applied
```

### Case 2: Denounced

```
Living characters:
A trust 0
B trust 0
C trust 0
D trust 0
E trust 0

Dead character:
F trust 0

Result:
denounced
Count = 5
```

### Case 3: Completed

```
All 15 campaign dungeons status = cleared

Result:
completed
Display final guide rank
```

### Case 4: Cumulative modifier

```
Living trust-0 characters = 3

E2 campaign modifier:
accept = -10
expose = +5
```

### Case 5: Empty board is exhausted, not unemployed

```
No emergency party with three jobs can be formed
Board offers = []

Result = exhausted
```

### Case 6: Deterministic trigger IDs

```
Pool order = [C, A, B, D, E]
Living trust-0 = [A, B, D, E, C]

denounced.triggerCharacterIds = [C, A, B, D, E]
```

## 11. Integration Notes

- C3 runs before normal C6 evaluation. Immediate `distrust` bypasses it.
- C4 provides normal expedition settlement data. Immediate `distrust` bypasses it.
- C5 provides promotion/rank data.
- C7 owns phase validation, active-party identity validation, and atomically writes the C6 result as `ended`; it rejects duplicate settlement or ending transitions.
- C8 records only settlements that actually occur. It records no settlement for an aborted `distrust` expedition.
- U6 consumes `CampaignEnding` and does not recalculate conditions, title, reason, rank, or trigger characters.
