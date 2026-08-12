import type { ChoiceId, DungeonEvent, EventId, MemberId } from "@/lib/domain";

export const MOCK_EVENTS: DungeonEvent[] = [
  {
    id: "e-entry" as EventId, kind: "rest", title: "던전 입구의 마지막 점검",
    description: "파티가 장비를 다시 묶는다. 리엔이 이 층의 소문을 당신에게 묻는다.",
    choices: [
      { id: "ch-entry-tell" as ChoiceId, label: "아는 대로 말한다", target: { kind: "member", id: "m-rien" as MemberId }, expectedGain: "리엔의 신뢰를 얻는다", knownRisk: "정보를 나중에 팔 기회를 잃는다" },
      { id: "ch-entry-hide" as ChoiceId, label: "아는 것이 없다고 한다", expectedGain: "정보를 나중에 쓸 수 있다", knownRisk: "길잡이로서 무능해 보인다" },
    ],
  },
  {
    id: "e-a1" as EventId, kind: "monster", title: "고블린 정찰대",
    description: "좁은 길에서 고블린 셋이 튀어나온다. 가론이 먼저 뛰어들었다.",
    choices: [
      { id: "ch-a1-support" as ChoiceId, label: "고블린의 약점을 알려준다", target: { kind: "member", id: "m-garon" as MemberId }, expectedGain: "가론의 신뢰를 얻고 피해를 줄인다", knownRisk: "던전 쪽 정보원을 잃는다" },
      { id: "ch-a1-betray" as ChoiceId, label: "고블린에게 파티의 대형을 넘긴다", target: { kind: "boss" }, expectedGain: "보스와의 관계가 좋아진다", knownRisk: "발각되면 처형" },
      { id: "ch-a1-watch" as ChoiceId, label: "관망한다", expectedGain: "관계 변화를 줄인다", knownRisk: "양쪽 모두 당신을 셈에 넣지 않게 된다" },
    ],
  },
  {
    id: "e-a2" as EventId, kind: "merchant", title: "그림자 상인",
    description: "후드를 쓴 상인이 좌판을 펼친다. 독과 가짜 지도를 함께 팔고 있다.",
    choices: [
      { id: "ch-a2-buy-map" as ChoiceId, label: "가짜 지도를 산다", expectedGain: "나중에 파티를 원하는 길로 유도할 수 있다", knownRisk: "사례금 6을 쓴다" },
      { id: "ch-a2-buy-info" as ChoiceId, label: "보스에 관한 정보를 산다", expectedGain: "보스전에서 쓸 진실 카드를 얻는다", knownRisk: "사례금 8을 쓴다" },
      { id: "ch-a2-sell" as ChoiceId, label: "파티의 사정을 상인에게 판다", expectedGain: "사례금을 얻는다", knownRisk: "베카가 거래를 목격할 수 있다" },
    ],
  },
  {
    id: "e-a3" as EventId, kind: "special", title: "보스의 밀사",
    description: "복면을 쓴 자가 당신만 따로 부른다. 옥좌까지 파티를 데려오면 몫을 주겠다고 한다.",
    choices: [
      { id: "ch-a3-accept" as ChoiceId, label: "계약을 받아들인다", target: { kind: "boss" }, expectedGain: "보스전 뒤 큰 보수를 약속받는다", knownRisk: "파티가 전멸하면 명성을 잃는다" },
      { id: "ch-a3-report" as ChoiceId, label: "파티에 알린다", target: { kind: "member", id: "m-is" as MemberId }, expectedGain: "이스의 신뢰를 크게 얻는다", knownRisk: "보스가 당신을 적으로 셈한다" },
    ],
  },
  {
    id: "e-b1" as EventId, kind: "monster", title: "무너진 다리의 파수꾼",
    description: "돌로 된 파수꾼이 다리를 막고 있다. 우회로는 좁고 어둡다.",
    choices: [
      { id: "ch-b1-fight" as ChoiceId, label: "정면으로 붙게 한다", expectedGain: "시간을 아낀다", knownRisk: "누군가 크게 다칠 수 있다" },
      { id: "ch-b1-detour" as ChoiceId, label: "우회로로 안내한다", target: { kind: "member", id: "m-beka" as MemberId }, expectedGain: "베카가 함정을 미리 걷어낸다", knownRisk: "식량을 더 쓴다" },
    ],
  },
  {
    id: "e-b2" as EventId, kind: "rest", title: "젖은 야영지",
    description: "물이 새는 방에서 파티가 잠깐 눕는다. 가론이 먼저 잠들었다.",
    choices: [
      { id: "ch-b2-food" as ChoiceId, label: "식량을 나눈다", expectedGain: "모두의 신뢰를 조금씩 얻는다", knownRisk: "식량 2를 쓴다" },
      { id: "ch-b2-steal" as ChoiceId, label: "가론의 짐을 뒤진다", target: { kind: "member", id: "m-garon" as MemberId }, expectedGain: "유품이 될 물건을 미리 챈다", knownRisk: "깨면 신뢰가 크게 떨어진다" },
      { id: "ch-b2-listen" as ChoiceId, label: "파티원끼리 하는 말을 듣는다", expectedGain: "누가 누구를 의심하는지 알게 된다", knownRisk: "쉬지 못해 다음 전투가 불리해진다" },
    ],
  },
  {
    id: "e-boss" as EventId, kind: "monster", title: "리치의 옥좌",
    description: "옥좌 뒤에 관이 놓여 있다. 리치가 당신을 알아보고 눈길을 준다.",
    choices: [
      { id: "ch-boss-help-heroes" as ChoiceId, label: "관의 위치를 알려준다", target: { kind: "member", id: "m-rien" as MemberId }, expectedGain: "파티가 리치를 끝낼 수 있다", knownRisk: "보스와 맺은 것이 있다면 모두 깨진다" },
      { id: "ch-boss-help-boss" as ChoiceId, label: "파티의 남은 힘을 리치에게 알린다", target: { kind: "boss" }, expectedGain: "리치가 약속한 몫을 받는다", knownRisk: "생존자가 있으면 처형된다" },
      { id: "ch-boss-watch" as ChoiceId, label: "끝까지 지켜본다", expectedGain: "어느 쪽과도 등지지 않는다", knownRisk: "이긴 쪽이 당신에게 줄 것이 없다" },
    ],
  },
];
