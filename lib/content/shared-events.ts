import type { SituationEvent } from "@/lib/domain";
import { SHARED_REST_EVENTS } from "@/lib/content/shared-rest-events";
import { SHARED_MERCHANT_EVENTS } from "@/lib/content/shared-merchant-events";
import { SHARED_SPECIAL_EVENTS } from "@/lib/content/shared-special-events";

/**
 * 공용 사건. 생태 규칙을 참조하지 않으므로 모든 테마의 던전에 나온다.
 *
 * 유형은 콘텐츠가 직접 선언하고, 판단의 근거는 상황 묘사의 관찰 가능한 사실이
 * 진다. 묘사에는 사실을 적고 결론을 적지 않는다. `상인이 자꾸 뒤를 돌아본다`는
 * 사실이고 `이 상인은 도둑이다`는 결론이다.
 * docs/superpowers/specs/2026-08-20-lattebun-f3-1-advice-content-contract-design.md
 */
export const SHARED_EVENTS: readonly SituationEvent[] = [
  ...SHARED_REST_EVENTS,
  ...SHARED_MERCHANT_EVENTS,
  ...SHARED_SPECIAL_EVENTS,
];
