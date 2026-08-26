import { CLASSES } from "@/lib/content/classes";

/**
 * 파티가 서는 차례.
 *
 * 게시판·지도·진행 카드, 입장 장면, 전투 대열이 모두 이 차례를 쓴다. 예전에는
 * 카드가 사람마다 섞은 자리를, 전투는 규칙 배열을 그대로 썼다. 재 보니 공고
 * 300건 중 229건(76%)에서 두 차례가 어긋났고, 같은 파티를 화면마다 다르게 읽게
 * 됐다.
 *
 * 차례는 `hitWeight` 오름차순이다. 새 기준을 지어내지 않는다 — `hitWeight` 는
 * 이미 「적이 누구를 노리는가」를 정하는 값이고, 전사가 3 으로 가장 크며 그
 * 설명이 문자 그대로 「앞에서 버티며」다. 게임이 이미 누가 앞에 서는지 알고
 * 있으므로 그것을 그대로 쓴다.
 *
 * 오름차순인 이유는 화면 배치다. 전투 무대는 파티가 왼쪽, 적이 오른쪽이므로
 * **배열의 마지막이 화면 오른쪽 끝, 곧 적에게 가장 가까운 자리**다. 가장 잘
 * 맞는 사람이 거기 서야 한다. 그래서 성직자 · 도적 · 전사 순으로 늘어선다.
 *
 * 규칙 배열은 이 파일이 건드리지 않는다. 전투는 파티 배열 순서대로 행동하고
 * 표적 가중치도 그 배열을 타므로, 규칙에서 순서를 바꾸면 같은 시드의 전투
 * 결과가 달라진다. 여기서 정하는 것은 그리는 차례뿐이다.
 */

interface FormationRank {
  readonly hitWeight: number;
  readonly maxHp: number;
  readonly listed: number;
}

const RANK_BY_CLASS_ID: ReadonlyMap<string, FormationRank> = new Map(
  CLASSES.map((classDef, listed) => [
    String(classDef.id),
    { hitWeight: classDef.hitWeight, maxHp: classDef.maxHp, listed },
  ]),
);

/*
 * 모르는 직업은 맨 앞(가장 뒤쪽 자리)에 둔다.
 *
 * 콘텐츠가 늘어나는 중에 직업이 하나 빠져도 화면이 무너지지 않아야 한다. 자리를
 * 잃는 것보다 어색한 자리에 서는 편이 낫다.
 */
const UNKNOWN: FormationRank = { hitWeight: -1, maxHp: -1, listed: -1 };

function rankOf(classId: string): FormationRank {
  return RANK_BY_CLASS_ID.get(classId) ?? UNKNOWN;
}

/**
 * 두 사람 중 누가 더 뒤에 서는가. 음수면 왼쪽(적에게서 먼 쪽)이다.
 *
 * `hitWeight` 가 같은 직업이 셋(궁수·성직자·마법사) 있어서 그것만으로는 차례가
 * 정해지지 않는다. `maxHp` 오름차순으로 깬다 — 맞았을 때 가장 못 버티는 사람이
 * 가장 뒤에 선다는 뜻이라 앞뒤를 가르는 기준과 결이 같다. 그래도 같으면 콘텐츠에
 * 적힌 차례를 따라, 같은 파티가 언제나 같은 모습으로 서게 한다.
 */
function compareFormation(left: string, right: string): number {
  const a = rankOf(left);
  const b = rankOf(right);
  if (a.hitWeight !== b.hitWeight) return a.hitWeight - b.hitWeight;
  if (a.maxHp !== b.maxHp) return a.maxHp - b.maxHp;
  return a.listed - b.listed;
}

export function inFormationOrder<T>(
  members: readonly T[],
  classIdOf: (member: T) => string,
): readonly T[] {
  return [...members].sort((left, right) => compareFormation(classIdOf(left), classIdOf(right)));
}

/** 직업이 아니라 이미 `hitWeight` 를 들고 있는 전투 참가자용이다. */
export function inFormationOrderByClassId<T extends { readonly classId: string }>(
  members: readonly T[],
): readonly T[] {
  return inFormationOrder(members, (member) => member.classId);
}
