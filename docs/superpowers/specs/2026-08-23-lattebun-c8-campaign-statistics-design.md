# C8 Campaign Statistics Specification

## 1. Overview

C8 is the campaign statistics aggregation layer.

C8 records finalized settlement results and converts campaign progress into measurable statistics.

Core responsibility:

```
C4 SettlementResult
        ↓
C8 Statistics Update
        ↓
CampaignStatistics
```

C8 does not calculate rewards or decide campaign outcomes. It only aggregates already finalized results.

---

## 2. Goals

C8 provides:

- Campaign performance statistics
- Settlement history accumulation
- Final campaign result data for U6
- Long-term campaign summary data

---

## 3. Non Goals

C8 does not own:

- Reward calculation (C4)
- Ending evaluation (C6)
- Campaign state transition (C7)
- Event history / narrative records (E3)
- Persistence implementation (I1)
- UI rendering (U6)

---

## 4. Update Timing

Statistics update occurs immediately after settlement completion.

```
Dungeon Complete
        ↓
C4 Settlement
        ↓
SettlementResult
        ↓
C8 UpdateStatistics
        ↓
WorldTurn
```

---

## 5. Statistics Model

```ts
interface CampaignStatistics {
  totalExpeditions: number;

  successfulExpeditions: number;
  failedExpeditions: number;

  totalDeaths: number;

  totalGoldEarned: number;
  totalGoldSpent: number;

  highestDungeonCleared: number;

  settlementHistory: SettlementSummary[];
}
```

---

## 6. Settlement Summary

```ts
interface SettlementSummary {
  expeditionId: string;

  result: "success" | "failure";

  dungeonNumber: number;

  goldEarned: number;
  goldSpent: number;

  survivorCount: number;
  deathCount: number;
}
```

---

## 7. Recording Rules

### Success

```
totalExpeditions +1
successfulExpeditions +1
settlementHistory append
```

### Failure

```
totalExpeditions +1
failedExpeditions +1
settlementHistory append
```

### Deaths

```
totalDeaths += deathCount
```

### Gold

```
totalGoldEarned += earned
totalGoldSpent += spent
```

---

## 8. Highest Dungeon Tracking

Highest dungeon is based on the highest dungeon number cleared.

Example:

```
Dungeon 3 → Dungeon 7 → Dungeon 5

highestDungeonCleared = 7
```

---

## 9. Settlement History

All settlement results are preserved.

Reason:

- Campaigns are finite
- Data size remains manageable
- Future analysis expansion is possible

---

## 10. Final Result Usage

U6 consumes accumulated CampaignStatistics.

Example:

```
Campaign Result

Total Expeditions: 15
Successful: 12
Failed: 3
Total Gold Earned: 4850G
```

Final display uses campaign-wide totals, not only the final expedition.

---

## 11. Test Cases

### Successful Settlement

Input:

```
result: success
goldEarned: 300
survivorCount: 4
```

Expected:

```
totalExpeditions = 1
successfulExpeditions = 1
```

### Failed Settlement

Input:

```
result: failure
deathCount: 3
```

Expected:

```
failedExpeditions = 1
totalDeaths = 3
```

### Highest Dungeon Update

Input:

```
previous highestDungeonCleared = 5
new dungeonNumber = 8
```

Expected:

```
highestDungeonCleared = 8
```

### Full History Preservation

Input:

```
Settlement 1
Settlement 2
Settlement 3
```

Expected:

```
settlementHistory.length === 3
```

---

## 12. Summary

| Item | Decision |
|---|---|
| Purpose | Numeric campaign performance tracking |
| Update timing | After settlement completion |
| Failed expedition | Included |
| Final screen source | CampaignStatistics cumulative data |
| Highest record | Highest dungeon number |
| History | Store all settlement summaries |
