import { ADVICE_OUTCOMES, EVENT_KINDS, RuleError } from "@/lib/domain";
import type {
  AdviceOutcome,
  BaseAdviceOption,
  EcologyRelation,
  MerchantAdviceOption,
  NonMerchantAdviceOption,
  NonMerchantSituationEvent,
  SituationEvent,
  ThemeContent,
  ThemeId,
} from "@/lib/domain";

/** 사건 하나가 담는 조언 수. 도움·방해·중립을 한 개씩이다. */
const ADVICE_PER_EVENT = 3;

function invalid(message: string, details: Record<string, unknown>): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function requireText(
  value: string,
  message: string,
  details: Record<string, unknown>,
): void {
  if (value.trim() === "") invalid(message, details);
}

function validateAdviceText(option: BaseAdviceOption, eventId: string): void {
  const details = { contentType: "advice", eventId, adviceId: option.id };
  requireText(option.label, `조언 문구가 비어 있다: ${option.id}`, details);
  requireText(option.line, `조언의 근거 대사가 비어 있다: ${option.id}`, details);
  requireText(option.resultText, `조언의 결과 문구가 비어 있다: ${option.id}`, details);
}

/** 테마 전용 사건에서 유형이 요구하는 관계. */
const REQUIRED_RELATION: Readonly<Record<AdviceOutcome, EcologyRelation>> = {
  help: "consistent",
  harm: "contradictory",
  neutral: "unrelated",
};

function validateThemedAdvice(
  option: NonMerchantAdviceOption,
  eventId: string,
  theme?: ThemeContent,
): void {
  const details = { contentType: "advice", eventId, adviceId: option.id };
  const required = REQUIRED_RELATION[option.outcome];
  const source = option.source;

  if (option.relation !== required) {
    invalid(`조언 유형과 규칙 관계가 맞지 않는다: ${option.id}`, {
      ...details,
      outcome: option.outcome,
      expected: required,
      actual: option.relation,
    });
  }

  // 정합·모순은 무엇에 대해 정합인지 가리켜야 한다. 무관은 가리킬 것이 없다.
  const needsSource = option.relation !== "unrelated";
  if (needsSource && option.source === undefined) {
    invalid(`참조 근거가 없다: ${option.id}`, { ...details, relation: option.relation });
  }
  if (!needsSource && option.source !== undefined) {
    invalid(`무관한 조언이 참조 근거를 갖는다: ${option.id}`, {
      ...details,
      source: option.source,
    });
  }
  if (source?.kind === "boss") {
    invalid(`일반 테마 조언이 보스 특징을 참조한다: ${option.id}`, {
      ...details,
      bossRuleId: source.bossRuleId,
    });
  }
  if (theme !== undefined && source?.kind === "ecology") {
    if (!theme.rules.some((rule) => rule.id === source.ruleId)) {
      invalid(`테마 밖 생태 규칙을 참조한다: ${option.id} → ${source.ruleId}`, {
        ...details,
        theme: theme.id,
        ruleId: source.ruleId,
      });
    }
  }
}

function validateBossAdvice(
  option: NonMerchantAdviceOption,
  event: NonMerchantSituationEvent,
  theme?: ThemeContent,
): void {
  const details = { contentType: "advice", eventId: event.id, adviceId: option.id };
  const required = REQUIRED_RELATION[option.outcome];
  const source = option.source;
  if (option.relation !== required) {
    invalid(`조언 유형과 규칙 관계가 맞지 않는다: ${option.id}`, {
      ...details,
      outcome: option.outcome,
      expected: required,
      actual: option.relation,
    });
  }
  if (option.outcome === "neutral") {
    if (source !== undefined) {
      invalid(`보스 정보 중립 조언이 근거를 갖는다: ${option.id}`, details);
    }
  } else if (source?.kind !== "boss") {
    invalid(`보스 정보 조언이 보스 특징을 참조하지 않는다: ${option.id}`, details);
  }
  if (option.bossDamageModifier === undefined) {
    invalid(`보스 정보 조언의 보스 피해 보정이 없다: ${option.id}`, details);
  }
  if (theme !== undefined && source?.kind === "boss") {
    const targetBoss = theme.bosses.find((boss) => boss.id === event.targetBossId);
    if (targetBoss === undefined) {
      invalid(`테마에 대상 보스가 없다: ${event.targetBossId}`, {
        ...details,
        targetBossId: event.targetBossId,
      });
    }
    if (!targetBoss.rules.some((rule) => rule.id === source.bossRuleId)) {
      const belongsToOtherBoss = theme.bosses.some(
        (boss) =>
          boss.id !== targetBoss.id &&
          boss.rules.some((rule) => rule.id === source.bossRuleId),
      );
      invalid(
        belongsToOtherBoss
          ? `다른 보스의 특징을 참조한다: ${option.id}`
          : `대상 보스에 없는 특징을 참조한다: ${option.id}`,
        { ...details, targetBossId: event.targetBossId, bossRuleId: source.bossRuleId },
      );
    }
  }
}

function validateSharedAdvice(option: BaseAdviceOption, eventId: string): void {
  const details = { contentType: "advice", eventId, adviceId: option.id };

  // 공용 사건은 생태 규칙을 참조하지 않는다. 그것이 공용의 정의다.
  if (option.relation !== "unrelated") {
    invalid(`공용 조언의 관계가 무관이 아니다: ${option.id}`, {
      ...details,
      actual: option.relation,
    });
  }
  if (option.source !== undefined) {
    invalid(`공용 조언이 참조 근거를 갖는다: ${option.id}`, {
      ...details,
      source: option.source,
    });
  }
  // 보스는 테마에 속한다. 모든 테마에 나오는 사건이 특정 보스의 피해를 바꿀 수 없다.
  if (option.bossDamageModifier !== undefined) {
    invalid(`공용 조언이 보스 피해 보정을 갖는다: ${option.id}`, {
      ...details,
      bossDamageModifier: option.bossDamageModifier,
    });
  }
}

function validateMerchantEffect(
  effect: unknown,
  eventId: string,
  adviceId: string,
): void {
  const details = { contentType: "advice", eventId, adviceId };
  if (effect === null || typeof effect !== "object") {
    invalid(`merchant 효과 형태가 잘못됐다: ${adviceId}`, details);
  }

  const immediate: unknown = Reflect.get(effect, "immediateHpDeltaPerMember");
  const nextBattle: unknown = Reflect.get(effect, "nextBattle");

  if (
    immediate !== undefined &&
    (typeof immediate !== "number" || !Number.isInteger(immediate) || immediate === 0)
  ) {
    invalid(`merchant 즉시 HP 변화는 0이 아닌 정수여야 한다: ${adviceId}`, {
      ...details,
      immediateHpDeltaPerMember: immediate,
    });
  }

  if (nextBattle !== undefined) {
    if (nextBattle === null || typeof nextBattle !== "object") {
      invalid(`merchant 다음 전투 보정 형태가 잘못됐다: ${adviceId}`, details);
    }

    const incoming: unknown = Reflect.get(nextBattle, "incomingDamageMultiplier");
    const party: unknown = Reflect.get(nextBattle, "partyDamageMultiplier");
    const multipliers = [incoming, party].filter((multiplier) => multiplier !== undefined);

    if (
      multipliers.length !== 1 ||
      typeof multipliers[0] !== "number" ||
      !Number.isFinite(multipliers[0]) ||
      multipliers[0] <= 0
    ) {
      invalid(`merchant 다음 전투 보정은 유한한 양수 하나여야 한다: ${adviceId}`, {
        ...details,
        incomingDamageMultiplier: incoming,
        partyDamageMultiplier: party,
      });
    }
  }

  if (immediate === undefined && nextBattle === undefined) {
    invalid(`merchant 효과가 비어 있다: ${adviceId}`, details);
  }
}

function validateMerchantAdvice(option: MerchantAdviceOption, eventId: string): void {
  validateSharedAdvice(option, eventId);

  const runtimeOption: BaseAdviceOption & {
    readonly goldCost?: unknown;
    readonly merchantEffect?: unknown;
  } = option;
  const details = { contentType: "advice", eventId, adviceId: option.id };
  if (runtimeOption.outcome === "neutral") {
    if (runtimeOption.goldCost !== 0) {
      invalid(`merchant neutral 비용은 0G여야 한다: ${option.id}`, {
        ...details,
        goldCost: runtimeOption.goldCost,
      });
    }
    if (runtimeOption.merchantEffect !== undefined) {
      invalid(`merchant neutral 조언은 효과를 가질 수 없다: ${option.id}`, details);
    }
    return;
  }

  if (
    typeof runtimeOption.goldCost !== "number" ||
    !Number.isInteger(runtimeOption.goldCost) ||
    runtimeOption.goldCost <= 0
  ) {
    invalid(`merchant H/X 비용은 양의 정수여야 한다: ${option.id}`, {
      ...details,
      goldCost: runtimeOption.goldCost,
    });
  }
  if (
    runtimeOption.merchantEffect === undefined ||
    runtimeOption.merchantEffect === null ||
    typeof runtimeOption.merchantEffect !== "object"
  ) {
    invalid(`merchant H/X 조언에 효과가 없다: ${option.id}`, details);
  }

  validateMerchantEffect(runtimeOption.merchantEffect, eventId, option.id);
}

function validateAdviceSet(event: SituationEvent, theme?: ThemeContent): void {
  const details = { contentType: "situationEvent", eventId: event.id };

  if (event.advice.length !== ADVICE_PER_EVENT) {
    invalid(`조언이 ${ADVICE_PER_EVENT}개가 아니다: ${event.id}`, {
      ...details,
      expected: ADVICE_PER_EVENT,
      actual: event.advice.length,
    });
  }

  const seenIds = new Set<string>();
  if (event.kind === "merchant") {
    for (const option of event.advice) {
      if (seenIds.has(option.id)) {
        invalid(`조언 ID가 사건 안에서 중복된다: ${option.id}`, {
          ...details,
          adviceId: option.id,
        });
      }
      seenIds.add(option.id);
      validateAdviceText(option, event.id);
      validateMerchantAdvice(option, event.id);
    }
  } else {
    for (const option of event.advice) {
      if (seenIds.has(option.id)) {
        invalid(`조언 ID가 사건 안에서 중복된다: ${option.id}`, {
          ...details,
          adviceId: option.id,
        });
      }
      seenIds.add(option.id);
      validateAdviceText(option, event.id);
      if (event.theme === undefined) {
        validateSharedAdvice(option, event.id);
      } else if (event.targetBossId !== undefined) {
        validateBossAdvice(option, event, theme);
      } else {
        validateThemedAdvice(option, event.id, theme);
      }
    }
  }

  // 유형이 정확히 한 개씩인지. 개수만 세면 help 2개 + harm 1개도 3개라 통과한다.
  for (const outcome of ADVICE_OUTCOMES) {
    const count = event.advice.filter((option) => option.outcome === outcome).length;
    if (count !== 1) {
      invalid(`조언 유형 ${outcome}이 한 개가 아니다: ${event.id}`, {
        ...details,
        outcome,
        expected: 1,
        actual: count,
      });
    }
  }
}

function validateUpgrades(event: SituationEvent, theme?: ThemeContent): void {
  if (event.upgrades === undefined) return;

  for (const upgrade of event.upgrades) {
    const details = {
      contentType: "adviceUpgrade",
      eventId: event.id,
      clueId: upgrade.clueId,
      slotIndex: upgrade.slotIndex,
    };

    if (
      !Number.isInteger(upgrade.slotIndex) ||
      upgrade.slotIndex < 0 ||
      upgrade.slotIndex >= ADVICE_PER_EVENT
    ) {
      invalid(`강화판의 slotIndex가 범위를 벗어난다: ${event.id}`, details);
    }

    const replaced = event.advice[upgrade.slotIndex];
    const replacement = upgrade.replacement;

    // 도움 슬롯을 방해로 바꾸면 각 한 개씩이 깨진다.
    // 단서를 본 플레이어에게만 불변식이 다르게 적용될 이유가 없다.
    if (replacement.outcome !== replaced.outcome) {
      invalid(`강화판의 유형이 교체할 슬롯과 다르다: ${event.id}`, {
        ...details,
        expected: replaced.outcome,
        actual: replacement.outcome,
      });
    }

    validateAdviceText(replacement, event.id);
    if (event.theme === undefined) {
      validateSharedAdvice(replacement, event.id);
    } else if (event.targetBossId !== undefined) {
      validateBossAdvice(replacement, event, theme);
    } else {
      validateThemedAdvice(replacement, event.id, theme);
    }
  }
}

function validateConditionalRules(event: SituationEvent, theme?: ThemeContent): void {
  const declared = event.kind === "merchant" ? undefined : event.satisfiedConditionalRuleIds;
  const details = { contentType: "situationEvent", eventId: event.id };

  if (declared !== undefined && declared.length > 0) {
    if (event.theme === undefined || theme === undefined) {
      invalid(`공용 또는 merchant 사건은 조건부 규칙을 선언할 수 없다: ${event.id}`, details);
    }
    const seen = new Set<string>();
    for (const ruleId of declared) {
      if (seen.has(ruleId)) {
        invalid(`조건부 규칙 선언이 중복된다: ${event.id} → ${ruleId}`, {
          ...details,
          ruleId,
        });
      }
      seen.add(ruleId);
      const rule = theme.rules.find((candidate) => candidate.id === ruleId);
      if (rule === undefined || !rule.conditional) {
        invalid(`조건부 규칙이 아니거나 테마 밖이다: ${event.id} → ${ruleId}`, {
          ...details,
          theme: theme.id,
          ruleId,
        });
      }
    }
  }

  const referenced = event.kind === "merchant"
    ? []
    : event.advice.flatMap((option) => {
      const source = option.source;
      return source?.kind === "ecology" && theme?.rules.some(
        (rule) => rule.id === source.ruleId && rule.conditional,
      )
        ? [source.ruleId]
        : [];
    });
  const referencedIds = new Set(referenced);
  for (const ruleId of referencedIds) {
    if (declared?.includes(ruleId) !== true) {
      invalid(`조건부 생태 규칙 참조가 선언되지 않았다: ${event.id} → ${ruleId}`, {
        ...details,
        ruleId,
      });
    }
  }
  if (declared !== undefined) {
    for (const ruleId of declared) {
      if (!referencedIds.has(ruleId)) {
        invalid(`사용하지 않은 조건부 규칙을 선언했다: ${event.id} → ${ruleId}`, {
          ...details,
          ruleId,
        });
      }
    }
  }
}

/**
 * 조언 콘텐츠 하나가 계약을 만족하는지 검사한다.
 *
 * 수량·문구·태그만 본다. 유형 판정, 수용·의심·적발 확률, 개인별 반응,
 * 보스 피해 보정은 규칙(E2)의 몫이다. 한 던전 안의 중복 방지는 배치(E3)가 한다.
 * docs/systems/INFORMATION_AND_DECEPTION.md
 */
export function validateSituationEvent(event: SituationEvent, theme?: ThemeContent): void {
  const details = { contentType: "situationEvent", eventId: event.id };
  if (event.theme === undefined && event.kind === "monster") {
    invalid(`몬스터 사건은 공용일 수 없다: ${event.id}`, {
      ...details,
      kind: event.kind,
    });
  }
  if (event.theme === undefined && event.targetBossId !== undefined) {
    invalid(`공용 사건은 대상 보스를 가질 수 없다: ${event.id}`, {
      ...details,
      targetBossId: event.targetBossId,
    });
  }
  if (event.theme !== undefined && theme !== undefined && event.theme !== theme.id) {
    invalid(`사건의 테마가 검증 대상과 다르다: ${event.id}`, {
      ...details,
      eventTheme: event.theme,
      expectedTheme: theme.id,
    });
  }
  if (event.targetBossId !== undefined && event.kind !== "special") {
    invalid(`보스 정보 사건은 special이어야 한다: ${event.id}`, {
      ...details,
      kind: event.kind,
    });
  }
  if (
    event.targetBossId === undefined &&
    event.advice.some((option) => option.bossDamageModifier !== undefined)
  ) {
    invalid(`보스 대상이 없는 사건이 보스 피해 보정을 갖는다: ${event.id}`, details);
  }
  requireText(event.title, `사건 제목이 비어 있다: ${event.id}`, details);
  requireText(event.description, `사건 묘사가 비어 있다: ${event.id}`, details);
  requireText(
    event.defaultResultText,
    `기본 결과 문구가 비어 있다: ${event.id}`,
    details,
  );
  validateAdviceSet(event, theme);
  validateConditionalRules(event, theme);
  validateUpgrades(event, theme);
}

/**
 * 공용 사건의 분류별 하한.
 *
 * 상한이 아니다. 던전 하나가 6~8지점이고 네 분류가 각 1회 이상 보장되므로
 * 여유 지점이 한 분류로 몰리면 최대 5개가 필요하다. 정확히 5개를 요구하면
 * F3-4가 30개로 늘릴 때 검증기가 깨진다.
 */
const SHARED_EVENTS_PER_KIND_MIN = 5;

/** 규칙 하나가 공급해야 하는 도움·방해 수. */
const RULE_ADVICE_MIN = 2;

function validateEventIds(events: readonly SituationEvent[]): void {
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.id)) {
      invalid(`사건 ID가 중복된다: ${event.id}`, {
        contentType: "situationEvent",
        eventId: event.id,
      });
    }
    seen.add(event.id);
  }
}

function validateSharedSupply(events: readonly SituationEvent[]): void {
  const shared = events.filter((event) => event.theme === undefined);
  // monster는 전부 생태 규칙 위에서 판정되므로 공용일 수 없다.
  for (const kind of EVENT_KINDS) {
    if (kind === "monster") continue;
    const count = shared.filter((event) => event.kind === kind).length;
    if (count < SHARED_EVENTS_PER_KIND_MIN) {
      invalid(`공용 ${kind} 사건이 ${SHARED_EVENTS_PER_KIND_MIN}개 미만이다`, {
        contentType: "situationEvent",
        kind,
        expected: SHARED_EVENTS_PER_KIND_MIN,
        actual: count,
      });
    }
  }
}

function validateThemeSupply(
  events: readonly SituationEvent[],
  themeContent?: ThemeContent,
): void {
  const themed = events.filter((event): event is NonMerchantSituationEvent => event.theme !== undefined);
  const themes = themeContent === undefined
    ? new Set<ThemeId>(themed.map((event) => event.theme as ThemeId))
    : new Set<ThemeId>([themeContent.id]);

  for (const theme of themes) {
    const contentRules = themeContent?.id === theme
      ? themeContent.rules.map((rule) => rule.id)
      : undefined;
    const options = themed
      .filter((event) => event.theme === theme)
      .flatMap((event): readonly NonMerchantAdviceOption[] => event.advice);

    // 던전이 규칙 6개 중 어느 3개를 활성으로 뽑아도 재료가 있어야 한다.
    const ruleIds = contentRules === undefined
      ? new Set(
        options.flatMap((option) =>
          option.source?.kind === "ecology" ? [option.source.ruleId] : [],
        ),
      )
      : new Set(contentRules);
    for (const ruleId of ruleIds) {
      for (const outcome of ["help", "harm"] as const) {
        const count = options.filter(
          (option) =>
            option.source?.kind === "ecology" &&
            option.source.ruleId === ruleId &&
            option.outcome === outcome,
        ).length;
        if (count < RULE_ADVICE_MIN) {
          invalid(`규칙 ${ruleId}의 ${outcome} 조언이 ${RULE_ADVICE_MIN}개 미만이다`, {
            contentType: "advice",
            theme,
            ruleId,
            outcome,
            expected: RULE_ADVICE_MIN,
            actual: count,
          });
        }
      }
    }
  }
}

/**
 * 조언 콘텐츠 모음 전체가 던전을 만들기에 충분한지 검사한다.
 *
 * 사건마다 {@link validateSituationEvent}를 돌린 뒤, ID 전역 중복과 공급
 * 하한(공용 분류별 5개, 규칙마다 도움·방해 2개)을 본다.
 */
export function validateSituationEvents(
  events: readonly SituationEvent[],
  theme?: ThemeContent,
): void {
  for (const event of events) {
    validateSituationEvent(event, theme);
  }

  validateEventIds(events);
  if (theme === undefined) {
    validateSharedSupply(events);
    validateThemeSupply(events);
  } else {
    if (events.some((event) => event.theme !== theme.id)) {
      invalid(`테마 검증 대상 밖 사건이 포함되어 있다: ${theme.id}`, {
        contentType: "situationEvent",
        theme: theme.id,
      });
    }
    validateThemeSupply(events, theme);
  }
}
