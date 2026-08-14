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
  effectTags: EventChoice["effectTags"] = ["observe"],
): EventChoice {
  return { id: id as ChoiceId, label, expectedGain, knownRisk, target, effectTags };
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
          choice(
            "choice-rush-past",
            "소음을 감수하고 돌파한다",
            "전투를 짧게 끝낸다",
            "파티가 부상을 입을 수 있다",
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
          choice(
            "choice-burn-web",
            "거미줄을 태운다",
            "통로를 빠르게 확보한다",
            "불길이 주변까지 번질 수 있다",
          ),
        ],
      ),
      event(
        "event-collapsed-bridge",
        "monster",
        "무너진 다리",
        "무너진 다리가 깊은 틈 위에 위태롭게 걸쳐 있다.",
        [
          choice(
            "choice-cross-bridge",
            "다리를 건넌다",
            "빠른 길을 유지한다",
            "발판이 무너질 수 있다",
          ),
          choice(
            "choice-find-detour",
            "우회로를 찾는다",
            "파티를 안전하게 이끈다",
            "식량과 시간이 더 든다",
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
          choice(
            "choice-share-secret",
            "불빛 아래서 정보를 나눈다",
            "파티원의 경계를 낮춘다",
            "당신의 약점도 함께 드러난다",
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
          choice(
            "choice-sleep-lightly",
            "경계를 세우고 잠든다",
            "매복에 대비한다",
            "회복할 시간이 줄어든다",
          ),
        ],
      ),
      event(
        "event-wounded-scout",
        "rest",
        "부상당한 정찰병",
        "부상당한 정찰병이 잠시 쉬어 갈 곳을 찾고 있다.",
        [
          choice(
            "choice-tend-scout",
            "정찰병을 돌본다",
            "다음 층의 위험 정보를 얻는다",
            "회복 물자를 나눠야 한다",
          ),
          choice(
            "choice-pass-scout",
            "발견하지 못한 척 지나간다",
            "자원을 보존한다",
            "중요한 경고를 놓칠 수 있다",
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
          choice(
            "choice-ignore-rumor",
            "소문을 사지 않고 관찰한다",
            "자원을 아낀다",
            "유용한 단서를 놓칠 수 있다",
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
          choice(
            "choice-refuse-map",
            "거래를 거절하고 직접 살핀다",
            "스스로 판단할 시간을 얻는다",
            "위험한 길을 고를 수 있다",
          ),
        ],
      ),
      event(
        "event-herbalist-cart",
        "merchant",
        "약초 수레",
        "약초꾼이 치료 재료와 독성 재료를 함께 펼쳐 보인다.",
        [
          choice(
            "choice-buy-herbs",
            "치료 약초를 산다",
            "부상에 대비할 물자를 확보한다",
            "당장 쓸 골드를 잃는다",
          ),
          choice(
            "choice-study-herbs",
            "약초의 성질만 묻는다",
            "위험한 식물을 구분하는 단서를 얻는다",
            "거래 없이 떠나면 약초꾼이 불쾌해한다",
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
            "계약을 읽은 사실이 파티에 퍼질 수 있다",
          ),
          choice(
            "choice-seal-contract",
            "계약서를 봉인한 채 지나간다",
            "불필요한 위험을 피한다",
            "던전의 의도를 파악하지 못한다",
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
          choice(
            "choice-open-door",
            "문을 열고 안을 확인한다",
            "숨겨진 공간을 확보한다",
            "기습을 받을 수 있다",
          ),
        ],
      ),
      event(
        "event-unstable-rune",
        "special",
        "불안정한 룬",
        "바닥의 룬이 파티가 지나갈 때마다 빛을 바꾼다.",
        [
          choice(
            "choice-stabilize-rune",
            "룬을 안정시킨다",
            "안전한 통로를 만든다",
            "마력이 소진될 수 있다",
          ),
          choice(
            "choice-mark-rune",
            "룬의 변화를 기록한다",
            "다음 경로를 읽을 단서를 얻는다",
            "기록 중 함정이 발동할 수 있다",
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
          "탐험 중 모은 정보로 최종 방어를 준비한다",
          "선택과 관계가 보스전 결과로 돌아온다",
        ),
        choice(
          "choice-prepare-defense",
          "파티의 방어를 정비한다",
          "보스전의 위험을 관찰한다",
          "준비하는 동안 다른 기회를 놓친다",
        ),
      ],
    ),
  ],
};
