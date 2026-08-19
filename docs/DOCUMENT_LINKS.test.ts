import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 문서 사이 상대 링크 감시.
 *
 * 개편은 문서를 나누고 이름을 바꾸고 옮긴다. 그때마다 그 문서를 가리키던
 * 링크가 조용히 끊어진다. `D2`가 `PARTY_AND_TRUST.md`를 둘로 나눌 때
 * 일곱 곳이 한꺼번에 끊어졌고, 사람이 눈으로 찾아야 했다. `D4`~`D6`이
 * 남은 문서를 옮길 때 같은 일이 반복되므로 여기서 고정한다.
 *
 * 외부 링크는 검사하지 않는다. 네트워크에 기대는 검사는 오프라인에서
 * 빨간불이 되고, 그러면 아무도 보지 않게 된다.
 *
 * `superpowers/`도 검사하지 않는다. 그때 무엇을 왜 결정했는지의 기록이라
 * 지금 경로로 고치면 기록이 아니라 위조가 된다. 실제로 그 문서들은 저장소
 * 루트 기준 경로로 쓰여 있어 처음부터 끊어져 있다.
 *
 * 위반은 모아서 한 번에 보여준다. 링크가 여럿 끊어지는 것이 이 검사의
 * 정상적인 실패 모습이기 때문이다.
 */

const DOCS_ROOT = import.meta.dirname;

/** 원본 그대로 보존하는 기록. 링크를 고치지 않으므로 검사하지 않는다. */
const PRESERVED_DIRECTORIES: readonly string[] = ["superpowers"];

/** `[보이는 글](경로)` 에서 경로만 꺼낸다. 이미지 `!`도 같은 형태다. */
const LINK_PATTERN = /\[[^\]]*\]\(([^)]+)\)/g;

function markdownFiles(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (PRESERVED_DIRECTORIES.includes(entry.name)) {
        continue;
      }
      found.push(...markdownFiles(path));
    } else if (entry.name.endsWith(".md")) {
      found.push(path);
    }
  }

  return found;
}

/** 검사 대상이 아닌 링크. 외부 주소와 문서 안 앵커만 건너뛴다. */
function isExternal(target: string): boolean {
  return (
    target.startsWith("http://") ||
    target.startsWith("https://") ||
    target.startsWith("mailto:") ||
    target.startsWith("#")
  );
}

describe("문서 링크", () => {
  it("상대 링크가 실제 파일을 가리킨다", () => {
    const broken: string[] = [];

    for (const file of markdownFiles(DOCS_ROOT)) {
      const text = readFileSync(file, "utf8");

      for (const [, rawTarget] of text.matchAll(LINK_PATTERN)) {
        if (isExternal(rawTarget)) {
          continue;
        }

        // `문서.md#절` 처럼 앵커가 붙어 있어도 파일 자체는 존재해야 한다.
        // 공백이 든 파일명은 `%20`으로 쓰이므로 되돌린 뒤 확인한다.
        const path = decodeURIComponent(rawTarget.split("#")[0]);
        if (path === "") {
          continue;
        }

        if (!existsSync(resolve(dirname(file), path))) {
          broken.push(`${relative(DOCS_ROOT, file)} → ${rawTarget}`);
        }
      }
    }

    expect(broken, "끊어진 링크").toEqual([]);
  });
});
