import type { MemberId } from "@/lib/domain";

export interface MockSettlement {
  outcome: "clear" | "gameOver";
  survivors: { memberId: MemberId; name: string; classLabel: string }[];
  casualties: { memberId: MemberId; name: string; classLabel: string }[];
  trustChanges: { memberId: MemberId; name: string; delta: number; reason: string }[];
  rewards: { label: string; amount: number }[];
  influentialDecisions: string[];
}

export const MOCK_SETTLEMENT: MockSettlement = {
  outcome: "clear",
  survivors: [{ memberId: "m-garon" as MemberId, name: "가론", classLabel: "전사" }, { memberId: "m-beka" as MemberId, name: "베카", classLabel: "도적" }],
  casualties: [{ memberId: "m-rien" as MemberId, name: "리엔", classLabel: "성직자" }, { memberId: "m-is" as MemberId, name: "이스", classLabel: "마법사" }],
  trustChanges: [
    { memberId: "m-garon" as MemberId, name: "가론", delta: 9, reason: "충동적 성격: 위험한 길에서 먼저 정보를 받았음" },
    { memberId: "m-is" as MemberId, name: "이스", delta: -18, reason: "의심 많은 성격: 왼쪽 길이 비어 있다는 말이 거짓으로 드러남" },
    { memberId: "m-rien" as MemberId, name: "리엔", delta: 4, reason: "정의로운 성격: 숨기지 않은 답변" },
  ],
  rewards: [{ label: "사례금", amount: 34 }, { label: "명성", amount: 2 }, { label: "유품", amount: 1 }],
  influentialDecisions: ["이스에게 왼쪽 길이 비어 있다고 말했다. 그 길에 파수꾼이 있었다.", "보스의 밀사가 준 계약을 받아들이지 않고 이스에게 알렸다.", "리치의 관 위치를 리엔에게 알려줘 파티가 보스를 끝냈다."],
};
