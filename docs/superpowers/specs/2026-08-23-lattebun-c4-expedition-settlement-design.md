# C4 — Expedition Settlement Specification

## Purpose

C4 is the settlement layer that permanently applies expedition results to the campaign state.

Responsibilities:
- persist final member state
- calculate clear/wipe settlement
- apply gold and reputation changes
- process wipe relic recovery
- update dungeon risk and attempts
- return structured settlement details for U6/C8

C4 does not control phase transition or idempotency history. C7 owns state
progression and the history of settled expedition IDs.

## Settlement Contract

`settleExpedition(campaign, snapshot)` receives an expedition end snapshot and
returns:

- updated CampaignState
- SettlementResult

`snapshot` must contain:

- `expeditionId`: stable identity for one completed expedition; C7 records it
  after a successful settlement and rejects another settlement for the same ID
- `dungeonId` and `contractRisk`: the accepted contract's dungeon and risk
- `party`: the three contracted member IDs, in expedition order
- `finalMembers`: the three final member states from expedition/boss resolution
- `causeInputs`: structured choice, reaction, and damage records needed to
  explain this settlement

C4 validates this snapshot and is pure: it never mutates `campaign` or the
snapshot. C7 must reject an `expeditionId` already in its settled-expedition
history before invoking C4, then owns the phase transition after C4 returns.

SettlementResult contains:
- `expeditionId` and `dungeonId`
- `survivorIds`, `survivorCount`, and per-member before/after changes
- `reputationDelta`
- `goldDelta`: contract gold only, excluding relic recovery
- `relicGold`: recovered relic gold only
- risk before/after and whether the ★5 cap applied
- next reward
- a structured five-step cause chain: `choice`, `reactions`, `damage`,
  `economy`, `campaignChange`

U6 turns this structured result into display text through its View adapter;
C8 records the same result without recomputing rewards or losses.

## Settlement Order

1. validate input
2. apply final character states
3. calculate clear/wipe outcome
4. apply economy changes
5. update dungeon state
6. calculate next reward
7. return new state and settlement result

Failed validation must not partially mutate campaign state.

Validation rejects a missing result, an unknown dungeon or member, duplicate
member IDs, a party other than exactly three members, final members not exactly
matching that party, invalid HP/trust/gold ranges, contradictory alive/HP state,
or a clear/wipe result inconsistent with the final survivors. Duplicate
settlement IDs are rejected at the C7 boundary, before C4 is called.

## Character State

Survivors keep final HP and trust.

If HP is below 20% of max HP:
- set gravelyWounded

Dead members:
- hp = 0
- alive = false
- no additional trust changes

The 20% boundary is strict: HP exactly equal to 20% of max HP is not gravely
wounded. C4 only changes the expedition party; it preserves all other pool
members.

## Clear Settlement

Base rewards are shared rules.

Survivor multiplier:
- 3 survivors: 100%
- 2 survivors: 60%
- 1 survivor: 30%

Apply floor after multiplication.

Partial survival never recovers dead member gold.

On clear, set the dungeon status to `cleared` and leave its failure `attempts`
unchanged. Add the contract reward to both current gold and cumulative earned
gold. Dead members in a partial clear retain their uncollected gold; it is
neither recovered nor reset.

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

`relicGold` is separate from `goldDelta`; the total current-gold and
cumulative-earned-gold increase for a wipe is `goldDelta + relicGold` (where
`goldDelta` is zero). A wipe leaves the dungeon uncleared, increases `attempts`
by one, and increases risk by one unless it is already ★5.

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
1. minimize wounded members across the whole board
2. maximize the number of complete three-class parties
3. break remaining ties with seeded selection

If even one complete normal party can be formed, do not use wounded members to
increase the number of offers. Emergency candidates are considered only when no
complete normal party exists.

Emergency deployed wounded members use current HP.

## Exhaustion Ending Rule

Personnel exhaustion occurs only when emergency deployment still cannot create three different classes.

## Validation And Tests

Validate:
- invalid members
- invalid survivor state
- invalid HP
- missing expedition result
- C7 rejects a duplicate expedition ID before C4 runs

Test:
- 3/2/1 survivor rewards
- wipe relic recovery
- dead member gold reset
- risk cap at ★5
- attempts increase
- next reward calculation
- wounded state
- emergency deployment rules
- normal-only deployment remains unchanged when it can create one party
- emergency whole-board wounded minimization, party-count maximization, and
  seeded tie breaking
- structured cause chain and U6 adapter mapping
- clear rewards and wipe relics both increase cumulative earned gold

## Follow-up Changes

C4 implementation must include related contract updates in the implementation plan. Do not limit the plan to settlement code only.

Required plan scope:

### C2 — Campaign Board / Party Generation

Update party generation rules to support emergency deployment.

Plan must include:
- separate normal deployment eligibility from emergency deployment eligibility
- keep gravely wounded members excluded by default
- allow emergency candidates only when normal candidates cannot create a valid 3-class party
- when emergency is necessary, minimize wounded members across the board before
  maximizing complete-party count
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

Add one adapter that converts SettlementResult's structured cause chain and
separate `goldDelta`/`relicGold` fields into `U6SettlementView`. Do not make the
screen calculate settlement values or consume CampaignState directly.

### C7 — Campaign Transition

Maintain the settled-expedition ID history, reject duplicate settlement before
calling C4, and own phase progression. C4 remains a pure settlement function.

### Official Documents

Update `docs/systems/CHARACTER_POOL_AND_WORLDTURN.md` and
`docs/systems/PROGRESSION_AND_ENDINGS.md` in the implementation change so their
deployment and personnel-exhaustion rules match emergency deployment.

B1 owns final balance tuning.
