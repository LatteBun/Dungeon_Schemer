/**
 * U5 진행 기록.
 *
 * 현재 원정의 시간 순 기록이고 네 필터를 제공한다. 한 항목이 여러 필터에
 * 걸리므로 필터별로 목록을 복제하지 않는다. 복제하면 같은 사건이 두 벌로
 * 남아 한쪽만 고쳐진다.
 */

export const U5_LOG_FILTERS = ["all", "clue", "battle", "ecology"] as const;

export type U5LogFilter = (typeof U5_LOG_FILTERS)[number];

export const U5_LOG_FILTER_LABEL: Readonly<Record<U5LogFilter, string>> = {
  all: "전체",
  clue: "단서",
  battle: "전투",
  ecology: "생태",
};

export interface U5LogEntry {
  /** 시간 순. 1부터 센다. */
  order: number;
  /** 이 항목이 걸리는 필터. `all` 은 여기 넣지 않는다. */
  tags: readonly Exclude<U5LogFilter, "all">[];
  label: string;
  detail: string;
}

/**
 * `전체` 는 모든 항목을 시간 순으로 합친다. 나머지는 그 태그를 가진 것만
 * 고르되 시간 순서를 잃지 않는다.
 */
export function filterLog(
  entries: readonly U5LogEntry[],
  filter: U5LogFilter,
): readonly U5LogEntry[] {
  const picked = filter === "all"
    ? [...entries]
    : entries.filter((entry) => entry.tags.includes(filter));

  return picked.sort((left, right) => left.order - right.order);
}

/**
 * `생태` 탭의 두 구역.
 *
 * 확인된 생태와 관찰 단서를 같은 목록에 섞지 않는다. 단서가 규칙을 시사해도
 * 화면이 대신 결론 내리면 안 된다. 플레이어가 규칙과 단서로 판단할 몫이다.
 */
export interface U5EcologyView {
  /** E2 가 위험도에 따라 공개한 활성 규칙. 단정형으로 적는다. */
  disclosedRules: readonly string[];
  /** 사건에서 본 사실. 그대로 적는다. 규칙 문장으로 승격하지 않는다. */
  observedClues: readonly string[];
}
