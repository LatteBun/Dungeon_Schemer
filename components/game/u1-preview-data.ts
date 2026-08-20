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

export const U1_PREVIEW_STATUS = {
  rank: "B",
  reputation: 74,
  gold: 186,
  canPromote: true,
  remainingDungeons: 11,
  currentDungeon: { name: "거미굴 3번", riskLevel: 2 },
} as const;
