// 이 파일은 컴파일에 성공하는 것 자체가 검사다.
// 런타임에 실행하지 않으며 애플리케이션이 가져오지 않는다.
// 모든 값을 export하는 이유는 no-unused-vars 규칙을 피하기 위함이다.
import type { ClassId, MemberId, NodeId } from "./ids";
import {
  PARTY_SIZE_MAX,
  PARTY_SIZE_MIN,
  PERSONALITIES,
  TRUST_MAX,
  TRUST_MIN,
} from "./party";
import type { ClassDef, PartyMember, Personality } from "./party";

export const memberId = "m1" as MemberId;
export const nodeId = "n1" as NodeId;

// 브랜드가 동작하면 NodeId를 MemberId 자리에 넣을 수 없다.
// @ts-expect-error NodeId는 MemberId에 대입할 수 없다
export const wrongId: MemberId = nodeId;

// 상수의 개수와 값이 설정집과 맞는지 확인한다.
export const personalityCount: 5 = PERSONALITIES.length;
export const partySizeRange: [3, 5] = [PARTY_SIZE_MIN, PARTY_SIZE_MAX];
export const trustRange: [0, 100] = [TRUST_MIN, TRUST_MAX];

export const sampleClass: ClassDef = {
  id: "warrior" as ClassId,
  name: "전사",
  description: "앞에서 버티며 파티의 피해를 받아낸다.",
};

export const sampleMember: PartyMember = {
  id: memberId,
  name: "라스",
  classId: sampleClass.id,
  personality: "righteous",
  trust: 55,
  alive: true,
};

// 목록에 없는 성격은 대입할 수 없다.
// @ts-expect-error brave는 확정된 성격 다섯에 없다
export const wrongPersonality: Personality = "brave";
