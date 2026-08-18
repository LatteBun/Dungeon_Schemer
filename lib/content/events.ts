import type {
  ChoiceId,
  DungeonEvent,
  EventChoice,
  EventEffectTag,
  EventId,
  EventKind,
  ItemId,
} from "@/lib/domain";

export interface DungeonEventPools {
  readonly regular: Readonly<Record<EventKind, readonly DungeonEvent[]>>;
  readonly boss: readonly DungeonEvent[];
}

/**
 * 입장 전에 공개하는 지점별 위험 성격이다.
 *
 * 개별 사건이 아니라 분류에서 문구를 얻는다. 사건마다 다른 문구를 쓰면 제목을
 * 가려도 위험 문구가 어떤 사건인지 알려주게 되어, 정확한 피해와 보상은 도착할
 * 때까지 숨긴다는 규칙이 깨진다.
 * docs/superpowers/specs/2026-08-13-sanghwan-yoo-game-direction-rework-design.md
 */
export const EVENT_KIND_RISK_SUMMARY: Readonly<Record<EventKind, string>> = {
  monster: "전투 위험 높음",
  rest: "위험 낮음",
  merchant: "자원 손실 위험",
  special: "위험 예측 어려움",
};

export const BOSS_RISK_SUMMARY = "보스전 위험";

export const ENTRY_RISK_SUMMARY = "던전 입구";

/**
 * 효과 태그는 라벨의 의도를 규칙이 읽을 수 있게 옮긴 것이다.
 *
 * 라벨과 예상 이득·알려진 위험은 F2가 승인받은 콘텐츠라 그대로 둔다. 태그가
 * 라벨과 어긋나 보이면 라벨이 아니라 태그를 고칠 자리다.
 * docs/superpowers/specs/2026-08-15-sbh3821-event-action-boss-fight-design.md
 */
function choice(
  id: string,
  label: string,
  expectedGain: string,
  knownRisk: string,
  effectTags: readonly EventEffectTag[],
  itemId?: string,
): EventChoice {
  return {
    id: id as ChoiceId,
    label,
    expectedGain,
    knownRisk,
    effectTags,
    ...(itemId === undefined ? {} : { itemId: itemId as ItemId }),
  };
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
            ["support"],
          ),
          choice(
            "choice-rush-past",
            "소음을 감수하고 돌파한다",
            "전투를 짧게 끝낸다",
            "파티가 부상을 입을 수 있다",
            ["sabotage"],
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
            ["support"],
          ),
          choice(
            "choice-burn-web",
            "거미줄을 태운다",
            "통로를 빠르게 확보한다",
            "불길이 주변까지 번질 수 있다",
            ["sabotage"],
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
            ["sabotage"],
          ),
          choice(
            "choice-find-detour",
            "우회로를 찾는다",
            "파티를 안전하게 이끈다",
            "식량과 시간이 더 든다",
            ["support"],
          ),
        ],
      ),
      event(
        "event-howling-tunnel",
        "monster",
        "울부짖는 굴",
        "굴 안쪽에서 여러 마리의 울음이 겹쳐 들린다.",
        [
          choice(
            "choice-mark-safe-gap",
            "울음이 끊기는 틈을 알려준다",
            "무리와 마주치지 않고 지나간다",
            "틈을 기다리는 동안 뒤가 비어 있다",
            ["support"],
          ),
          choice(
            "choice-provoke-pack",
            "돌을 던져 무리를 끌어낸다",
            "한곳에 모아 길을 비운다",
            "모인 무리가 파티를 덮칠 수 있다",
            ["sabotage"],
          ),
        ],
      ),
      event(
        "event-stone-sentinel",
        "monster",
        "돌의 파수꾼",
        "통로 한가운데 선 석상이 지나는 것을 세고 있다.",
        [
          choice(
            "choice-match-count",
            "숫자를 맞춰 통과시킨다",
            "파수꾼을 깨우지 않고 지난다",
            "셈이 틀리면 즉시 반응한다",
            ["support"],
          ),
          choice(
            "choice-break-sentinel",
            "석상을 부순다",
            "다시 지나갈 길을 확보한다",
            "무너지는 돌에 파티가 다친다",
            ["sabotage"],
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
            ["rest"],
          ),
          choice(
            "choice-share-secret",
            "불빛 아래서 정보를 나눈다",
            "파티원의 경계를 낮춘다",
            "당신의 약점도 함께 드러난다",
            ["information"],
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
            ["item"],
          ),
          choice(
            "choice-sleep-lightly",
            "경계를 세우고 잠든다",
            "매복에 대비한다",
            "회복할 시간이 줄어든다",
            ["rest"],
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
            ["rest"],
          ),
          choice(
            "choice-pass-scout",
            "발견하지 못한 척 지나간다",
            "자원을 보존한다",
            "중요한 경고를 놓칠 수 있다",
            ["observe"],
          ),
        ],
      ),
      event(
        "event-warm-spring",
        "rest",
        "따뜻한 샘",
        "김이 오르는 샘가에 잠시 앉을 자리가 있다.",
        [
          choice(
            "choice-soak-wounds",
            "상처를 씻게 한다",
            "파티가 눈에 띄게 회복한다",
            "물소리에 발소리가 묻힌다",
            ["rest"],
          ),
          choice(
            "choice-fill-skins",
            "물만 채우고 서두른다",
            "시간을 아낀다",
            "회복할 기회를 넘긴다",
            ["observe"],
          ),
        ],
      ),
      event(
        "event-old-shrine",
        "rest",
        "낡은 사당",
        "누군가 오래전에 두고 간 공물이 아직 남아 있다.",
        [
          choice(
            "choice-share-offering",
            "공물을 나눠 먹인다",
            "굶주림을 덜고 사기를 올린다",
            "사당의 주인이 달가워하지 않는다",
            ["rest"],
          ),
          choice(
            "choice-read-inscription",
            "새겨진 글을 읽는다",
            "이 층의 내력을 알아낸다",
            "읽는 데 시간이 걸린다",
            ["information"],
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
            ["trade"],
            "item-information-scroll",
          ),
          choice(
            "choice-ignore-rumor",
            "소문을 사지 않고 관찰한다",
            "자원을 아낀다",
            "유용한 단서를 놓칠 수 있다",
            ["observe"],
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
            ["trade"],
            "item-information-scroll",
          ),
          choice(
            "choice-refuse-map",
            "거래를 거절하고 직접 살핀다",
            "스스로 판단할 시간을 얻는다",
            "위험한 길을 고를 수 있다",
            ["observe"],
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
            ["trade"],
            "item-healing-potion",
          ),
          choice(
            "choice-study-herbs",
            "약초의 성질만 묻는다",
            "위험한 식물을 구분하는 단서를 얻는다",
            "거래 없이 떠나면 약초꾼이 불쾌해한다",
            ["information"],
          ),
        ],
      ),
      event(
        "event-bone-collector",
        "merchant",
        "뼈 수집가",
        "수집가가 죽은 자의 유품을 늘어놓고 값을 부른다.",
        [
          choice(
            "choice-buy-antidote",
            "해독 물자를 산다",
            "독에 당한 상처를 되돌린다",
            "값이 만만치 않다",
            ["trade"],
            "item-healing-potion",
          ),
          choice(
            "choice-ask-origin",
            "유품의 출처를 묻는다",
            "앞서 간 원정대의 최후를 듣는다",
            "듣고 나면 파티가 동요한다",
            ["information"],
          ),
        ],
      ),
      event(
        "event-lamp-trader",
        "merchant",
        "등불 장수",
        "장수가 오래 타는 등불을 흔들어 보인다.",
        [
          choice(
            "choice-buy-lamp",
            "등불을 산다",
            "어두운 구간에서 덜 다친다",
            "골드를 쓴다",
            ["trade"],
            "item-lure-pouch",
          ),
          choice(
            "choice-borrow-light",
            "불씨만 얻어 간다",
            "값을 치르지 않고 넘긴다",
            "장수가 다음에 값을 올린다",
            ["observe"],
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
            ["information"],
          ),
          choice(
            "choice-seal-contract",
            "계약서를 봉인한 채 지나간다",
            "불필요한 위험을 피한다",
            "던전의 의도를 파악하지 못한다",
            ["observe"],
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
            ["information"],
          ),
          choice(
            "choice-open-door",
            "문을 열고 안을 확인한다",
            "숨겨진 공간을 확보한다",
            "기습을 받을 수 있다",
            ["sabotage"],
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
            ["support"],
          ),
          choice(
            "choice-mark-rune",
            "룬의 변화를 기록한다",
            "다음 경로를 읽을 단서를 얻는다",
            "기록 중 함정이 발동할 수 있다",
            ["information"],
          ),
        ],
      ),
      event(
        "event-mirror-pool",
        "special",
        "거울 웅덩이",
        "잔잔한 웅덩이가 지나는 이의 모습을 다르게 비춘다.",
        [
          choice(
            "choice-read-reflection",
            "비친 모습을 읽어준다",
            "파티가 스스로의 상태를 알아챈다",
            "감추고 싶던 것도 함께 드러난다",
            ["information"],
          ),
          choice(
            "choice-stir-pool",
            "물을 흐트러뜨린다",
            "불길한 장면을 지운다",
            "웅덩이가 반응할 수 있다",
            ["sabotage"],
          ),
        ],
      ),
      event(
        "event-collapsing-hall",
        "special",
        "무너지는 방",
        "천장에서 흙이 떨어지고 기둥이 기울고 있다.",
        [
          choice(
            "choice-brace-pillar",
            "기둥을 받쳐 시간을 번다",
            "파티를 무사히 통과시킨다",
            "받치는 동안 길잡이가 남는다",
            ["support"],
          ),
          choice(
            "choice-rush-through",
            "무너지기 전에 뛰게 한다",
            "빠르게 벗어난다",
            "낙석에 맞을 수 있다",
            ["sabotage"],
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
          ["observe"],
        ),
        choice(
          "choice-prepare-defense",
          "파티의 방어를 정비한다",
          "보스전의 위험을 관찰한다",
          "준비하는 동안 다른 기회를 놓친다",
          ["support"],
        ),
      ],
    ),
  ],
};

/**
 * 입구 지점의 사건이다. 일반 사건 풀에 넣지 않는다.
 *
 * 입구는 파티가 서 있는 자리일 뿐 사건이 발생하지 않는다. 그런데도 지점이므로
 * 사건 식별자가 필요하다. 풀에서 뽑아 쓰면 지도에 뜨기만 하고 절대 열리지 않는
 * 사건이 한 칸을 먹는다.
 * docs/superpowers/specs/2026-08-18-sbh3821-irregular-map-generation-design.md
 */
export const ENTRY_EVENT: DungeonEvent = event(
  "event-dungeon-entrance",
  "special",
  "던전 입구",
  "여기서부터가 던전이다. 파티가 첫 길을 고르기를 기다린다.",
  [
    choice(
      "choice-enter-dungeon",
      "안으로 들어간다",
      "탐험을 시작한다",
      "한번 들어가면 돌아 나올 수 없다",
      ["observe"],
    ),
  ],
);
