import type { EventKind, Grade } from "@/lib/domain";

/**
 * 지점을 글자가 아니라 그림으로 표현한다.
 *
 * 범례를 찾아가며 기호를 해석하지 않아도 지점이 무엇인지 바로 읽히게 하는 것이
 * 목적이다. 외부 이미지를 쓰지 않고 인라인 SVG로 그리는 이유는, 배포된 페이지가
 * 외부 요청을 하지 않아야 하고 색을 테마 토큰으로 맞춰야 하기 때문이다.
 *
 * 색만으로 구분하지 않는다. 모양 자체가 다르므로 색을 못 봐도 구별된다.
 * docs/superpowers/specs/2026-08-18-sbh3821-irregular-map-generation-design.md
 */
export type MapIconKind = EventKind | "entry";

interface IconProps {
  /** 지점 반지름. 아이콘은 이 안에 들어가도록 그린다. */
  size: number;
  color: string;
}

/** 몬스터. 뿔과 어금니, 두 눈으로 위협을 드러낸다. */
function MonsterIcon({ size, color }: IconProps) {
  const s = size / 16;
  return (
    <g transform={`scale(${s})`} stroke={color} fill="none" strokeWidth={1.6} strokeLinejoin="round">
      <path d="M-9 2 C-9 -5 -5 -9 0 -9 C5 -9 9 -5 9 2 C9 7 5 9 0 9 C-5 9 -9 7 -9 2 Z" />
      <path d="M-7 -4 L-10 -10 L-4 -8" fill={color} />
      <path d="M7 -4 L10 -10 L4 -8" fill={color} />
      <circle cx={-3.5} cy={0} r={1.6} fill={color} stroke="none" />
      <circle cx={3.5} cy={0} r={1.6} fill={color} stroke="none" />
      <path d="M-4 5 L-2 7 L0 5 L2 7 L4 5" />
    </g>
  );
}

/** 휴식. 모닥불이다. 장작 위에 불꽃이 오른다. */
function CampfireIcon({ size, color }: IconProps) {
  const s = size / 16;
  return (
    <g transform={`scale(${s})`} stroke={color} fill="none" strokeWidth={1.6} strokeLinejoin="round">
      <path d="M0 -9 C3 -5 5 -3 5 0 C5 3.6 2.8 6 0 6 C-2.8 6 -5 3.6 -5 0 C-5 -3 -3 -5 0 -9 Z" fill={color} fillOpacity={0.25} />
      <path d="M0 -3 C1.4 -1 2 0 2 1.4 C2 3 1.1 4 0 4 C-1.1 4 -2 3 -2 1.4 C-2 0 -1.4 -1 0 -3 Z" fill={color} fillOpacity={0.5} stroke="none" />
      <path d="M-8 8 L8 10" strokeLinecap="round" />
      <path d="M-8 10 L8 8" strokeLinecap="round" />
    </g>
  );
}

/** 특수 사건. 무슨 일이 날지 모른다는 뜻의 물음표다. 상인 조우도 여기 들어간다. */
function QuestionIcon({ size, color }: IconProps) {
  const s = size / 16;
  return (
    <g transform={`scale(${s})`} stroke={color} fill="none" strokeWidth={2} strokeLinecap="round">
      <path d="M-4.5 -4 C-4.5 -7.5 -1.8 -9 0.4 -9 C3.2 -9 5 -7 5 -4.4 C5 -1.2 0.6 -0.6 0.6 2.6" />
      <circle cx={0.6} cy={7.4} r={1.5} fill={color} stroke="none" />
    </g>
  );
}

/** 입구. 던전으로 들어가는 아치다. */
function EntryIcon({ size, color }: IconProps) {
  const s = size / 16;
  return (
    <g transform={`scale(${s})`} stroke={color} fill="none" strokeWidth={1.6} strokeLinejoin="round">
      <path d="M-7 9 L-7 -1 C-7 -5.4 -3.9 -8 0 -8 C3.9 -8 7 -5.4 7 -1 L7 9" />
      <path d="M-3.4 9 L-3.4 0.6 C-3.4 -1.8 -1.9 -3.2 0 -3.2 C1.9 -3.2 3.4 -1.8 3.4 0.6 L3.4 9" fill={color} fillOpacity={0.3} />
    </g>
  );
}

const EVENT_ICONS: Readonly<Record<MapIconKind, (props: IconProps) => React.ReactElement>> = {
  monster: MonsterIcon,
  rest: CampfireIcon,
  special: QuestionIcon,
  entry: EntryIcon,
};

/**
 * 등급별 보스 전용 아이콘이다.
 *
 * 보스마다 실루엣이 달라야 어느 던전에 들어와 있는지 지도만 보고 안다. 콘텐츠의
 * 보스 이름과 성격을 따랐다.
 */
function BossIcon({ grade, size, color }: IconProps & { grade: Grade }) {
  const s = size / 16;
  const common = { stroke: color, fill: "none", strokeWidth: 1.7, strokeLinejoin: "round" as const };

  if (grade === "C") {
    // 동굴의 수문장. 웅크린 돌덩이와 두 눈.
    return (
      <g transform={`scale(${s})`} {...common}>
        <path d="M-9 8 L-6 -4 L0 -8 L6 -4 L9 8 Z" fill={color} fillOpacity={0.2} />
        <circle cx={-3} cy={0} r={1.5} fill={color} stroke="none" />
        <circle cx={3} cy={0} r={1.5} fill={color} stroke="none" />
        <path d="M-4 4 L4 4" strokeLinecap="round" />
      </g>
    );
  }
  if (grade === "B") {
    // 검은 뿔의 사냥꾼. 크게 휘어진 두 뿔.
    return (
      <g transform={`scale(${s})`} {...common}>
        <path d="M-10 -8 C-6 -6 -5 -2 -5 1" strokeLinecap="round" />
        <path d="M10 -8 C6 -6 5 -2 5 1" strokeLinecap="round" />
        <path d="M-5 1 C-5 -2 -2.6 -4 0 -4 C2.6 -4 5 -2 5 1 C5 5.6 2.6 8 0 8 C-2.6 8 -5 5.6 -5 1 Z" fill={color} fillOpacity={0.2} />
        <circle cx={-2} cy={1} r={1.3} fill={color} stroke="none" />
        <circle cx={2} cy={1} r={1.3} fill={color} stroke="none" />
      </g>
    );
  }
  if (grade === "A") {
    // 심연의 감시자. 하나의 큰 눈.
    return (
      <g transform={`scale(${s})`} {...common}>
        <path d="M-10 0 C-6 -6.4 6 -6.4 10 0 C6 6.4 -6 6.4 -10 0 Z" fill={color} fillOpacity={0.16} />
        <circle cx={0} cy={0} r={3.6} />
        <circle cx={0} cy={0} r={1.6} fill={color} stroke="none" />
      </g>
    );
  }
  // 무너뜨리는 군주. 왕관과 무너지는 기둥.
  return (
    <g transform={`scale(${s})`} {...common}>
      <path d="M-9 -2 L-9 -9 L-4.5 -5 L0 -10 L4.5 -5 L9 -9 L9 -2 Z" fill={color} fillOpacity={0.25} />
      <path d="M-9 -2 L9 -2" strokeLinecap="round" />
      <path d="M-5 2 L-6 9" strokeLinecap="round" />
      <path d="M0 2 L0 9" strokeLinecap="round" />
      <path d="M5 2 L6 9" strokeLinecap="round" />
    </g>
  );
}

export interface MapNodeIconProps {
  /** 보스방이면 `boss`, 그 밖에는 사건 분류 또는 입구. */
  kind: MapIconKind | "boss";
  /** 보스방일 때 어느 보스인지. 등급마다 실루엣이 다르다. */
  grade?: Grade;
  size?: number;
  color?: string;
}

export function MapNodeIcon({
  kind,
  grade = "C",
  size = 18,
  color = "var(--color-parchment)",
}: MapNodeIconProps) {
  if (kind === "boss") return <BossIcon grade={grade} size={size} color={color} />;
  const Icon = EVENT_ICONS[kind];
  return <Icon size={size} color={color} />;
}
