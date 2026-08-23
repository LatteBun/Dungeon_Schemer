# C4 — Expedition Settlement Specification

## Purpose

C4 is the settlement layer that permanently applies expedition results to the campaign state.

Responsibilities:
- persist final member state
- calculate clear/wipe settlement
- apply gold and reputation changes
- process wipe relic recovery
- update dungeon risk and attempts
- provide settlement details for U6/C8

C4 does not control phase transition. C7 owns state progression.

## Settlement Contract

`settleExpedition()` receives an expedition end snapshot and returns:

- updated CampaignState
- SettlementResult

SettlementResult contains:
- survivors
- member changes
- reputation delta
- gold delta
- relic gold
- risk before/after
- next reward
- cause chain for presentation

## Settlement Order

1. validate input
2. apply final character states
3. calculate clear/wipe outcome
4. apply economy changes
5. update dungeon state
6. calculate next reward
7. return new state and settlement result

Failed validation must not partially mutate campaign state.

## Character State

Survivors keep final HP and trust.

If HP is below 20% of max HP:
- set gravelyWounded

Dead members:
- hp = 0
- alive = false
- no additional trust changes

## Clear Settlement

Base rewards are shared rules.

Survivor multiplier:
- 3 survivors: 100%
- 2 survivors: 60%
- 1 survivor: 30%

Apply floor after multiplication.

Partial survival never recovers dead member gold.

## Wipe Settlement

Wipe gives:
- no contract reward
- reputation loss based on contract risk before increase
- relic recovery from dead members
- risk increase by 1 (maximum ★5)
- attempts increase

Relic recovery starts at:

`WIPE_SALVAGE_RATE = 1.0`

The value remains a balance constant and will be reevaluated in B1.

Recovered gold:
- increases current gold
- increases cumulative earned gold
- sets dead member gold to 0

## Risk And Next Reward

Failure uses the original contract risk for losses.

Next reward uses the increased risk after failure.

Example:

★2 failure:
- loss: ★2
- next reward: ★3

## Emergency Deployment Rule

Gravely wounded members are normally unavailable.

Normal deployment requires:
- alive
- trust > 0
- not gravely wounded

If normal members cannot create a valid 3-class party:

Emergency deployment may use:
- alive
- trust > 0
- gravely wounded allowed

Selection:
1. minimize number of wounded members
2. break ties with seeded selection

Emergency deployed wounded members use current HP.

## Exhaustion Ending Rule

Personnel exhaustion occurs only when emergency deployment still cannot create three different classes.

## Validation And Tests

Validate:
- duplicate settlement
- invalid members
- invalid survivor state
- invalid HP
- missing expedition result

Test:
- 3/2/1 survivor rewards
- wipe relic recovery
- dead member gold reset
- risk cap at ★5
- attempts increase
- next reward calculation
- wounded state
- emergency deployment rules

## Follow-up Changes

C4 implementation must include related contract updates in the implementation plan. Do not limit the plan to settlement code only.

Required plan scope:

### C2 — Campaign Board / Party Generation

Update party generation rules to support emergency deployment.

Plan must include:
- separate normal deployment eligibility from emergency deployment eligibility
- keep gravely wounded members excluded by default
- allow emergency candidates only when normal candidates cannot create a valid 3-class party
- minimize wounded member usage
- preserve seeded deterministic selection

### C6 — Ending Conditions

Update personnel exhaustion rules.

Plan must include:
- exhaustion check after emergency deployment evaluation
- alive + trust > 0 candidates are considered
- gravely wounded members are valid emergency candidates
- dead or trust 0 members are never candidates

### C8 — Statistics

Use SettlementResult as the source for settlement statistics.

### U6 — Settlement View

Consume SettlementResult directly.

B1 owns final balance tuning.
