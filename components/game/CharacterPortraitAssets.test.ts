import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLASSES } from "@/lib/content/classes";
import type { CharacterId } from "@/lib/domain";
import {
  PORTRAIT_VARIANTS,
  portraitSrcForCharacter,
  portraitVariantForCharacterId,
} from "./character-labels";

/**
 * 초상은 직업마다 여섯 장, 생사 두 벌이 모두 있어야 한다.
 *
 * 한 벌이라도 빠지면 그 변형을 받은 캐릭터가 죽는 순간 그림이 사라진다. 어떤
 * 캐릭터가 어떤 변형을 받는지는 식별자 해시가 정하므로, 빠진 자리는 특정 시드
 * 에서만 드러난다 — 사람이 눈으로 찾기 어려운 종류다.
 */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("캐릭터 초상 자산", () => {
  it("직업마다 여섯 변형이 살아 있는 것과 죽은 것 모두 있다", () => {
    const missing: string[] = [];

    for (const klass of CLASSES) {
      for (const variant of PORTRAIT_VARIANTS) {
        for (const life of ["live", "dead"]) {
          const path = join("public", "assets", "characters", life, klass.id, `${klass.id}_${variant}.png`);
          if (!existsSync(path)) missing.push(path);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("모두 실제 PNG 파일이다", () => {
    for (const klass of CLASSES) {
      for (const variant of PORTRAIT_VARIANTS) {
        const path = join("public", "assets", "characters", "live", klass.id, `${klass.id}_${variant}.png`);
        const head = readFileSync(path).subarray(0, PNG_SIGNATURE.length);
        expect(head.equals(PNG_SIGNATURE), path).toBe(true);
      }
    }
  });

  it("같은 캐릭터는 늘 같은 변형을 받는다", () => {
    // 렌더 시점이나 생사와 무관해야 카드와 전투 장면이 같은 얼굴을 보인다.
    const id = "character-017" as CharacterId;
    expect(portraitVariantForCharacterId(id)).toBe(portraitVariantForCharacterId(id));
  });

  it("여섯 변형이 모두 쓰인다", () => {
    /*
     * 해시가 한쪽으로 쏠리면 넣어 둔 그림이 화면에 나오지 않는다. 서른 명 풀을
     * 쓰므로 그만큼을 훑어 여섯이 다 나오는지 본다.
     */
    const seen = new Set<string>();
    for (let index = 1; index <= 30; index += 1) {
      seen.add(portraitVariantForCharacterId(`character-${String(index).padStart(3, "0")}` as CharacterId));
    }

    expect([...seen].sort()).toEqual([...PORTRAIT_VARIANTS].sort());
  });

  it("고른 변형이 실제 파일을 가리킨다", () => {
    for (let index = 1; index <= 30; index += 1) {
      const id = `character-${String(index).padStart(3, "0")}` as CharacterId;
      for (const klass of CLASSES) {
        for (const alive of [true, false]) {
          const src = portraitSrcForCharacter({ id, classId: klass.id, alive });
          expect(existsSync(join("public", src.replace(/^\//, ""))), src).toBe(true);
        }
      }
    }
  });
});
