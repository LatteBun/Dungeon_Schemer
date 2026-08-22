import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 배정표 무결성 검사.
 *
 * 배정표의 규약은 각 문서의 「관리 원칙」에 산문으로 적혀 있다. 사람이
 * 상태를 ✅로 바꾸면서 다른 행의 `선행`에서 그 ID를 지우는 일을 빠뜨리면
 * 표가 조용히 틀어지고, 아무도 시작 가능한 작업을 표만 보고 찾을 수
 * 없게 된다. 그 규약을 여기서 실행 가능한 형태로 고정한다.
 *
 * 배정표는 개편마다 새로 만들지만 규약은 같으므로 검사를 여기 모아 두고
 * 문서별 테스트 파일이 경로만 넘긴다.
 *
 * 위반은 모아서 한 번에 보여준다. 루프 안에서 바로 단정하면 위반이
 * 여럿일 때 첫 번째만 드러나 여러 번 고쳐야 한다.
 */

/**
 * D6 → D6·D7처럼 그대로 뒤에 번호를 붙이는 분할과, F2 → F2-1·F2-2처럼
 * 이어서 진행하는 하위 단계를 나누는 분할을 모두 담는다.
 */
const ID_PATTERN = /^[A-Z]\d+(?:-\d+)?$/;
const MERMAID_ID_PATTERN = /^[A-Z]\d+(?:[-_]\d+)?$/;
const STATUSES = ["⬜", "🟡", "✅"] as const;
type Status = (typeof STATUSES)[number];
const DONE: Status = "✅";
const WAITING: Status = "⬜";

interface TaskRow {
  id: string;
  area: string;
  doneWhen: string;
  /** 아직 끝나지 않은 선행만 담는다. */
  blockedBy: string[];
  /** 완료 여부와 무관한 전체 구조. 그래프의 나가는 간선과 같아야 한다. */
  unblocks: string[];
  owner: string;
  status: Status;
}

/** `**F2 C1 E1**` 또는 `—` 형태의 칸을 ID 목록으로 바꾼다. */
function parseIdList(cell: string): string[] {
  const bare = cell.replaceAll("*", "").trim();
  if (bare === "" || bare === "—") return [];
  return bare.split(/\s+/);
}

/**
 * 7열 배정표의 행만 골라낸다. 문서에는 계층 설명 같은 2열·3열 표도
 * 있으므로 열 개수와 첫 칸의 ID 모양으로 걸러낸다.
 */
function parseTaskRows(markdown: string): TaskRow[] {
  const rows: TaskRow[] = [];

  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;

    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 7) continue;
    if (!ID_PATTERN.test(cells[0])) continue;

    rows.push({
      id: cells[0],
      area: cells[1],
      doneWhen: cells[2],
      blockedBy: parseIdList(cells[3]),
      unblocks: parseIdList(cells[4]),
      owner: cells[5],
      status: cells[6] as Status,
    });
  }

  return rows;
}

interface Graph {
  nodes: string[];
  /** `from` → `to` 목록 */
  edges: Map<string, string[]>;
}

/** Mermaid 식별자의 밑줄 분할 표기를 배정표 ID 표기로 맞춘다. */
function normalizeMermaidTaskId(id: string): string {
  return id.replaceAll("_", "-");
}

/**
 * mermaid 블록에서 노드 선언과 간선을 읽는다.
 * 노드는 `F1["F1 도메인 타입"]`, 간선은 `F1 --> F2 & C1` 형태다.
 */
function parseGraph(markdown: string): Graph {
  const block = /```mermaid\n([\s\S]*?)```/.exec(markdown);
  if (block === null) {
    throw new Error("문서에서 mermaid 블록을 찾지 못했다.");
  }

  const nodes: string[] = [];
  const edges = new Map<string, string[]>();

  const idsIn = (side: string): string[] =>
    side
      .split("&")
      .map((part) => part.trim())
      .filter((part) => MERMAID_ID_PATTERN.test(part))
      .map(normalizeMermaidTaskId);

  for (const line of block[1].split("\n")) {
    const trimmed = line.trim();

    // subgraph L0["L0 기반"] 의 L0 은 노드가 아니다.
    if (!trimmed.startsWith("subgraph")) {
      const declaration = new RegExp(
        `^(${MERMAID_ID_PATTERN.source.slice(1, -1)})\\["`,
      ).exec(trimmed);
      if (declaration !== null) {
        nodes.push(normalizeMermaidTaskId(declaration[1]));
        continue;
      }
    }

    const edge = /^(.+?)\s*-->\s*(.+)$/.exec(trimmed);
    if (edge === null) continue;

    for (const from of idsIn(edge[1])) {
      const targets = edges.get(from) ?? [];
      targets.push(...idsIn(edge[2]));
      edges.set(from, targets);
    }
  }

  return { nodes, edges };
}

function sorted(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort();
}

/**
 * 한 배정표 문서에 대한 무결성 검사 전체를 등록한다.
 *
 * @param label 실패 메시지에서 어느 배정표인지 알아보기 위한 이름
 * @param docPath 배정표 마크다운의 절대 경로
 */
export function describeWorkAssignment(label: string, docPath: string): void {
  // Windows에서 core.autocrlf가 CRLF로 체크아웃해도 검사가 동작하도록 통일한다.
  const doc = readFileSync(docPath, "utf8").replace(/\r\n/g, "\n");

  const rows = parseTaskRows(doc);
  const graph = parseGraph(doc);

  const statusById = new Map(rows.map((row) => [row.id, row.status]));

  /** 그래프에서 이 작업이 풀어 주는 작업들. */
  const outgoing = (id: string): string[] => graph.edges.get(id) ?? [];

  /** 그래프에서 이 작업을 막는 작업들. */
  const incoming = (id: string): string[] =>
    [...graph.edges]
      .filter(([, targets]) => targets.includes(id))
      .map(([from]) => from);

  describe(`${label} · 배정표 파싱`, () => {
    it("배정표 행과 그래프를 찾는다", () => {
      expect(rows.length, "배정표 행").toBeGreaterThan(0);
      expect(graph.nodes.length, "그래프 노드").toBeGreaterThan(0);
      expect(graph.edges.size, "그래프 간선").toBeGreaterThan(0);
    });

    it("ID가 중복되지 않는다", () => {
      const duplicated = (ids: string[]): string[] =>
        ids.filter((id, index) => ids.indexOf(id) !== index);

      expect(duplicated(rows.map((row) => row.id)), "표의 중복 ID").toEqual([]);
      expect(duplicated(graph.nodes), "그래프의 중복 노드").toEqual([]);
    });
  });

  describe(`${label} · 행의 내용`, () => {
    it("모든 행에 구현 영역과 완료 기준이 있다", () => {
      const missing = rows
        .filter((row) => row.area === "" || row.doneWhen === "")
        .map((row) => row.id);
      expect(missing, "구현 영역 또는 완료 기준이 빈 행").toEqual([]);
    });

    it("상태는 정해진 셋 중 하나다", () => {
      const wrong = rows
        .filter((row) => !STATUSES.includes(row.status))
        .map((row) => `${row.id}: ${row.status}`);
      expect(wrong, "알 수 없는 상태").toEqual([]);
    });

    it("완료된 행에는 담당자가 있다", () => {
      const anonymous = rows
        .filter((row) => row.status === DONE && row.owner === "")
        .map((row) => row.id);
      expect(anonymous, "담당자 없이 완료된 행").toEqual([]);
    });
  });

  describe(`${label} · 표와 그래프가 같은 구조를 담는다`, () => {
    it("표의 ID와 그래프의 노드가 일치한다", () => {
      expect(sorted(graph.nodes)).toEqual(sorted(rows.map((row) => row.id)));
    });

    it("존재하지 않는 ID를 가리키지 않는다", () => {
      const known = new Set(rows.map((row) => row.id));
      const unknown: string[] = [];

      for (const row of rows) {
        for (const id of row.blockedBy) {
          if (!known.has(id)) unknown.push(`${row.id} 의 선행 ${id}`);
        }
        for (const id of row.unblocks) {
          if (!known.has(id)) unknown.push(`${row.id} 의 풀리는 것 ${id}`);
        }
      }
      for (const [from, targets] of graph.edges) {
        if (!known.has(from)) unknown.push(`그래프의 ${from}`);
        for (const to of targets) {
          if (!known.has(to)) unknown.push(`그래프의 ${from} --> ${to}`);
        }
      }

      expect(unknown, "표에 없는 ID를 가리키는 곳").toEqual([]);
    });

    it("`풀리는 것`이 그래프의 나가는 간선과 같다", () => {
      const mismatched = rows
        .filter(
          (row) =>
            sorted(row.unblocks).join(" ") !==
            sorted(outgoing(row.id)).join(" "),
        )
        .map(
          (row) =>
            `${row.id}: 표 [${sorted(row.unblocks).join(" ")}] ≠ 그래프 [${sorted(outgoing(row.id)).join(" ")}]`,
        );
      expect(mismatched, "표와 그래프가 어긋난 행").toEqual([]);
    });
  });

  describe(`${label} · 선행 규약`, () => {
    it("`선행`이 그래프의 들어오는 간선과 어긋나지 않는다", () => {
      const stray: string[] = [];
      for (const row of rows) {
        const sources = new Set(incoming(row.id));
        for (const id of row.blockedBy) {
          if (!sources.has(id)) {
            stray.push(`${row.id} 의 선행 ${id} 는 그래프에 없는 의존이다`);
          }
        }
      }
      expect(stray, "그래프에 없는 선행").toEqual([]);
    });

    it("완료된 ID가 `선행`에 남아 있지 않다", () => {
      const stale: string[] = [];
      for (const row of rows) {
        for (const id of row.blockedBy) {
          if (statusById.get(id) === DONE) {
            stale.push(`${row.id} 의 선행에서 완료된 ${id} 를 지워야 한다`);
          }
        }
      }
      expect(stale, "남아 있는 완료 선행").toEqual([]);
    });

    it("`선행`이 아직 안 끝난 선행을 빠뜨리지 않는다", () => {
      const missing: string[] = [];
      for (const row of rows) {
        const listed = new Set(row.blockedBy);
        for (const id of incoming(row.id)) {
          if (statusById.get(id) !== DONE && !listed.has(id)) {
            missing.push(`${row.id} 의 선행에 아직 안 끝난 ${id} 가 없다`);
          }
        }
      }
      expect(missing, "빠진 선행").toEqual([]);
    });

    it("완료된 작업에는 남은 선행이 없다", () => {
      const blocked = rows
        .filter((row) => row.status === DONE && row.blockedBy.length > 0)
        .map((row) => `${row.id}: ${row.blockedBy.join(" ")}`);
      expect(blocked, "완료됐는데 선행이 남은 행").toEqual([]);
    });
  });

  describe(`${label} · 의존성 구조`, () => {
    it("순환이 없다", () => {
      const visiting = new Set<string>();
      const visited = new Set<string>();
      const cycles: string[] = [];

      const walk = (id: string, path: string[]): void => {
        if (visiting.has(id)) {
          cycles.push([...path, id].join(" → "));
          return;
        }
        if (visited.has(id)) return;

        visiting.add(id);
        for (const next of outgoing(id)) {
          walk(next, [...path, id]);
        }
        visiting.delete(id);
        visited.add(id);
      };

      for (const row of rows) {
        walk(row.id, []);
      }
      expect(cycles, "순환").toEqual([]);
    });

    it("자기 자신을 가리키지 않는다", () => {
      const selfish = rows
        .filter((row) => outgoing(row.id).includes(row.id))
        .map((row) => row.id);
      expect(selfish, "자기 자신을 가리키는 행").toEqual([]);
    });

    it("남은 작업이 있으면 시작 가능한 작업도 있다", () => {
      const unfinished = rows.filter((row) => row.status !== DONE);
      if (unfinished.length === 0) return;

      const ready = rows
        .filter((row) => row.status === WAITING && row.blockedBy.length === 0)
        .map((row) => row.id);
      expect(ready.length, "시작 가능한 작업 수").toBeGreaterThan(0);
    });
  });
}
