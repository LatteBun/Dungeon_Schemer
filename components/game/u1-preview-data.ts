import { DENOUNCE_THRESHOLD } from "@/lib/domain";

export const U1_PREVIEW_SCREEN_IDS = [
  "intro",
  "board",
  "map",
  "progress",
  "settlement",
] as const;

export type U1PreviewScreen = (typeof U1_PREVIEW_SCREEN_IDS)[number];

export interface U1PreviewScreenDefinition {
  id: U1PreviewScreen;
  label: string;
  mainTitle: string;
  mainDescription: string;
  rightTitle: string | null;
  rightDescription: string | null;
}

export const U1_PREVIEW_SCREENS: readonly U1PreviewScreenDefinition[] = [
  {
    id: "intro",
    label: "인트로",
    mainTitle: "길잡이의 시작",
    mainDescription: "직접 싸우지 않고 정보와 선택으로 원정을 이끕니다.",
    rightTitle: null,
    rightDescription: null,
  },
  {
    id: "board",
    label: "게시판",
    mainTitle: "길드 게시판",
    mainDescription: "진입 가능한 공고와 잠긴 공고를 함께 확인합니다.",
    rightTitle: "계약 상세",
    rightDescription: "선택한 던전과 출전 파티를 확인합니다.",
  },
  {
    id: "map",
    label: "지도",
    mainTitle: "던전 지도",
    mainDescription: "현재 위치와 다음 선택지를 확인합니다.",
    rightTitle: "파티 상태",
    rightDescription: "현재 파티와 이동 정보를 확인합니다.",
  },
  {
    id: "progress",
    label: "진행",
    mainTitle: "원정 진행",
    mainDescription: "상황 설명과 카드 선택 영역입니다.",
    rightTitle: "최근 반응",
    rightDescription: "파티원의 반응과 상태 변화를 확인합니다.",
  },
  {
    id: "settlement",
    label: "정산·엔딩",
    mainTitle: "원정 정산",
    mainDescription: "생존·보상·위험도 변화의 원인을 확인합니다.",
    rightTitle: "보상과 승급",
    rightDescription: "변경된 보상과 승급 상태를 확인합니다.",
  },
];

export const U1_PREVIEW_PARTY = [
  {
    id: "eda",
    name: "에다",
    role: "전사",
    currentHp: 10,
    maxHp: 12,
    trust: "수용",
    reaction: "선택을 따른다",
  },
  {
    id: "nio",
    name: "니오",
    role: "도적",
    currentHp: 7,
    maxHp: 9,
    trust: "의심",
    reaction: "길을 살핀다",
  },
  {
    id: "rasha",
    name: "라샤",
    role: "성직자",
    currentHp: 8,
    maxHp: 8,
    trust: "적발",
    reaction: "위험을 경계한다",
  },
] as const;

export const U1_PREVIEW_NOTICES = [
  {
    id: "spider-cave-3",
    title: "거미굴 3번",
    area: "고대 수로",
    riskLevel: 2,
    status: "계약 가능",
    partyIds: ["eda", "nio", "rasha"],
  },
  {
    id: "abandoned-mine-4",
    title: "폐광 4번",
    area: "광부의 길",
    riskLevel: 3,
    status: "파티 피로",
    partyIds: ["eda", "rasha"],
  },
  {
    id: "graveyard-2",
    title: "묘지 2번",
    area: "이끼 낀 묘역",
    riskLevel: 4,
    status: "명성 부족",
    partyIds: ["nio"],
  },
] as const;

export const U1_PREVIEW_PATH_NODES = [
  { id: "entrance", label: "입구", state: "현재 위치" },
  { id: "rest", label: "휴식", state: "안전 지점" },
  { id: "merchant", label: "상인", state: "정보 부족" },
  { id: "intel", label: "정보", state: "선택 지점" },
  { id: "boss", label: "보스방", state: "위험 ★★★" },
] as const;

export const U1_PREVIEW_CHOICES = [
  {
    id: "left",
    title: "왼쪽 통로로 빠져나간다",
    detail: "발자국은 적지만 시야가 좁다.",
  },
  {
    id: "center",
    title: "중앙 문로가 열려 있다",
    detail: "소음이 크지만 보급품 흔적이 있다.",
  },
  {
    id: "wind",
    title: "바람이 부는 복도다",
    detail: "먼 곳의 비명과 함께 차가운 공기가 흐른다.",
  },
] as const;

export const U1_PREVIEW_SETTLEMENT_STEPS = [
  {
    id: "survival",
    label: "생존",
    value: "3 / 3 귀환",
    reason: "라샤의 경계로 매복을 피했다.",
  },
  {
    id: "reward",
    label: "보상",
    value: "+48 골드",
    reason: "상인 지점에서 보급 상자를 발견했다.",
  },
  {
    id: "promotion",
    label: "승급",
    value: "명성 +9",
    reason: "위험도 2 계약을 완수했다.",
  },
] as const;

export const U1_PREVIEW_STATUS = {
  rank: "B",
  reputation: 74,
  gold: 186,
  canPromote: true,
  remainingDungeons: 11,
  zeroTrust: { livingCount: 7, threshold: DENOUNCE_THRESHOLD },
  currentDungeon: { name: "자카르의 불탄 우물", riskLevel: 5 },
} as const;
