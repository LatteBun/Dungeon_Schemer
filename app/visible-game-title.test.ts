import { describe, expect, it } from "vitest";

import { metadata } from "./layout";
import manifest from "./manifest";

describe("사용자 노출 게임 제목", () => {
  it("브라우저와 설치형 웹 앱에 새 제목을 제공한다", () => {
    expect(metadata.title).toBe("용사님, 이쪽입니다");
    expect(metadata.description).toBe("용사님, 이쪽입니다 프로토타입");
    expect(metadata.appleWebApp).toMatchObject({ title: "용사님, 이쪽입니다" });
    expect(manifest()).toMatchObject({
      name: "용사님, 이쪽입니다",
      short_name: "용사님, 이쪽입니다",
    });
  });
});
