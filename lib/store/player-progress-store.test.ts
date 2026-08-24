import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PLAYER_PROGRESS_STORAGE_KEY,
} from "@/lib/achievements/player-progress-storage";
import { PlayerProgressProvider } from "@/components/game/PlayerProgressProvider";
import { createPlayerProgressStore } from "./player-progress-store";
import type { CompletedCampaignRecord } from "@/lib/achievements/player-progress";

function memoryStorage(initial?: Record<string, string>) {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    value: (key: string) => values.get(key),
  };
}

const completed: CompletedCampaignRecord = {
  runId: "run-1",
  ending: "completed",
  finalRank: "S",
  totalExpeditions: 15,
  clearedExpeditions: 15,
  wipedExpeditions: 0,
  deaths: 0,
  advices: 100,
};

describe("플레이어 업적 Store", () => {
  it("hydrate 뒤 완료 캠페인을 저장하고 상태를 갱신한다", () => {
    const storage = memoryStorage();
    const store = createPlayerProgressStore();

    store.getState().hydrate(storage);
    store.getState().record({ ...completed, runId: "stored" }, "2026-08-24T10:00:00.000Z");

    expect(store.getState().status).toBe("ready");
    expect(store.getState().progress.totals.completedCampaigns).toBe(1);
    expect(storage.value(PLAYER_PROGRESS_STORAGE_KEY)).toContain('"recordedRunIds":["stored"]');
  });

  it("쓰기 실패 뒤에도 메모리 업적은 남는다", () => {
    const storage = {
      ...memoryStorage(),
      setItem: () => { throw new Error("storage write blocked"); },
    };
    const store = createPlayerProgressStore();

    store.getState().hydrate(storage);
    store.getState().record(completed, "2026-08-24T10:00:00.000Z");

    expect(store.getState().status).toBe("unavailable");
    expect(store.getState().progress.totals.completedCampaigns).toBe(1);
  });

  it("읽기 실패는 이미 누적한 메모리 업적을 지우지 않는다", () => {
    const store = createPlayerProgressStore();

    store.getState().hydrate(memoryStorage());
    store.getState().record(completed, "2026-08-24T10:00:00.000Z");
    store.getState().hydrate({
      ...memoryStorage(),
      getItem: () => { throw new Error("storage read blocked"); },
    });

    expect(store.getState().status).toBe("unavailable");
    expect(store.getState().progress.totals.completedCampaigns).toBe(1);
  });

  it("미래 버전은 메모리에서만 누적하고 저장값을 덮어쓰지 않는다", () => {
    const futureRaw = JSON.stringify({ version: 2 });
    const storage = memoryStorage({ [PLAYER_PROGRESS_STORAGE_KEY]: futureRaw });
    const store = createPlayerProgressStore();

    store.getState().hydrate(storage);
    store.getState().record(completed, "2026-08-24T10:00:00.000Z");

    expect(store.getState().status).toBe("unavailable");
    expect(store.getState().progress.totals.completedCampaigns).toBe(1);
    expect(storage.value(PLAYER_PROGRESS_STORAGE_KEY)).toBe(futureRaw);
  });

  it("미래 버전 기록도 명시적 초기화로 두 저장 키를 지운다", () => {
    const storage = memoryStorage({
      [PLAYER_PROGRESS_STORAGE_KEY]: JSON.stringify({ version: 2 }),
      "dungeon-schemer.player-progress.corrupt-backup": "{broken",
    });
    const store = createPlayerProgressStore();

    store.getState().hydrate(storage);
    store.getState().clear();

    expect(storage.value(PLAYER_PROGRESS_STORAGE_KEY)).toBeUndefined();
    expect(storage.value("dungeon-schemer.player-progress.corrupt-backup")).toBeUndefined();
    expect(store.getState().progress.totals.completedCampaigns).toBe(0);
    expect(store.getState().status).toBe("ready");
  });

  it("초기화 저장소 제거가 실패해도 메모리는 빈 기록으로 돌아간다", () => {
    const storage = {
      ...memoryStorage(),
      removeItem: () => { throw new Error("storage remove blocked"); },
    };
    const store = createPlayerProgressStore();

    store.getState().hydrate(storage);
    store.getState().record(completed, "2026-08-24T10:00:00.000Z");
    store.getState().clear();

    expect(store.getState().progress.totals.completedCampaigns).toBe(0);
    expect(store.getState().status).toBe("unavailable");
  });

  it("Store 팩토리는 인스턴스 사이에 메모리 기록을 공유하지 않는다", () => {
    const first = createPlayerProgressStore();
    const second = createPlayerProgressStore();

    first.getState().hydrate(memoryStorage());
    first.getState().record(completed, "2026-08-24T10:00:00.000Z");

    expect(first).not.toBe(second);
    expect(second.getState().progress.totals.completedCampaigns).toBe(0);
    expect(second.getState().status).toBe("loading");
  });

  it("Provider는 자식 주위에 DOM wrapper를 추가하지 않는다", () => {
    const html = renderToStaticMarkup(createElement(
      PlayerProgressProvider,
      null,
      createElement("main", { "data-player-progress-child": "true" }),
    ));

    expect(html).toBe('<main data-player-progress-child="true"></main>');
  });
});
