import type {
  ChoiceId,
  DungeonEvent,
  EventChoice,
  EventId,
  EventKind,
} from "@/lib/domain";

export interface DungeonEventPools {
  readonly regular: Readonly<Record<EventKind, readonly DungeonEvent[]>>;
  readonly boss: readonly DungeonEvent[];
}

function choice(
  id: string,
  label: string,
  expectedGain: string,
  knownRisk: string,
  target?: EventChoice["target"],
): EventChoice {
  return { id: id as ChoiceId, label, expectedGain, knownRisk, target };
}

function event(
  id: string,
  kind: EventKind,
  title: string,
  description: string,
  choices: EventChoice[],
): DungeonEvent {
  return { id: id as EventId, kind, title, description, choices };
}

export const DUNGEON_EVENT_POOLS: DungeonEventPools = {
  regular: {
    monster: [
      event(
        "event-goblin-ambush",
        "monster",
        "고블린 매복",
        "고블린들이 좁은 길목에서 파티를 포위했다.",
        [
          choice(
            "choice-guide-flank",
            "우회로를 알려준다",
            "파티의 피해를 줄이고 신뢰를 얻는다",
            "고블린이 도주해 보스에게 경고할 수 있다",
          ),
        ],
      ),
      event(
        "event-spider-nest",
        "monster",
        "거미 둥지",
        "거미줄이 통로 전체를 가로막고 있다.",
        [
          choice(
            "choice-cut-web",
            "안전한 통로를 만든다",
            "식량 손실 없이 둥지를 통과한다",
            "길잡이가 먼저 독에 노출될 수 있다",
          ),
        ],
      ),
    ],
    rest: [
      event(
        "event-dying-campfire",
        "rest",
        "꺼져 가는 모닥불",
        "희미한 불빛 곁에 지친 여행자들이 모여 있다.",
        [
          choice(
            "choice-share-rations",
            "식량을 나눈다",
            "파티가 회복하고 관계를 확인한다",
            "남은 식량이 줄어든다",
          ),
        ],
      ),
      event(
        "event-abandoned-camp",
        "rest",
        "버려진 야영지",
        "사람의 흔적이 남은 야영지가 텅 비어 있다.",
        [
          choice(
            "choice-search-camp",
            "야영지를 조사한다",
            "정보와 쓸 만한 물자를 찾을 수 있다",
            "함정이나 감시 흔적을 건드릴 수 있다",
          ),
        ],
      ),
    ],
    merchant: [
      event(
        "event-shadow-merchant",
        "merchant",
        "그림자 행상인",
        "그림자 속 행상인이 조용히 거래를 제안한다.",
        [
          choice(
            "choice-buy-rumor",
            "보스의 소문을 산다",
            "보스와 경로에 관한 정보를 얻는다",
            "거짓 정보에 자원을 낭비할 수 있다",
          ),
        ],
      ),
      event(
        "event-map-peddler",
        "merchant",
        "지도 장수",
        "낡은 지도를 든 장수가 다음 갈림길을 가리킨다.",
        [
          choice(
            "choice-trade-map",
            "낡은 지도를 거래한다",
            "다음 경로의 위험을 비교할 단서를 얻는다",
            "거래 사실이 양쪽에 알려질 수 있다",
          ),
        ],
      ),
    ],
    special: [
      event(
        "event-sealed-contract",
        "special",
        "봉인된 계약서",
        "봉인된 계약서가 던전의 의도를 숨긴 채 놓여 있다.",
        [
          choice(
            "choice-read-contract",
            "계약 조건을 읽는다",
            "던전 세력의 의도를 파악한다",
            "계약을 읽은 사실이 보스에게 전달된다",
            { kind: "boss" },
          ),
        ],
      ),
      event(
        "event-whispering-door",
        "special",
        "속삭이는 문",
        "닫힌 문 너머에서 누군가 파티에게 속삭인다.",
        [
          choice(
            "choice-answer-door",
            "문의 질문에 답한다",
            "숨겨진 길과 거래 기회를 발견한다",
            "대답이 파티의 비밀을 드러낼 수 있다",
          ),
        ],
      ),
    ],
  },
  boss: [
    event(
      "event-boss-audience",
      "special",
      "보스의 알현실",
      "보스가 알현실에서 파티를 기다리고 있다.",
      [
        choice(
          "choice-enter-audience",
          "보스 앞에 나아간다",
          "탐험 중 모은 정보로 최종 협상을 시작한다",
          "선택과 관계가 보스전 결과로 돌아온다",
          { kind: "boss" },
        ),
      ],
    ),
  ],
};
